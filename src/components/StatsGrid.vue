<template>
  <div class="stats-grid">
    <!-- 今日上漲股票數 -->
    <div class="stat-card" id="cardRising">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-arrow-trend-up"></i></div>
        <div class="stat-trend up" id="risingTrend"><i class="fas fa-arrow-up"></i> 0.0%</div>
      </div>
      <div class="stat-value" id="risingStocks">--</div>
      <div class="stat-subinfo" id="risingSubinfo">
        <span><span class="dot" style="background:#22c55e"></span>A/D --</span>
        <span class="muted">&gt;2%: --</span>
        <span class="muted"><-2%: --</span>
      </div>
      <div class="sparkline" id="sparkRising"></div>
      <div class="stat-label">今日上漲股票數</div>
    </div>

    <!-- 本月最佳報酬 -->
    <div class="stat-card" id="cardTopReturn">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-crown"></i></div>
        <div class="stat-trend up" id="topReturnTrend"><i class="fas fa-arrow-up"></i> 0.0%</div>
      </div>
      <div class="stat-value" id="topStock">N/A</div>
      <div class="stat-subinfo" id="topReturnSubinfo">
        <span><span class="dot" style="background:#00d4ff"></span>報酬：--</span>
        <span class="muted">成交值：--</span>
        <span class="muted">波動：--</span>
      </div>
      <div class="sparkline" id="sparkTop"></div>
      <div class="stat-label">本月最佳報酬</div>
    </div>

    <!-- 市場平均報酬率 -->
    <div class="stat-card" id="cardAvgReturn">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-chart-pie"></i></div>
        <div class="stat-trend" id="avgReturnTrend"><i class="fas fa-minus"></i> 0.0%</div>
      </div>
      <div class="stat-value" id="avgReturn">0.0%</div>
      <div class="stat-subinfo" id="avgReturnSubinfo">
        <span><span class="dot" style="background:#888"></span>相對大盤 --</span>
        <span class="muted">分位：--</span>
      </div>
      <div class="sparkline" id="sparkAvg"></div>
      <div class="stat-label">市場平均報酬率</div>
    </div>

    <!-- 突破新高股票 -->
    <div class="stat-card" id="cardNewHigh">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-fire"></i></div>
        <div class="stat-trend up" id="newHighTrend"><i class="fas fa-arrow-up"></i> 近似</div>
      </div>
      <div class="stat-value" id="newHighStocks">0</div>
      <div class="stat-subinfo" id="newHighSubinfo">
        <span><span class="dot" style="background:#ff0080"></span>淨新高 --</span>
        <span class="muted">52週新高：--</span>
      </div>
      <div class="sparkline" id="sparkHigh"></div>
      <div class="stat-label">突破新高股票</div>
    </div>

    <!-- 站上 MA60 比例 -->
    <div class="stat-card" id="cardMA60">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
        <div class="stat-trend" id="ma60Trend"><i class="fas fa-minus"></i> --</div>
      </div>
      <div class="stat-value" id="ma60Ratio">0%</div>
      <div class="stat-subinfo" id="ma60Subinfo">
        <span class="muted">站上：--</span>
        <span class="muted">樣本：--</span>
      </div>
      <div class="stat-label">站上 MA60 比例</div>
    </div>

    <!-- 站上 MA20 比例 -->
    <div class="stat-card" id="cardMA20">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-chart-area"></i></div>
        <div class="stat-trend" id="ma20Trend"><i class="fas fa-minus"></i> --</div>
      </div>
      <div class="stat-value" id="ma20Ratio">0%</div>
      <div class="stat-subinfo" id="ma20Subinfo">
        <span><span class="dot" style="background:#22c55e"></span>站上：--</span>
        <span class="muted">樣本：--</span>
      </div>
      <div class="stat-label">站上 MA20 比例（近似）</div>
    </div>

    <!-- 上漲家數 / 下跌家數 比 -->
    <div class="stat-card" id="cardAD">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-balance-scale-left"></i></div>
        <div class="stat-trend" id="adTrend"><i class="fas fa-minus"></i></div>
      </div>
      <div class="stat-value" id="adRatio">--</div>
      <div class="stat-subinfo" id="adSubinfo">
        <span class="muted">上漲：--</span>
        <span class="muted">下跌：--</span>
      </div>
      <div class="stat-label">上漲/下跌 比</div>
    </div>

    <!-- 成交量中位數 -->
    <div class="stat-card" id="cardVolMedian">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-bolt"></i></div>
        <div class="stat-trend" id="volMedianTrend"><i class="fas fa-minus"></i> --</div>
      </div>
      <div class="stat-value" id="medianVolume">0</div>
      <div class="stat-subinfo" id="medianVolumeSubinfo">
        <span class="muted">單位：張</span>
        <span class="muted">樣本：--</span>
      </div>
      <div class="stat-label">成交量中位數</div>
    </div>

    <!-- 上漲成交量 / 下跌成交量 比 -->
    <div class="stat-card" id="cardUpDownVol">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
        <div class="stat-trend" id="upDownVolTrend"><i class="fas fa-minus"></i></div>
      </div>
      <div class="stat-value" id="upDownVolRatio">1.0x</div>
      <div class="stat-subinfo" id="upDownVolSubinfo">
        <span class="muted">上漲量：--</span>
        <span class="muted">下跌量：--</span>
      </div>
      <div class="stat-label">量能比</div>
    </div>

    <!-- 高波動警示比例 -->
    <div class="stat-card" id="cardHiVol">
      <div class="stat-header">
        <div class="stat-icon"><i class="fas fa-signal"></i></div>
        <div class="stat-trend" id="hiVolTrend"><i class="fas fa-minus"></i></div>
      </div>
      <div class="stat-value" id="hiVolRatio">0.0%</div>
      <div class="stat-subinfo" id="hiVolSubinfo">
        <span class="muted">波動≥0.8：--</span>
        <span class="muted">樣本：--</span>
      </div>
      <div class="stat-label">高波動警示比例</div>
    </div>
  </div>
</template>

