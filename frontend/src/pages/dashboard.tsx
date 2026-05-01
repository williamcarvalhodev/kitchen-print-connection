import { usePrintJob, useSettings } from "@/hooks/use-print-job";
import { useGetPrintJobStats } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Activity, AlertTriangle, Printer, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { settings, saveSettings } = useSettings();
  const { printerStatus, lastError, pendingJobs, isPolling } = usePrintJob();
  const { data: stats } = useGetPrintJobStats({ refetchInterval: 5000 });

  const statusColors = {
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
          
          <div className="flex items-center space-x-6 bg-card p-4 rounded-lg border border-border shadow-sm">
            <div className="flex items-center space-x-3">
              <Switch 
                id="auto-print" 
                checked={settings.autoPrint}
                onCheckedChange={(c) => saveSettings({ autoPrint: c })}
              />
              <Label htmlFor="auto-print" className="font-mono uppercase text-sm cursor-pointer">Auto-Print</Label>
            </div>
            
            <div className="h-8 w-px bg-border"></div>
            
            <div className="flex items-center space-x-3">
              <span className="font-mono uppercase text-sm text-muted-foreground">Status:</span>
              <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center ${statusColors[printerStatus]}`}>
                {printerStatus === 'printing' && <Activity className="w-3 h-3 mr-2" />}
                {printerStatus === 'error' && <AlertTriangle className="w-3 h-3 mr-2" />}
                {printerStatus}
              </div>
            </div>
          </div>
        </div>

        {lastError && (
          <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-md flex items-start font-mono text-sm">
            <AlertTriangle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">PRINTER ERROR</p>
              <p>{lastError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Pending</CardTitle>
              <Clock className="w-4 h-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground">{stats?.pending || 0}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Printing</CardTitle>
              <Printer className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">{stats?.printing || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Done Today</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground">{stats?.todayPrinted || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Errors</CardTitle>
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-destructive">{stats?.error || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-mono tracking-wider uppercase flex items-center">
              Active Queue
              {isPolling && <div className="ml-3 w-2 h-2 rounded-full bg-primary animate-pulse" />}
            </h3>
          </div>
          
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {pendingJobs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                NO JOBS PENDING
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pendingJobs.map((job) => (
                  <div key={job.id} className="p-4 flex items-center justify-between bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-center space-x-6">
                      <div className="text-2xl font-bold text-foreground w-24">
                        #{job.orderData.orderNumber}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{job.orderData.customerName}</p>
                        <p className="text-sm text-muted-foreground font-mono">{job.orderData.items.length} items • {job.orderData.total}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-muted-foreground mb-1">
                        {format(new Date(job.createdAt), "HH:mm:ss")}
                      </p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary/20 text-secondary border border-secondary/30 uppercase tracking-wider">
                        PENDING
                      </span>
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
