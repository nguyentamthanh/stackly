import { describe, expect, it } from "vitest";
import { groupMoney, parseMoney } from "@/lib/format";

describe("groupMoney", () => {
  it.each([
    ["", ""],
    ["0", "0"],
    ["999", "999"],
    ["1000", "1.000"],
    ["5000000", "5.000.000"],
    ["1234567890", "1.234.567.890"],
    ["1234567.5", "1.234.567,5"],
    ["0.005", "0,005"],
    ["12.", "12,"],
    ["007", "7"],
  ])("%s → %s", (input, output) => {
    expect(groupMoney(input)).toBe(output);
  });
});

describe("parseMoney (số nguyên)", () => {
  it.each([
    ["5.000.000", "5000000"],
    ["5,000,000", "5000000"],
    ["5 000 000", "5000000"],
    ["5000000", "5000000"],
    ["abc", ""],
    ["", ""],
    ["007", "7"],
    ["0", "0"],
    ["12,5", "125"],
  ])("%s → %s", (input, output) => {
    expect(parseMoney(input)).toBe(output);
  });
});

describe("parseMoney (có số lẻ)", () => {
  it("dấu phẩy là dấu thập phân, dấu chấm là hàng nghìn", () => {
    expect(parseMoney("1.234.567,89", true)).toBe("1234567.89");
    expect(parseMoney("0,005", true)).toBe("0.005");
  });

  it("gõ dấu phẩy hoặc dấu chấm ở cuối để bắt đầu phần lẻ", () => {
    expect(parseMoney("0,", true)).toBe("0.");
    expect(parseMoney("12.", true)).toBe("12.");
    expect(parseMoney(",", true)).toBe("0.");
  });

  it("gõ tiếp sau dấu chấm vẫn là phần lẻ nhờ hiển thị đã đổi thành dấu phẩy", () => {
    const afterDot = groupMoney(parseMoney("0.", true));
    expect(afterDot).toBe("0,");
    expect(parseMoney(afterDot + "5", true)).toBe("0.5");
  });

  it("gõ thêm chữ số vào số đã có dấu nhóm không bị hiểu thành số lẻ", () => {
    expect(parseMoney("1.2345", true)).toBe("12345");
    expect(parseMoney("1.234.5", true)).toBe("12345");
  });

  it("dán số kiểu Mỹ: một dấu chấm với 1–2 hoặc 4+ chữ số sau là số lẻ", () => {
    expect(parseMoney("759.97", true, true)).toBe("759.97");
    expect(parseMoney("0.005", true, true)).toBe("0.005");
    expect(parseMoney("1.2345", true, true)).toBe("1.2345");
  });

  it("dán 1.234 (ba chữ số sau, phần nguyên khác 0) là hàng nghìn", () => {
    expect(parseMoney("1.234", true, true)).toBe("1234");
    expect(parseMoney("1.234.567", true, true)).toBe("1234567");
  });

  it("nhiều dấu phẩy là dấu nhóm kiểu Mỹ", () => {
    expect(parseMoney("5,000,000", true, true)).toBe("5000000");
  });

  it("đi đi về về giữa hiển thị và phân tích không đổi giá trị", () => {
    for (const c of ["0", "1", "1234", "1234567.89", "0.005", "759.97", "140600000"]) {
      expect(parseMoney(groupMoney(c), true)).toBe(c);
    }
  });
});
