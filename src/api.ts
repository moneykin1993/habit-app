/**
 * Front utility layer (CORS回避)
 * - 開発/本番とも、原則として同一オリジンの /api/gas を叩く
 *   → Cloudflare Pages Functions が GAS に中継
 */

function envBase(): string {
  // ローカルでは未設定でもOK（/api/gas を使う）
  const base = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  return (base || "").trim().replace(/\/+$/, "");
}

function buildProxyUrl(path: string, query?: Record<string, any>): string {
  const base = envBase();
  // baseがあればそれを使う（本番で別ドメインにしたい場合）
  // 無ければ同一オリジンの /api/gas
  const url = new URL((base || "") + "/api/gas", window.location.origin);

  url.searchParams.set("path", path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function gasCall<T>(
  path: string,
  body: Record<string, any> = {},
  query?: Record<string, any>
): Promise<T> {
  const url = buildProxyUrl(path, query);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {})
  });

  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`);
  }
}

export function groupOptions(): string[] {
  const arr: string[] = [];
  for (let i = 1; i <= 200; i++) arr.push(`グループ${i}`);
  return arr;
}

export function hasAnySpace(s: string): boolean {
  return /[ \u3000]/.test(s ?? "");
}

export function todayJst(): string {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

export type TimeOption = { minutes: number; label: string };

export function toHourMinOptions(): TimeOption[] {
  const out: TimeOption[] = [];
  for (let min = 0; min <= 720; min += 10) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const label =
      h === 0 ? `${m}分` : m === 0 ? `${h}時間` : `${h}時間${String(m).padStart(2, "0")}分`;
    out.push({ minutes: min, label });
  }
  return out;
}
