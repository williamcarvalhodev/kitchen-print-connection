import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = "/api";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export interface OrderItem {
  name: string;
  quantity: number;
  variation?: string;
  notes?: string;
}

export interface OrderData {
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryMethod: string;
  paymentMethod: string;
  total: string;
  date: string;
  items: OrderItem[];
  notes?: string;
}

export interface PrintJob {
  id: number;
  orderId: string;
  status: string;
  orderData: OrderData;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  printedAt: string | null;
}

export interface PrintJobStats {
  pending: number;
  printing: number;
  done: number;
  error: number;
  total: number;
  todayPrinted: number;
}

export interface ApiSettings {
  printerIp: string;
  printerPort: number;
  printerProtocol: string;
  autoRetry: boolean;
  retryIntervalSeconds: number;
  apiKey: string;
  storeName: string;
}

export function useHealthCheck(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["healthz"],
    queryFn: () => apiFetch<{ status: string }>("/healthz"),
    refetchInterval: options?.refetchInterval,
  });
}

export function useListPrintJobs(
  params?: { status?: string; limit?: number },
  options?: { refetchInterval?: number }
) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.limit) query.set("limit", String(params.limit));
  return useQuery({
    queryKey: ["print-jobs", params],
    queryFn: () => apiFetch<PrintJob[]>(`/print-jobs?${query.toString()}`),
    refetchInterval: options?.refetchInterval,
  });
}

export function useGetPendingPrintJobs(options?: {
  refetchInterval?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["print-jobs", "pending"],
    queryFn: () => apiFetch<PrintJob[]>("/print-jobs/pending"),
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
  });
}

export function useGetPrintJobStats(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["print-jobs", "stats"],
    queryFn: () => apiFetch<PrintJobStats>("/print-jobs/stats"),
    refetchInterval: options?.refetchInterval,
  });
}

export function useUpdatePrintJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status: string; errorMessage?: string } }) =>
      apiFetch<PrintJob>(`/print-jobs/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["print-jobs"] });
    },
  });
}
