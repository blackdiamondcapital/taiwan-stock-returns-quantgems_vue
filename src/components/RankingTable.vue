<script setup>
const props = defineProps({
  rows: { type: Array, default: () => [] },
  sort: { type: Object, default: () => ({ column: 'return', direction: 'desc' }) },
})
const emit = defineEmits(['change-sort'])

function onHeaderClick(col){
  const dir = (props.sort.column === col) ? (props.sort.direction === 'asc' ? 'desc' : 'asc') : 'desc'
  emit('change-sort', { column: col, direction: dir })
}
</script>

<template>
  <div class="ranking-table-container">
    <div class="table-header">
      <div class="table-title"><i class="fas fa-list-ol"></i> 市場排行榜</div>
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
            <th :class="{sorted: sort.column==='cumulative', [sort.direction]: sort.column==='cumulative'}" @click="onHeaderClick('cumulative')">累積報酬 <span class="sort-indicator"></span></th>
            <th>動作</th>
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
            <td>
              <span class="return-value" :class="item.cumulative>=0?'positive':'negative'">
                {{ Number(item.cumulative).toFixed(2) }}%
              </span>
            </td>
            <td>
              <button class="btn-icon"><i class="fas fa-chart-line"></i></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
