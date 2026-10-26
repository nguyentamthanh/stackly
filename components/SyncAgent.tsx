"use client";

import { useEffect } from "react";
import { subscribeLocalChanges } from "@/lib/storage";
import { isSyncEnabled, markLocalChange, reloadSyncConfig, syncNow } from "@/lib/sync";

/** Chạy nền trên mọi trang: kéo dữ liệu mới khi mở app/quay lại tab, đẩy thay đổi sau 2 giây. */
export function SyncAgent() {
  useEffect(() => {
    if (isSyncEnabled()) void syncNow();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeLocalChanges(() => {
      if (!markLocalChange()) return;
      clearTimeout(timer);
      timer = setTimeout(() => void syncNow(), 2000);
    });
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      reloadSyncConfig();
      if (isSyncEnabled()) void syncNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
