<script setup>
const props = defineProps({
  rows: { type: Array, default: () => [] },
  sort: { type: Object, default: () => ({ column: 'return', direction: 'desc' }) },
  period: { type: String, default: 'daily' },
  filters: { type: Object, default: () => ({ market: 'all', industry: 'all', returnRange: 'all', volumeThreshold: 0 }) },
})
const emit = defineEmits(['change-sort', 'update:period', 'update:filters'])

const periodOptions = [
  { value: 'daily', label: '日' },
  { value: 'weekly', label: '週' },
  { value: 'monthly', label: '月' },
  { value: 'quarterly', label: '季' },
  { value: 'yearly', label: '年' },
]

function onHeaderClick(col){
  const dir = (props.sort.column === col) ? (props.sort.direction === 'asc' ? 'desc' : 'asc') : 'desc'
  emit('change-sort', { column: col, direction: dir })
}

function onSelectMarket(event){
  const next = { ...props.filters, market: event.target.value }
  emit('update:filters', next)
}

function onSelectPeriod(p){
  if (p === props.period) return
  emit('update:period', p)
}
</script>

<template>
  <section class="ranking-section">
    <div class="ranking-table-container">
      <div class="table-header">
        <div class="ranking-header-card">
          <div class="ranking-header-top">
            <div class="table-title"><i class="fas fa-list-ol"></i> 市場排行榜</div>
            <div class="ranking-period-control">
              <button
                v-for="item in periodOptions"
                :key="item.value"
                type="button"
                class="period-chip"
                :class="{ active: props.period === item.value }"
                @click="onSelectPeriod(item.value)"
              >{{ item.label }}</button>
            </div>
          </div>
          <div class="ranking-filter-bar">
            <label class="filter-label">市場別</label>
            <select class="filter-input" :value="props.filters.market" @change="onSelectMarket">
              <option value="all">全部市場</option>
              <option value="listed">上市</option>
              <option value="otc">上櫃</option>
            </select>
          </div>
        </div>
      </div>
      <div class="table-container">
        <table class="ranking-table">
        <thead>
          <tr>
            <th :class="{sorted: sort.column==='rank', [sort.direction]: sort.column==='rank'}" @click="onHeaderClick('rank')">名次 <span class="sort-indicator"></span></th>
            <th :class="{sorted: sort.column==='symbol', [sort.direction]: sort.column==='symbol'}" @click="onHeaderClick('symbol')">股票 <span class="sort-indicator"></span></th>
            <th :class="{sorted: sort.column==='return', [sort.direction]: sort.column==='return'}" @click="onHeaderClick('return')">報酬率 <span class="sort-indicator"></span></th>
            <th :class="{sorted: sort.column==='price', [sort.direction]: sort.column==='price'}" @click="onHeaderClick('price')">價格 <span class="sort-indicator"></span></th>
            <th :class="{sorted: sort.column==='change', [sort.direction]: sort.column==='change'}" @click="onHeaderClick('change')">漲跌 <span class="sort-indicator"></span></th>
            <th :class="{sorted: sort.column==='volume', [sort.direction]: sort.column==='volume'}" @click="onHeaderClick('volume')">成交量 <span class="sort-indicator"></span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.symbol + '-' + item.rank">
            <td>
              <span class="rank-badge" :class="{gold: item.rank===1, silver: item.rank===2, bronze: item.rank===3}">{{ item.rank }}</span>
            </td>
            <td>
              <div class="stock-info">
                <span class="stock-symbol">{{ item.symbol }}</span>
                <span class="stock-name">{{ item.short_name || item.name }}</span>
              </div>
            </td>
            <td>
              <span class="return-value" :class="item.return>=0?'positive':'negative'">
                <i class="fas" :class="item.return>=0?'fa-arrow-up':'fa-arrow-down'"></i>
                {{ Number(item.return).toFixed(2) }}%
              </span>
            </td>
            <td>{{ Number(item.price).toFixed(2) }}</td>
            <td :class="item.change>=0?'positive':'negative'">{{ (item.change>=0?'+':'') + Number(item.change).toFixed(2) }}</td>
            <td>{{ Number(item.volume||0).toLocaleString() }}</td>
          </tr>
        </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
