import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ch } from "./config/clickhouse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "change-me-secret-key";



interface LogEntry {
  userId?: string;
  user_id?: string;
  level?: string;
  message?: string;
  body?: object | string;
  service?: string;
  metadata?: object | string;
}

// ── Auth middleware (only for write operations) ────────────────────────────
function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const key =
    (req.headers["x-api-key"] as string) || (req.query.apiKey as string);
  if (key !== API_KEY) {
    res.status(401).json({ error: "Invalid or missing API key" });
    return;
  }
  next();
}

// ── POST /api/logs — ingest one or many logs ───────────────────────────────
app.post(
  "/api/logs",
  requireApiKey,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const entries: LogEntry[] = Array.isArray(req.body)
        ? req.body
        : [req.body];

      const rows = entries.map((e: LogEntry) => ({
        user_id: String(e.userId || e.user_id || ""),
        level: String(e.level || "info").toLowerCase(),
        message: String(e.message || ""),
        body:
          typeof e.body === "object"
            ? JSON.stringify(e.body)
            : String(e.body || ""),
        service: String(e.service || ""),
        metadata:
          typeof e.metadata === "object"
            ? JSON.stringify(e.metadata)
            : String(e.metadata || "{}"),
      }));

      await ch.insert({
        table: "logs",
        values: rows,
        format: "JSONEachRow",
      });

      res.status(201).json({ inserted: rows.length });
    } catch (err) {
      const error = err as Error;
      console.error("[POST /api/logs]", error.message);
      res.status(500).json({ error: error.message });
    }
  },
);

// ── GET /api/logs — search / paginate ─────────────────────────────────────
app.get("/api/logs", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId = "",
      search = "",
      level = "",
      service = "",
      from = "",
      to = "",
      page = "1",
      limit = "100",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: Record<string, string | number> = {};

    if (userId) {
      conditions.push("user_id = {userId:String}");
      params.userId = userId;
    }
    if (search) {
      conditions.push(
        "(positionCaseInsensitive(body, {search:String}) > 0 OR positionCaseInsensitive(message, {search:String}) > 0)",
      );
      params.search = search;
    }
    if (level) {
      conditions.push("level = {level:String}");
      params.level = level.toLowerCase();
    }
    if (service) {
      conditions.push("service = {service:String}");
      params.service = service;
    }
    if (from) {
      conditions.push("timestamp >= parseDateTimeBestEffort({from:String})");
      params.from = from;
    }
    if (to) {
      conditions.push("timestamp <= parseDateTimeBestEffort({to:String})");
      params.to = to;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await ch.query({
      query: `SELECT count() as total FROM logs ${where}`,
      query_params: params,
      format: "JSONEachRow",
    });
    const countRows = (await countResult.json()) as Array<{ total: string }>;
    const total = Number(countRows[0]?.total ?? 0);

    const dataResult = await ch.query({
      query: `
        SELECT
          toString(id)   AS id,
          toString(timestamp) AS timestamp,
          user_id,
          level,
          message,
          body,
          service,
          metadata
        FROM logs
        ${where}
        ORDER BY timestamp DESC
        LIMIT {limit:UInt32}
        OFFSET {offset:UInt32}
      `,
      query_params: { ...params, limit: limitNum, offset },
      format: "JSONEachRow",
    });

    const rows = await dataResult.json();

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
      data: rows,
    });
  } catch (err) {
    const error = err as Error;
    console.error("[GET /api/logs]", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/logs/:id ──────────────────────────────────────────────────────
app.get("/api/logs/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ch.query({
      query: `SELECT toString(id) AS id, toString(timestamp) AS timestamp, user_id, level, message, body, service, metadata FROM logs WHERE id = {id:UUID} LIMIT 1`,
      query_params: { id: req.params.id },
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Array<object>;
    if (!rows.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    const error = err as Error;
    console.error("[GET /api/logs/:id]", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/stats ─────────────────────────────────────────────────────────
app.get("/api/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await ch.query({
      query: `
        SELECT
          count()                                              AS total,
          countIf(level = 'error')                            AS errors,
          countIf(level = 'warn')                             AS warnings,
          countIf(timestamp >= now() - INTERVAL 1 HOUR)       AS last_hour,
          countIf(timestamp >= now() - INTERVAL 24 HOUR)      AS last_24h
        FROM logs
      `,
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Array<object>;
    res.json(rows[0]);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

// ── Fallback to frontend ───────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 LogPlatform API running on http://localhost:${PORT}`);
  console.log(`🔑 API Key: ${API_KEY}`);
});
