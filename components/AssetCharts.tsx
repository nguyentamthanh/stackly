"use client";

import { useMemo } from "react";
import { sma } from "@/lib/indicators";
import { fmtNum } from "@/lib/format";
import type { Bar } from "@/lib/types";
import { TimeSeriesChart, type SeriesSpec } from "./TimeSeriesChart";

function withMA(bars: Bar[], period: number): Bar[] {
  const ma = sma(
    bars.map((b) => b[1]),
    period,
  );
  return bars.flatMap((b, i) => (ma[i] == null ? [] : [[b[0], Math.round(ma[i]! * 100) / 100] as Bar]));
}

const fmtPrice = (v: number) => (Math.abs(v) >= 1000 ? fmtNum(v, 0) : fmtNum(v, 2));
const fmtScore = (v: number) => fmtNum(v, 0);
const SCORE_RANGE: [number, number] = [0, 100];
const SCORE_BANDS = [20, 40, 60, 80];

export function PriceChart({ bars, domestic, mainLabel = "Giá" }: { bars: Bar[]; domestic?: Bar[]; mainLabel?: string }) {
  const series = useMemo<SeriesSpec[]>(
    () => [
      { name: mainLabel, data: bars, color: "--ink", width: 2, area: true },
      ...(domestic && domestic.length ? [{ name: "Giá bán trong nước", data: domestic, color: "--t-expensive", width: 2 as const }] : []),
      { name: "MA50", data: withMA(bars, 50), color: "--t-cheap", width: 1 },
      { name: "MA200", data: withMA(bars, 200), color: "--jade", width: 2, dashed: true },
    ],
    [bars, domestic, mainLabel],
  );
  return <TimeSeriesChart series={series} formatValue={fmtPrice} />;
}

export function ScoreChart({ scores }: { scores: Bar[] }) {
  const series = useMemo<SeriesSpec[]>(() => [{ name: "Điểm hấp dẫn", data: scores, color: "--t-very-cheap", width: 2 }], [scores]);
  return (
    <TimeSeriesChart series={series} height={220} fixedRange={SCORE_RANGE} bands={SCORE_BANDS} defaultYears={0} formatValue={fmtScore} />
  );
}
