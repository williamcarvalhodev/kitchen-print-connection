import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  pgTable, serial, text, integer, jsonb, timestamp, index
} from "drizzle-orm/pg-core";
import { eq, desc, and, gte, sql } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Database Schema ─────────────────────────────────────────────────────────

const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

const printJobsTable = pgTable("print_jobs", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  status: text("status").notNull().default("pending"),
  orderData: jsonb("order_data").notNull(),
  errorMessage: text("error_message"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  printedAt: timestamp("printed_at"),
}, (t) => [
  index("idx_print_jobs_status").on(t.status),
  index("idx_print_jobs_created_at").on(t.createdAt),
]);

// ─── DB Connection ────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { settingsTable, printJobsTable } });

// Auto-create tables on startup
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS print_jobs (
      id SERIAL PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      order_data JSONB NOT NULL,
      error_message TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      printed_at TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at);
  `);
  console.log("Database initialized");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULTS: Record<string, string> = {
  printerIp: "192.168.0.113",
  printerPort: "80",
  printerProtocol: "epos",
  autoRetry: "true",
  retryIntervalSeconds: "5",
  apiKey: "kitchen-bridge-secret",
  storeName: "Minha Loja",
};

async function getApiKey(): Promise<string> {
  const setting = await db.select().from(settingsTable).where(eq(settingsTable.key, "apiKey")).limit(1);
  return setting[0]?.value ?? DEFAULTS.apiKey;
}

async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function mapSettings(map: Record<string, string>) {
  return {
    printerIp: map.printerIp,
    printerPort: Number(map.printerPort),
    printerProtocol: map.printerProtocol as "epos" | "raw",
    autoRetry: map.autoRetry === "true",
    retryIntervalSeconds: Number(map.retryIntervalSeconds),
    apiKey: map.apiKey,
    storeName: map.storeName,
  };
}

function formatJob(job: typeof printJobsTable.$inferSelect) {
  return {
    id: job.id,
    orderId: job.orderId,
    status: job.status,
    orderData: job.orderData,
    errorMessage: job.errorMessage,
    attempts: job.attempts,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    printedAt: job.printedAt ? job.printedAt.toISOString() : null,
  };
}

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// Print Jobs
app.get("/api/print-jobs", async (req, res) => {
  const status = req.query.status as string | undefined;
  const limit = Number(req.query.limit) || 50;
  const conditions = status ? [eq(printJobsTable.status, status)] : [];
  const jobs = await db.select().from(printJobsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(printJobsTable.createdAt)).limit(limit);
  res.json(jobs.map(formatJob));
});

app.post("/api/print-jobs", async (req, res) => {
  const { orderId, orderData, apiKey } = req.body;
  if (!orderId || !orderData || !apiKey) return res.status(400).json({ error: "Missing fields" });

  const validKey = await getApiKey();
  if (apiKey !== validKey) return res.status(401).json({ error: "Invalid API key" });

  const existing = await db.select().from(printJobsTable).where(eq(printJobsTable.orderId, orderId)).limit(1);
  if (existing.length > 0) return res.status(409).json({ error: "Order already queued", job: formatJob(existing[0]) });

  const [job] = await db.insert(printJobsTable).values({ orderId, orderData, status: "pending", attempts: 0 }).returning();
  return res.status(201).json(formatJob(job));
});

app.get("/api/print-jobs/pending", async (_req, res) => {
  const jobs = await db.select().from(printJobsTable)
    .where(eq(printJobsTable.status, "pending"))
    .orderBy(printJobsTable.createdAt).limit(10);
  res.json(jobs.map(formatJob));
});

app.get("/api/print-jobs/stats", async (_req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [counts] = await db.select({
    pending: sql<number>`count(*) filter (where status = 'pending')`,
    printing: sql<number>`count(*) filter (where status = 'printing')`,
    done: sql<number>`count(*) filter (where status = 'done')`,
    error: sql<number>`count(*) filter (where status = 'error')`,
    total: sql<number>`count(*)`,
  }).from(printJobsTable);
  const [todayCounts] = await db.select({ todayPrinted: sql<number>`count(*)` })
    .from(printJobsTable)
    .where(and(eq(printJobsTable.status, "done"), gte(printJobsTable.printedAt, today)));
  res.json({
    pending: Number(counts.pending), printing: Number(counts.printing),
    done: Number(counts.done), error: Number(counts.error),
    total: Number(counts.total), todayPrinted: Number(todayCounts.todayPrinted),
  });
});

app.get("/api/print-jobs/:id", async (req, res) => {
  const [job] = await db.select().from(printJobsTable).where(eq(printJobsTable.id, Number(req.params.id))).limit(1);
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json(formatJob(job));
});

app.patch("/api/print-jobs/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status, errorMessage } = req.body;
  const updates: Partial<typeof printJobsTable.$inferInsert> = { status, updatedAt: new Date(), errorMessage: errorMessage ?? null };
  if (status === "done") updates.printedAt = new Date();
  if (status === "printing") {
    const [cur] = await db.select().from(printJobsTable).where(eq(printJobsTable.id, id)).limit(1);
    updates.attempts = (cur?.attempts ?? 0) + 1;
  }
  const [job] = await db.update(printJobsTable).set(updates).where(eq(printJobsTable.id, id)).returning();
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json(formatJob(job));
});

// Settings
app.get("/api/settings", async (_req, res) => {
  res.json(mapSettings(await getAllSettings()));
});

app.put("/api/settings", async (req, res) => {
  const allowed = ["printerIp", "printerPort", "printerProtocol", "autoRetry", "retryIntervalSeconds", "apiKey", "storeName"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const value = String(req.body[key]);
      await db.insert(settingsTable).values({ key, value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
    }
  }
  res.json(mapSettings(await getAllSettings()));
});

// Serve frontend static files (built by vite)
const frontendDist = path.join(__dirname, "public");
app.use(express.static(frontendDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3000;

initDb().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Kitchen Print Bridge running on port ${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to init DB:", err);
  process.exit(1);
});