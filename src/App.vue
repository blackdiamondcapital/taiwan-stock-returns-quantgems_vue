<script setup>
import { onMounted, ref, reactive } from 'vue'
import { fetchRankings, fetchStatistics } from './services/api'
import HeaderNav from './components/HeaderNav.vue'
import FilterPanel from './components/FilterPanel.vue'
import StatsGrid from './components/StatsGrid.vue'
import Heatmap from './components/Heatmap.vue'
import RankingTable from './components/RankingTable.vue'
import Comparison from './components/Comparison.vue'
import Alerts from './components/Alerts.vue'
import Analysis from './components/Analysis.vue'

// Shared reactive state
const currentData = ref([])
const currentSort = ref({ column: 'return', direction: 'desc' })
const heatmapRows = ref([])
const tableRows = ref([])
const statsRef = ref(null)
let apiAsOfDate = null
const apiState = ref('idle')
const apiText = ref('等待載入')
const currentView = ref('overview')
const selectedDateRef = ref('')
const periodRef = ref('daily')
const filtersRef = reactive({ market: 'all', industry: 'all', returnRange: 'all', volumeThreshold: 0 })
let hasAttemptedAutoPeriodFallback = false
let allowDailyAutoFallback = false

  const qs = (sel, root = document) => root.querySelector(sel)
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel))

  const setVisibility = (selector, display) => {
    // deprecated: now using v-show for view switches
  }

  function onChangeSort(newSort) {
    currentSort.value = newSort
    const rows = [...tableRows.value]
    sortData(rows)
    tableRows.value = rows
  }

  function setApiStatus(state, message) {
    const dot = qs('#apiStatusDot')
    const text = qs('#apiStatusText')
    if (!dot || !text) return
    dot.className = 'status-dot'
    dot.classList.add(state === 'loading' ? 'loading' : state === 'connected' ? 'connected' : 'error')
    text.textContent = message || (state === 'connected' ? '已連線' : state === 'loading' ? '載入中…' : '連線錯誤')
    apiState.value = state
    apiText.value = message || (state === 'connected' ? '已連線' : state === 'loading' ? '載入中…' : '連線失敗')
  }

  // updateAsOfBadge deprecated; HeaderNav shows asOf via props

  function getSelectedDate() {
    if (selectedDateRef.value) return selectedDateRef.value
    const el = qs('#datePicker')
    return el && el.value ? el.value : ''
  }
  function getSelectedPeriod() {
    return periodRef.value || 'daily'
  }
  function getMainFilters() {
    return { ...filtersRef, date: getSelectedDate() }
  }

  function sortData(data) {
    data.sort((a, b) => {
      const aVal = a[currentSort.value.column]
      const bVal = b[currentSort.value.column]
      if (typeof aVal === 'string') {
        return currentSort.value.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return currentSort.value.direction === 'asc' ? aVal - bVal : bVal - aVal
    })
    data.forEach((item, i) => (item.rank = i + 1))
  }

  function getReturnCategory(returnRate) {
    if (returnRate > 5) return 'positive-high'
    if (returnRate >= 1) return 'positive-mid'
    if (returnRate <= -5) return 'negative-high'
    if (returnRate <= -1) return 'negative-mid'
    return 'neutral'
  }

  // Heatmap is handled by Heatmap.vue component

  // Ranking table rendered by component via props

  async function loadAndRender() {
    const period = getSelectedPeriod()
    const filters = getMainFilters()
    setApiStatus('loading')
    const formatNumber = (value, digits = 0) => {
      if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
      return Number(value).toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    }
    const formatPercent = (value, digits = 1) => {
      if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
      return `${Number(value).toFixed(digits)}%`
    }
    const formatRatio = (value, digits = 2, suffix = 'x') => {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return '--'
      return `${Number(value).toFixed(digits)}${suffix}`
    }

    const [list, statsResp] = await Promise.all([
      fetchRankings({ period, ...filters, limit: 200 }),
      fetchStatistics({ period, market: filters.market, date: filters.date })
    ])
    if (
      period === 'daily'
      && allowDailyAutoFallback
      && !hasAttemptedAutoPeriodFallback
      && list.length > 0
      && list.every((item) => Number(item.return_rate) === 0)
    ) {
      hasAttemptedAutoPeriodFallback = true
      periodRef.value = 'monthly'
      await loadAndRender()
      return
    }
    hasAttemptedAutoPeriodFallback = false
    // map to currentData shape
    currentData.value = list.map((item, idx) => ({
      rank: idx + 1,
      symbol: item.symbol,
      name: item.name || item.symbol,
      short_name: item.short_name || item.name || '',
      return: Number(item.return_rate) || 0,
      price: Number(item.current_price) || 0,
      priorClose: Number(item.prior_close) || 0,
      change: Number(item.price_change) || 0,
      volume: Number(item.volume) || 0,
      cumulative: Number(item.cumulative_return ?? item.return_rate) || 0,
      market: item.market || 'all',
      industry: item.industry || 'all',
      volatility: parseFloat(item.volatility) || 0.5,
    }))
    // update heatmap rows for component
    const rowsForHeatmap = currentData.value.map((r) => ({ symbol: r.symbol, name: r.name, return: r.return }))
    heatmapRows.value = rowsForHeatmap
    const sorted = [...currentData.value]
    sortData(sorted)
    tableRows.value = sorted

    // statistics
    if (statsResp && statsResp.data) {
      const s = statsResp.data
      statsRef.value = s
      apiAsOfDate = statsResp.asOfDate || null
      const totalCount = Number(s.totalCount || 0)
      const safeTotal = totalCount > 0 ? totalCount : 1
      // key cards
      const el = (id) => qs('#' + id)
      if (el('risingStocks')) el('risingStocks').textContent = formatNumber(s.risingStocks)
      if (el('topStock')) el('topStock').textContent = s.topStock || 'N/A'
      if (el('topReturnSubinfo')) {
        el('topReturnSubinfo').innerHTML = `
          <span><span class="dot" style="background:#00d4ff"></span>報酬：${formatPercent(s.maxReturn, 2)}</span>
          <span class="muted">成交量：${formatNumber(s.topVolume)}</span>
          <span class="muted">樣本：${formatNumber(s.totalCount)}</span>
        `
      }
      if (el('topReturnTrend')) {
        const tr = el('topReturnTrend')
        tr.classList.remove('up','down')
        const mr = Number(s.maxReturn || 0)
        const up = mr >= 0
        tr.classList.add(up ? 'up' : 'down')
        tr.innerHTML = `<i class="fas ${up ? 'fa-arrow-up':'fa-arrow-down'}"></i> ${Math.abs(mr).toFixed(1)}%`
      }
      if (el('avgReturn')) el('avgReturn').textContent = formatPercent(s.avgReturn, 1)
      if (el('avgReturnSubinfo')) {
        el('avgReturnSubinfo').innerHTML = `
          <span><span class="dot" style="background:#888"></span>市場樣本：${formatNumber(s.totalCount)}</span>
          <span class="muted">上漲：${formatNumber(s.advancersCount)} 下跌：${formatNumber(s.declinersCount)}</span>
        `
      }
      if (el('avgReturnTrend')) {
        const avgTrendVal = Number(s.avgReturn || 0)
        const avgTrendUp = avgTrendVal >= 0
        const node = el('avgReturnTrend')
        node.classList.remove('up','down')
        node.classList.add(avgTrendUp ? 'up' : 'down')
        node.innerHTML = `<i class="fas ${avgTrendUp ? 'fa-arrow-up' : 'fa-arrow-down'}"></i> ${Math.abs(avgTrendVal).toFixed(1)}%`
      }
      if (el('newHighStocks')) el('newHighStocks').textContent = formatNumber(s.newHighStocks)
      if (el('newHighSubinfo')) {
        el('newHighSubinfo').innerHTML = `
          <span><span class="dot" style="background:#ff0080"></span>淨新高 ${formatNumber(s.newHighNet)}</span>
          <span class="muted">新高：${formatNumber(s.newHighStocks)} 新低：${formatNumber(s.newLowStocks)}</span>
        `
      }
      if (el('newHighTrend')) {
        const netHigh = Number(s.newHighNet || 0)
        const newHighTrendVal = (netHigh / safeTotal) * 100
        const newHighTrendUp = newHighTrendVal >= 0
        const node = el('newHighTrend')
        node.classList.remove('up','down')
        node.classList.add(newHighTrendUp ? 'up' : 'down')
        node.innerHTML = `<i class="fas ${newHighTrendUp ? 'fa-arrow-up' : 'fa-arrow-down'}"></i> ${Math.abs(newHighTrendVal).toFixed(1)}%`
      }
      if (el('risingSubinfo')) {
        const ratioText = s.adRatio !== null && s.adRatio !== undefined && Number.isFinite(Number(s.adRatio))
          ? Number(s.adRatio).toFixed(2)
          : '--'
        const g2 = formatNumber(s.greater2Count)
        const l2 = formatNumber(s.lessNeg2Count)
        el('risingSubinfo').innerHTML = `
          <span><span class="dot" style="background:#22c55e"></span>A/D ${ratioText}</span>
          <span class="muted">&gt;2%: ${g2}</span>
          <span class="muted"><-2%: ${l2}</span>
        `
      }
      if (el('adRatio')) el('adRatio').textContent = formatRatio(s.adRatio)
      if (el('adSubinfo')) el('adSubinfo').innerHTML = `
        <span class="muted">上漲：${formatNumber(s.advancersCount)}</span>
        <span class="muted">下跌：${formatNumber(s.declinersCount)}</span>
      `
      if (el('ma60Ratio')) el('ma60Ratio').textContent = formatPercent(s.ma60Ratio, 0)
      if (el('ma60Subinfo')) {
        el('ma60Subinfo').innerHTML = `
          <span><span class="dot" style="background:#00d4ff"></span>站上：${formatNumber(s.ma60AboveCount)}</span>
          <span class="muted">樣本：${formatNumber(s.ma60SampleCount)}</span>
        `
      }
      if (el('ma60Trend')) {
        const ma60TrendVal = Number(s.ma60TrendPercent || 0)
        const ma60TrendUp = ma60TrendVal >= 0
        const node = el('ma60Trend')
        node.classList.remove('up','down')
        node.classList.add(ma60TrendUp ? 'up' : 'down')
        node.innerHTML = `<i class="fas ${ma60TrendUp?'fa-arrow-up':'fa-arrow-down'}"></i> ${Math.abs(ma60TrendVal).toFixed(1)}%`
      }
      if (el('ma20Ratio')) el('ma20Ratio').textContent = formatPercent(s.ma20Ratio, 0)
      if (el('ma20Subinfo')) {
        el('ma20Subinfo').innerHTML = `
          <span><span class="dot" style="background:#22c55e"></span>站上：${formatNumber(s.ma20AboveCount)}</span>
          <span class="muted">樣本：${formatNumber(s.ma20SampleCount)}</span>
        `
      }
      if (el('ma20Trend')) {
        const ma20TrendVal = Number(s.ma20TrendPercent || 0)
        const ma20TrendUp = ma20TrendVal >= 0
        const node = el('ma20Trend')
        node.classList.remove('up','down')
        node.classList.add(ma20TrendUp ? 'up' : 'down')
        node.innerHTML = `<i class="fas ${ma20TrendUp?'fa-arrow-up':'fa-arrow-down'}"></i> ${Math.abs(ma20TrendVal).toFixed(1)}%`
      }
      if (el('ma60Trend')) {
        const ma60TrendVal = Number(s.ma60TrendPercent || 0)
        const ma60TrendUp = ma60TrendVal >= 0
        const node = el('ma60Trend')
        node.classList.remove('up','down')
        node.classList.add(ma60TrendUp ? 'up' : 'down')
        node.innerHTML = `<i class="fas ${ma60TrendUp?'fa-arrow-up':'fa-arrow-down'}"></i> ${Math.abs(ma60TrendVal).toFixed(1)}%`
      }
      if (el('medianVolume')) el('medianVolume').textContent = formatNumber(s.medianVolume)
      if (el('volMedianTrend')) {
        const volTrendVal = Number(s.medianVolumeTrend || 0)
        const volTrendUp = volTrendVal >= 0
        const node = el('volMedianTrend')
        node.classList.remove('up','down')
        node.classList.add(volTrendUp ? 'up' : 'down')
        node.innerHTML = `<i class="fas ${volTrendUp?'fa-arrow-up':'fa-arrow-down'}"></i> ${Math.abs(volTrendVal).toFixed(1)}%`
      }
      if (el('medianVolumeSubinfo')) {
        el('medianVolumeSubinfo').innerHTML = `
          <span class="muted">單位：張</span>
          <span class="muted">樣本：${formatNumber(totalCount)}</span>
        `
      }
      if (el('upDownVolRatio')) el('upDownVolRatio').textContent = formatRatio(s.upDownVolumeRatio, 2)
      if (el('upDownVolTrend')) {
        const upDownTrendVal = Number(s.upDownVolumeRatio || 0) - 1
        const upDownTrendUp = upDownTrendVal >= 0
        const node = el('upDownVolTrend')
        node.classList.remove('up','down')
        node.classList.add(upDownTrendUp ? 'up' : 'down')
        node.innerHTML = `<i class="fas ${upDownTrendUp?'fa-arrow-up':'fa-arrow-down'}"></i> ${Math.abs(upDownTrendVal * 100).toFixed(1)}%`
      }
      if (el('upDownVolSubinfo')) {
        el('upDownVolSubinfo').innerHTML = `
          <span class="muted">上漲量：${formatNumber(s.upVolume)}</span>
          <span class="muted">下跌量：${formatNumber(s.downVolume)}</span>
        `
      }
      if (el('hiVolRatio')) el('hiVolRatio').textContent = formatPercent(s.hiVolatilityRatio, 1)
      if (el('hiVolTrend')) {
        const hiVolTrendVal = Number(s.hiVolatilityRatio || 0)
        const hiVolTrendUp = hiVolTrendVal <= 5
        const node = el('hiVolTrend')
        node.classList.remove('up','down')
        node.classList.add(hiVolTrendUp ? 'up' : 'down')
        node.innerHTML = `<i class="fas ${hiVolTrendUp?'fa-arrow-down':'fa-arrow-up'}"></i> ${Math.abs(hiVolTrendVal).toFixed(1)}%`
      }
      if (el('hiVolSubinfo')) {
        el('hiVolSubinfo').innerHTML = `
          <span class="muted">波動 ≥ 0.8：${formatNumber(s.highVolatilityCount)}</span>
          <span class="muted">樣本：${formatNumber(totalCount)}</span>
        `
      }
      if (el('risingTrend')) {
        const t = Number(s.trendPercent || 0)
        const trendUp = t >= 0
        const node = el('risingTrend')
        node.classList.remove('up','down')
        node.classList.add(trendUp ? 'up' : 'down')
        node.innerHTML = `<i class="fas ${trendUp?'fa-arrow-up':'fa-arrow-down'}"></i> ${Math.abs(t).toFixed(1)}%`
      }
      setApiStatus('connected', '已連線')
    } else {
      setApiStatus('error', '連線失敗')
    }
  }

  // View switching
  function switchView(view) {
    currentView.value = view
    loadAndRender()
  }

  // Mount-time event wiring
  onMounted(() => {
    // 初始化日期（與原版一致：預設今天）
    if (!selectedDateRef.value) {
      const d = new Date()
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth()+1).padStart(2,'0')
      const dd = String(d.getDate()).padStart(2,'0')
      selectedDateRef.value = `${yyyy}-${mm}-${dd}`
    }
    // 初次載入
    loadAndRender()
  })

  // Header handlers
  function onHeaderRefresh(){ loadAndRender() }
  function onHeaderDateChange(v){ selectedDateRef.value = v; loadAndRender() }
  function onHeaderChangeView(v){ switchView(v) }

  // Filter handlers
function onUpdatePeriod(p){
  if (p === 'daily') {
    allowDailyAutoFallback = false
  } else {
    allowDailyAutoFallback = true
  }
  periodRef.value = p
  loadAndRender()
}
  function onUpdateFilters(f){ Object.assign(filtersRef, f); loadAndRender() }
</script>

<template>
  <div class="app-container">
    <HeaderNav
      :date="selectedDateRef"
      :asOf="apiAsOfDate"
      :apiState="apiState"
      :apiText="apiText"
      :currentView="currentView"
      @refresh="onHeaderRefresh"
      @update:date="onHeaderDateChange"
      @change-view="onHeaderChangeView"
    />

    <!-- Main -->
    <main class="main-content">
    <div class="content-shell">
      <!-- Global Filter Panel for Overview -->
      <div v-show="currentView==='overview'">
        <FilterPanel
          :period="periodRef"
          :filters="filtersRef"
          @update:period="onUpdatePeriod"
          @update:filters="onUpdateFilters"
        />
      </div>

      <!-- Stats Cards -->
      <div v-show="currentView==='overview'">
        <StatsGrid />
      </div>

      <!-- Heatmap -->
      <div v-show="currentView==='overview'">
        <Heatmap :rows="heatmapRows" @refresh="loadAndRender" />
      </div>

      <!-- Ranking (hidden by default) -->
      <div v-show="currentView==='ranking'">
        <RankingTable
          :rows="tableRows"
          :sort="currentSort"
          :period="periodRef"
          :filters="filtersRef"
          @change-sort="onChangeSort"
          @update:period="onUpdatePeriod"
          @update:filters="onUpdateFilters"
        />
      </div>

      <!-- Analysis (hidden by default, controlled by view switch) -->
      <div v-show="currentView==='analysis'">
        <Analysis
          :rows="tableRows"
          :period="periodRef"
          :filters="filtersRef"
          :key="`analysis-${periodRef}-${filtersRef.market}`"
          @update:period="onUpdatePeriod"
          @update:filters="onUpdateFilters"
        />
      </div>

      <div v-show="currentView==='comparison'">
        <Comparison :rows="currentData" />
      </div>

      <div v-show="currentView==='alerts'">
        <Alerts />
      </div>
    </div>
  </main>
  </div>
</template>

<style scoped>
/* 本檔案不再放置主要樣式，樣式集中在 src/legacy.css */
</style>
