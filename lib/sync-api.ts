/** Giới hạn kích thước dữ liệu mã hóa (base64) mỗi người — đủ cho hàng nghìn giao dịch */
export const MAX_SYNC_BYTES = 512 * 1024;

export interface SyncRecord {
  iv: string;
  data: string;
  version: number;
  updatedAt: string;
}

export interface SyncPutBody {
  iv: string;
  data: string;
  /** Phiên bản đang có trên máy; 0 = tạo mới. Lệch với máy chủ → 409 */
  expectedVersion: number;
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function isValidSyncId(id: string): boolean {
  return /^[0-9a-f]{64}$/.test(id);
}

/** Trả về thông báo lỗi, hoặc null nếu hợp lệ. */
export function validatePutBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Dữ liệu gửi lên không hợp lệ.";
  const b = body as Partial<SyncPutBody>;
  if (typeof b.iv !== "string" || b.iv.length !== 16 || !BASE64.test(b.iv)) return "IV không hợp lệ.";
  if (typeof b.data !== "string" || !b.data.length || !BASE64.test(b.data)) return "Dữ liệu mã hóa không hợp lệ.";
  if (b.data.length > MAX_SYNC_BYTES) return "Dữ liệu quá lớn.";
  if (!Number.isInteger(b.expectedVersion) || b.expectedVersion! < 0) return "Phiên bản không hợp lệ.";
  return null;
}
