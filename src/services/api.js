// Basic API service wrapper
export const API_BASE_URL = `${window.location.origin}/api`;

export async function httpGet(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    url.searchParams.set(k, String(v));
  });
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// Placeholders to be expanded in next steps
export async function fetchRankings({ period, market, industry, returnRange, volumeThreshold, date, limit = 50 }) {
  try {
    const json = await httpGet('/returns/rankings', { period, market, industry, returnRange, volumeThreshold, date, limit });
    return json?.data ?? [];
  } catch (e) {
    console.warn('fetchRankings error', e);
    return [];
  }
}

export async function fetchStatistics({ period, market, date }) {
  try {
    const json = await httpGet('/returns/statistics', { period, market, date });
    return { data: json?.data ?? null, asOfDate: json?.asOfDate ?? null };
  } catch (e) {
    console.warn('fetchStatistics error', e);
    return { data: null, asOfDate: null };
  }
}
