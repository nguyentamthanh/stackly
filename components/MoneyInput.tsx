"use client";

import { useLayoutEffect, useRef, useState, type ClipboardEvent, type InputHTMLAttributes } from "react";
import { groupMoney, parseMoney } from "@/lib/format";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode" | "min" | "max" | "step"> & {
  value: number | string;
  /** Nhận chuỗi số chuẩn (dấu chấm thập phân, "" khi ô trống). Không có nút tăng giảm vì ô hiện dạng 5.000.000. */
  onValueChange: (canonical: string) => void;
  /** Cho phép số lẻ (số lượng, giá USD). Mặc định chỉ số nguyên (tiền VND). */
  decimals?: boolean;
};

const sameNumber = (a: string, b: string) => (Number(a) || 0) === (Number(b) || 0);

/** Vị trí con trỏ sau khi định dạng: sau `sig` ký tự có nghĩa (chữ số, dấu phẩy) tính từ đầu */
function caretAfter(formatted: string, sig: number, decimals: boolean): number {
  if (sig <= 0) return 0;
  const significant = decimals ? /[\d,]/ : /\d/;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (significant.test(formatted[i]) && ++seen === sig) return i + 1;
  }
  return formatted.length;
}

/**
 * Ô nhập số có dấu phân cách hàng nghìn kiểu Việt Nam ("5.000.000"), cập nhật ngay khi gõ và giữ vị trí con trỏ.
 * Hiểu cả "5,000,000" khi dán. Phụ thuộc vào giá trị cha: khi cha đổi giá trị khác với những gì đang hiển thị thì hiển thị lại.
 */
export function MoneyInput({ value, onValueChange, decimals = false, ...rest }: Props) {
  const canonical = typeof value === "number" ? (Number.isFinite(value) ? String(value) : "") : value;
  const [text, setText] = useState(() => groupMoney(canonical));
  const [last, setLast] = useState(canonical);
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const pasted = useRef(false);

  // Giá trị đổi từ bên ngoài (nút gợi ý, đổi tài sản, bị kẹp min/max): hiển thị lại. Ô trống mà cha ép thành 0 thì giữ trống.
  if (!sameNumber(canonical, last)) {
    setLast(canonical);
    setText(groupMoney(canonical));
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (caret.current != null && el && document.activeElement === el) el.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [text]);

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode={decimals ? "decimal" : "numeric"}
      autoComplete="off"
      value={text}
      onPaste={(e: ClipboardEvent<HTMLInputElement>) => {
        pasted.current = true;
        rest.onPaste?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        const next = parseMoney(raw, decimals, pasted.current);
        pasted.current = false;
        const formatted = groupMoney(next);
        const pos = e.target.selectionStart ?? raw.length;
        const sig = (raw.slice(0, pos).match(decimals ? /[\d,]/g : /\d/g) ?? []).length;
        caret.current = pos >= raw.length ? formatted.length : caretAfter(formatted, sig, decimals);
        setText(formatted);
        setLast(next);
        onValueChange(next);
      }}
    />
  );
}
