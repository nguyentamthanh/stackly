"use client";

import { AreaSeries, ColorType, createChart, LineSeries, LineStyle, type IChartApi, type Time } from "lightweight-charts";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import type { Bar } from "@/lib/types";
import { cx } from "@/lib/ui";

export interface SeriesSpec {
  name: string;
  data: Bar[];
  /** Tên biến CSS, ví dụ "--jade" */
  color: string;
  width?: 1 | 2 | 3;
  dashed?: boolean;
  area?: boolean;
}

const RANGES = [
  { label: "1N", years: 1 },
  { label: "3N", years: 3 },
  { label: "5N", years: 5 },
  { label: "Tất cả", years: 0 },
];

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

export function TimeSeriesChart({
  series,
  height = 320,
  fixedRange,
  defaultYears = 3,
  formatValue,
  bands,
}: {
  series: SeriesSpec[];
  height?: number;
  /** Cố định trục tung, ví dụ [0, 100] cho biểu đồ điểm */
  fixedRange?: [number, number];
  defaultYears?: number;
  formatValue?: (v: number) => string;
  /** Đường ngang tham chiếu (ví dụ ngưỡng 20/40/60/80) */
  bands?: number[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();
  const [years, setYears] = useState(defaultYears);
  const lastDate = series.flatMap((s) => s.data.at(-1)?.[0] ?? []).sort().at(-1);
  const firstDate = series.flatMap((s) => s.data[0]?.[0] ?? []).sort()[0];

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      height,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: cssVar("--muted"),
        fontFamily: getComputedStyle(document.body).fontFamily,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: cssVar("--line") } },
      rightPriceScale: { borderVisible: false, scaleMargins: fixedRange ? { top: 0.04, bottom: 0.04 } : { top: 0.1, bottom: 0.1 } },
      timeScale: { borderVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: cssVar("--ink") }, vertLine: { labelBackgroundColor: cssVar("--ink") } },
      localization: {
        locale: "vi-VN",
        priceFormatter: formatValue,
        dateFormat: "dd/MM/yyyy",
      },
    });
    chartRef.current = chart;

    for (const s of series) {
      if (!s.data.length) continue;
      const color = cssVar(s.color);
      const common = {
        lineWidth: s.width ?? 2,
        lineStyle: s.dashed ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: !s.dashed,
        autoscaleInfoProvider: fixedRange ? () => ({ priceRange: { minValue: fixedRange[0], maxValue: fixedRange[1] } }) : undefined,
      } as const;
      const data = s.data.map(([time, value]) => ({ time: time as Time, value }));
      const api = s.area
        ? chart.addSeries(AreaSeries, { ...common, lineColor: color, topColor: color + "40", bottomColor: color + "05" })
        : chart.addSeries(LineSeries, { ...common, color });
      api.setData(data);
      if (bands && s === series[0]) {
        for (const b of bands) {
          api.createPriceLine({ price: b, color: cssVar("--line"), lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false });
        }
      }
    }
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [series, height, resolvedTheme, fixedRange, formatValue, bands]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !lastDate || !firstDate) return;
    if (years === 0) {
      chart.timeScale().fitContent();
      return;
    }
    const from = new Date(lastDate);
    from.setUTCFullYear(from.getUTCFullYear() - years);
    const fromStr = from.toISOString().slice(0, 10);
    chart.timeScale().setVisibleRange({ from: (fromStr < firstDate ? firstDate : fromStr) as Time, to: lastDate as Time });
  }, [years, lastDate, firstDate, resolvedTheme, series]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-2">
        <div className="flex gap-3 text-xs text-muted flex-wrap">
          {series
            .filter((s) => s.data.length)
            .map((s) => (
              <span key={s.name} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block w-4 border-t-2"
                  style={{ borderColor: `var(${s.color})`, borderStyle: s.dashed ? "dashed" : "solid" }}
                />
                {s.name}
              </span>
            ))}
        </div>
        <div className="ml-auto flex rounded-lg border border-line p-0.5 text-xs" role="group" aria-label="Khoảng thời gian">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setYears(r.years)}
              aria-pressed={years === r.years}
              className={cx("px-2.5 py-1 rounded-md", years === r.years ? "bg-ink text-paper font-semibold" : "text-muted hover:text-ink")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={ref} style={{ height }} />
    </div>
  );
}
