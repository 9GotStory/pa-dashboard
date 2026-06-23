"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Lock,
  RefreshCw,
  CheckCircle,
  XCircle,
  Terminal,
  Rocket,
  CloudDownload,
  Database,
  Flag,
  CalendarClock,
} from "lucide-react";

// --- CONFIGURATION ---
// Only static, non-configurable values live here. Year, province, and the
// KPI list itself are pulled from BATCH_ALL meta at runtime so the frontend
// never duplicates Code.gs CONFIG (which caused drift in the past).
const API_URL = "https://opendata.moph.go.th/api/report_data";

interface KpiListItem {
  table: string;
  sheet: string;
}

interface SyncSettings {
  current_year: string;
  province_code: string;
}

type LogType =
  | "start"
  | "info"
  | "success"
  | "error"
  | "warn"
  | "finish"
  | "fetch"
  | "upload";

interface LogEntry {
  timestamp: string;
  message: string;
  type: LogType;
}

export default function SyncPage() {
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Runtime config pulled from BATCH_ALL meta. kpiList/settings start empty
  // and are populated by fetchMetadata() after authentication.
  const [kpiList, setKpiList] = useState<KpiListItem[]>([]);
  const [settings, setSettings] = useState<SyncSettings | null>(null);
  const [selectedKPIs, setSelectedKPIs] = useState<string[]>([]);
  const [lastUpdatedMap, setLastUpdatedMap] = useState<Record<string, string>>(
    {},
  );
  const [metaError, setMetaError] = useState<string | null>(null);

  // Guards first-time default selection so a subsequent Clear by the user
  // is not overridden when fetchMetadata() refreses after a sync completes.
  const hasInitializedSelection = useRef(false);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Fetch Metadata after login
  useEffect(() => {
    if (isAuthenticated) {
      fetchMetadata();
    }
  }, [isAuthenticated]);

  const fetchMetadata = async () => {
    setIsFetchingMeta(true);
    setMetaError(null);
    addLog("Fetching metadata to check last updated status...", "info");

    const gasUrl = process.env.NEXT_PUBLIC_GAS_SCRIPT_URL;
    if (!gasUrl || gasUrl.includes("YOUR_SCRIPT_ID")) {
      const msg = "Cannot fetch metadata: NEXT_PUBLIC_GAS_SCRIPT_URL is not set.";
      addLog(msg, "warn");
      setMetaError(msg);
      setIsFetchingMeta(false);
      return;
    }

    try {
      const res = await fetch(`${gasUrl}?sheet=BATCH_ALL`);
      if (!res.ok) throw new Error(`BATCH_ALL HTTP ${res.status}`);
      const json = await res.json();
      const meta = json?.meta;
      if (!meta) {
        throw new Error("BATCH_ALL response is missing meta — deploy the latest Code.gs version.");
      }

      if (Array.isArray(meta.kpi_config)) {
        // Only `table` is required. If `sheet` is missing (older Code.gs
        // deployments before the sheet field was added), fall back to using
        // the table name as the sheet name — they are identical for every
        // entry in CONFIG.KPIS today.
        const list: KpiListItem[] = meta.kpi_config
          .filter((k: any) => k && k.table)
          .map((k: any) => ({
            table: String(k.table),
            sheet: String(k.sheet || k.table),
          }));
        setKpiList(list);
        if (list.length > 0 && !meta.kpi_config[0].sheet) {
          addLog(
            "Note: deployed Code.gs is older — using table name as sheet fallback. Deploy latest Code.gs to remove this warning.",
            "warn",
          );
        }
        // Default-select every KPI on the FIRST successful load only.
        // Using a ref guard (not prev.length === 0) preserves a user's
        // intentional "Clear" across the post-sync metadata refresh.
        if (!hasInitializedSelection.current && list.length > 0) {
          setSelectedKPIs(list.map((k) => k.table));
          hasInitializedSelection.current = true;
        }
      }

      // current_year is the only strictly-required field for sync.
      // province_code falls back to CONFIG default at the GAS layer when the
      // sheet omits it, so accept either presence here.
      if (meta.current_year) {
        setSettings({
          current_year: String(meta.current_year),
          province_code: meta.province_code ? String(meta.province_code) : "",
        });
      }

      if (meta.lastUpdatedMap) {
        setLastUpdatedMap(meta.lastUpdatedMap);
      }
      addLog("Metadata loaded successfully.", "success");
    } catch (e: any) {
      console.error(e);
      const msg = e.message || "Unknown error";
      addLog(`Failed to load metadata: ${msg}`, "error");
      setMetaError(msg);
    } finally {
      setIsFetchingMeta(false);
    }
  };

  const addLog = (msg: string, type: LogType = "info") => {
    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString(),
        message: msg,
        type: type,
      },
    ]);
  };

  const checkPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const serverPin = process.env.NEXT_PUBLIC_SYNC_PIN_CODE;

    // Fallback if env not set
    if (!serverPin) {
      alert("Configuration Error: NEXT_PUBLIC_SYNC_PIN_CODE is not set!");
      return;
    }

    if (pin === serverPin) {
      setIsAuthenticated(true);
    } else {
      alert("Incorrect PIN");
      setPin("");
    }
  };

  const startSync = async () => {
    if (isSyncing) return;

    const gasUrl = process.env.NEXT_PUBLIC_GAS_SCRIPT_URL;
    if (!gasUrl || gasUrl.includes("YOUR_SCRIPT_ID")) {
      alert(
        "Configuration Error: NEXT_PUBLIC_GAS_SCRIPT_URL is not set or invalid!",
      );
      return;
    }

    if (!settings || kpiList.length === 0) {
      alert(
        "Settings or KPI list not loaded yet. Wait for metadata to finish loading, then try again.",
      );
      return;
    }

    setIsSyncing(true);
    setProgress(0);
    setLogs([]); // Clear old logs
    addLog(
      `Starting Client-Side Sync (year=${settings.current_year}, province=${settings.province_code})...`,
      "start",
    );

    const kpisToSync = kpiList.filter((kpi) =>
      selectedKPIs.includes(kpi.table),
    );

    if (kpisToSync.length === 0) {
      addLog("No KPIs selected for sync. Aborting.", "warn");
      setIsSyncing(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < kpisToSync.length; i++) {
      const kpi = kpisToSync[i];
      const currentProgress = Math.round((i / kpisToSync.length) * 100);
      setProgress(currentProgress);

      try {
        // 1. Fetch from MOPH with Retry Logic (to handle CORS/WAF blocks)
        let fetchRes;
        let retries = 3;
        let delayMs = 5000;

        while (retries > 0) {
          try {
            fetchRes = await fetch(API_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tableName: kpi.table,
                year: settings.current_year,
                province: settings.province_code,
                type: "json",
              }),
            });
            break; // Success, exit retry loop
          } catch (err: any) {
            // TypeError usually indicates a network or CORS error
            if (err.message === "Failed to fetch" || err.name === "TypeError") {
              retries--;
              if (retries === 0)
                throw new Error("CORS/Network Error after multiple retries");
              addLog(
                `ถูกบล็อก (CORS/Rate Limit). รอ ${delayMs / 1000} วิ แล้วลองใหม่...`,
                "warn",
              );
              await new Promise((r) => setTimeout(r, delayMs));
              delayMs += 5000; // Increase delay progressively
            } else {
              throw err;
            }
          }
        }

        if (!fetchRes || !fetchRes.ok) {
          throw new Error(`MOPH API Error: ${fetchRes?.status}`);
        }

        const rawText = await fetchRes.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          if (rawText.trim().startsWith("<")) {
            throw new Error(
              "MOPH returned HTML instead of JSON (Possible Cloudflare block?)",
            );
          }
          throw new Error("Invalid JSON response");
        }

        if (!Array.isArray(data))
          throw new Error("API response is not an array");

        addLog(
          `Received ${data.length} rows. Uploading to Google Sheets...`,
          "upload",
        );

        // 2. Send to GAS (Client-Side Direct) with retry
        // IMPACT: We use 'text/plain' to facilitate a "Simple Request" and avoid CORS Preflight (OPTIONS) which GAS doesn't support.
        // Retry mirrors the MOPH fetch loop: GAS Web Apps can return transient
        // network errors ("Failed to fetch") that resolve on a second attempt.
        // Idempotency: saveDataToSheet() clears the sheet before writing, so
        // re-uploading the same payload after a partial failure is safe.
        const payload = {
          action: "save_kpi_data",
          tableName: kpi.table,
          sheetName: kpi.sheet,
          data: data,
        };

        let gasRes;
        let gasRetries = 3;
        let gasDelayMs = 3000;

        while (gasRetries > 0) {
          try {
            gasRes = await fetch(gasUrl, {
              method: "POST",
              headers: {
                "Content-Type": "text/plain;charset=utf-8",
              },
              body: JSON.stringify(payload),
            });
            break; // Success, exit retry loop
          } catch (err: any) {
            if (
              err.message === "Failed to fetch" ||
              err.name === "TypeError"
            ) {
              gasRetries--;
              if (gasRetries === 0)
                throw new Error(
                  "GAS upload failed (Network) after multiple retries",
                );
              addLog(
                `อัปโหลดล้มเหลว (Network). รอ ${gasDelayMs / 1000} วิ แล้วลองใหม่...`,
                "warn",
              );
              await new Promise((r) => setTimeout(r, gasDelayMs));
              gasDelayMs += 3000;
            } else {
              throw err;
            }
          }
        }

        if (!gasRes || !gasRes.ok) {
          throw new Error(`GAS HTTP Error: ${gasRes?.status}`);
        }

        const gasJson = await gasRes.json();

        if (gasJson.status === "success") {
          addLog(`Success: ${kpi.table} synced.`, "success");
          successCount++;
        } else {
          throw new Error(gasJson.message || "Unknown GAS Error");
        }
      } catch (error: any) {
        console.error(error);
        addLog(`Failed ${kpi.table}: ${error.message}`, "error");
        failCount++;
      }

      // Random pause between 4 to 7 seconds to avoid rate limiting
      // WAFs often block exact interval requests (bot detection)
      const randomDelay = 4000 + Math.floor(Math.random() * 3000);
      await new Promise((r) => setTimeout(r, randomDelay));
    }

    setProgress(100);
    setIsSyncing(false);
    addLog(
      `Sync Completed. Success: ${successCount}, Failed: ${failCount}`,
      "finish",
    );

    // Refresh metadata to show new dates
    fetchMetadata();
  };

  const getIconForLog = (type: LogType) => {
    switch (type) {
      case "start":
        return <Rocket size={16} className="text-blue-400" />;
      case "success":
        return <CheckCircle size={16} className="text-green-400" />;
      case "error":
        return <XCircle size={16} className="text-red-400" />;
      case "finish":
        return <Flag size={16} className="text-yellow-400" />;
      case "fetch":
        return <CloudDownload size={16} className="text-cyan-400" />;
      case "upload":
        return <Database size={16} className="text-purple-400" />;
      case "info":
      default:
        return <Terminal size={16} className="text-gray-400" />;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 p-4">
        <form
          onSubmit={checkPin}
          className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl"
        >
          <div className="mb-6 flex justify-center text-blue-600">
            <Lock size={48} />
          </div>
          <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
            System Access
          </h1>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="mb-4 w-full rounded-lg border border-gray-300 p-3 text-center text-2xl tracking-widest outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="PIN CODE"
            maxLength={4}
            autoFocus
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 active:scale-95"
          >
            Unlock Sync Manager
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col gap-4 rounded-xl bg-white p-6 shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold text-gray-800">
              Client-Side Data Sync
            </h1>
            <p className="text-gray-500">MOPH API Bridge & Monitor</p>
          </div>
          {metaError ? (
            <button
              onClick={fetchMetadata}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-3 font-bold text-white shadow-md transition-all hover:bg-amber-700 active:scale-95 sm:w-auto"
            >
              <RefreshCw /> Retry config load
            </button>
          ) : (
            <button
              onClick={startSync}
              disabled={isSyncing || !settings || kpiList.length === 0}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-bold text-white shadow-md transition-all sm:w-auto ${
                isSyncing || !settings || kpiList.length === 0
                  ? "cursor-not-allowed bg-gray-400"
                  : "bg-green-600 hover:bg-green-700 active:scale-95"
              }`}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="animate-spin" /> Syncing...
                </>
              ) : !settings || kpiList.length === 0 ? (
                <>
                  <RefreshCw className="animate-spin" /> Loading config...
                </>
              ) : (
                <>
                  <RefreshCw /> Start Targeted Sync
                </>
              )}
            </button>
          )}
        </div>

        {metaError && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">Could not load config from server.</p>
            <p className="text-amber-700 break-words">{metaError}</p>
            <p className="mt-2 text-xs text-amber-600">
              Check that Code.gs is deployed with the latest version, then click
              "Retry config load".
            </p>
          </div>
        )}

        {/* KPI Selection Section */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-md border border-slate-100">
          <div className="flex justify-between items-end mb-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                Select Indicators to Sync
              </h2>
              <p className="text-sm text-gray-500">
                {selectedKPIs.length} of {kpiList.length} selected
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <button
                onClick={() => setSelectedKPIs(kpiList.map((k) => k.table))}
                className="text-brand-600 hover:text-brand-700 font-medium"
                disabled={isSyncing || kpiList.length === 0}
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => setSelectedKPIs([])}
                className="text-slate-500 hover:text-slate-700 font-medium"
                disabled={isSyncing}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {kpiList.length === 0 ? (
              <p className="text-sm text-slate-400 italic col-span-full text-center py-6">
                Loading KPI list from server...
              </p>
            ) : (
              kpiList.map((kpi) => {
              const isSelected = selectedKPIs.includes(kpi.table);
              const lastUpdated = lastUpdatedMap[kpi.table];

              // Format Date if exists
              let dateStrOut = "No data / Never synced";
              let dateColor = "text-slate-400";
              if (lastUpdated) {
                try {
                  let d = new Date(lastUpdated);

                  // Handle MOPH format YYYYMMDDHHmm (e.g., "202602221224")
                  const dateStr = String(lastUpdated);
                  if (dateStr.length === 12 && /^\d+$/.test(dateStr)) {
                    const y = parseInt(dateStr.substring(0, 4));
                    const m = parseInt(dateStr.substring(4, 6)) - 1;
                    const day = parseInt(dateStr.substring(6, 8));
                    const h = parseInt(dateStr.substring(8, 10));
                    const min = parseInt(dateStr.substring(10, 12));
                    d = new Date(y, m, day, h, min);
                  }

                  if (!isNaN(d.getTime())) {
                    dateStrOut = d.toLocaleString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    // Simple heuristic: if date is within last 2 days, green, else orange
                    const now = new Date();
                    const diffDays =
                      (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
                    if (diffDays <= 2)
                      dateColor = "text-emerald-500 font-medium";
                    else if (diffDays <= 7)
                      dateColor = "text-amber-500 font-medium";
                    else dateColor = "text-orange-500 font-medium";
                  } else {
                    dateStrOut = String(lastUpdated);
                  }
                } catch (e) {
                  dateStrOut = String(lastUpdated);
                }
              }

              return (
                <label
                  key={kpi.table}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-brand-50/30 border-brand-200"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  } ${isSyncing ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedKPIs([...selectedKPIs, kpi.table]);
                      } else {
                        setSelectedKPIs(
                          selectedKPIs.filter((id) => id !== kpi.table),
                        );
                      }
                    }}
                    className="mt-1 w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                    disabled={isSyncing}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium text-slate-800 truncate"
                      title={kpi.table}
                    >
                      {kpi.table}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <CalendarClock className={`w-3.5 h-3.5 ${dateColor}`} />
                      <span className={`text-[11px] ${dateColor}`}>
                        {isFetchingMeta ? "Loading..." : dateStrOut}
                      </span>
                    </div>
                  </div>
                </label>
              );
            })
            )}
          </div>
        </div>

        {/* Progress Section */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-md">
          <div className="flex justify-between text-sm font-semibold text-gray-600 mb-2">
            <span>Overall Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Console Logs */}
        <div className="rounded-xl bg-gray-900 p-6 shadow-xl font-mono text-sm leading-relaxed min-h-[400px] flex flex-col">
          <div className="flex items-center gap-2 text-gray-400 mb-4 border-b border-gray-700 pb-2">
            <Terminal size={16} />
            <span>System Console</span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[500px] space-y-2">
            {logs.length === 0 ? (
              <span className="text-gray-600 italic">Ready to sync...</span>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {getIconForLog(log.type)}
                  </div>
                  <div className="flex flex-col">
                    <span
                      className={`break-words ${
                        log.type === "error"
                          ? "text-red-300"
                          : log.type === "success"
                            ? "text-green-300"
                            : log.type === "start"
                              ? "text-blue-300 font-bold"
                              : log.type === "finish"
                                ? "text-yellow-300 font-bold"
                                : "text-gray-300"
                      }`}
                    >
                      {log.message}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {log.timestamp}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400">
          Secure Sync Manager • Protected Node • PA Dashboard
        </div>
      </div>
    </div>
  );
}
