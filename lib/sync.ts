"use client";

import { useSyncExternalStore } from "react";
import { getState, parseState, saveState, type AppState } from "./storage";
import type { SyncPutBody, SyncRecord } from "./sync-api";
import { decryptPayload, deriveSyncKeys, encryptPayload, generateCode, isValidCode, normalizeCode, type SyncKeys } from "./sync-crypto";

const CONFIG_KEY = "tichsan:sync";

interface SyncConfig {
  code: string;
  /** Phiên bản trên máy chủ mà thiết bị này đang khớp */
  version: number;
  lastSyncedAt: string | null;
  /** Có thay đổi trên máy chưa đẩy lên */
  dirty: boolean;
}

export type SyncPhase = "off" | "idle" | "syncing" | "error" | "conflict";

export interface SyncStatus {
  phase: SyncPhase;
  code: string | null;
  lastSyncedAt: string | null;
  message?: string;
  /** Khi xung đột: dữ liệu trên máy chủ để người dùng chọn */
  remote?: { state: AppState; record: SyncRecord };
}

let config: SyncConfig | null = null;
let configLoaded = false;
let status: SyncStatus = { phase: "off", code: null, lastSyncedAt: null };
let keysCache: { code: string; keys: SyncKeys } | null = null;
let applyingRemote = false;
const listeners = new Set<() => void>();

function loadConfig(): SyncConfig | null {
  if (!configLoaded) {
    configLoaded = true;
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      config = raw ? (JSON.parse(raw) as SyncConfig) : null;
    } catch {
      config = null;
    }
    status = config ? { phase: "idle", code: config.code, lastSyncedAt: config.lastSyncedAt } : status;
  }
  return config;
}

function saveConfig(next: SyncConfig | null) {
  config = next;
  try {
    if (next) localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    // Không lưu được cấu hình: đồng bộ chỉ hoạt động trong phiên này
  }
}

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, code: config?.code ?? null, lastSyncedAt: config?.lastSyncedAt ?? null, ...patch };
  listeners.forEach((l) => l());
}

async function keysFor(code: string): Promise<SyncKeys> {
  if (keysCache?.code !== code) keysCache = { code, keys: await deriveSyncKeys(code) };
  return keysCache.keys;
}

async function request(id: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`/api/sync/${id}`, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  } catch {
    throw new Error("Không kết nối được máy chủ đồng bộ. Kiểm tra mạng rồi thử lại.");
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? `Lỗi máy chủ (${res.status})`;
  } catch {
    return `Lỗi máy chủ (${res.status})`;
  }
}

function applyRemote(state: AppState) {
  applyingRemote = true;
  try {
    saveState(parseState(state));
  } finally {
    applyingRemote = false;
  }
}

async function push(cfg: SyncConfig): Promise<void> {
  const { id, key } = await keysFor(cfg.code);
  const payload = await encryptPayload(key, getState());
  const body: SyncPutBody = { ...payload, expectedVersion: cfg.version };
  const res = await request(id, { method: "PUT", body: JSON.stringify(body) });
  if (res.status === 409) {
    const { current } = (await res.json()) as { current: SyncRecord };
    const state = await decryptPayload<AppState>(key, current);
    setStatus({ phase: "conflict", remote: { state, record: current }, message: "Thiết bị khác vừa thay đổi dữ liệu." });
    return;
  }
  if (!res.ok) throw new Error(await errorMessage(res));
  const { version, updatedAt } = (await res.json()) as { version: number; updatedAt: string };
  saveConfig({ ...cfg, version, lastSyncedAt: updatedAt, dirty: false });
  setStatus({ phase: "idle", message: undefined, remote: undefined });
}

async function pull(cfg: SyncConfig): Promise<void> {
  const { id, key } = await keysFor(cfg.code);
  const res = await request(id);
  if (res.status === 404) {
    // Dữ liệu trên máy chủ đã bị xóa (từ thiết bị khác): tạo lại từ dữ liệu máy này
    saveConfig({ ...cfg, version: 0, dirty: true });
    return push(config!);
  }
  if (!res.ok) throw new Error(await errorMessage(res));
  const record = (await res.json()) as SyncRecord;
  if (record.version <= cfg.version) {
    saveConfig({ ...cfg, lastSyncedAt: new Date().toISOString() });
    setStatus({ phase: "idle", message: undefined });
    return;
  }
  const state = await decryptPayload<AppState>(key, record);
  if (cfg.dirty) {
    setStatus({ phase: "conflict", remote: { state, record }, message: "Dữ liệu trên máy này và trên máy chủ đều có thay đổi mới." });
    return;
  }
  applyRemote(state);
  saveConfig({ ...cfg, version: record.version, lastSyncedAt: record.updatedAt, dirty: false });
  setStatus({ phase: "idle", message: undefined });
}

let running: Promise<void> | null = null;

/** Đẩy thay đổi lên nếu có, ngược lại kéo bản mới về. */
export function syncNow(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg || status.phase === "conflict") return Promise.resolve();
  if (running) return running;
  setStatus({ phase: "syncing" });
  running = (cfg.dirty ? push(cfg) : pull(cfg))
    .catch((err: Error) => setStatus({ phase: "error", message: err.message }))
    .finally(() => {
      running = null;
    });
  return running;
}

/** Bật đồng bộ trên máy này với một mã mới; trả về mã để người dùng lưu lại. */
export async function enableWithNewCode(): Promise<string> {
  const code = generateCode();
  saveConfig({ code, version: 0, lastSyncedAt: null, dirty: true });
  setStatus({ phase: "syncing" });
  try {
    await push(config!);
  } catch (err) {
    saveConfig(null);
    setStatus({ phase: "off", message: (err as Error).message });
    throw err;
  }
  return code;
}

/** Kết nối với mã đã tạo ở thiết bị khác: dữ liệu trên máy chủ thay cho dữ liệu máy này. */
export async function connectWithCode(input: string): Promise<void> {
  const code = normalizeCode(input);
  if (!isValidCode(code)) throw new Error("Mã đồng bộ phải có 26 ký tự (chữ và số).");
  const { id, key } = await keysFor(code);
  const res = await request(id);
  if (res.status === 404) throw new Error("Không tìm thấy dữ liệu cho mã này.");
  if (!res.ok) throw new Error(await errorMessage(res));
  const record = (await res.json()) as SyncRecord;
  const state = await decryptPayload<AppState>(key, record);
  applyRemote(state);
  saveConfig({ code, version: record.version, lastSyncedAt: record.updatedAt, dirty: false });
  setStatus({ phase: "idle", message: undefined });
}

export async function resolveConflict(keep: "remote" | "local"): Promise<void> {
  const cfg = loadConfig();
  const remote = status.remote;
  if (!cfg || !remote) return;
  if (keep === "remote") {
    applyRemote(remote.state);
    saveConfig({ ...cfg, version: remote.record.version, lastSyncedAt: remote.record.updatedAt, dirty: false });
    setStatus({ phase: "idle", remote: undefined, message: undefined });
    return;
  }
  saveConfig({ ...cfg, version: remote.record.version, dirty: true });
  setStatus({ phase: "syncing", remote: undefined, message: undefined });
  await push(config!).catch((err: Error) => setStatus({ phase: "error", message: err.message }));
}

/** Ngừng đồng bộ trên máy này (dữ liệu trên máy chủ vẫn còn). */
export function disableSync() {
  saveConfig(null);
  setStatus({ phase: "off", remote: undefined, message: undefined });
}

/** Xóa dữ liệu trên máy chủ và ngừng đồng bộ. */
export async function deleteRemoteAndDisable(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg) return;
  const { id } = await keysFor(cfg.code);
  const res = await request(id, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(await errorMessage(res));
  disableSync();
}

/** Gọi khi dữ liệu trên máy thay đổi; bỏ qua thay đổi do chính đồng bộ ghi vào. */
export function markLocalChange(): boolean {
  const cfg = loadConfig();
  if (!cfg || applyingRemote) return false;
  if (!cfg.dirty) saveConfig({ ...cfg, dirty: true });
  return true;
}

export function isSyncEnabled(): boolean {
  return loadConfig() != null;
}

/** Đọc lại cấu hình (tab khác có thể vừa đồng bộ và nâng phiên bản). */
export function reloadSyncConfig() {
  if (status.phase === "syncing" || status.phase === "conflict") return;
  configLoaded = false;
  loadConfig();
  setStatus({});
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): SyncStatus {
  loadConfig();
  return status;
}

const SERVER_STATUS: SyncStatus = { phase: "off", code: null, lastSyncedAt: null };

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATUS);
}
