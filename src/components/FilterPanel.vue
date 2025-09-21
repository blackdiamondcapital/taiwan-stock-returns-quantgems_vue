<script setup>
const props = defineProps({
  period: { type: String, default: 'daily' },
  filters: { type: Object, default: () => ({ market: 'all', industry: 'all', returnRange: 'all', volumeThreshold: 0 }) },
})
const emit = defineEmits(['update:period', 'update:filters'])
function setPeriod(p){ emit('update:period', p) }
function updateFilter(key, value){ emit('update:filters', { ...props.filters, [key]: value }) }
</script>

<template>
  <div class="filter-panel">
    <div class="filter-header">
      <div class="filter-title">
        <i class="fas fa-filter"></i>
        篩選條件
      </div>
      <div class="period-selector">
        <button class="period-btn" :class="{active: period==='daily'}" @click="setPeriod('daily')">日</button>
        <button class="period-btn" :class="{active: period==='weekly'}" @click="setPeriod('weekly')">週</button>
        <button class="period-btn" :class="{active: period==='monthly'}" @click="setPeriod('monthly')">月</button>
        <button class="period-btn" :class="{active: period==='quarterly'}" @click="setPeriod('quarterly')">季</button>
        <button class="period-btn" :class="{active: period==='yearly'}" @click="setPeriod('yearly')">年</button>
      </div>
    </div>
    <div class="filter-controls">
      <div class="filter-group">
        <label class="filter-label">市場類別</label>
        <select class="filter-input" :value="filters.market" @change="e=>updateFilter('market', e.target.value)">
          <option value="all">全部市場</option>
          <option value="listed">上市</option>
          <option value="otc">上櫃</option>
        </select>
      </div>
      <div class="filter-group overview-hide" id="industryGroup">
        <label class="filter-label">產業類別</label>
        <select class="filter-input" :value="filters.industry" @change="e=>updateFilter('industry', e.target.value)">
          <option value="all">全部產業</option>
          <option value="semiconductor">半導體</option>
          <option value="finance">金融保險</option>
          <option value="shipping">航運業</option>
          <option value="steel">鋼鐵工業</option>
        </select>
      </div>
      <div class="filter-group overview-hide" id="returnGroup">
        <label class="filter-label">報酬率範圍</label>
        <select class="filter-input" :value="filters.returnRange" @change="e=>updateFilter('returnRange', e.target.value)">
          <option value="all">全部</option>
          <option value="top10">前10%</option>
          <option value="positive">正報酬</option>
          <option value="negative">負報酬</option>
          <option value="extreme">極端值 (±20%)</option>
        </select>
      </div>
      <div class="filter-group overview-hide" id="volumeGroup">
        <label class="filter-label">成交量門檻</label>
        <select class="filter-input" :value="filters.volumeThreshold" @change="e=>updateFilter('volumeThreshold', Number(e.target.value)||0)">
          <option :value="0">全部</option>
          <option :value="10000">&gt; 10000張</option>
          <option :value="1000">&gt; 1000張</option>
          <option :value="100">&gt; 100張</option>
        </select>
      </div>
    </div>
  </div>
</template>
