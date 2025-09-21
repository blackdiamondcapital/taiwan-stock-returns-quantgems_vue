<script setup>
import { onMounted, reactive, computed } from 'vue'

const props = defineProps({
  rows: { type: Array, default: () => [] }, // current market rows to match for table
})

const state = reactive({
  input: '',
  selected: [],
})

const STORAGE_KEY = 'quantgems.comparisonSymbols'
function loadSelection() {
  try { state.selected = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { state.selected = [] }
}
function saveSelection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.selected.slice(0,5)))
}
function addSymbol() {
  const sym = String(state.input || '').trim().toUpperCase()
  if (!sym) return
  if (state.selected.includes(sym)) return
  if (state.selected.length >= 5) return
  state.selected.push(sym)
  state.input = ''
  saveSelection()
}
function removeSymbol(sym){
  const i = state.selected.indexOf(sym)
  if (i>=0){ state.selected.splice(i,1); saveSelection() }
}

const tableRows = computed(() => {
  if (!Array.isArray(props.rows) || !props.rows.length) return []
  const map = new Map(props.rows.map(r => [String(r.symbol).toUpperCase(), r]))
  return state.selected.slice(0,5).map(sym => {
    const k = String(sym).toUpperCase()
    const s = map.get(k) || { symbol: sym, name: '', short_name: '', return: 0, price: 0, volume: 0, volatility: 0, market: '' }
    return s
  })
})

onMounted(loadSelection)
</script>

<template>
  <section class="comparison-section" id="comparisonSection" style="display:none">
    <div class="comparison-grid">
      <div class="comparison-card" id="comparisonSettingsCard">
        <h3><i class="fas fa-balance-scale"></i> 比較設定</h3>
        <div class="comparison-controls">
          <div class="control-group">
            <input v-model="state.input" class="filter-input" placeholder="輸入代碼，例如 2330 或 2330.TW" />
            <button class="btn-primary" @click="addSymbol"><i class="fas fa-plus"></i> 加入</button>
          </div>
        </div>
        <div class="chip-list">
          <template v-if="state.selected.length">
            <span class="chip" v-for="sym in state.selected" :key="sym">
              <span class="stock-symbol">{{ sym }}</span>
              <span class="remove" @click="removeSymbol(sym)" :title="`移除 ${sym}`">✕</span>
            </span>
          </template>
          <div class="empty-state" v-else>
            <i class="fas fa-chart-line"></i>
            <div>尚未選擇股票</div>
          </div>
        </div>
      </div>
      <div class="comparison-card" id="comparisonTableCard">
        <h3><i class="fas fa-table"></i> 數據比較</h3>
        <div class="comparison-table-wrapper" style="overflow-x:auto;">
          <table class="comparison-table">
            <thead>
              <tr>
                <th>股票</th>
                <th>名稱</th>
                <th>報酬率</th>
                <th>股價</th>
                <th>成交量</th>
                <th>波動</th>
                <th>市場</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!tableRows.length">
                <td colspan="7" class="empty-state"><i class="fas fa-table"></i><div>選擇股票查看數據表</div></td>
              </tr>
              <tr v-for="s in tableRows" :key="s.symbol">
                <td><span class="stock-symbol">{{ s.symbol }}</span></td>
                <td style="text-align:left">{{ s.short_name || s.name }}</td>
                <td :style="{textAlign:'right', color: (Number(s.return)>=0?'var(--success)':'var(--error)')}">{{ Number(s.return||0).toFixed(2) }}%</td>
                <td style="text-align:right">{{ Number(s.price||0).toFixed(2) }}</td>
                <td style="text-align:right">{{ Number(s.volume||0).toLocaleString() }}</td>
                <td style="text-align:right">{{ Number(s.volatility||0).toFixed(2) }}</td>
                <td style="text-align:center">{{ s.market || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>
