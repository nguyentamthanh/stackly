"use client";

import { useMemo } from "react";
import { fmtVndShort } from "@/lib/format";
import type { Bar } from "@/lib/types";
import { TimeSeriesChart, type SeriesSpec } from "./TimeSeriesChart";

export interface ValueLine {
  name: string;
  data: Bar[];
  /** Tên biến CSS */
  color: string;
  dashed?: boolean;
}

/** Giá trị danh mục theo thời gian của nhiều kiểu đầu tư trên cùng một dòng tiền */
export function StrategyChart({ lines, height = 300 }: { lines: ValueLine[]; height?: number }) {
  const series = useMemo<SeriesSpec[]>(
    () => lines.map((l) => ({ name: l.name, data: l.data, color: l.color, width: l.dashed ? 1 : 2, dashed: l.dashed })),
    [lines],
  );
  return <TimeSeriesChart series={series} height={height} defaultYears={0} formatValue={fmtVndShort} />;
}
