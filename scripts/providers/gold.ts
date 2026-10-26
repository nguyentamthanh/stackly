import { getJson } from "./http";

interface PnjResponse {
  data: { masp: string; tensp: string; giaban: number; giamua: number }[];
}

export interface DomesticGold {
  sjcBuy: number;
  sjcSell: number;
  ringBuy: number;
  ringSell: number;
  source: string;
}

/** PNJ niêm yết theo nghìn đồng/chỉ → quy đổi VND/lượng (1 lượng = 10 chỉ). */
const PNJ_TO_VND_PER_LUONG = 1000 * 10;

export async function fetchDomesticGold(): Promise<DomesticGold> {
  const j = await getJson<PnjResponse>("https://edge-api.pnj.io/ecom-frontend/v1/get-gold-price?zone=00");
  const sjc = j.data?.find((d) => d.masp === "SJC");
  const ring = j.data?.find((d) => d.masp === "N24K");
  if (!sjc || !ring) throw new Error("PNJ: thiếu giá SJC hoặc nhẫn 999.9");
  return {
    sjcBuy: sjc.giamua * PNJ_TO_VND_PER_LUONG,
    sjcSell: sjc.giaban * PNJ_TO_VND_PER_LUONG,
    ringBuy: ring.giamua * PNJ_TO_VND_PER_LUONG,
    ringSell: ring.giaban * PNJ_TO_VND_PER_LUONG,
    source: "PNJ",
  };
}

/** 1 lượng = 37,5 gram ; 1 troy ounce = 31,1034768 gram */
export const OZ_PER_LUONG = 37.5 / 31.1034768;
