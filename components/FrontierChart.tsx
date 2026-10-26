"use client";

import { CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import type { AllocationFile } from "@/lib/allocation";
import { CLASS_LABELS } from "@/lib/assets";
import { fmtPct } from "@/lib/format";
import { PROFILES, type ProfileId } from "@/lib/plan";

interface Pt {
  vol: number;
  ret: number;
  name: string;
}

export function FrontierChart({ alloc, profile }: { alloc: AllocationFile; profile: ProfileId }) {
  const classes: Pt[] = alloc.classes
    .filter((c) => c.cls !== "crypto")
    .map((c) => ({ vol: c.vol, ret: c.expReturn, name: CLASS_LABELS[c.cls] }));
  const fixed: Pt[] = (Object.keys(alloc.fixed) as ProfileId[]).map((id) => ({ ...alloc.fixed[id], name: `${PROFILES[id].name} (cố định)` }));
  const optimized: Pt[] = (Object.keys(alloc.optimized) as ProfileId[]).map((id) => ({
    vol: alloc.optimized[id].vol,
    ret: alloc.optimized[id].ret,
    name: PROFILES[id].name,
  }));
  const current = optimized.find((p) => p.name === PROFILES[profile].name)!;
  const maxVol = Math.max(0.25, ...alloc.frontier.map((f) => f.vol), ...fixed.map((f) => f.vol)) * 1.05;
  const frontier = alloc.frontier.filter((f) => f.vol <= maxVol);

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 10, right: 16, left: 0, bottom: 16 }}>
          <CartesianGrid stroke="var(--line)" />
          <XAxis
            type="number"
            dataKey="vol"
            domain={[0, maxVol]}
            tickFormatter={(v: number) => fmtPct(v, 0)}
            stroke="var(--muted)"
            fontSize={12}
            label={{ value: "Biến động (rủi ro) mỗi năm", position: "insideBottom", offset: -8, fill: "var(--muted)", fontSize: 12 }}
          />
          <YAxis type="number" dataKey="ret" tickFormatter={(v: number) => fmtPct(v, 0)} stroke="var(--muted)" fontSize={12} width={44} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}
            formatter={(v, key) => [fmtPct(Number(v), 1), key === "vol" ? "Biến động" : "Lợi nhuận kỳ vọng"]}
            labelFormatter={() => ""}
          />
          <Line data={frontier} dataKey="ret" type="monotone" stroke="var(--jade)" strokeWidth={2} dot={false} isAnimationActive={false} name="Đường biên hiệu quả" />
          <Scatter data={classes} fill="var(--muted)" name="Từng kênh" isAnimationActive={false}>
            <LabelList dataKey="name" position="right" fontSize={11} fill="var(--muted)" />
          </Scatter>
          <Scatter data={fixed} fill="var(--surface)" stroke="var(--t-expensive)" strokeWidth={2} name="Tỷ trọng cố định" isAnimationActive={false} />
          <Scatter data={optimized} fill="var(--jade)" name="Tối ưu" isAnimationActive={false} />
          <Scatter data={[current]} fill="var(--jade)" stroke="var(--ink)" strokeWidth={2} shape="star" name="Hồ sơ của bạn" isAnimationActive={false}>
            <LabelList dataKey="name" position="top" fontSize={12} fill="var(--ink)" fontWeight={600} />
          </Scatter>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FrontierLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-4 border-t-2 border-jade" /> Đường biên hiệu quả
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-jade" /> Phân bổ tối ưu
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-full border-2 border-t-expensive" /> Tỷ trọng cố định
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-muted" /> Từng kênh riêng lẻ
      </span>
    </div>
  );
}

