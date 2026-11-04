import type { DcReportData } from "./types";

// The report pages' data in the browser (SPEC §9.5): each
// /data/reports/{id}.json is fetched once per page load, so changing a
// filter never asks the network again. A failed load is not kept, so asking
// again retries it.
const loads = new Map<string, Promise<DcReportData>>();

export function loadReport(id: string): Promise<DcReportData> {
  let load = loads.get(id);
  if (!load) {
    load = fetch(`/data/reports/${encodeURIComponent(id)}.json`).then((res) => {
      if (!res.ok) throw new Error(`/data/reports/${id}.json: HTTP ${res.status}`);
      return res.json() as Promise<DcReportData>;
    });
    load.catch(() => loads.delete(id));
    loads.set(id, load);
  }
  return load;
}
