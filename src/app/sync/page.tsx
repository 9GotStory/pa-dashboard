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
} from "lucide-react";

// --- CONFIGURATION ---
const YEAR = "2569";
const PROVINCE = "54";
const API_URL = "https://opendata.moph.go.th/api/report_data";

const KPI_LIST = [
  { table: "s_kpi_anc12", sheet: "s_kpi_anc12" },
  { table: "s_anc5", sheet: "s_anc5" },
  { table: "s_kpi_food", sheet: "s_kpi_food" },
  { table: "s_kpi_childdev4", sheet: "s_kpi_childdev4" },
  { table: "s_kpi_childdev2", sheet: "s_kpi_childdev2" },
  { table: "s_aged9", sheet: "s_aged9" },
  { table: "s_dm_screen", sheet: "s_dm_screen" },
  { table: "s_ht_screen", sheet: "s_ht_screen" },
  { table: "s_ncd_screen_repleate1", sheet: "s_ncd_screen_repleate1" },
  { table: "s_ncd_screen_repleate2", sheet: "s_ncd_screen_repleate2" },
  { table: "s_dental_0_5_cavity_free", sheet: "s_dental_0_5_cavity_free" },
  { table: "s_kpi_dental28", sheet: "s_kpi_dental28" },
  { table: "s_kpi_dental33", sheet: "s_kpi_dental33" },
];

type LogType =
  | "start"
  | "info"
  | "success"
  | "error"
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
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

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

    setIsSyncing(true);
    setProgress(0);
    setLogs([]); // Clear old logs
    addLog("Starting Client-Side Sync Process (Static Mode)...", "start");

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < KPI_LIST.length; i++) {
      const kpi = KPI_LIST[i];
      const currentProgress = Math.round((i / KPI_LIST.length) * 100);
      setProgress(currentProgress);

      try {
        // 1. Fetch from MOPH
        addLog(`Fetching ${kpi.table}...`, "fetch");
        const fetchRes = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableName: kpi.table,
            year: YEAR,
            province: PROVINCE,
            type: "json",
          }),
        });

        if (!fetchRes.ok) throw new Error(`MOPH API Error: ${fetchRes.status}`);

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

        // 2. Send to GAS (Client-Side Direct)
        // IMPACT: We use 'text/plain' to facilitate a "Simple Request" and avoid CORS Preflight (OPTIONS) which GAS doesn't support.
        const payload = {
          action: "save_kpi_data",
          tableName: kpi.table,
          sheetName: kpi.sheet,
          data: data,
        };

        const gasRes = await fetch(gasUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify(payload),
        });

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

      // Brief pause to avoid rate limiting (MOPH WAF is sensitive)
      await new Promise((r) => setTimeout(r, 2000));
    }

    setProgress(100);
    setIsSyncing(false);
    addLog(
      `Sync Completed. Success: ${successCount}, Failed: ${failCount}`,
      "finish",
    );
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
        <div className="mb-6 flex items-center justify-between rounded-xl bg-white p-6 shadow-md">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Client-Side Data Sync
            </h1>
            <p className="text-gray-500">MOPH API Bridge & Monitor</p>
          </div>
          <button
            onClick={startSync}
            disabled={isSyncing}
            className={`flex items-center gap-2 rounded-lg px-6 py-3 font-bold text-white shadow-md transition-all ${
              isSyncing
                ? "cursor-not-allowed bg-gray-400"
                : "bg-green-600 hover:bg-green-700 active:scale-95"
            }`}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="animate-spin" /> Syncing...
              </>
            ) : (
              <>
                <RefreshCw /> Start Sync
              </>
            )}
          </button>
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
