<img width="3418" height="703" alt="image" src="https://github.com/user-attachments/assets/212081a3-49e5-49b2-9cf3-ba0c21b3c759" />

# LogPlatform

> Personal study project — also used in production privately.

A log ingestion and querying platform built with Node.js and ClickHouse. Exposes a REST API to send logs from any service and query them with filters, pagination, and aggregated statistics.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 (ESM) |
| Language | TypeScript 6 |
| HTTP Framework | Express 5 |
| Database | ClickHouse (MergeTree) |
| ClickHouse Client | `@clickhouse/client` |
| Dev execution | `tsx watch` |
| Containerization | Docker + Docker Compose |

---

## Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- Node.js 20+ (only for local development without Docker)

---

## Environment Variables

Create a `.env` file at the project root:

```env
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DB=logs_db
API_KEY=change-me-secret-key
PORT=3000
```

---

## Running with Docker

```bash
docker compose up -d
```

The API will be available at `http://localhost:3000`.

---

## Running Locally (dev)

```bash
# Start only ClickHouse
docker compose up -d clickhouse

# Install dependencies
npm install

# Start with hot-reload
npm run dev
```

---

## Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/logs` | ✅ | Ingest one or multiple logs |
| `GET` | `/api/logs` | — | List/search logs with filters |
| `GET` | `/api/logs/:id` | — | Return a log by UUID |
| `GET` | `/api/stats` | — | Aggregated statistics |
| `GET` | `/` | — | Static frontend |

### Authentication

Write routes require the `x-api-key` header or the `apiKey` query param with the value defined in `API_KEY`.

### Available filters for `GET /api/logs`

| Parameter | Type | Description |
|---|---|---|
| `userId` | string | Filter by user |
| `search` | string | Search in `body` and `message` |
| `level` | string | `info`, `warn`, `error` |
| `service` | string | Service name |
| `from` | ISO 8601 | Start timestamp |
| `to` | ISO 8601 | End timestamp |
| `page` | number | Page (default: 1) |
| `limit` | number | Items per page (max: 500, default: 100) |

---

## Table Schema

```sql
CREATE TABLE logs_db.logs (
    id        UUID                DEFAULT generateUUIDv4(),
    timestamp DateTime64(3, 'UTC') DEFAULT now64(3),
    user_id   String,
    level     LowCardinality(String) DEFAULT 'info',
    message   String,
    body      String,
    service   String              DEFAULT '',
    metadata  String              DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, user_id)
TTL timestamp + INTERVAL 90 DAY;
```

Logs are retained for **90 days** and then automatically removed by ClickHouse's TTL.

---

## Testing the Routes

Use the `requests.http` file with the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension in VS Code.
