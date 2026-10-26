// Mã hóa đầu-cuối cho đồng bộ: máy chủ chỉ thấy hash của mã (làm ID) và dữ liệu đã mã hóa.
// Khóa giải mã suy ra từ mã đồng bộ và không bao giờ rời trình duyệt.

/** Bảng chữ Crockford base32: bỏ I, L, O, U để khỏi nhầm khi gõ tay */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** 128 bit ngẫu nhiên → 26 ký tự base32 */
const CODE_LENGTH = 26;

export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** "ABCD-EFGH-…" để dễ đọc và chép tay */
export function formatCode(code: string): string {
  return code.match(/.{1,5}/g)!.join("-");
}

/** Chuẩn hóa mã người dùng gõ vào: bỏ gạch nối/khoảng trắng, viết hoa, sửa ký tự dễ nhầm. */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export interface SyncKeys {
  /** ID lưu trên máy chủ = SHA-256(mã) dạng hex */
  id: string;
  key: CryptoKey;
}

/** Mã có 128 bit ngẫu nhiên nên một lần SHA-256 (khác tiền tố cho ID và khóa) là đủ an toàn. */
export async function deriveSyncKeys(code: string): Promise<SyncKeys> {
  const id = toHex(await sha256(`tichsan-id:${code}`));
  const raw = await sha256(`tichsan-key:${code}`);
  const key = await crypto.subtle.importKey("raw", raw.buffer as ArrayBuffer, "AES-GCM", false, ["encrypt", "decrypt"]);
  return { id, key };
}

export interface EncryptedPayload {
  iv: string;
  data: string;
}

export async function encryptPayload(key: CryptoKey, value: unknown): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  return { iv: toBase64(iv), data: toBase64(cipher) };
}

export async function decryptPayload<T = unknown>(key: CryptoKey, payload: EncryptedPayload): Promise<T> {
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(payload.iv) }, key, fromBase64(payload.data));
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    throw new Error("Không giải mã được dữ liệu. Kiểm tra lại mã đồng bộ.");
  }
}
