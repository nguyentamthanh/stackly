"use client";

import { useSyncExternalStore } from "react";
import type { AllocationMethod } from "./allocation";
import type { ProfileId } from "./plan";
import type { Transaction } from "./portfolio";
import type { AssetClass } from "./types";

const KEY = "tichsan:v1";
const VERSION = 1;

export interface PlanState {
  profile: ProfileId;
  /** Tối ưu theo đường biên hiệu quả hoặc tỷ trọng cố định */
  method: AllocationMethod;
  answers: number[] | null;
  budget: number;
  /** Tài sản đại diện được chọn cho mỗi nhóm */
  picks: Partial<Record<AssetClass, string>>;
}

export interface AppState {
  version: number;
  plan: PlanState;
  transactions: Transaction[];
}

export const DEFAULT_STATE: AppState = {
  version: VERSION,
  plan: {
    profile: "balanced",
    method: "optimized",
    answers: null,
    budget: 5_000_000,
    picks: { vn: "e1vfvn30", us: "spy", gold: "vang-nhan", crypto: "btc", savings: "tiet-kiem" },
  },
  transactions: [],
};

let cache: AppState | null = null;
const listeners = new Set<() => void>();

/** Kiểm tra và chuẩn hóa dữ liệu (từ localStorage hoặc file nhập vào). Ném lỗi nếu không hợp lệ. */
export function parseState(raw: unknown): AppState {
  if (!raw || typeof raw !== "object") throw new Error("File không đúng định dạng sao lưu của Tích Sản.");
  const r = raw as Partial<AppState>;
  if (r.version !== VERSION) throw new Error(`Phiên bản dữ liệu không hỗ trợ: ${String(r.version)}`);
  const txs = Array.isArray(r.transactions) ? r.transactions : [];
  for (const t of txs) {
    if (!t || typeof t.assetId !== "string" || typeof t.quantity !== "number" || typeof t.price !== "number" || !t.date) {
      throw new Error("Có giao dịch thiếu thông tin (mã tài sản, ngày, số lượng hoặc giá).");
    }
  }
  return {
    version: VERSION,
    plan: { ...DEFAULT_STATE.plan, ...(r.plan ?? {}), picks: { ...DEFAULT_STATE.plan.picks, ...(r.plan?.picks ?? {}) } },
    transactions: txs,
  };
}

function load(): AppState {
  try {
    const s = localStorage.getItem(KEY);
    return s ? parseState(JSON.parse(s)) : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

function getSnapshot(): AppState {
  if (!cache) cache = load();
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function saveState(next: AppState) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Trình duyệt chặn lưu trữ (chế độ riêng tư): vẫn giữ trong bộ nhớ cho phiên này
  }
  listeners.forEach((l) => l());
}

export function updateState(fn: (s: AppState) => AppState) {
  saveState(fn(getSnapshot()));
}

/** Trạng thái người dùng; null khi đang render phía server (chưa đọc được localStorage). */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function exportState(state: AppState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tich-san-sao-luu-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importStateFromFile(file: File): Promise<AppState> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("File không phải JSON hợp lệ.");
  }
  const state = parseState(raw);
  saveState(state);
  return state;
}
