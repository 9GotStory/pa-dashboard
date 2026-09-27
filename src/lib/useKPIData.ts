'use client';

import { useState, useEffect } from 'react';
import type { DashboardDataset, KPISummary } from './types';
import {
  buildDashboardModel,
  parseDashboardResponse,
  parseFacilitiesResponse,
  parseKpiCatalogResponse,
  parseTambonsResponse,
  type DashboardModel,
  type HospitalDetail,
} from './dashboard-data';

// Same-origin Backend v2 endpoints only — no external hosts, no env overrides.
const DASHBOARD_ENDPOINT = '/api/v1/dashboard';
const KPIS_ENDPOINT = '/api/v1/kpis';
const FACILITIES_ENDPOINT = '/api/v1/facilities';
const TAMBONS_ENDPOINT = '/api/v1/tambons';

export interface UseKPIDataResult {
  dataset: DashboardDataset | null;
  data: KPISummary[];
  hospitalMap: Record<string, HospitalDetail>;
  tambonMap: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

async function fetchWithRetry(
  url: string,
  retries = 3,
  signal?: AbortSignal,
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    // Bail out immediately if the caller already aborted — no point retrying.
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      // User-initiated cancel: surface right away, don't burn retries.
      if (isAbortError(err)) throw err;
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Retries failed');
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetchWithRetry(url, 3, signal);
  try {
    return await res.json();
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new Error(`Malformed JSON from ${url}`);
  }
}

type LoadResult =
  | { dataset: null }
  | { dataset: DashboardDataset; model: DashboardModel };

async function loadDashboard(signal: AbortSignal): Promise<LoadResult> {
  // STEP 1 — the active dataset is the authority. A `dataset: null` +
  // empty-results response is a normal state, not an error, and means the
  // remaining endpoints hold nothing to render.
  const dashboard = parseDashboardResponse(
    await fetchJson(DASHBOARD_ENDPOINT, signal),
  );

  if (dashboard.dataset === null) {
    return { dataset: null };
  }

  // STEP 2 — catalog + references in parallel. React state is committed
  // only after every response succeeded AND the combined payload validated,
  // so a partial dashboard state can never reach the UI.
  const [kpis, facilities, tambons] = await Promise.all([
    fetchJson(KPIS_ENDPOINT, signal).then(parseKpiCatalogResponse),
    fetchJson(FACILITIES_ENDPOINT, signal).then(parseFacilitiesResponse),
    fetchJson(TAMBONS_ENDPOINT, signal).then(parseTambonsResponse),
  ]);

  return {
    dataset: dashboard.dataset,
    model: buildDashboardModel({
      dataset: dashboard.dataset,
      results: dashboard.results,
      kpis,
      facilities,
      tambons,
    }),
  };
}

export function useKPIData(): UseKPIDataResult {
  const [dataset, setDataset] = useState<DashboardDataset | null>(null);
  const [data, setData] = useState<KPISummary[]>([]);
  const [hospitalMap, setHospitalMap] = useState<Record<string, HospitalDetail>>({});
  const [tambonMap, setTambonMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    loadDashboard(signal)
      .then((result) => {
        // Unmounted mid-load — don't write state onto a dead component.
        if (signal.aborted) return;
        if (result.dataset === null) {
          // Authoritative no-active state: no data, no error, not loading.
          setDataset(null);
          setData([]);
          setHospitalMap({});
          setTambonMap({});
          setLastUpdated('');
          setError(null);
        } else {
          setDataset(result.dataset);
          setData(result.model.summaries);
          setHospitalMap(result.model.hospitalMap);
          setTambonMap(result.model.tambonMap);
          setLastUpdated(result.model.lastUpdated);
          setError(null);
        }
      })
      .catch((err) => {
        // Expected when the component unmounts mid-fetch — no error UI.
        if (isAbortError(err) || signal.aborted) return;
        console.error('Error loading dashboard data:', err);
        // No stale fallback: a fresh failure must surface, never pose as data.
        setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      })
      .finally(() => {
        if (!signal.aborted) setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, []);

  return {
    dataset,
    data,
    hospitalMap,
    tambonMap,
    isLoading,
    error,
    lastUpdated,
  };
}
