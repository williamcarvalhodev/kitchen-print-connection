import { useState, useEffect, useCallback } from "react";
import { usePrintJob, useSettings } from "@/hooks/use-print-job";
import { useGetPrintJobStats } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Printer, CheckCircle2, Clock, ChefHat, Phone, MapPin, CheckCheck } from "lucide-react";

interface WcOrder {
  id: number;
  orderNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  total: string;
  currency: string;
  paymentMethod: string;
  deliveryMethod: string;
  deliveryAddress: string | null;
  items: { name: string; quantity: number; total: string }[];
  status: string;
}

export default function Dashboard() {
  const { settings } = useSettings();
  const { printerStatus, lastError } = usePrintJob();
  const { data: stats } = useGetPrintJobStats({ refetchInterval: 5000 });

  const [wcOrders, setWcOrders] = useState<WcOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [completingId, setCompletingId] = useState<number | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/wc/orders/processing");
      if (res.ok) setWcOrders(await res.json());
    } catch {}
    setLoadingOrders(false);
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  async function completeOrder(orderId: number) {
    setCompletingId(orderId);
    try {
      const res = await fetch(`/api/wc/orders/${orderId}/complete`, { method: "POST" });
      if (res.ok) setWcOrders(prev => prev.filter(o => o.id !== orderId));
    } catch {}
    setCompletingId(null);
  }

  const statusColors: Record<string, string> = {
    idle: "bg-secondary text-secondary-foreground shadow-[0_0_15px_rgba(245,158,11,0.3)]",
    printing: "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-pulse",
    error: "bg-destructive text-destructive-foreground shadow-[0_0_20px_rgba(239,68,68,0.5)]",
    offline: "bg-muted text-muted-foreground",
  };

  return (
    <div className="flex-1 overflow-auto bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Command Center</h2>
            <p className="text-muted-foreground mt-1 text-sm font-mono uppercase tracking-wider">Live Operations View</p>
          </div>
          <div className="flex items-center space-x-4 bg-card p-4 rounded-lg border border-border">
            <span className="font-mono uppercase text-sm text-muted-foreground">Status:</span>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center ${statusColors[printerStatus]}`}>
              {printerStatus === "printing" && <Activity className="w-3 h-3 mr-2" />}
              {printerStatus === "error" && <AlertTriangle className="w-3 h-3 mr-2" />}
              {printerStatus}
            </div>
          </div>
        </div>

        {lastError && (
          <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-md flex items-start font-mono text-sm">
            <AlertTriangle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
            <div><p className="font-bold mb-1">PRINTER ERROR</p><p>{lastError}</p></div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Pending", value: stats?.pending || 0, icon: Clock, color: "text-secondary" },
            { label: "Printing", value: stats?.printing || 0, icon: Printer, color: "text-primary" },
            { label: "Done Today", value: stats?.todayPrinted || 0, icon: CheckCircle2, color: "text-muted-foreground" },
            { label: "Errors", value: stats?.error || 0, icon: AlertTriangle, color: "text-destructive" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
                <Icon className={`w-4 h-4 ${color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold ${color === "text-destructive" && value > 0 ? "text-destructive" : "text-foreground"}`}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-mono tracking-wider uppercase flex items-center">
              <ChefHat className="w-5 h-5 mr-2 text-primary" />
              Processing Orders
              {wcOrders.length > 0 && (
                <span className="ml-3 px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground">
                  {wcOrders.length}
                </span>
              )}
            </h3>
            <button onClick={fetchOrders} className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider">
              ↻ Refresh
            </button>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {loadingOrders ? (
              <div className="p-8 text-center text-muted-foreground font-mono text-sm animate-pulse">LOADING ORDERS...</div>
            ) : wcOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono text-sm">NO ORDERS IN PROCESSING</div>
            ) : (
              <div className="divide-y divide-border">
                {wcOrders.map(order => (
                  <div key={order.id} className="p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xl font-bold text-foreground font-mono">#{order.orderNumber}</span>
                          <Badge variant="outline" className="font-mono text-xs text-secondary border-secondary/30">
                            EM PROCESSAMENTO
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">{order.date}</span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <span className="font-bold text-foreground">{order.customerName}</span>
                          {order.customerPhone && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="w-3 h-3" /> {order.customerPhone}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                          <MapPin className="w-3 h-3" />
                          {order.deliveryMethod}
                          {order.deliveryAddress && ` — ${order.deliveryAddress}`}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {order.items?.map((item, i) => (
                            <span key={i} className="text-xs bg-muted/50 px-2 py-1 rounded font-mono">
                              {item.quantity}x {item.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3 shrink-0">
                        <span className="text-lg font-bold text-foreground font-mono">{order.total} {order.currency}</span>
                        <button
                          onClick={() => completeOrder(order.id)}
                          disabled={completingId === order.id}
                          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-lg font-mono text-sm font-bold uppercase tracking-wider transition-all"
                        >
                          <CheckCheck className="w-4 h-4" />
                          {completingId === order.id ? "..." : "Finalizar"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
