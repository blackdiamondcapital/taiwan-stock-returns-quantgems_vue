<template>
  <section class="alerts-section" id="alertsSection" style="display:none">
    <div class="alerts-grid">
      <div class="alerts-card">
        <h3><i class="fas fa-bell-plus"></i> 新增警示規則</h3>
        <div class="alerts-form">
          <div class="form-group">
            <label for="alertSymbolInput">股票代碼</label>
            <input id="alertSymbolInput" class="filter-input" placeholder="代碼或留空=全部" />
            <small class="form-hint">留空代表監控所有股票</small>
          </div>
          <div class="form-group">
            <label for="alertTypeSelect">指標類型</label>
            <select id="alertTypeSelect" class="filter-input">
              <option value="return">報酬率 (%)</option>
              <option value="volume">成交量</option>
              <option value="volatility">波動</option>
            </select>
          </div>
          <div class="form-group">
            <label for="alertOperatorSelect">條件</label>
            <select id="alertOperatorSelect" class="filter-input">
              <option value=">=">大於等於 ≥</option>
              <option value="<=">小於等於 ≤</option>
            </select>
          </div>
          <div class="form-group">
            <label for="alertThresholdInput">閾值</label>
            <input id="alertThresholdInput" class="filter-input" type="number" step="0.1" placeholder="0.0" />
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <button class="btn-primary" id="addAlertBtn" style="width:100%; margin-top:1.5rem;">
              <i class="fas fa-plus"></i> 新增規則
            </button>
          </div>
        </div>
        <div class="form-group">
          <label for="desktopNotifyToggle" style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
            <input type="checkbox" id="desktopNotifyToggle" />
            <span>啟用桌面通知</span>
            <small class="form-hint" style="margin-left:auto;">接收瀏覽器通知</small>
          </label>
        </div>
      </div>
      <div class="alerts-card">
        <h3><i class="fas fa-list-check"></i> 警示規則</h3>
        <div class="table-wrapper" style="overflow-x:auto;">
          <table class="alerts-table">
            <thead>
              <tr>
                <th style="width:70%">條件</th>
                <th style="width:30%">操作</th>
              </tr>
            </thead>
            <tbody id="alertRulesBody">
              <tr id="rulesEmpty" style="display:none;">
                <td colspan="2" class="empty-state">
                  <i class="fas fa-bell-slash"></i>
                  <div>尚未設定任何規則</div>
                  <small>請在左側新增警示規則</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="margin-top:1rem; text-align:center;">
          <small class="muted">規則會在數據更新時自動評估</small>
        </div>
      </div>
      <div class="alerts-card">
        <h3><i class="fas fa-inbox"></i> 警示收件匣</h3>
        <div class="inbox" id="alertsInbox">
          <div class="empty-state" id="inboxEmpty" style="display:none;">
            <i class="fas fa-inbox"></i>
            <div>收件匣為空</div>
            <small>觸發的警示將會顯示在此處</small>
          </div>
        </div>
        <div style="margin-top:1rem; display:flex; justify-content:space-between; align-items:center;">
          <small class="muted">保留最近 100 筆記錄</small>
          <button class="btn-icon" id="exportAlertsBtn" title="匯出警示記錄">
            <i class="fas fa-download"></i>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
