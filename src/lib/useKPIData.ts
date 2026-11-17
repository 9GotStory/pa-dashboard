'use client';

import { useState, useEffect } from 'react';
import { paRegistry, processPaSnapshot, type PaSnapshot, type ProcessedPa } from './pa/process';

const API_URL = 'https://script.google.com/macros/s/AKfycbwLnUji6n_z0KANgGMqZchGaqk38CCm7d8nDUggLDHEbsuoXe1e1uPt42ivkEKR0B5H/exec';

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

// Starts from the build's processed snapshot of PA, which the page's HTML
// already shows, then fetches GAS in the background and swaps the live
// result in. If GAS fails the build's numbers stay, with no error shown
// (SPEC §4, ADR-0017).
export function useKPIData(initial: ProcessedPa): ProcessedPa {
  const [pa, setPa] = useState(initial);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function fetchAllData() {
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
        const live = processPaSnapshot({
          BATCH_ALL: batchJson,
          hospitals: hospitalsData,
          tambon_master: tambonData,
          registry: Object.fromEntries(registry.map((entry, i) => [entry.sheet, registryJson[i]])),
        });

        // Bail out if the component unmounted mid-fetch so we don't
        // write state onto an unmounted component. Aborted requests also
        // short-circuit earlier via the catch block below.
        if (signal.aborted) return;

        setPa(live);
      } catch (err) {
        // Expected when the component unmounts mid-fetch.
        if (isAbortError(err)) return;
        // The build's numbers stay on screen: no error UI.
        console.error('Error fetching KPI data:', err);
      }
    }

    fetchAllData();

    return () => {
      controller.abort();
    };
  }, []);

  return pa;
}
