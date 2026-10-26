import { describe, expect, it } from "vitest";
import { decryptPayload, deriveSyncKeys, encryptPayload, formatCode, generateCode, isValidCode, normalizeCode } from "@/lib/sync-crypto";
import { isValidSyncId, MAX_SYNC_BYTES, validatePutBody } from "@/lib/sync-api";

describe("mã đồng bộ", () => {
  it("sinh mã 26 ký tự base32, hiển thị theo nhóm có gạch nối", () => {
    const code = generateCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(formatCode(code)).toMatch(/^([0-9A-Z]{4,5}-){5}[0-9A-Z]{1,6}$/);
  });

  it("mỗi lần sinh một mã khác nhau", () => {
    expect(generateCode()).not.toBe(generateCode());
  });

  it("chuẩn hóa mã người dùng gõ: bỏ khoảng trắng, gạch nối, viết hoa, sửa O→0 và I/L→1", () => {
    const code = generateCode();
    const typed = formatCode(code).toLowerCase().replace(/-/g, " - ");
    expect(normalizeCode(typed)).toBe(code);
    expect(normalizeCode("o1l-i")).toBe("0111");
  });

  it("kiểm tra độ dài hợp lệ", () => {
    expect(isValidCode(generateCode())).toBe(true);
    expect(isValidCode("ABC")).toBe(false);
  });
});

describe("mã hóa đầu-cuối", () => {
  it("cùng một mã luôn ra cùng một ID; mã khác ra ID khác", async () => {
    const code = generateCode();
    const a = await deriveSyncKeys(code);
    const b = await deriveSyncKeys(code);
    const c = await deriveSyncKeys(generateCode());
    expect(a.id).toMatch(/^[0-9a-f]{64}$/);
    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(c.id);
  });

  it("ID không chứa mã gốc (máy chủ không suy ra được mã)", async () => {
    const code = generateCode();
    const { id } = await deriveSyncKeys(code);
    expect(id.toUpperCase()).not.toContain(code);
  });

  it("mã hóa rồi giải mã ra đúng dữ liệu", async () => {
    const { key } = await deriveSyncKeys(generateCode());
    const data = { version: 1, transactions: [{ id: "x", assetId: "fpt", note: "Mua lần đầu ✓" }] };
    const payload = await encryptPayload(key, data);
    expect(payload.data).not.toContain("fpt");
    expect(await decryptPayload(key, payload)).toEqual(data);
  });

  it("giải mã bằng mã sai thì báo lỗi", async () => {
    const right = await deriveSyncKeys(generateCode());
    const wrong = await deriveSyncKeys(generateCode());
    const payload = await encryptPayload(right.key, { a: 1 });
    await expect(decryptPayload(wrong.key, payload)).rejects.toThrow(/mã đồng bộ/i);
  });
});

describe("validatePutBody", () => {
  const ok = { iv: "AAAAAAAAAAAAAAAA", data: "YWJj", expectedVersion: 0 };
  it("chấp nhận dữ liệu hợp lệ", () => {
    expect(validatePutBody(ok)).toBeNull();
    expect(isValidSyncId("a".repeat(64))).toBe(true);
  });
  it("từ chối IV sai, dữ liệu không phải base64, phiên bản âm, ID sai", () => {
    expect(validatePutBody({ ...ok, iv: "short" })).not.toBeNull();
    expect(validatePutBody({ ...ok, data: "<script>" })).not.toBeNull();
    expect(validatePutBody({ ...ok, expectedVersion: -1 })).not.toBeNull();
    expect(validatePutBody({ ...ok, data: "A".repeat(MAX_SYNC_BYTES + 4) })).toMatch(/quá lớn/);
    expect(isValidSyncId("../etc")).toBe(false);
  });
});
