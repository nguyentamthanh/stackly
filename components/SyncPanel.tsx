"use client";

import { useState } from "react";
import { fmtDateTime } from "@/lib/format";
import {
  connectWithCode,
  deleteRemoteAndDisable,
  disableSync,
  enableWithNewCode,
  resolveConflict,
  syncNow,
  useSyncStatus,
} from "@/lib/sync";
import { formatCode } from "@/lib/sync-crypto";
import { cx } from "@/lib/ui";

const btn = "rounded-lg border border-line px-3 py-2 text-sm hover:border-muted disabled:opacity-50";
const btnPrimary = "rounded-lg bg-jade text-on-jade font-semibold px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50";

export function SyncPanel() {
  const status = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(formatCode(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowCode(true);
    }
  };

  return (
    <section aria-labelledby="h-sync" className="rounded-xl border border-line bg-surface p-4 sm:p-5 flex flex-col gap-4">
      <div>
        <h2 id="h-sync" className="font-display text-xl font-semibold">
          Đồng bộ nhiều thiết bị
        </h2>
        <p className="text-sm text-muted mt-1 max-w-prose">
          Dùng một mã bí mật để mở cùng kế hoạch và danh mục trên điện thoại và máy tính, không cần tài khoản. Dữ liệu được mã hóa
          ngay trên trình duyệt; máy chủ không đọc được nội dung.
        </p>
      </div>

      {status.phase === "off" ? (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2 items-start">
            <p className="text-sm font-medium">Lần đầu dùng</p>
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => run(async () => setNewCode(await enableWithNewCode()))}>
              {busy ? "Đang tạo…" : "Tạo mã đồng bộ"}
            </button>
          </div>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => connectWithCode(input));
            }}
          >
            <label htmlFor="sync-code" className="text-sm font-medium">
              Đã có mã từ thiết bị khác
            </label>
            <div className="flex gap-2">
              <input
                id="sync-code"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="XXXXX-XXXXX-XXXXX-…"
                autoComplete="off"
                spellCheck={false}
                className="flex-1 min-w-0 rounded-lg border border-line bg-paper px-3 py-2 font-mono text-sm uppercase"
              />
              <button type="submit" className={btn} disabled={busy || !input.trim()}>
                Kết nối
              </button>
            </div>
            <p className="text-xs text-muted">Dữ liệu trên máy này sẽ được thay bằng dữ liệu của mã đó.</p>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {newCode && (
            <div className="rounded-lg bg-jade-soft p-3 flex flex-col gap-2">
              <p className="text-sm font-medium">Mã đồng bộ của bạn. Hãy lưu lại ở nơi an toàn:</p>
              <code className="font-mono text-base sm:text-lg font-semibold tracking-wide break-all">{formatCode(newCode)}</code>
              <p className="text-xs text-muted">
                Nhập mã này ở thiết bị khác để mở cùng dữ liệu. Mất mã thì không khôi phục được, vì máy chủ chỉ giữ bản đã mã hóa.
              </p>
            </div>
          )}

          <p className="text-sm" role="status">
            {status.phase === "syncing" && <span className="text-muted">Đang đồng bộ…</span>}
            {status.phase === "idle" && (
              <span>
                <span className="text-up font-medium">Đã bật đồng bộ</span>
                {status.lastSyncedAt && <span className="text-muted"> · lần cuối {fmtDateTime(status.lastSyncedAt)}</span>}
              </span>
            )}
            {status.phase === "error" && <span className="text-down">Lỗi đồng bộ: {status.message}</span>}
          </p>

          {status.phase === "conflict" && status.remote && (
            <div className="rounded-lg border border-t-expensive/40 bg-t-expensive/10 p-3 flex flex-col gap-2">
              <p className="text-sm font-medium">{status.message} Giữ bản nào?</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} disabled={busy} onClick={() => run(() => resolveConflict("remote"))}>
                  Bản trên máy chủ ({status.remote.state.transactions.length} giao dịch, {fmtDateTime(status.remote.record.updatedAt)})
                </button>
                <button type="button" className={btn} disabled={busy} onClick={() => run(() => resolveConflict("local"))}>
                  Bản trên máy này
                </button>
              </div>
            </div>
          )}

          {status.code && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-sm bg-paper rounded px-2 py-1">
                {showCode ? formatCode(status.code) : `${status.code.slice(0, 5)}-•••••-•••••-…`}
              </code>
              <button type="button" className="text-sm text-jade hover:underline" onClick={() => setShowCode((s) => !s)}>
                {showCode ? "Ẩn mã" : "Hiện mã"}
              </button>
              <button type="button" className="text-sm text-jade hover:underline" onClick={() => copy(status.code!)}>
                {copied ? "Đã sao chép" : "Sao chép mã"}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={busy || status.phase === "syncing" || status.phase === "conflict"} onClick={() => run(syncNow)}>
              Đồng bộ ngay
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() => {
                disableSync();
                setNewCode(null);
              }}
            >
              Ngừng đồng bộ trên máy này
            </button>
            {confirmDelete ? (
              <span className="flex flex-wrap items-center gap-2 text-sm">
                Xóa vĩnh viễn dữ liệu trên máy chủ?
                <button
                  type="button"
                  className={cx(btn, "border-down text-down")}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await deleteRemoteAndDisable();
                      setConfirmDelete(false);
                      setNewCode(null);
                    })
                  }
                >
                  Xóa
                </button>
                <button type="button" className={btn} onClick={() => setConfirmDelete(false)}>
                  Hủy
                </button>
              </span>
            ) : (
              <button type="button" className={cx(btn, "text-down")} onClick={() => setConfirmDelete(true)}>
                Xóa dữ liệu trên máy chủ
              </button>
            )}
          </div>
          <p className="text-xs text-muted">Dữ liệu trên máy này vẫn được giữ khi ngừng đồng bộ hoặc xóa dữ liệu trên máy chủ.</p>
        </div>
      )}

      {(error || (status.phase === "off" && status.message)) && (
        <p role="alert" className="text-sm text-down">
          {error || status.message}
        </p>
      )}
    </section>
  );
}
