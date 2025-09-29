import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });
// Whether to serve demo responses when DB queries fail
const USE_FALLBACK = String(process.env.USE_FALLBACK).toLowerCase() === 'true';

// Global error handlers to avoid process crash and keep server alive
process.on('unhandledRejection', (reason) => {
  console.error('UnhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('UncaughtException:', err);
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// PostgreSQL pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 's8304021',
  database: process.env.DB_NAME || 'postgres',
});

// Map period to frequency code used in DB
function mapPeriod(period) {
  if (!period) return 'all';
  const p = String(period).toLowerCase();
  if (p.startsWith('day')) return 'D';
  if (p.startsWith('week')) return 'W';
  if (p.startsWith('month')) return 'M';
  if (p.startsWith('quarter')) return 'Q';
  if (p.startsWith('year')) return 'Y';
  return 'all';
}

function toIsoDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function resolveStockDate(client, requestedDate) {
  const isoRequested = toIsoDate(requestedDate);
  if (isoRequested) {
    const check = await client.query('SELECT COUNT(*) AS cnt FROM stock_returns WHERE date = $1', [isoRequested]);
    if (Number(check.rows[0]?.cnt || 0) > 0) return isoRequested;
    const fallback = await client.query('SELECT MAX(date) AS latest FROM stock_returns WHERE date <= $1', [isoRequested]);
    if (fallback.rows[0]?.latest) return fallback.rows[0].latest;
  }
  const latest = await client.query('SELECT MAX(date) AS latest FROM stock_returns');
  return latest.rows[0]?.latest || null;
}

// Health
app.get('/api/health', async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    res.json({ status: 'connected', database: 'PostgreSQL', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'disconnected', error: e.message });
  }
});

// Statistics endpoint expected by front-end
app.get('/api/returns/statistics', async (req, res) => {
  const { period = 'daily', market = 'all', date } = req.query;
  const periodKey = String(period || 'daily').toLowerCase();
  const periodReturnColumns = {
    daily: 'daily_return',
    weekly: 'weekly_return',
    monthly: 'monthly_return',
    quarterly: 'quarterly_return',
    yearly: 'yearly_return',
  };
  const returnColumn = periodReturnColumns[periodKey] || periodReturnColumns.daily;
  const periodWindowDays = {
    daily: 1,
    weekly: 5,
    monthly: 21,
    quarterly: 63,
    yearly: 252,
  };
  const windowDays = periodWindowDays[periodKey] || periodWindowDays.daily;
  let client;
  try {
    client = await pool.connect();
    const targetDate = await resolveStockDate(client, date);

    if (!targetDate) {
      if (!USE_FALLBACK) return res.status(404).json({ error: 'No data available' });
      return res.json({ data: fallbackStats(), asOfDate: date || new Date().toISOString().slice(0, 10), fallback: true });
    }

    const isoDate = toIsoDate(targetDate) || targetDate;

    const metricsSql = `
      WITH base AS (
        SELECT
          r.symbol,
          r.date,
          COALESCE(r.daily_return, 0)::numeric AS daily_return,
          COALESCE(p.volume, 0)::numeric AS volume,
          ROW_NUMBER() OVER (PARTITION BY r.symbol ORDER BY r.date DESC) AS rn
        FROM stock_returns r
        LEFT JOIN stock_prices p ON p.symbol = r.symbol AND p.date = r.date
        LEFT JOIN stock_symbols s ON s.symbol = r.symbol
        WHERE r.date <= $1::date
          AND (
            $2::text = 'all'
            OR s.market = $2::text
          )
      ),
      aggregated AS (
        SELECT
          symbol,
          SUM(daily_return) FILTER (WHERE rn <= $3)::numeric AS period_return,
          MAX(volume) FILTER (WHERE rn = 1)::numeric AS latest_volume
        FROM base
        WHERE rn <= $3
        GROUP BY symbol
      ),
      returns AS (
        SELECT
          a.symbol,
          COALESCE(a.period_return, 0)::numeric AS period_return,
          COALESCE(a.latest_volume, 0)::numeric AS volume
        FROM aggregated a
      ),
      price_today AS (
        SELECT
          sp.symbol,
          COALESCE(sp.high_price, sp.close_price, 0)::numeric AS current_high,
          COALESCE(sp.close_price, 0)::numeric AS current_close,
          COALESCE(sp.low_price, sp.close_price, 0)::numeric AS current_low
        FROM stock_prices sp
        LEFT JOIN stock_symbols s ON s.symbol = sp.symbol
        WHERE sp.date = $1::date
          AND (
            $2::text = 'all'
            OR s.market = $2::text
          )
      ),
      high_52w AS (
        SELECT
          sp.symbol,
          MAX(COALESCE(sp.high_price, sp.close_price, 0))::numeric AS high_52w
        FROM stock_prices sp
        LEFT JOIN stock_symbols s ON s.symbol = sp.symbol
        WHERE sp.date BETWEEN $1::date - INTERVAL '365 days' AND $1::date
          AND (
            $2::text = 'all'
            OR s.market = $2::text
          )
        GROUP BY sp.symbol
      ),
      low_52w AS (
        SELECT
          sp.symbol,
          MIN(COALESCE(sp.low_price, sp.close_price, 0))::numeric AS low_52w
        FROM stock_prices sp
        LEFT JOIN stock_symbols s ON s.symbol = sp.symbol
        WHERE sp.date BETWEEN $1::date - INTERVAL '365 days' AND $1::date
          AND (
            $2::text = 'all'
            OR s.market = $2::text
          )
        GROUP BY sp.symbol
      ),
      ma60 AS (
        SELECT
          sp.symbol,
          AVG(COALESCE(sp.close_price, 0))::numeric AS ma60_value,
          COUNT(*) AS sample_count
        FROM stock_prices sp
        LEFT JOIN stock_symbols s ON s.symbol = sp.symbol
        WHERE sp.date BETWEEN $1::date - INTERVAL '59 days' AND $1::date
          AND (
            $2::text = 'all'
            OR s.market = $2::text
          )
        GROUP BY sp.symbol
      ),
      ma20 AS (
        SELECT
          sp.symbol,
          AVG(COALESCE(sp.close_price, 0))::numeric AS ma20_value,
          COUNT(*) AS sample_count
        FROM stock_prices sp
        LEFT JOIN stock_symbols s ON s.symbol = sp.symbol
        WHERE sp.date BETWEEN $1::date - INTERVAL '19 days' AND $1::date
          AND (
            $2::text = 'all'
            OR s.market = $2::text
          )
        GROUP BY sp.symbol
      )
      SELECT
        COUNT(*) AS total_count,
        SUM(CASE WHEN period_return > 0 THEN 1 ELSE 0 END) AS advancers,
        SUM(CASE WHEN period_return < 0 THEN 1 ELSE 0 END) AS decliners,
        SUM(CASE WHEN period_return = 0 THEN 1 ELSE 0 END) AS unchanged,
        SUM(CASE WHEN period_return >= 0.02 THEN 1 ELSE 0 END) AS greater_2pct,
        SUM(CASE WHEN period_return <= -0.02 THEN 1 ELSE 0 END) AS less_neg_2pct,
        AVG(period_return) AS avg_return,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY volume) AS median_volume,
        SUM(CASE WHEN period_return >= 0 THEN volume ELSE 0 END) AS up_volume,
        SUM(CASE WHEN period_return < 0 THEN volume ELSE 0 END) AS down_volume,
        SUM(CASE WHEN ABS(period_return) >= 0.05 THEN 1 ELSE 0 END) AS high_volatility_count,
        SUM(
          CASE
            WHEN pt.current_high IS NOT NULL
              AND h.high_52w IS NOT NULL
              AND pt.current_high >= h.high_52w * 0.999
            THEN 1 ELSE 0 END
        ) AS new_high_52w,
        SUM(
          CASE
            WHEN pt.current_low IS NOT NULL
              AND l.low_52w IS NOT NULL
              AND pt.current_low <= l.low_52w * 1.001
            THEN 1 ELSE 0 END
        ) AS new_low_52w,
        SUM(CASE WHEN ma20.sample_count >= 10 THEN 1 ELSE 0 END) AS ma20_sample_count,
        SUM(
          CASE
            WHEN ma20.sample_count >= 10
              AND ma20.ma20_value IS NOT NULL
              AND pt.current_close IS NOT NULL
              AND pt.current_close >= ma20.ma20_value
            THEN 1 ELSE 0 END
        ) AS ma20_above_count,
        SUM(CASE WHEN ma.sample_count >= 30 THEN 1 ELSE 0 END) AS ma60_sample_count,
        SUM(
          CASE
            WHEN ma.sample_count >= 30
              AND ma.ma60_value IS NOT NULL
              AND pt.current_close IS NOT NULL
              AND pt.current_close >= ma.ma60_value
            THEN 1 ELSE 0 END
        ) AS ma60_above_count
      FROM returns r
      LEFT JOIN price_today pt ON pt.symbol = r.symbol
      LEFT JOIN high_52w h ON h.symbol = r.symbol
      LEFT JOIN low_52w l ON l.symbol = r.symbol
      LEFT JOIN ma60 ma ON ma.symbol = r.symbol
      LEFT JOIN ma20 ON ma20.symbol = r.symbol
    `;
    const stat = await client.query(metricsSql, [isoDate, (market || 'all'), windowDays] );

    const topSql = `
      WITH base AS (
        SELECT
          r.symbol,
          r.date,
          COALESCE(r.daily_return, 0)::numeric AS daily_return,
          ROW_NUMBER() OVER (PARTITION BY r.symbol ORDER BY r.date DESC) AS rn
        FROM stock_returns r
        LEFT JOIN stock_symbols s ON s.symbol = r.symbol
        WHERE r.date <= $1::date
          AND (
            $2::text = 'all'
            OR s.market = $2::text
          )
      ),
      aggregated AS (
        SELECT
          symbol,
          SUM(daily_return) FILTER (WHERE rn <= $3)::numeric AS period_return
        FROM base
        WHERE rn <= $3
        GROUP BY symbol
      )
      SELECT
        a.symbol,
        a.period_return,
        COALESCE(sp.volume, 0)::numeric AS volume,
        COALESCE(sp.close_price, 0)::numeric AS close_price,
        COALESCE(prev.close_price, 0)::numeric AS prior_close
      FROM aggregated a
      LEFT JOIN stock_prices sp ON sp.symbol = a.symbol AND sp.date = $1::date
      LEFT JOIN stock_prices prev ON prev.symbol = a.symbol AND prev.date = $1::date - ($3::int) * INTERVAL '1 day'
      ORDER BY a.period_return DESC NULLS LAST
      LIMIT 1
    `;
    const top = await client.query(topSql, [isoDate, (market || 'all'), windowDays]);

    const aggregate = stat.rows[0] || {};
    const t = top.rows[0] || null;
    const totalCount = Number(aggregate.total_count || 0);
    const advancers = Number(aggregate.advancers || 0);
    const decliners = Number(aggregate.decliners || 0);
    const unchanged = Number(aggregate.unchanged || 0);
    const greater2 = Number(aggregate.greater_2pct || 0);
    const lessNeg2 = Number(aggregate.less_neg_2pct || 0);
    const avgReturn = Number((aggregate.avg_return || 0) * 100);
    const medianReturn = aggregate.median_return !== null && aggregate.median_return !== undefined ? Number(aggregate.median_return) * 100 : null;
    const medianVolume = aggregate.median_volume !== null && aggregate.median_volume !== undefined ? Number(aggregate.median_volume) : null;
    const upVolume = Number(aggregate.up_volume || 0);
    const downVolume = Number(aggregate.down_volume || 0);
    const upDownVolumeRatio = downVolume === 0 ? null : upVolume / downVolume;
    const highVolCount = Number(aggregate.high_volatility_count || 0);
    const hiVolatilityRatio = totalCount ? (highVolCount / totalCount) * 100 : 0;
    const adRatio = decliners === 0 ? null : advancers / decliners;
    const trendPercent = totalCount ? ((advancers - decliners) / totalCount) * 100 : 0;
    const ma20SampleCount = Number(aggregate.ma20_sample_count || 0);
    const ma20AboveCount = Number(aggregate.ma20_above_count || 0);
    const ma20Ratio = ma20SampleCount ? (ma20AboveCount / ma20SampleCount) * 100 : 0;
    const newHighStocks = Number(aggregate.new_high_52w || 0);
    const newLowStocks = Number(aggregate.new_low_52w || 0);
    const newHighNet = newHighStocks - newLowStocks;
    const ma60SampleCount = Number(aggregate.ma60_sample_count || 0);
    const ma60AboveCount = Number(aggregate.ma60_above_count || 0);
    const ma60Ratio = ma60SampleCount ? (ma60AboveCount / ma60SampleCount) * 100 : 0;
    const ma60TrendPercent = ma60Ratio - ma20Ratio;
    const ma20TrendPercent = ma20Ratio - ma60Ratio;
    const topVolume = Number(t?.volume || 0);
    const topPrice = Number(t?.close_price || 0);
    const topPricePrev = Number(t?.close_price_20 || 0);
    const topReturn = t && t.return_20 !== null && t.return_20 !== undefined ? Number(t.return_20) : 0;

    res.json({
      data: {
        advancers,
        decliners,
        unchanged,
        avgReturn,
        risingStocks: advancers,
        topStock: t ? t.symbol : 'N/A',
        maxReturn: topReturn,
        newHighStocks,
        newLowStocks,
        newHighNet,
        newHigh52w: newHighStocks,
        greater2Count: greater2,
        lessNeg2Count: lessNeg2,
        adRatio: adRatio,
        trendPercent,
        medianReturn,
        ma20Ratio,
        ma20TrendPercent,
        ma20AboveCount,
        ma20SampleCount,
        ma60Ratio,
        ma60TrendPercent,
        ma60AboveCount,
        ma60SampleCount,
        topVolume,
        topPrice,
        topPricePrev,
        medianVolume,
        upDownVolumeRatio,
        hiVolatilityRatio,
        advancersCount: advancers,
        declinersCount: decliners,
        totalCount,
        upVolume,
        downVolume,
        highVolatilityCount: highVolCount,
      },
      asOfDate: isoDate,
    });
  } catch (e) {
    console.warn('statistics error:', e.message);
    if (!USE_FALLBACK) return res.status(500).json({ error: e.message });
    res.json({ data: fallbackStats(), asOfDate: date || new Date().toISOString().slice(0,10), fallback: true });
  } finally {
    try { client && client.release(); } catch {}
  }
});

// Rankings endpoint expected by front-end
app.get('/api/returns/rankings', async (req, res) => {
  const { period = 'daily', market = 'all', industry = 'all', returnRange = 'all', volumeThreshold = 0, date, limit = 50 } = req.query;
  const periodKey = String(period || 'daily').toLowerCase();
  const periodWindowDays = {
    daily: 1,
    weekly: 5,
    monthly: 21,
    quarterly: 63,
    yearly: 252,
  };
  const windowDays = periodWindowDays[periodKey] || periodWindowDays.daily;
  const lim = Math.min(parseInt(limit) || 50, 500);
  let client;
  try {
    client = await pool.connect();
    const targetDate = await resolveStockDate(client, date);

    if (!targetDate) {
      if (!USE_FALLBACK) return res.status(404).json({ error: 'No data available' });
      const now = date || new Date().toISOString().slice(0,10);
      return res.json({ data: demoRankings(now, lim), count: lim, asOfDate: now, fallback: true });
    }

    const isoDate = toIsoDate(targetDate) || targetDate;
    const sql = `
      WITH base AS (
        SELECT
          r.symbol,
          r.date,
          COALESCE(r.daily_return, 0)::numeric AS daily_return,
          ROW_NUMBER() OVER (PARTITION BY r.symbol ORDER BY r.date DESC) AS rn
        FROM stock_returns r
        LEFT JOIN stock_symbols s ON s.symbol = r.symbol
        WHERE r.date <= $1::date
          AND (
            $2::text = 'all'
            OR s.market = $2::text
          )
      ),
      aggregated AS (
        SELECT
          symbol,
          SUM(daily_return) FILTER (WHERE rn <= $3)::numeric AS period_return
        FROM base
        WHERE rn <= $3
        GROUP BY symbol
      )
      SELECT
        a.symbol,
        $1::date AS latest_date,
        COALESCE(a.period_return, 0) AS latest_return_pct,
        COALESCE(p.volume, 0) AS volume,
        COALESCE(p.close_price, 0) AS current_price,
        COALESCE(p.change, 0) AS price_change,
        COALESCE(p.change_percent, 0) AS change_percent,
        s.name AS full_name,
        s.short_name,
        s.market,
        s.industry
      FROM aggregated a
      LEFT JOIN stock_prices p ON p.symbol = a.symbol AND p.date = $1::date
      LEFT JOIN stock_symbols s ON s.symbol = a.symbol
      ORDER BY a.period_return DESC
      LIMIT $4
    `;
    const q = await client.query(sql, [isoDate, (market || 'all'), windowDays, lim]);

    const data = q.rows.map((r, i) => ({
      rank: i + 1,
      symbol: r.symbol,
      name: r.full_name || r.symbol,
      short_name: r.short_name || r.full_name || r.symbol,
      return_rate: Number(r.latest_return_pct * 100),
      volume: Number(r.volume || 0),
      cumulative_return: 0,
      market: r.market || 'all',
      industry: r.industry || 'all',
      current_price: Number(r.current_price || 0),
      price_change: Number(r.price_change || 0),
      change_percent: Number(r.change_percent || 0),
      latest_date: r.latest_date,
    }));
    res.json({ data, count: data.length, asOfDate: isoDate });
  } catch (e) {
    console.warn('rankings error:', e.message);
    if (!USE_FALLBACK) return res.status(500).json({ error: e.message });
    const now = date || new Date().toISOString().slice(0,10);
    res.json({ data: demoRankings(now, lim), count: lim, asOfDate: now, fallback: true });
  } finally {
    try { client && client.release(); } catch {}
  }
});

function fallbackStats() {
  return {
    advancers: 0,
    decliners: 0,
    unchanged: 0,
    avgReturn: 0,
    risingStocks: 0,
    topStock: 'N/A',
    maxReturn: 0,
    newHighStocks: 0,
    newLowStocks: 0,
    newHighNet: 0,
    newHigh52w: 0,
    greater2Count: 0,
    lessNeg2Count: 0,
    adRatio: null,
    trendPercent: 0,
    medianReturn: 0,
    ma20Ratio: 0,
    ma20TrendPercent: 0,
    ma20AboveCount: 0,
    ma20SampleCount: 0,
    ma60Ratio: 0,
    ma60TrendPercent: 0,
    ma60AboveCount: 0,
    ma60SampleCount: 0,
    topVolume: 0,
    medianVolume: 0,
    upDownVolumeRatio: null,
    hiVolatilityRatio: 0,
    advancersCount: 0,
    declinersCount: 0,
    totalCount: 0,
    upVolume: 0,
    downVolume: 0,
    highVolatilityCount: 0,
  };
}

function demoRankings(dateLabel, count) {
  return Array.from({ length: Math.min(count, 50) }).map((_, i) => ({
    rank: i + 1,
    symbol: `DEMO${String(i + 1).padStart(2, '0')}`,
    name: `DEMO${String(i + 1).padStart(2, '0')}`,
    return_rate: Math.round((Math.random() * 10 + 1) * 100) / 100,
    volume: Math.floor(Math.random() * 5_000_000),
    cumulative_return: 0,
    market: 'all',
    industry: 'D',
    current_price: 0,
    price_change: 0,
    latest_date: dateLabel,
  }));
}

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
