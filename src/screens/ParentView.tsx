import React, { useMemo, useState } from "react";
import { gasCall, groupOptions, hasAnySpace } from "../api";

type ResolveResp =
  | { ok: true; student_key: string }
  | { ok: false; message: string };

type SummaryResp =
  | {
      ok: true;
      improvement_support: { raw: string; text: string } | null;
      results: {
        streak_days: number;
        week_achieved_rate_pct: number;
        pie: { achieved: number; not_achieved: number; unreported: number };
        week_total_hours: number;
        avg_daily_hours: number;

        // 個人評価
        grade: "S" | "A" | "B" | "C";
        grade_message: string; // 肯定文言のみ

        // ▼ 追加：チーム評価（無い場合もあるので optional にして互換性維持）
        team_grade?: "S" | "A" | "B" | "C";
        team_grade_message?: string; // 肯定文言のみ
      };
    }
  | { ok: false; message: string };

/** hours(number) → {h, m} */
function hoursToHM(hours: number): { h: number; m: number } {
  const totalMin = Math.round((Number(hours) || 0) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return { h, m };
}

/** hours(number) → "X時間Y分" */
function hoursToJa(hours: number): string {
  const hm = hoursToHM(hours);
  return `${hm.h}時間${hm.m}分`;
}

/** pie counts → conic-gradient 用の deg 文字列を作る */
function pieToDegVars(pie: { achieved: number; not_achieved: number; unreported: number }) {
  const a = Number(pie?.achieved || 0);
  const n = Number(pie?.not_achieved || 0);
  const u = Number(pie?.unreported || 0);
  const total = a + n + u || 1;

  const degA = (a / total) * 360;
  const degN = (n / total) * 360;

  const p1 = `${degA}deg`; // 達成の終点
  const p2 = `${degA + degN}deg`; // 達成+未達の終点
  return { a, n, u, p1, p2 };
}

export default function ParentView() {
  const groups = useMemo(() => groupOptions(), []);
  const [group, setGroup] = useState(groups[0] || "グループ1");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [data, setData] = useState<SummaryResp | null>(null);
  const [showAvg, setShowAvg] = useState(false);

  const hasSpace = hasAnySpace(name);
  const canShow = !!group && !!name.trim() && !hasSpace && !busy;

  async function show() {
    if (!canShow) return;
    setBusy(true);
    setMsg("");
    setData(null);
    setShowAvg(false);

    try {
      const r1 = await gasCall<ResolveResp>("/parent/resolve-student", {
        group_name: group,
        name_raw: name
      });

      if (!r1.ok) {
        setMsg(
          r1.message ||
            "該当する生徒が見つかりませんでした。入力内容に誤りがないかをご確認ください。"
        );
        return;
      }

      const r2 = await gasCall<SummaryResp>("/parent/get-week-summary", {
        student_key: r1.student_key
      });

      if (!r2.ok) {
        setMsg(r2.message || "現在は利用できません。");
        return;
      }

      setData(r2);
    } catch {
      setMsg("通信に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h1 className="title">お子様の学習状況</h1>

        <div className="field">
          <label>お子様のグループ名</label>
          <select value={group} onChange={(e) => setGroup(e.target.value)} disabled={busy}>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>お子様の氏名（フルネーム）</label>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          {hasSpace && <div className="hint">スペースなしで入力してください。</div>}
        </div>

        <button className="btn" disabled={!canShow} onClick={show}>
          {busy ? "処理中..." : "表示"}
        </button>

        {msg && <div className="message">{msg}</div>}
      </div>

      {data && data.ok && (
        <div className="card">
          <h2 className="h2">学習状況を知る</h2>

          <div className="field">
            <label>今日の工夫（前日分）</label>
            {data.improvement_support ? (
              <div className="support">{data.improvement_support.text}</div>
            ) : (
              <div className="support-min"> </div>
            )}
          </div>

          {/* 指標カード（横幅1/2・中央揃え等はCSSで制御） */}
          <div className="metrics">
            <div className="metric streak">
              <div className="mk">連続報告日数</div>
              <div className="mv">{data.results.streak_days}日</div>
              <div className="ms">継続中</div>
            </div>

            <div className="metric total">
              <div className="mk">週の合計勉強時間</div>
              <div className="mv">{hoursToJa(data.results.week_total_hours)}</div>
              <div className="ms">今週の合計</div>
            </div>

            <div className="metric grade">
              <div className="mk">個人評価</div>
              <div className="mv">{data.results.grade}</div>
              <div className="ms">今週の評価</div>
            </div>

            {/* ▼ 追加：チーム評価（APIが返さない場合は非表示） */}
            {data.results.team_grade && (
              <div className="metric team">
                <div className="mk">チーム評価</div>
                <div className="mv">{data.results.team_grade}</div>
                <div className="ms">今週の評価</div>
              </div>
            )}
          </div>

          <div className="result-row">
            <div className="result-k">週の計画達成率</div>
          </div>

          {/* pie-card ＋注釈 */}
          {(() => {
            const { a, n, u, p1, p2 } = pieToDegVars(data.results.pie);
            return (
              <div className="pie-card">
                <div className="pie-chart" style={{ ["--p1" as any]: p1, ["--p2" as any]: p2 }}>
                  <div className="pie-center" aria-label={`今週 ${data.results.week_achieved_rate_pct}% 達成`}>
                    <div className="pie-center-top">今週</div>
                    <div className="pie-center-pct">{data.results.week_achieved_rate_pct}%</div>
                    <div className="pie-center-bottom">達成</div>
                  </div>
                </div>

                <div className="pie-legend">
                  <div className="pie-item">
                    <span className="pie-dot achieved" />
                    達成：{a} day
                  </div>
                  <div className="pie-item">
                    <span className="pie-dot not" />
                    未達：{n} day
                  </div>
                  <div className="pie-item">
                    <span className="pie-dot unreported" />
                    未報告：{u} day
                  </div>
                </div>
              </div>
            );
          })()}

          <button className="btn-secondary" type="button" onClick={() => setShowAvg(!showAvg)}>
            タップで平均勉強時間を表示
          </button>

          {/* 1日の勉強時間は「〇時間〇分」 */}
          {showAvg && (
            <div className="result-row">
              <div className="result-k">1日あたりの勉強時間</div>
              <div className="result-v">{hoursToJa(data.results.avg_daily_hours)}</div>
            </div>
          )}

          {/* ひとことコメント（左上ラベルはCSSで固定） */}
          <div className="positive">
            <div className="card-badge">ひとことコメント</div>
            {data.results.grade_message}
          </div>
        </div>
      )}
    </div>
  );
}
