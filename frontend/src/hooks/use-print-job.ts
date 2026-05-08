import { useState, useEffect, useCallback, useRef } from "react";
import {
  useGetPendingPrintJobs,
  useUpdatePrintJobStatus,
  type PrintJob,
  type OrderData,
} from "./api";

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
  printerIp: "192.168.0.103",
  printerPort: 9100,
  protocol: "epos",
  pollInterval: 5,
  apiKey: "",
  storeName: "Minha Loja",
  autoPrint: false,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem("kitchen_bridge_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed, autoPrint: false };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const saveSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings, autoPrint: false };
      localStorage.setItem("kitchen_bridge_settings", JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { settings, saveSettings };
}

function buildEposXml(order: OrderData, storeName: string): string {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const itemsXml = order.items
    .map((item) => {
      const variation = item.variation ? ` (${item.variation})` : "";
      const notes = item.notes
        ? `      <text>  * ${escapeXml(item.notes)}\n</text>\n`
        : "";
      return `      <text>${item.quantity}x ${escapeXml(item.name)}${escapeXml(variation)}\n</text>\n${notes}`;
    })
    .join("");

  const phone = order.customerPhone
    ? `      <text>Tel: ${escapeXml(order.customerPhone)}\n</text>\n`
    : "";
  const address = order.deliveryAddress
    ? `      <text>Endereco: ${escapeXml(order.deliveryAddress)}\n</text>\n`
    : "";
  const notes = order.notes
    ? `      <text>Obs: ${escapeXml(order.notes)}\n\n</text>\n`
    : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
      <text align="center" smooth="true" double="true">${escapeXml(storeName)}\n</text>
      <text align="center">--- PEDIDO #${escapeXml(order.orderNumber)} ---\n</text>
      <text>\n</text>
      <text>Cliente: ${escapeXml(order.customerName)}\n</text>
${phone}      <text>Data: ${escapeXml(order.date)}\n</text>
      <text>Entrega: ${escapeXml(order.deliveryMethod)}\n</text>
${address}      <text>\n</text>
      <text>--- ITENS ---\n</text>
${itemsXml}      <text>\n</text>
${notes}      <text>--- PAGAMENTO ---\n</text>
      <text>Total: ${escapeXml(order.total)}\n</text>
      <text>Metodo: ${escapeXml(order.paymentMethod)}\n</text>
      <feed unit="20"/>
      <cut type="feed"/>
    </epos-print>
  </s:Body>
</s:Envelope>`;
}

export function usePrintJob() {
  const { settings } = useSettings();
  const [printerStatus, setPrinterStatus] = useState
    "idle" | "printing" | "error" | "offline"
  >("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  const { mutateAsync: updateStatus } = useUpdatePrintJobStatus();

  const { data: pendingJobs = [], isFetching } = useGetPendingPrintJobs({
    refetchInterval: settings.pollInterval * 1000,
    enabled: true,
  });

  const isProcessingRef = useRef(false);

  const printJob = useCallback(
    async (job: PrintJob) => {
      try {
        setPrinterStatus("printing");
        setLastError(null);
        await updateStatus({ id: job.id, data: { status: "printing" } });
        const xml = buildEposXml(job.orderData, settings.storeName);
        const printerUrl = `http://${settings.printerIp}:${settings.printerPort}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(printerUrl, {
          method: "POST",
          headers: { "Content-Type": "text/xml; charset=utf-8" },
          body: xml,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Printer returned HTTP ${response.status}`);
        const responseText = await response.text();
        if (responseText.includes('success="false"')) {
          throw new Error('Printer returned success="false"');
        }
        await updateStatus({ id: job.id, data: { status: "done" } });
        setPrinterStatus("idle");
        return true;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        setLastError(errMsg);
        setPrinterStatus("error");
        try {
          await updateStatus({
            id: job.id,
            data: { status: "error", errorMessage: errMsg },
          });
        } catch {}
        return false;
      }
    },
    [settings, updateStatus]
  );

  useEffect(() => {
    const processQueue = async () => {
      if (pendingJobs.length === 0 || isProcessingRef.current) return;
      isProcessingRef.current = true;
      for (const job of pendingJobs) {
        await printJob(job);
        await new Promise((r) => setTimeout(r, 1000));
      }
      isProcessingRef.current = false;
    };
    processQueue();
  }, [pendingJobs, printJob]);

  return {
    printerStatus,
    lastError,
    pendingJobs,
    isPolling: isFetching,
    printJob,
    retryJob: printJob,
  };
}
