import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Khởi tạo lười: next build chạy code cấp module, khi đó DATABASE_URL có thể chưa có.
let _sql: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Thiếu biến môi trường DATABASE_URL (kết nối Neon).");
    _sql = neon(url);
  }
  return _sql;
}

export const SYNC_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS sync_states (
  id          char(64)    PRIMARY KEY,
  iv          text        NOT NULL,
  data        text        NOT NULL,
  version     integer     NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now()
)`;
