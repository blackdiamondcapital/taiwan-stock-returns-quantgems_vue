<script setup>
import { onMounted, onBeforeUnmount, reactive, watch } from 'vue'
import Chart from 'chart.js/auto'

const props = defineProps({
  rows: { type: Array, default: () => [] },
})

const state = reactive({
  factor: 'return',
  buckets: 10,
  metric: 'avg', // avg | ir
  // 投資決策
  strategyType: 'momentum',
  riskTolerance: 'moderate',
  investAmount: 1000000,
  maxStocks: 10,
  maxWeight: 20,
  signals: [],
  portfolio: [],
  riskBars: { market: 0, concentration: 0, liquidity: 0 },
})

let chart

function buildGroups(data, factorKey, bucketCount){
  const getVal = (d) => (factorKey === 'return' ? Number(d.return) : Number(d[factorKey]))
  const rows = (data || []).filter(d => Number.isFinite(Number(d.return)) && Number.isFinite(getVal(d)))
  if (!rows.length) return []
  const sorted = [...rows].sort((a,b)=> getVal(a) - getVal(b))
  const n = sorted.length
  const base = Math.floor(n / bucketCount)
  const groups = []
  for (let i=0, start=0; i<bucketCount; i++){
    let size = (i < bucketCount - 1) ? base : (n - start)
    if (size <= 0) size = 0
    const g = sorted.slice(start, start + size)
    start += size
    const returns = g.map(x => Number(x.return)).filter(Number.isFinite)
    const mean = returns.reduce((s,r)=> s + r, 0) / Math.max(1, returns.length)
    const variance = returns.length > 1 ? returns.reduce((s,v)=> s + Math.pow(v - mean, 2), 0) / (returns.length - 1) : 0
    const stdev = Math.sqrt(variance)
    const ir = stdev > 0 ? (mean / stdev) : 0
    groups.push({ label: `Q${i+1}`, count: g.length, mean, ir })
  }
  return groups
}

function renderChart(){
  const ctx = document.getElementById('quantBarCanvas')?.getContext('2d')
  if (!ctx) return
  const groups = buildGroups(props.rows, state.factor, Number(state.buckets))
  if (chart) { chart.destroy(); chart = null }
  if (!groups.length){
    const wrap = document.getElementById('quantBarWrap')
    if (wrap) wrap.innerHTML = '<div class="muted">無資料</div>'
    return
  }
  const metricKey = state.metric === 'ir' ? 'ir' : 'mean'
  const labels = groups.map(g => `${g.label} (n=${g.count})`)
  const values = groups.map(g => Number.isFinite(g[metricKey]) ? g[metricKey] : 0)

  const posGrad = ctx.createLinearGradient(0, 0, 0, 300)
  posGrad.addColorStop(0, 'rgba(0, 255, 200, 0.9)')
  posGrad.addColorStop(1, 'rgba(0, 180, 255, 0.6)')
  const negGrad = ctx.createLinearGradient(0, 0, 0, 300)
  negGrad.addColorStop(0, 'rgba(255, 120, 160, 0.9)')
  negGrad.addColorStop(1, 'rgba(255, 80, 120, 0.6)')
  const cyanGrad = ctx.createLinearGradient(0, 0, 0, 300)
  cyanGrad.addColorStop(0, 'rgba(0, 212, 255, 0.95)')
  cyanGrad.addColorStop(1, 'rgba(0, 160, 255, 0.6)')
  const colors = metricKey === 'ir' ? values.map(_ => cyanGrad) : values.map(v => v >= 0 ? posGrad : negGrad)
  const borderColors = metricKey === 'ir' ? values.map(_ => 'rgba(0, 212, 255, 1)') : values.map(v => v >= 0 ? 'rgba(0, 255, 200, 1)' : 'rgba(255, 120, 160, 1)')
  const ymax = Math.max(2, Math.max(...values.map(v => Math.abs(v))) * 1.2)
  const yMin = metricKey === 'ir' ? 0 : -Math.max(1, ymax * 0.4)

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: metricKey === 'ir' ? 'IR' : '平均報酬 (%)',
        data: values,
        backgroundColor: colors,
        borderColor: borderColors,
        borderWidth: 1.2,
        borderRadius: 10,
        barThickness: 'flex',
        maxBarThickness: 32,
        hoverBackgroundColor: colors,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      animation: { duration: 600, easing: 'easeOutQuart' },
      scales: {
        x: { ticks: { color: '#ffffff', font: { size: 14 } }, grid: { color: 'rgba(255,255,255,0.12)' } },
        y: { title: { display: true, text: metricKey === 'ir' ? 'IR' : 'Return (%)', color: '#ffffff' },
             ticks: { color: '#ffffff', font: { size: 14 } }, grid: { color: 'rgba(255,255,255,0.12)' }, suggestedMax: ymax, suggestedMin: yMin }
      }
    }
  })
}

function percentile(arr, p){
  if (!Array.isArray(arr) || !arr.length) return 0
  const a = [...arr].sort((x,y)=> x - y)
  const idx = Math.min(a.length - 1, Math.floor(a.length * p))
  return a[idx]
}

function computeAnomalies(){
  const rows = (props.rows || []).filter(d => Number.isFinite(Number(d.return)))
  if (!rows.length) return []
  const vols = rows.map(r => Number(r.volume)).filter(v => Number.isFinite(v))
  const vol95 = vols.length ? percentile(vols, 0.95) : Infinity
  const spikeUp = rows.filter(r => r.return > 5).map(r => ({ type:'up', ...r }))
  const spikeDown = rows.filter(r => r.return < -5).map(r => ({ type:'down', ...r }))
  const explosiveVol = rows.filter(r => Number.isFinite(r.volume) && r.volume >= vol95).map(r => ({ type:'vol', ...r }))
  const items = [...spikeUp.slice(0,30), ...spikeDown.slice(0,30), ...explosiveVol.slice(0,30)]
    .sort((a,b)=> Math.abs(b.return) - Math.abs(a.return)).slice(0,60)
  return items
}

onMounted(() => { renderChart() })
watch([() => props.rows, () => state.factor, () => state.buckets, () => state.metric], () => { renderChart() })
onBeforeUnmount(() => { if (chart) { chart.destroy(); chart = null } })

// ====== 投資決策：訊號 ======
function generateSignals(){
  const data = Array.isArray(props.rows) ? props.rows : []
  if (!data.length) { state.signals = []; return }
  const thresholds = {
    conservative: { buy: 3, sell: -2, volume: 0.8 },
    moderate: { buy: 2, sell: -3, volume: 1.2 },
    aggressive: { buy: 1, sell: -4, volume: 1.5 }
  }[state.riskTolerance]
  const signals = []
  for (const stock of data){
    let signal = 'hold'; let strength = 0; let reason = ''
    if (state.strategyType === 'momentum'){
      if (Number(stock.return) > thresholds.buy){ signal='buy'; strength=Math.min(100,(stock.return/thresholds.buy)*30); reason=`動量突破 ${Number(stock.return).toFixed(2)}%` }
      else if (Number(stock.return) < thresholds.sell){ signal='sell'; strength=Math.min(100, Math.abs(stock.return/thresholds.sell)*30); reason=`動量下跌 ${Number(stock.return).toFixed(2)}%` }
    } else if (state.strategyType === 'reversal'){
      if (Number(stock.return) < -5){ signal='buy'; strength=Math.min(100, Math.abs(stock.return)*5); reason=`超跌反彈 ${Number(stock.return).toFixed(2)}%` }
      else if (Number(stock.return) > 8){ signal='sell'; strength=Math.min(100, Number(stock.return)*4); reason=`漲幅過大 ${Number(stock.return).toFixed(2)}%` }
    } else if (state.strategyType === 'volume'){
      const avgVol = data.reduce((s,x)=> s + (Number(x.volume)||0), 0) / Math.max(1,data.length)
      if ((Number(stock.volume)||0) > avgVol * thresholds.volume && Number(stock.return) > 1){ signal='buy'; strength=Math.min(100, ((Number(stock.volume)||0)/avgVol)*20); reason=`放量上漲 量${((Number(stock.volume)||0)/1e6).toFixed(1)}M` }
    } else if (state.strategyType === 'composite'){
      let score = 0
      if (Number(stock.return) > 2) score += 30
      if (Number(stock.return) < -3) score -= 25
      const avgVol = data.reduce((s,x)=> s + (Number(x.volume)||0), 0) / Math.max(1,data.length)
      if ((Number(stock.volume)||0) > avgVol*1.5) score += 20
      if (Number(stock.volatility) < 0.5) score += 10
      if (score > 35){ signal='buy'; strength=Math.min(100, score); reason=`綜合評分 ${score}` }
      else if (score < -20){ signal='sell'; strength=Math.min(100, Math.abs(score)); reason=`綜合評分 ${score}` }
    }
    if (signal !== 'hold') signals.push({ symbol: stock.symbol, signal, strength, reason, return: Number(stock.return)||0, volume: Number(stock.volume)||0 })
  }
  state.signals = signals.sort((a,b)=> b.strength - a.strength).slice(0,15)
}

// ====== 投資決策：投資組合 ======
function optimizePortfolio(){
  const data = Array.isArray(props.rows) ? props.rows : []
  if (!data.length) { state.portfolio = []; return }
  const candidates = data
    .filter(s => (Number(s.volume)||0) > 1_000_000)
    .map(s => ({
      ...s,
      score: (Number(s.return)||0) / Math.max(0.1, Number(s.volatility)||0.1),
      liquidity: Math.min(100, (Number(s.volume)||0) / 10_000_000 * 100)
    }))
    .sort((a,b)=> b.score - a.score)
    .slice(0, Math.max(1, Number(state.maxStocks)||10))
  const totalScore = candidates.reduce((sum,s)=> sum + Math.max(0, s.score), 0)
  let portfolio = candidates.map(stock => {
    const baseWeight = totalScore > 0 ? (Math.max(0, stock.score) / totalScore) * 100 : (100 / candidates.length)
    const weight = Math.min(Number(state.maxWeight)||20, Math.max(5, baseWeight))
    const amount = Number(state.investAmount||0) * (weight / 100)
    return { symbol: stock.symbol, weight, amount, expectedReturn: Number(stock.return)||0, risk: Number(stock.volatility)||0, score: stock.score }
  })
  const totalWeight = portfolio.reduce((s,p)=> s + p.weight, 0)
  portfolio = portfolio.map(p => ({ ...p, weight: p.weight / totalWeight * 100, amount: Number(state.investAmount||0) * (p.weight/100) }))
  state.portfolio = portfolio
}

// ====== 投資決策：風險評估 ======
function assessRisk(){
  const data = Array.isArray(props.rows) ? props.rows : []
  if (!data.length) { state.riskBars = { market:0, concentration:0, liquidity:0 }; return }
  const returns = data.map(s => Number(s.return)||0)
  const marketRisk = Math.abs(returns.reduce((sum,r)=> sum + r, 0)/Math.max(1,returns.length)) * 5
  const concentrationRisk = (data.filter(s => (Number(s.volume)||0) < 5_000_000).length / data.length) * 100
  const liquidityRisk = (data.filter(s => (Number(s.volume)||0) < 1_000_000).length / data.length) * 100
  state.riskBars = {
    market: Math.min(100, Math.max(0, marketRisk)),
    concentration: Math.min(100, Math.max(0, concentrationRisk)),
    liquidity: Math.min(100, Math.max(0, liquidityRisk)),
  }
}

function fmtPct(v){ return `${Number(v).toFixed(1)}%` }

</script>

<template>
  <section class="analysis-section">
    <div class="analysis-tools">
      <div class="analysis-card quant-bars">
        <h3 style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;">
          <span><i class="fas fa-chart-bar"></i> 量化分組柱狀圖</span>
          <span style="gap:.5rem;opacity:.95;" class="factor-controls">
            <label style="font-size:.85rem;color:var(--text-secondary)">因子</label>
            <select v-model="state.factor" class="filter-input" style="width:120px;padding:.4rem .6rem;">
              <option value="return">報酬</option>
              <option value="volume">成交量</option>
              <option value="volatility">波動</option>
            </select>
            <label style="font-size:.85rem;color:var(--text-secondary)">組數</label>
            <select v-model.number="state.buckets" class="filter-input" style="width:110px;padding:.4rem .6rem;">
              <option :value="10">10 (Decile)</option>
              <option :value="5">5 (Quintile)</option>
            </select>
            <label style="font-size:.85rem;color:var(--text-secondary)">度量</label>
            <select v-model="state.metric" class="filter-input" style="width:130px;padding:.4rem .6rem;">
              <option value="avg">平均報酬</option>
              <option value="ir">IR</option>
            </select>
          </span>
        </h3>
        <div id="quantBarWrap" style="height:300px;margin-top:10px;">
          <canvas id="quantBarCanvas" height="300"></canvas>
        </div>
      </div>

      <div class="analysis-card">
        <h3><i class="fas fa-exclamation-triangle"></i> 市場異常</h3>
        <div class="anomaly-list" style="max-height:360px; overflow:auto;">
          <template v-if="computeAnomalies().length">
            <div v-for="it in computeAnomalies()" :key="it.symbol + '-' + it.type" class="anomaly-item">
              <div class="anomaly-left">
                <span class="badge" :class="it.type==='up'?'up':it.type==='down'?'down':'vol'">{{ it.type==='up'?'急漲':it.type==='down'?'急跌':'爆量' }}</span>
                <strong>{{ it.symbol }}</strong>
              </div>
              <div class="anomaly-right">{{ Number(it.return).toFixed(2) }}%<span v-if="it.volume"> · 量 {{ Number(it.volume).toLocaleString() }}</span></div>
            </div>
          </template>
          <div v-else class="muted">無資料</div>
        </div>
      </div>
      
      <!-- 投資決策：買賣訊號 -->
      <div class="analysis-card">
        <h3><i class="fas fa-signal"></i> 買賣訊號</h3>
        <div class="signal-controls">
          <div class="signal-params">
            <label>策略類型：</label>
            <select v-model="state.strategyType" class="filter-input">
              <option value="momentum">動量策略</option>
              <option value="reversal">反轉策略</option>
              <option value="volume">成交量突破</option>
              <option value="composite">綜合訊號</option>
            </select>
          </div>
          <div class="signal-params">
            <label>風險偏好：</label>
            <select v-model="state.riskTolerance" class="filter-input">
              <option value="conservative">保守型</option>
              <option value="moderate">穩健型</option>
              <option value="aggressive">積極型</option>
            </select>
          </div>
          <button class="btn-primary" @click="generateSignals"><i class="fas fa-magic"></i> 生成訊號</button>
        </div>
        <div class="signal-results">
          <template v-if="state.signals.length">
            <div v-for="s in state.signals" :key="s.symbol + '-' + s.signal" class="signal-item" :class="s.signal">
              <div>
                <strong>{{ s.symbol }}</strong>
                <span class="signal-action">{{ s.signal==='buy'?'買入':'賣出' }}</span>
                <div class="signal-reason">{{ s.reason }}</div>
              </div>
              <div class="signal-strength">{{ Math.round(s.strength) }}%</div>
            </div>
          </template>
          <div v-else class="muted">請選擇策略參數並生成訊號</div>
        </div>
      </div>

      <!-- 投資決策：投資組合 -->
      <div class="analysis-card">
        <h3><i class="fas fa-chart-pie"></i> 投資組合建議</h3>
        <div class="portfolio-controls">
          <div class="portfolio-params">
            <label>投資金額：</label>
            <input type="number" v-model.number="state.investAmount" class="filter-input" placeholder="1000000">
          </div>
          <div class="portfolio-params">
            <label>最大持股數：</label>
            <input type="number" v-model.number="state.maxStocks" class="filter-input" placeholder="10" min="3" max="20">
          </div>
          <div class="portfolio-params">
            <label>單股上限：</label>
            <input type="number" v-model.number="state.maxWeight" class="filter-input" placeholder="20" min="5" max="50">
            <span>%</span>
          </div>
          <button class="btn-primary" @click="optimizePortfolio"><i class="fas fa-calculator"></i> 優化組合</button>
        </div>
        <div class="portfolio-results">
          <template v-if="state.portfolio.length">
            <div class="portfolio-summary">
              <div class="portfolio-metric"><span>預期報酬：</span><span>{{ fmtPct(state.portfolio.reduce((sum,p)=> sum + (p.expectedReturn * p.weight/100), 0)) }}</span></div>
              <div class="portfolio-metric"><span>組合風險：</span><span>{{ fmtPct(Math.sqrt(state.portfolio.reduce((s,p)=> s + Math.pow(p.risk * p.weight/100, 2), 0))) }}</span></div>
            </div>
            <div class="portfolio-holdings">
              <div class="portfolio-item" v-for="p in state.portfolio" :key="p.symbol">
                <div>
                  <strong>{{ p.symbol }}</strong>
                  <div class="holding-details">權重 {{ p.weight.toFixed(1) }}% · 金額 {{ (p.amount/10000).toFixed(0) }}萬</div>
                </div>
                <div class="holding-return" :class="p.expectedReturn>=0?'positive':'negative'">{{ fmtPct(p.expectedReturn) }}</div>
              </div>
            </div>
          </template>
          <div v-else class="muted">設定參數後點擊優化組合</div>
        </div>
      </div>

      <!-- 投資決策：風險評估 -->
      <div class="analysis-card">
        <h3><i class="fas fa-shield-alt"></i> 風險評估</h3>
        <div class="risk-metrics">
          <div class="risk-metric"><span class="metric-label">市場風險</span><div class="risk-bar"><div class="risk-fill" :style="{width: state.riskBars.market + '%', background: state.riskBars.market<30?'var(--success)':state.riskBars.market<70?'var(--warning)':'var(--error)'}"></div></div><span class="metric-value">{{ fmtPct(state.riskBars.market) }}</span></div>
          <div class="risk-metric"><span class="metric-label">集中度風險</span><div class="risk-bar"><div class="risk-fill" :style="{width: state.riskBars.concentration + '%', background: state.riskBars.concentration<30?'var(--success)':state.riskBars.concentration<70?'var(--warning)':'var(--error)'}"></div></div><span class="metric-value">{{ fmtPct(state.riskBars.concentration) }}</span></div>
          <div class="risk-metric"><span class="metric-label">流動性風險</span><div class="risk-bar"><div class="risk-fill" :style="{width: state.riskBars.liquidity + '%', background: state.riskBars.liquidity<30?'var(--success)':state.riskBars.liquidity<70?'var(--warning)':'var(--error)'}"></div></div><span class="metric-value">{{ fmtPct(state.riskBars.liquidity) }}</span></div>
        </div>
        <button class="btn-primary" @click="assessRisk"><i class="fas fa-search"></i> 評估風險</button>
      </div>

      <!-- 投資決策：執行建議 -->
      <div class="analysis-card full-width">
        <h3><i class="fas fa-clipboard-list"></i> 執行建議</h3>
        <div class="action-plan">
          <ul>
            <li v-if="state.signals.length"><strong>訊號執行：</strong>優先關注強度>70%的買賣訊號，建議分批進出</li>
            <li v-if="state.portfolio.length"><strong>組合配置：</strong>按建議權重配置，單筆投入不超過總資金20%</li>
            <li><strong>風險控制：</strong><span v-if="state.riskBars.market>50">當前市場風險較高，建議降低倉位或增加避險部位</span><span v-else>風險水平可控，可按正常策略執行</span></li>
            <li><strong>監控要點：</strong>密切關注成交量變化和技術指標確認</li>
            <li><strong>停損設定：</strong>建議設定-8%停損點，+15%分批獲利了結</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
