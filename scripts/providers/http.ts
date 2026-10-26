const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

export async function getJson<T>(url: string, { retries = 2, timeoutMs = 20000 } = {}): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "*/*" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // Cloudflare challenge hoặc trang lỗi HTML
      if (text.trimStart().startsWith("<")) throw new Error("Nhận HTML thay vì JSON (có thể bị chặn)");
      return JSON.parse(text) as T;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error(`${url.split("?")[0]}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

export function round(x: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
