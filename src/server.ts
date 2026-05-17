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

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { settingsTable, printJobsTable } });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY, key TEXT NOT NULL UNIQUE, value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS print_jobs (
      id SERIAL PRIMARY KEY, order_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending', order_data JSONB NOT NULL,
      error_message TEXT, attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(), printed_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at);
  `);
  console.log("Database initialized");
}

const DEFAULTS: Record<string, string> = {
  printerIp: "192.168.0.113", printerPort: "9100", printerProtocol: "epos",
  autoRetry: "true", retryIntervalSeconds: "5",
  apiKey: "kitchen-bridge-secret", storeName: "Minha Loja",
  wcUrl: "https://wagasasushibar.com",
  wcKey: "ck_d95b36787bd39ca83629f4c4f5f88f21a914af12",
  wcSecret: "cs_027ae567d2506a57d9bb82158217a4ab7de09050",
};

const DEFAULT_LAYOUT = {
  storeName: "Wagasa Sushi Bar",
  storeAddress: "Av. Dom Nuno Alvares Pereira 67, 2840-469 Seixal",
  storePhone: "+351 938 122 182",
  storeNif: "516235586",
  storeInstagram: "@wagasasushi",
  footerMessage: "Obrigado pela sua encomenda!",
  printCopies: 1,
  showCupom1: true,
  showCupom2: true,
  cupom1Fields: {
    showHeader: true, showOrderNumber: true, showDate: true,
    showPaymentMethod: true, showDeliveryMethod: true, showDeliveryAddress: true,
    showCustomerName: true, showCustomerPhone: true, showItems: true,
    showNotes: true, showTotal: true, showFooter: true,
  },
  cupom2Fields: {
    showOrderNumber: true, showDate: true, showCustomerName: true,
    showItems: true, showNotes: true, showCheckbox: false,
  },
};

async function getApiKey() {
  const s = await db.select().from(settingsTable).where(eq(settingsTable.key, "apiKey")).limit(1);
  return s[0]?.value ?? DEFAULTS.apiKey;
}

async function getAllSettings() {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function mapSettings(map: Record<string, string>) {
  return {
    printerIp: map.printerIp, printerPort: Number(map.printerPort),
    printerProtocol: map.printerProtocol as "epos" | "raw",
    autoRetry: map.autoRetry === "true",
    retryIntervalSeconds: Number(map.retryIntervalSeconds),
    apiKey: map.apiKey, storeName: map.storeName,
    wcUrl: map.wcUrl, wcKey: map.wcKey, wcSecret: map.wcSecret,
  };
}

function formatJob(job: typeof printJobsTable.$inferSelect) {
  return {
    id: job.id, orderId: job.orderId, status: job.status,
    orderData: job.orderData, errorMessage: job.errorMessage,
    attempts: job.attempts,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    printedAt: job.printedAt ? job.printedAt.toISOString() : null,
  };
}

async function wcRequest(settings: any, endpoint: string, method = "GET", body?: any) {
  const separator = endpoint.includes("?") ? "&" : "?";
  const ts = Date.now();
  const url = `${settings.wcUrl}/wp-json/wc/v3/${endpoint}${separator}consumer_key=${settings.wcKey}&consumer_secret=${settings.wcSecret}&_=${ts}`;
  const opts: any = {
    method,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WC API error: ${res.status} - ${errText}`);
  }
  return res.json();
}

function mapWcOrderToOrderData(o: any) {
  return {
    orderNumber: String(o.number || o.id),
    date: new Date(o.date_created).toLocaleString("pt-PT"),
    customerName: `${o.billing?.first_name || ""} ${o.billing?.last_name || ""}`.trim(),
    customerSurname: o.billing?.last_name || "",
    customerEmail: o.billing?.email || "",
    customerPhone: o.billing?.phone || "",
    paymentMethod: o.payment_method_title || "",
    deliveryMethod: o.shipping_lines?.[0]?.method_title || "Levantamento no local",
    deliveryAddress: o.shipping?.address_1 ? `${o.shipping.address_1}, ${o.shipping.city}` : null,
    items: (o.line_items || []).map((i: any) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.total,
      variation: i.meta_data?.find((m: any) => m.key?.startsWith("pa_"))?.value || null,
      notes: null,
    })),
    subtotal: o.subtotal || "",
    shipping: o.shipping_total ? `${o.shipping_total} €` : "0,00 €",
    total: o.total || "",
    totalTax: o.total_tax || "",
    discount: o.discount_total || null,
    coupons: (o.coupon_lines || []).map((c: any) => ({ code: c.code, discount: c.discount })),
    fees: (o.fee_lines || []).map((f: any) => ({ name: f.name, amount: `${f.total} €` })),
    taxes: (o.tax_lines || []).map((t: any) => ({ label: t.label, amount: `${t.tax_total} €` })),
    notes: o.customer_note || null,
  };
}

const app = express();
app.use(cors());

app.use("/api/wc/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));

// ── WEBHOOK DO WOOCOMMERCE ─────────────────────────────────────────────────────
app.post("/api/wc/webhook", async (req, res) => {
  try {
    const topic = req.headers["x-wc-webhook-topic"] as string || "";
    console.log(`Webhook recebido: ${topic}`);
    res.status(200).json({ received: true });
    if (!topic.includes("order")) return;
    const order = typeof req.body === "string"
      ? JSON.parse(req.body)
      : Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString())
        : req.body;
    if (!order?.id || order?.status !== "processing") {
      console.log(`Webhook ignorado: status=${order?.status}`);
      return;
    }
    const orderId = String(order.id);
    console.log(`Novo pedido em processamento: #${order.number || orderId}`);
    const existing = await db.select().from(printJobsTable).where(eq(printJobsTable.orderId, orderId)).limit(1);
    if (existing.length > 0) {
      // Se já existe com erro, reseta para pending
      if (existing[0].status === "error") {
        await db.update(printJobsTable)
          .set({ status: "pending", errorMessage: null, updatedAt: new Date() })
          .where(eq(printJobsTable.id, existing[0].id));
        console.log(`Job #${orderId} resetado de error para pending`);
      } else {
        console.log(`Job já existe para pedido #${orderId} (status: ${existing[0].status})`);
      }
      return;
    }
    const orderData = mapWcOrderToOrderData(order);
    await db.insert(printJobsTable).values({ orderId, orderData, status: "pending", attempts: 0 });
    console.log(`Print job criado para pedido #${order.number || orderId}`);
  } catch (err: any) {
    console.error(`Erro no webhook: ${err.message}`);
  }
});

app.get("/api/layout", async (_req, res) => {
  try {
    const row = await db.select().from(settingsTable).where(eq(settingsTable.key, "receiptLayout")).limit(1);
    res.json(row[0] ? JSON.parse(row[0].value) : DEFAULT_LAYOUT);
  } catch { res.json(DEFAULT_LAYOUT); }
});

app.put("/api/layout", async (req, res) => {
  try {
    const value = JSON.stringify(req.body);
    await db.insert(settingsTable).values({ key: "receiptLayout", value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
    res.json(req.body);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get("/api/wc/orders/processing", async (_req, res) => {
  try {
    const settings = mapSettings(await getAllSettings());
    const orders = await wcRequest(settings, "orders?status=processing&per_page=20&orderby=date&order=desc");
    const processingOrders = orders.filter((o: any) => o.status === "processing");
    const mapped = processingOrders.map((o: any) => ({
      id: o.id,
      orderNumber: o.number,
      date: new Date(o.date_created).toLocaleString("pt-PT"),
      customerName: `${o.billing.first_name} ${o.billing.last_name}`.trim(),
      customerPhone: o.billing.phone,
      total: o.total,
      currency: o.currency_symbol || "EUR",
      paymentMethod: o.payment_method_title,
      deliveryMethod: o.shipping_lines?.[0]?.method_title || "Levantamento no local",
      deliveryAddress: o.shipping?.address_1 ? `${o.shipping.address_1}, ${o.shipping.city}` : null,
      items: o.line_items?.map((i: any) => ({ name: i.name, quantity: i.quantity, total: i.total })),
      status: o.status,
    }));
    res.json(mapped);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post("/api/wc/orders/:id/complete", async (req, res) => {
  try {
    const settings = mapSettings(await getAllSettings());
    const order = await wcRequest(settings, `orders/${req.params.id}`, "PUT", { status: "completed" });
    res.json({ success: true, orderId: order.id, status: order.status });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get("/api/print-jobs", async (req, res) => {
  const status = req.query.status as string | undefined;
  const limit = Number(req.query.limit) || 50;
  const conditions = status ? [eq(printJobsTable.status, status)] : [];
  const jobs = await db.select().from(printJobsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(printJobsTable.createdAt)).limit(limit);
  res.json(jobs.map(formatJob));
});

// FIX: se job já existe com status "error", reseta para "pending" em vez de 409
app.post("/api/print-jobs", async (req, res) => {
  const { orderId, orderData, apiKey } = req.body;
  if (!orderId || !orderData || !apiKey) return res.status(400).json({ error: "Missing fields" });
  const validKey = await getApiKey();
  if (apiKey !== validKey) return res.status(401).json({ error: "Invalid API key" });
  const existing = await db.select().from(printJobsTable).where(eq(printJobsTable.orderId, orderId)).limit(1);
  if (existing.length > 0) {
    const existingJob = existing[0];
    // Se já existe com erro, reseta para pending e actualiza os dados
    if (existingJob.status === "error") {
      const [updated] = await db.update(printJobsTable)
        .set({ status: "pending", orderData, errorMessage: null, updatedAt: new Date() })
        .where(eq(printJobsTable.id, existingJob.id))
        .returning();
      return res.status(201).json(formatJob(updated));
    }
    return res.status(409).json({ error: "Order already queued", job: formatJob(existingJob) });
  }
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

app.get("/api/settings", async (_req, res) => res.json(mapSettings(await getAllSettings())));

app.put("/api/settings", async (req, res) => {
  const allowed = ["printerIp", "printerPort", "printerProtocol", "autoRetry", "retryIntervalSeconds", "apiKey", "storeName", "wcUrl", "wcKey", "wcSecret"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const value = String(req.body[key]);
      await db.insert(settingsTable).values({ key, value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
    }
  }
  res.json(mapSettings(await getAllSettings()));
});

const frontendDist = path.join(process.cwd(), "dist", "public");
app.use(express.static(frontendDist));
app.get("/", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
app.get("/{*path}", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));

const PORT = Number(process.env.PORT) || 3000;
initDb().then(() => {
  app.listen(PORT, "0.0.0.0", () => console.log(`Kitchen Print Bridge running on port ${PORT}`));
}).catch(err => { console.error("Failed to init DB:", err); process.exit(1); });
