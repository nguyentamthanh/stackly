import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, parseState } from "@/lib/storage";

const withGoal = (goal: unknown) => ({ ...DEFAULT_STATE, goal });

describe("parseState: mục tiêu 1 năm", () => {
  it("giữ nguyên mục tiêu hợp lệ sau khi lưu rồi đọc lại", () => {
    const goal = { start: "2026-10", initial: 1_000_000, monthly: 5_000_000, target: 70_000_000, actuals: { "2026-10": 6_000_000, "2026-11": 11_000_000 } };
    expect(parseState(JSON.parse(JSON.stringify(withGoal(goal)))).goal).toEqual(goal);
  });

  it("dữ liệu cũ không có mục tiêu thì goal = null", () => {
    const old: Record<string, unknown> = { ...DEFAULT_STATE };
    delete old.goal;
    expect(parseState(old).goal).toBeNull();
  });

  it("bỏ mục tiêu sai định dạng nhưng không làm hỏng cả file", () => {
    expect(parseState(withGoal({ start: "10/2026", initial: 0, monthly: 1, target: 1, actuals: {} })).goal).toBeNull();
    expect(parseState(withGoal({ start: "2026-13", initial: 0, monthly: 1, target: 1, actuals: {} })).goal).toBeNull();
    expect(parseState(withGoal({ start: "2026-10", initial: -5, monthly: 1, target: 1, actuals: {} })).goal).toBeNull();
    expect(parseState(withGoal({ start: "2026-10", initial: 0, monthly: Number.NaN, target: 1, actuals: {} })).goal).toBeNull();
  });

  it("bỏ số thực tế có tháng hoặc giá trị sai, giữ phần còn lại", () => {
    const goal = { start: "2026-10", initial: 0, monthly: 1, target: 1, actuals: { "2026-10": 5, abc: 7, "2026-11": -1, "2026-12": "x" } };
    expect(parseState(withGoal(goal)).goal?.actuals).toEqual({ "2026-10": 5 });
  });
});
