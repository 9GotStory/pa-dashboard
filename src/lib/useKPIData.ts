'use client';

import { useState, useEffect } from 'react';
import type { KPISummary } from './types';
import { paRegistry, processPaSnapshot, type HospitalDetail, type PaSnapshot } from './pa/process';

const API_URL = 'https://script.google.com/macros/s/AKfycbwLnUji6n_z0KANgGMqZchGaqk38CCm7d8nDUggLDHEbsuoXe1e1uPt42ivkEKR0B5H/exec';

export interface UseKPIDataResult {
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

// Bumped V3 → V4: registry tabs now come from meta.kpi_registry (manifest
// driven) instead of a hardcoded pair.
const CACHE_KEY = 'PA_DASHBOARD_CACHE_V4';

export function useKPIData(): UseKPIDataResult {
  const [data, setData] = useState<KPISummary[]>([]);
  const [hospitalMap, setHospitalMap] = useState<Record<string, HospitalDetail>>({});
  const [tambonMap, setTambonMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    // Track cache hits locally so the catch block knows whether the user is
    // already seeing cached data. Reading React state inside the async catch
    // would always see the initial empty array (closure captures mount-time
    // value), causing setError to fire even when cache is on screen.
    let hadCachedData = false;

    // 1. Try to load from LocalStorage (Instant Load)
    const loadFromCache = () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as {
            data?: KPISummary[];
            hospitalMap?: Record<string, HospitalDetail>;
            tambonMap?: Record<string, string>;
            lastUpdated?: string;
          };
          // Valid cache check (optional: check timestamp expiry)
          if (parsed.data && Array.isArray(parsed.data)) {
            console.log('Using cached data');
            hadCachedData = true;
            setData(parsed.data);
            setHospitalMap(parsed.hospitalMap || {});
            setTambonMap(parsed.tambonMap || {});
            setLastUpdated(parsed.lastUpdated || '');
            setIsLoading(false); // Show immediately
          }
        }
      } catch (e) {
        console.warn('Failed to load cache', e);
      }
    };

    loadFromCache();

    // 2. Fetch fresh data (Stale-While-Revalidate)
    async function fetchAllData() {
      // If we didn't have cache, show loading. If we did, keep showing cache while fetching.
      // We don't set isLoading(true) here if we already have data, to prevent flash.

      setError(null);

      try {
        // Parallel fetch all data. Each fetch honors the AbortController so
        // unmounting the component cancels in-flight requests immediately
        // rather than burning bandwidth in the background.
        // Two-phase fetch: BATCH_ALL first (its meta.registry names the KPI
        // registry tabs to pull), then those tabs in parallel. Registry tabs
        // = one per category, so a new category tab is fetched automatically.
        const [batchRes, hospitalsRes, tambonRes] = await Promise.all([
          fetchWithRetry(`${API_URL}?sheet=BATCH_ALL`, 3, signal),
          fetchWithRetry(`${API_URL}?sheet=hospitals`, 3, signal),
          fetchWithRetry(`${API_URL}?sheet=tambon_master`, 3, signal),
        ]);

        const batchJson: PaSnapshot['BATCH_ALL'] = await batchRes.json();
        const hospitalsData: PaSnapshot['hospitals'] = await hospitalsRes.json();
        const tambonData: PaSnapshot['tambon_master'] = await tambonRes.json();

        const registry = paRegistry(batchJson);
        const registryRows = await Promise.all(
          registry.map((entry) => fetchWithRetry(`${API_URL}?sheet=${encodeURIComponent(entry.sheet)}`, 3, signal)),
        );
        const registryJson: PaSnapshot['registry'][string][] = await Promise.all(
          registryRows.map((res) => res.json()),
        );

        // The live responses in the shape of the snapshot of PA (SCHEMA §7),
        // processed by the same function as the build.
        const {
          data: orderedReports,
          hospitalMap: hMap,
          tambonMap: tMap,
          lastUpdated: formattedLastUpdated,
        } = processPaSnapshot({
          BATCH_ALL: batchJson,
          hospitals: hospitalsData,
          tambon_master: tambonData,
          registry: Object.fromEntries(registry.map((entry, i) => [entry.sheet, registryJson[i]])),
        });

        // Bail out if the component unmounted mid-fetch so we don't
        // write state onto an unmounted component. Aborted requests also
        // short-circuit earlier via the catch block below.
        if (signal.aborted) return;

        setData(orderedReports);
        setHospitalMap(hMap);
        setTambonMap(tMap);
        setLastUpdated(formattedLastUpdated);

        // Cache the fresh data. Isolated try-catch so a quota error never
        // surfaces as a "fetch failed" message — the UI already has the data.
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: orderedReports,
            hospitalMap: hMap,
            tambonMap: tMap,
            lastUpdated: formattedLastUpdated,
            timestamp: Date.now(),
          }));
        } catch (e) {
          console.warn('Failed to save cache', e);
        }

      } catch (err) {
        // Expected when the component unmounts mid-fetch — no error UI.
        if (isAbortError(err)) return;
        console.error('Error fetching KPI data:', err);
        // Only surface the error to UI if the user has nothing to look at.
        // If cache was loaded synchronously above, keep showing it (SWR-style).
        if (!hadCachedData) {
           setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        }
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    }

    fetchAllData();

    return () => {
      controller.abort();
    };
  }, []);

  return {
    data,
    hospitalMap,
    tambonMap,
    isLoading,
    error,
    lastUpdated,
  };
}
