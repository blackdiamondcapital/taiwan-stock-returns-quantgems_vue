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

  const qs = (sel, root = document) => root.querySelector(sel)
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel))

  const setVisibility = (selector, display) => {
    // deprecated: now using v-show for view switches
  }

  function onChangeSort(newSort) {
    currentSort.value = newSort
    const rows = [...currentData.value]
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
    const [list, statsResp] = await Promise.all([
      fetchRankings({ period, ...filters, limit: 200 }),
      fetchStatistics({ period, market: filters.market, date: filters.date })
    ])
    // map to currentData shape
    currentData.value = list.map((item, idx) => ({
      rank: idx + 1,
      symbol: item.symbol,
      name: item.name || item.symbol,
      short_name: item.short_name || item.name || '',
      return: parseFloat(item.return_rate) || 0,
      price: parseFloat(item.current_price) || 0,
      change: parseFloat(item.price_change) || 0,
      volume: parseInt(item.volume) || 0,
      cumulative: parseFloat(item.cumulative_return) || 0,
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
      // key cards
      const el = (id) => qs('#' + id)
      if (el('risingStocks')) el('risingStocks').textContent = s.risingStocks ?? '--'
      if (el('topStock')) el('topStock').textContent = s.topStock || 'N/A'
      if (el('topReturnTrend')) {
        const tr = el('topReturnTrend')
        tr.classList.remove('up','down')
        const mr = Number(s.maxReturn || 0)
        const up = mr >= 0
        tr.classList.add(up ? 'up' : 'down')
        tr.innerHTML = `<i class="fas ${up ? 'fa-arrow-up':'fa-arrow-down'}"></i> ${mr.toFixed(1)}%`
      }
      if (el('avgReturn')) el('avgReturn').textContent = `${Number(s.avgReturn||0).toFixed(1)}%`
      if (el('newHighStocks')) el('newHighStocks').textContent = s.newHighStocks ?? s.nearHighStocks ?? '--'
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
    switchView('overview')
  })

  // Header handlers
  function onHeaderRefresh(){ loadAndRender() }
  function onHeaderDateChange(v){ selectedDateRef.value = v; loadAndRender() }
  function onHeaderChangeView(v){ switchView(v) }

  // Filter handlers
  function onUpdatePeriod(p){ periodRef.value = p; loadAndRender() }
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
      <!-- Filter Panel -->
      <FilterPanel
        :period="periodRef"
        :filters="filtersRef"
        @update:period="onUpdatePeriod"
        @update:filters="onUpdateFilters"
      />

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
        <RankingTable :rows="tableRows" :sort="currentSort" @change-sort="onChangeSort" />
      </div>

      <!-- Analysis (hidden by default, controlled by view switch) -->
      <div v-show="currentView==='analysis'">
        <Analysis :rows="currentData" />
      </div>

      <div v-show="currentView==='comparison'">
        <Comparison :rows="currentData" />
      </div>

      <div v-show="currentView==='alerts'">
        <Alerts />
      </div>
    </main>
  </div>
</template>

<style scoped>
/* 本檔案不再放置主要樣式，樣式集中在 src/legacy.css */
</style>
