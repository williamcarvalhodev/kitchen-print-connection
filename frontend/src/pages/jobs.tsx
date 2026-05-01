import { useState } from "react";
import { useListPrintJobs, type PrintJob } from "@/hooks/api";
import { usePrintJob } from "@/hooks/use-print-job";
import { format } from "date-fns";
import { RefreshCw, CheckCircle2, AlertTriangle, Clock, Printer } from "lucide-react";

const STATUS_FILTERS = ["all", "pending", "printing", "done", "error"] as const;
type FilterStatus = (typeof STATUS_FILTERS)[number];

export default function Jobs() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const { data: jobs = [], isFetching, refetch } = useListPrintJobs(
    { status: filterStatus === "all" ? undefined : filterStatus, limit: 100 },
    { refetchInterval: 10000 }
  );

  const { printJob } = usePrintJob();
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const handleRetry = async (job: PrintJob) => {
    setRetryingId(job.id);
    await printJob(job);
    await refetch();
    setRetryingId(null);
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "pending": return <Clock className="w-4 h-4 text-secondary" />;
      case "printing": return <Printer className="w-4 h-4 text-primary animate-pulse" />;
      case "done": return <CheckCircle2 className="w-4 h-4 text-muted-foreground" />;
      case "error": return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default: return null;
    }
  };

  const statusClasses: Record<string, string> = {
    pending: "text-secondary border-secondary/30 bg-secondary/10",
    printing: "text-primary border-primary/30 bg-primary/10",
    done: "text-muted-foreground border-muted/30 bg-muted/10",
    error: "text-destructive border-destructive/30 bg-destructive/10",
  };

  return (
    <div className="flex-1 overflow-auto bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Job History</h2>
            <p className="text-muted-foreground mt-1 text-sm font-mono uppercase tracking-wider">Print Operations Log</p>
          </div>

          <button
            onClick={() => refetch()}
            className="flex items-center px-4 py-2 bg-sidebar border border-border rounded text-sm font-mono uppercase tracking-wider hover:bg-sidebar-accent transition-colors text-foreground"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="flex space-x-2 border-b border-border pb-4">
          {STATUS_FILTERS.map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 font-mono text-sm tracking-wider uppercase border-b-2 transition-colors ${
                filterStatus === status
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          {jobs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm uppercase tracking-wider">
              No jobs found
            </div>
          ) : (
            <table className="w-full text-left font-mono text-sm">
              <thead className="bg-sidebar border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-normal uppercase tracking-wider">Order</th>
                  <th className="px-6 py-4 font-normal uppercase tracking-wider">Time</th>
                  <th className="px-6 py-4 font-normal uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 font-normal uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 font-normal uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map(job => (
                  <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-foreground text-base">#{job.orderData.orderNumber}</span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {format(new Date(job.createdAt), "MMM dd, HH:mm:ss")}
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      {job.orderData.customerName}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center px-2.5 py-1 rounded border uppercase text-xs font-bold tracking-wider ${statusClasses[job.status] ?? ""}`}>
                        <StatusIcon status={job.status} />
                        <span className="ml-2">{job.status}</span>
                      </div>
                      {job.status === "error" && job.errorMessage && (
                        <div className="mt-1 text-xs text-destructive opacity-80 max-w-[200px] truncate" title={job.errorMessage}>
                          {job.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {(job.status === "error" || job.status === "done") && (
                        <button
                          onClick={() => handleRetry(job)}
                          disabled={retryingId === job.id}
                          className="px-3 py-1.5 bg-sidebar border border-border text-foreground hover:bg-sidebar-accent hover:text-primary transition-colors rounded uppercase text-xs font-bold tracking-wider disabled:opacity-50 inline-flex items-center"
                        >
                          <RefreshCw className={`w-3 h-3 mr-1.5 ${retryingId === job.id ? "animate-spin" : ""}`} />
                          Retry Print
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
