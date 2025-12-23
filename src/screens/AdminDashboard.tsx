import React, { useMemo, useState } from "react";
import { gasCall, groupOptions } from "../api";

type AdminResp =
  | { ok: false; message: string }
  | {
      ok: true;
      group_name: string;
      cycle: { start: string; end: string };
      weeks: string[]; // 週ID（YYYY-Www）
      rows: Array<{
        name: string;
        student_key: string;
        latest_grade: "S" | "A" | "B" | "C";
        period_reports_days: number;
        period_total_hours: number;
        latest_streak_days: number;
        weeks: Record<
          string,
          { grade: string; reports: string; rate: string; hours: string }
        >;
      }>;
    };

function getQueryParam(name: string): string {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || "";
}

/** ISO週ID "2025-W49" → その週の月曜の日付（ローカル） */
function weekIdToMonday(weekId: string): Date | null {
  // ISO week algorithm (Mon-based)
  const m = /^(\d{4})-W(\d{2})$/.exec(String(weekId || "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;

  // ISO week 1: the week with Jan 4th in it.
  // Compute Thursday of week 1, then add (week-1)*7 days, then go back to Monday.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = (jan4.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const week1Mon = new Date(Date.UTC(year, 0, 4 - day));
  const mon = new Date(week1Mon);
  mon.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);

  // 表示はユーザーのローカル（JST想定）
  return new Date(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate());
}

/** "2025-W49" → "12/1週"（必要なら年も付ける） */
function toWeekLabel(weekId: string): string {
  const mon = weekIdToMonday(weekId);
  if (!mon) return weekId;
  const mm = mon.getMonth() + 1;
  const dd = mon.getDate();
  return `${mm}月${dd}日~`;
}

export default function AdminDashboard() {
  const groups = useMemo(() => groupOptions(), []);
  const [group, setGroup] = useState(groups[0] || "グループ1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<AdminResp | null>(null);

  const adminToken = getQueryParam("admin_token");

  async function load() {
    if (!adminToken) return;
    setBusy(true);
    setMsg("");
    setData(null);

    try {
      // GET仕様だが、フロントはJSONPの都合上 gasCall（クエリ）で統一
      const res = await gasCall<AdminResp>("/admin/group-table", {}, {
        group_name: group,
        admin_token: adminToken
      });

      if (!res.ok) {
        setMsg(res.message || "権限がありません。");
        return;
      }
      setData(res);
    } catch {
      setMsg("通信に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  if (!adminToken) {
    return (
      <div className="container">
        <div className="card">
          <h1 className="title">管理者画面</h1>
          <div className="message">権限がありません。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="stack">
        <div className="card">
          <h1 className="title">管理者画面</h1>

          <div className="field">
            <label>グループ名</label>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              disabled={busy}
            >
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <button className="btn" onClick={load} disabled={busy}>
            {busy ? "処理中..." : "表示"}
          </button>

          {msg && <div className="message">{msg}</div>}
          {data && data.ok && (
            <div className="note">
              対象期間：{data.cycle.start} 〜 {data.cycle.end}
            </div>
          )}
        </div>

        {data && data.ok && (
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="sticky-col sticky-head">氏名</th>
                    <th className="sticky-head">最新週の評価</th>
                    <th className="sticky-head">合計報告日数</th>
                    <th className="sticky-head">合計勉強時間</th>
                    <th className="sticky-head">連続報告日数</th>
                    {data.weeks.map((w) => (
                      <th key={w} className="sticky-head">
                        {toWeekLabel(w)}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.student_key}>
                      <td className="sticky-col">{r.name}</td>
                      <td>{r.latest_grade}</td>
                      <td>{r.period_reports_days}</td>
                      <td>{r.period_total_hours}h</td>
                      <td>{r.latest_streak_days}</td>

                      {data.weeks.map((w) => {
                        const cell = r.weeks[w] || {
                          grade: "",
                          reports: "",
                          rate: "",
                          hours: ""
                        };
                        const isC = cell.grade === "C";
                        return (
                          <td key={w} className={isC ? "cell-c" : ""}>
                            <div className={isC ? "c-bold" : ""}>{cell.grade}</div>
                            <div className="cell-sub">{cell.reports}</div>
                            <div className="cell-sub">{cell.rate}</div>
                            <div className="cell-sub">{cell.hours}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
