/**
 * Front utility layer
 * - gasCall: GAS(JSON返却想定)への呼び出し
 * - groupOptions: グループ1〜200
 * - hasAnySpace: 氏名のスペース検知（全角/半角）
 * - todayJst: JSTのYYYY-MM-DD
 * - toHourMinOptions: 0〜720分(12h)を10分刻みプルダウン用
 */

function envBase(): string {
  const base = (import.meta as any).env?.VITE_GAS_API_BASE as string | undefined;
  return (base || "").trim().replace(/\/+$/, "");
}

function safeUrl(base: string): URL {
  try {
    return new URL(base);
  } catch {
    return new URL("https://" + base.replace(/^\/+/, ""));
  }
}

function buildUrl(path: string, query?: Record<string, any>): string {
  const base = envBase();
  if (!base) throw new Error("VITE_GAS_API_BASE is not set");

  const url = safeUrl(base);
  url.searchParams.set("path", path);

  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * GAS API call
 * - POST(JSON)固定（今はフロント実装を先に通す）
 * - query を渡すとURLクエリにも追加できる（admin_token等）
 */
export async function gasCall<T>(
  path: string,
  body: Record<string, any> = {},
  query?: Record<string, any>
): Promise<T> {
  const url = buildUrl(path, query);

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
