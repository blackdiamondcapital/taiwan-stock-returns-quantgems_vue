<template>
  <div class="stats-grid">
    <div class="stat-card" id="cardRising">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-arrow-trend-up"></i></div>
        <div class="stat-trend up" id="risingTrend"><i class="fas fa-arrow-up"></i> 12.5%</div>
      </div>
      <div class="stat-value" id="risingStocks">156</div>
      <div class="stat-subinfo" id="risingSubinfo">
        <span><span class="dot" style="background:#22c55e"></span>A/D 1.20</span>
        <span class="muted">&gt;2%: 65</span>
        <span class="muted"><-2%: 23</span>
      </div>
      <div class="sparkline" id="sparkRising"></div>
      <div class="stat-label">今日上漲股票數</div>
    </div>

    <div class="stat-card" id="cardTopReturn">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-crown"></i></div>
        <div class="stat-trend up" id="topReturnTrend"><i class="fas fa-arrow-up"></i> 28.3%</div>
      </div>
      <div class="stat-value" id="topStock">2330.TW</div>
      <div class="stat-subinfo" id="topReturnSubinfo">
        <span><span class="dot" style="background:#00d4ff"></span>半導體</span>
        <span class="muted">當月成交值前10</span>
        <span class="muted">波動: 中</span>
      </div>
      <div class="sparkline" id="sparkTop"></div>
      <div class="stat-label">本月最佳報酬</div>
    </div>

    <div class="stat-card" id="cardAvgReturn">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-chart-pie"></i></div>
        <div class="stat-trend down" id="avgReturnTrend"><i class="fas fa-arrow-down"></i> 3.2%</div>
      </div>
      <div class="stat-value" id="avgReturn">8.7%</div>
      <div class="stat-subinfo" id="avgReturnSubinfo">
        <span><span class="dot" style="background:#888"></span>相對大盤 +0.8%</span>
        <span class="muted">分位：74%</span>
      </div>
      <div class="sparkline" id="sparkAvg"></div>
      <div class="stat-label">市場平均報酬率</div>
    </div>

    <div class="stat-card" id="cardNewHigh">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-fire"></i></div>
        <div class="stat-trend up" id="newHighTrend"><i class="fas fa-arrow-up"></i> 新高</div>
      </div>
      <div class="stat-value" id="newHighStocks">23</div>
      <div class="stat-subinfo" id="newHighSubinfo">
        <span><span class="dot" style="background:#ff0080"></span>淨新高 +12</span>
        <span class="muted">52週新高：9</span>
      </div>
      <div class="sparkline" id="sparkHigh"></div>
      <div class="stat-label">突破新高股票</div>
    </div>
  </div>
</template>
