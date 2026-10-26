import { getSql } from "@/lib/db";
import { isValidSyncId, validatePutBody, type SyncPutBody, type SyncRecord } from "@/lib/sync-api";

// Máy chủ chỉ lưu ID (hash của mã đồng bộ) và dữ liệu đã mã hóa phía trình duyệt — không đọc được nội dung.

interface Row {
  iv: string;
  data: string;
  version: number;
  updated_at: string;
}

const toRecord = (r: Row): SyncRecord => ({ iv: r.iv, data: r.data, version: r.version, updatedAt: new Date(r.updated_at).toISOString() });

function error(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function idFrom(ctx: RouteContext<"/api/sync/[id]">): Promise<string | null> {
  const { id } = await ctx.params;
  return isValidSyncId(id) ? id : null;
}

export async function GET(_req: Request, ctx: RouteContext<"/api/sync/[id]">) {
  const id = await idFrom(ctx);
  if (!id) return error(400, "Mã đồng bộ không hợp lệ.");
  const rows = (await getSql()`SELECT iv, data, version, updated_at FROM sync_states WHERE id = ${id}`) as Row[];
  if (!rows.length) return error(404, "Không tìm thấy dữ liệu cho mã này.");
  return Response.json(toRecord(rows[0]), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request, ctx: RouteContext<"/api/sync/[id]">) {
  const id = await idFrom(ctx);
  if (!id) return error(400, "Mã đồng bộ không hợp lệ.");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error(400, "Dữ liệu gửi lên không phải JSON.");
  }
  const invalid = validatePutBody(body);
  if (invalid) return error(400, invalid);
  const { iv, data, expectedVersion } = body as SyncPutBody;
  const sql = getSql();

  // Ghi có điều kiện theo phiên bản để không ghi đè thay đổi từ thiết bị khác
  const rows = (
    expectedVersion === 0
      ? await sql`INSERT INTO sync_states (id, iv, data) VALUES (${id}, ${iv}, ${data})
                  ON CONFLICT (id) DO NOTHING RETURNING iv, data, version, updated_at`
      : await sql`UPDATE sync_states SET iv = ${iv}, data = ${data}, version = version + 1, updated_at = now()
                  WHERE id = ${id} AND version = ${expectedVersion} RETURNING iv, data, version, updated_at`
  ) as Row[];

  if (rows.length) return Response.json({ version: rows[0].version, updatedAt: toRecord(rows[0]).updatedAt });

  const current = (await sql`SELECT iv, data, version, updated_at FROM sync_states WHERE id = ${id}`) as Row[];
  if (!current.length) return error(404, "Dữ liệu trên máy chủ đã bị xóa.");
  return Response.json({ error: "Thiết bị khác vừa thay đổi dữ liệu.", current: toRecord(current[0]) }, { status: 409 });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/sync/[id]">) {
  const id = await idFrom(ctx);
  if (!id) return error(400, "Mã đồng bộ không hợp lệ.");
  await getSql()`DELETE FROM sync_states WHERE id = ${id}`;
  return new Response(null, { status: 204 });
}
