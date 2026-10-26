/**
 * Tạo bảng cho tính năng đồng bộ. Chạy một lần sau khi kết nối Neon:
 *   npm run db:setup     (đọc DATABASE_URL từ .env.local)
 */
import { getSql, SYNC_TABLE_SQL } from "../lib/db";

async function main() {
  const sql = getSql();
  await sql.query(SYNC_TABLE_SQL);
  const [{ count }] = (await sql`SELECT count(*)::int AS count FROM sync_states`) as { count: number }[];
  console.log(`Bảng sync_states sẵn sàng (${count} bản ghi).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
