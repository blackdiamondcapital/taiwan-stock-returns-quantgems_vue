const express = require('express');
const { sequelize } = require('../db');
const { QueryTypes } = require('sequelize');

const router = express.Router();

function toPercentUnit(v) {
  if (v === null || v === undefined) return v;
  const n = parseFloat(v);
  if (!isFinite(n)) return n;
  return Math.abs(n) <= 1 ? n * 100 : n;
}

router.get('/rankings', async (req, res) => {
  try {
    const { period = 'daily', market, returnRange, volumeThreshold, limit = 50, offset = 0 } = req.query;
    const { date } = req.query;

    let whereClause = '';
    const replacements = { limit: parseInt(limit), offset: parseInt(offset), period };

    if (market && market !== 'all') {
      whereClause += ` AND ((:market = 'listed' AND sr.symbol ~ '^[0-9]{4}\\.TW$') OR (:market = 'otc' AND sr.symbol ~ '^[0-9]{4}\\.TWO$'))`;
      replacements.market = market;
    } else {
      whereClause += ` AND sr.symbol ~ '^[0-9]{4}\\.TW(O)?$'`;
    }

    if (volumeThreshold && volumeThreshold > 0) {
      whereClause += ` AND COALESCE(ps.volume,0) >= :volumeThreshold`;
      replacements.volumeThreshold = parseInt(volumeThreshold);
    }

    const query = `
      WITH latest AS (
        SELECT CASE 
          WHEN :date::date IS NULL THEN (SELECT MAX(date) FROM stock_returns)
          ELSE (SELECT MAX(date) FROM stock_returns WHERE date::date <= :date::date)
        END AS dt
      ),
      sel_returns AS (
        SELECT * FROM (
          SELECT r.*, ROW_NUMBER() OVER (PARTITION BY r.symbol ORDER BY r.date DESC) AS rn
          FROM stock_returns r, latest
          WHERE r.date::date <= latest.dt::date
        ) t WHERE rn = 1
      ),
      price_sel AS (
        SELECT * FROM (
          SELECT p.symbol, p.date, p.open_price, p.close_price, p.volume,
                 ROW_NUMBER() OVER (PARTITION BY p.symbol ORDER BY p.date DESC) AS rn
          FROM stock_prices p, latest
          WHERE p.date::date <= latest.dt::date
        ) t WHERE rn = 1
      ),
      prev_price AS (
        SELECT * FROM (
          SELECT p.symbol, p.date, p.close_price,
                 ROW_NUMBER() OVER (PARTITION BY p.symbol ORDER BY p.date DESC) AS rn
          FROM stock_prices p, latest
          WHERE p.date::date < latest.dt::date
        ) t WHERE rn = 1
      )
      SELECT 
        sr.symbol,
        COALESCE(s.name, sr.symbol) AS name,
        COALESCE(s.market, CASE WHEN sr.symbol LIKE '%.TWO' THEN 'otc' ELSE 'listed' END) AS market,
        NULL::text AS industry,
        (
          CASE 
            WHEN :period = 'daily' THEN sr.daily_return
            WHEN :period = 'weekly' THEN sr.weekly_return
            WHEN :period = 'monthly' THEN sr.monthly_return
            WHEN :period = 'quarterly' THEN sr.quarterly_return
            WHEN :period = 'yearly' THEN sr.yearly_return
          END
        ) AS return_rate,
        ps.close_price AS current_price,
        (ps.close_price - COALESCE(ps.open_price, ps.close_price)) AS price_change,
        CASE WHEN ps.open_price IS NOT NULL AND ps.open_price <> 0
             THEN (ps.close_price - ps.open_price) * 100.0 / ps.open_price
             ELSE NULL END AS change_percent,
        ps.volume,
        sr.cumulative_return,
        0.5 AS volatility,
        ROW_NUMBER() OVER (
          ORDER BY (
            CASE 
              WHEN :period = 'daily' THEN sr.daily_return
              WHEN :period = 'weekly' THEN sr.weekly_return
              WHEN :period = 'monthly' THEN sr.monthly_return
              WHEN :period = 'quarterly' THEN sr.quarterly_return
              WHEN :period = 'yearly' THEN sr.yearly_return
            END
          ) DESC NULLS LAST
        ) AS rank
      FROM sel_returns sr
      LEFT JOIN price_sel ps ON ps.symbol = sr.symbol
      LEFT JOIN prev_price prev ON prev.symbol = sr.symbol
      LEFT JOIN stock_symbols s ON s.symbol = sr.symbol
      WHERE 1=1 ${whereClause}
        AND sr.symbol NOT LIKE '^%'
        AND sr.symbol ~ '^[0-9]{4}\\.TW(O)?$'
      ORDER BY (
        CASE 
          WHEN :period = 'daily' THEN sr.daily_return
          WHEN :period = 'weekly' THEN sr.weekly_return
          WHEN :period = 'monthly' THEN sr.monthly_return
          WHEN :period = 'quarterly' THEN sr.quarterly_return
          WHEN :period = 'yearly' THEN sr.yearly_return
        END
      ) DESC NULLS LAST
      LIMIT :limit OFFSET :offset
    `;

    const [priceAsOf] = await sequelize.query(
      `SELECT CASE 
         WHEN :date::date IS NULL THEN (SELECT MAX(date) FROM stock_returns)
         ELSE (SELECT MAX(date) FROM stock_returns WHERE date::date <= :date::date)
       END AS as_of`,
      { type: QueryTypes.SELECT, replacements: { date: date || null } }
    );
    const asOfDate = (priceAsOf && priceAsOf.as_of) || null;

    const reqLimit = parseInt(limit) || 50;
    const periodLower = (period || '').toLowerCase();
    const prefilterFactor = (periodLower === 'daily' || periodLower === 'weekly') ? 10 : 1;
    const sqlLimit = Math.min(5000, Math.max(reqLimit * prefilterFactor, reqLimit));

    const results = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements: { ...replacements, limit: sqlLimit, date: date || null }
    });

    let normalized = results.map(r => ({
      ...r,
      return_rate: toPercentUnit(r.return_rate),
      cumulative_return: toPercentUnit(r.cumulative_return)
    }));

    if ((period || '').toLowerCase() === 'daily') {
      normalized = normalized.filter(r => r.return_rate === null || r.return_rate <= 10);
    }
    if ((period || '').toLowerCase() === 'weekly') {
      normalized = normalized.filter(r => r.return_rate === null || r.return_rate <= 50);
    }

    let filteredResults = normalized;
    if (returnRange && returnRange !== 'all') {
      switch (returnRange) {
        case 'positive':
          filteredResults = normalized.filter(item => item.return_rate > 0);
          break;
        case 'negative':
          filteredResults = normalized.filter(item => item.return_rate < 0);
          break;
        case 'top10':
          filteredResults = normalized.slice(0, Math.ceil(normalized.length * 0.1));
          break;
        case 'extreme':
          filteredResults = normalized.filter(item => Math.abs(item.return_rate) > 20);
          break;
      }
    }

    const finalResults = filteredResults.slice(0, reqLimit);

    res.json({ success: true, data: finalResults, period, total: finalResults.length, asOfDate });
  } catch (error) {
    console.error('rankings error:', error);
    res.status(500).json({ success: false, error: '獲取報酬率排行榜失敗' });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const { period = 'daily', date, market = 'all' } = req.query;

    const statsQuery = `
      WITH latest AS (
        SELECT CASE 
          WHEN :date::date IS NULL THEN (SELECT MAX(date) FROM stock_returns)
          ELSE (SELECT MAX(date) FROM stock_returns WHERE date::date <= :date::date)
        END AS dt
      ),
      sel_returns AS (
        SELECT * FROM (
          SELECT r.*, ROW_NUMBER() OVER (PARTITION BY r.symbol ORDER BY r.date DESC) AS rn
          FROM stock_returns r, latest
          WHERE r.date::date <= latest.dt::date
        ) t WHERE rn = 1
      ),
      prices AS (
        SELECT 
          p.symbol,
          p.date,
          p.close_price,
          p.high_price,
          p.volume,
          AVG(p.close_price) OVER (PARTITION BY p.symbol ORDER BY p.date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS ma20,
          AVG(p.close_price) OVER (PARTITION BY p.symbol ORDER BY p.date ROWS BETWEEN 59 PRECEDING AND CURRENT ROW) AS ma60
        FROM stock_prices p
      ),
      price_sel AS (
        SELECT * FROM (
          SELECT pr.*, ROW_NUMBER() OVER (PARTITION BY pr.symbol ORDER BY pr.date DESC) AS rn
          FROM prices pr, latest
          WHERE pr.date::date <= latest.dt::date
        ) t WHERE rn = 1
      ),
      merged AS (
        SELECT 
          sr.symbol,
          sr.date AS dt,
          (
            CASE 
              WHEN :period = 'daily' THEN sr.daily_return
              WHEN :period = 'weekly' THEN sr.weekly_return
              WHEN :period = 'monthly' THEN sr.monthly_return
              WHEN :period = 'quarterly' THEN sr.quarterly_return
              WHEN :period = 'yearly' THEN sr.yearly_return
            END
          ) AS ret,
          ps.close_price,
          ps.high_price,
          ps.volume,
          ps.ma20,
          ps.ma60,
          (
            SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY t.volume)
            FROM (
              SELECT sp.volume FROM stock_prices sp
              WHERE sp.symbol = sr.symbol AND sp.date <= ps.date
              ORDER BY sp.date DESC LIMIT 20
            ) t
          ) AS vol_med20
        FROM sel_returns sr
        LEFT JOIN price_sel ps ON ps.symbol = sr.symbol
        WHERE sr.symbol NOT LIKE '^%' 
          AND sr.symbol ~ '^[0-9]{4}\\.TW(O)?$'
          AND (
            (:market = 'all' AND sr.symbol ~ '^[0-9]{4}\\.TW(O)?$')
            OR (:market = 'listed' AND sr.symbol ~ '^[0-9]{4}\\.TW$')
            OR (:market = 'otc' AND sr.symbol ~ '^[0-9]{4}\\.TWO$')
          )
      ),
      agg AS (
        SELECT 
          COUNT(*) AS total,
          COUNT(CASE WHEN ret > 0 THEN 1 END) AS rising_stocks,
          COUNT(CASE WHEN ret < 0 THEN 1 END) AS falling_stocks,
          COALESCE(AVG(ret), 0) AS avg_return,
          COALESCE(MAX(ret), 0) AS max_return,
          COALESCE(MIN(ret), 0) AS min_return,
          COALESCE((
            SELECT m2.symbol FROM merged m2
            ORDER BY m2.ret DESC NULLS LAST LIMIT 1
          ), 'N/A') AS top_stock,
          COUNT(CASE WHEN close_price IS NOT NULL AND high_price IS NOT NULL AND close_price > high_price * 0.95 THEN 1 END) AS near_high_stocks,
          COUNT(
            CASE WHEN close_price IS NOT NULL AND dt IS NOT NULL AND close_price > (
              SELECT MAX(sp.close_price) FROM stock_prices sp
              WHERE sp.symbol = merged.symbol
                AND sp.date < merged.dt
                AND sp.date >= merged.dt - INTERVAL '252 days'
            ) THEN 1 END
          ) AS new_high_stocks,
          COUNT(CASE WHEN ma60 IS NOT NULL AND close_price >= ma60 THEN 1 END) AS above_ma60,
          COUNT(CASE WHEN ma20 IS NOT NULL AND close_price >= ma20 THEN 1 END) AS above_ma20,
          COUNT(CASE WHEN ma60 IS NOT NULL AND ma20 IS NOT NULL AND close_price >= ma60 AND close_price >= ma20 THEN 1 END) AS both_above,
          COUNT(CASE WHEN vol_med20 IS NOT NULL AND volume IS NOT NULL AND volume >= vol_med20 * 1.5 THEN 1 END) AS vol_surge_up,
          COUNT(CASE WHEN vol_med20 IS NOT NULL AND volume IS NOT NULL AND volume >= vol_med20 * 2 THEN 1 END) AS over2x_count,
          AVG(CASE WHEN vol_med20 > 0 THEN volume/vol_med20 END) AS median_vol_multiplier,
          SUM(CASE WHEN ret > 0 THEN COALESCE(volume,0) ELSE 0 END) AS up_volume,
          SUM(CASE WHEN ret < 0 THEN COALESCE(volume,0) ELSE 0 END) AS down_volume,
          STDDEV_SAMP(ret) AS ret_stddev
        FROM merged
      )
      SELECT 
        rising_stocks,
        falling_stocks,
        avg_return,
        max_return,
        min_return,
        top_stock,
        near_high_stocks,
        new_high_stocks,
        CASE WHEN total > 0 THEN above_ma60::numeric * 100.0 / total ELSE 0 END AS above_ma60_pct,
        CASE WHEN total > 0 THEN above_ma20::numeric * 100.0 / total ELSE 0 END AS above_ma20_pct,
        CASE WHEN total > 0 THEN both_above::numeric * 100.0 / total ELSE 0 END AS both_above_pct,
        vol_surge_up,
        over2x_count,
        COALESCE(median_vol_multiplier, 0) AS median_vol_multiplier,
        up_volume,
        down_volume,
        CASE WHEN down_volume > 0 THEN up_volume::numeric / down_volume ELSE NULL END AS up_down_ratio,
        COALESCE(ret_stddev, 0) AS market_volatility
      FROM agg;
    `;

    const [stats] = await sequelize.query(statsQuery, { type: QueryTypes.SELECT, replacements: { date: date || null, period, market } });

    const [priceAsOf] = await sequelize.query(
      `SELECT CASE 
         WHEN :date::date IS NULL THEN (SELECT MAX(date) FROM stock_returns)
         ELSE (SELECT MAX(date) FROM stock_returns WHERE date::date <= :date::date)
       END AS as_of`,
      { type: QueryTypes.SELECT, replacements: { date: date || null } }
    );
    const asOfDate = (priceAsOf && priceAsOf.as_of) || null;

    const fracStats = (Math.abs(parseFloat(stats.max_return || 0)) <= 1) && (Math.abs(parseFloat(stats.min_return || 0)) <= 1);
    const scale = v => (fracStats ? toPercentUnit(v) : parseFloat(v));

    res.json({
      success: true,
      data: {
        risingStocks: parseInt(stats.rising_stocks) || 0,
        fallingStocks: parseInt(stats.falling_stocks) || 0,
        avgReturn: scale(stats.avg_return) || 0,
        maxReturn: scale(stats.max_return) || 0,
        minReturn: scale(stats.min_return) || 0,
        topStock: stats.top_stock || 'N/A',
        nearHighStocks: parseInt(stats.near_high_stocks) || 0,
        newHighStocks: parseInt(stats.new_high_stocks) || 0,
        aboveMA60Pct: parseFloat(stats.above_ma60_pct) || 0,
        aboveMA20Pct: parseFloat(stats.above_ma20_pct) || 0,
        bothAbovePct: parseFloat(stats.both_above_pct) || 0,
        volSurgeUp: parseInt(stats.vol_surge_up) || 0,
        over2xCount: parseInt(stats.over2x_count) || 0,
        medianVolMultiplier: parseFloat(stats.median_vol_multiplier) || 0,
        upVolume: parseInt(stats.up_volume) || 0,
        downVolume: parseInt(stats.down_volume) || 0,
        upDownRatio: stats.up_down_ratio === null ? null : parseFloat(stats.up_down_ratio),
        marketVolatility: parseFloat(stats.market_volatility) || 0
      },
      period,
      date: date || null,
      asOfDate
    });
  } catch (error) {
    console.error('statistics error:', error);
    res.status(500).json({ success: false, error: '獲取統計數據失敗', message: error.message });
  }
});

module.exports = router;
