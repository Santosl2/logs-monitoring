import { createClient } from "@clickhouse/client";

export const ch = createClient({
  url: `http://${process.env.CLICKHOUSE_HOST || "localhost"}:${process.env.CLICKHOUSE_PORT || 8123}`,
  database: process.env.CLICKHOUSE_DB || "logs_db",
  clickhouse_settings: {
    async_insert: 1,
    wait_for_async_insert: 0,
  },
});