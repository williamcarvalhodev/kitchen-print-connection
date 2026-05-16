/**
 * use-print-job.ts v2.0
 * 
 * SIMPLIFICADO: o browser NÃO imprime diretamente.
 * O agente local (agent.js) é o único responsável pela impressão via TCP.
 * O frontend apenas gere os jobs (criar, monitorar, retry).
 */

import { useState, useCallback } from "react";
import { useUpdatePrintJobStatus, type PrintJob } from "./api";

export interface AppSettings {
  printerIp: string;
  printerPort: number;
  protocol: "epos" | "raw";
  pollInterval: number;
  apiKey: string;
  storeName: string;
  autoPrint: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  printerIp: "192.168.0.113",
  printerPort: 9100,
  protocol: "raw",
  pollInterval: 5,
  apiKey: "",
  storeName: "Wagasa Sushi Bar",
  autoPrint: false,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem("kitchen_bridge_settings");
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const saveSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem("kitchen_bridge_settings", JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { settings, saveSettings };
}

export function usePrintJob() {
  const [printerStatus] = useState<"idle" | "printing" | "error" | "offline">("idle");
  const [lastError] = useState<string | null>(null);
  const { mutateAsync: updateStatus } = useUpdatePrintJobStatus();

  // RETRY: apenas repõe o status para "pending"
  // O agente local detecta e imprime automaticamente
  const printJob = useCallback(
    async (job: PrintJob) => {
      try {
        await updateStatus({ id: job.id, data: { status: "pending" } });
        return true;
      } catch {
        return false;
      }
    },
    [updateStatus]
  );

  return {
    printerStatus,
    lastError,
    pendingJobs: [] as PrintJob[],
    isPolling: false,
    printJob,
    retryJob: printJob,
  };
}
