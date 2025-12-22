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
        grade: "S" | "A" | "B" | "C";
        grade_message: string; // 肯定文言のみ
      };
    }
  | { ok: false; message: string };

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
        setMsg(r1.message || "該当する生徒が見つかりませんでした。入力内容をご確認ください。");
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
        <h1 className="title">保護者用 学習状況確認</h1>

        <div className="field">
          <label>お子様グループ名</label>
          <select value={group} onChange={(e) => setGroup(e.target.value)} disabled={busy}>
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>お子様氏名（スペースなし）</label>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          {hasSpace && <div className="hint">氏名にスペース（全角/半角）は使用できません。</div>}
        </div>

        <button className="btn" disabled={!canShow} onClick={show}>
          {busy ? "処理中..." : "表示"}
        </button>

        {msg && <div className="message">{msg}</div>}
      </div>

      {data && data.ok && (
        <div className="card">
          <h2 className="h2">成果</h2>

          <div className="field">
            <label>今日の工夫（前日分）</label>
            {data.improvement_support ? (
              <div className="support">{data.improvement_support.text}</div>
            ) : (
              <div className="support-min"> </div>
            )}
          </div>

          <div className="result-row">
            <div className="result-k">連続報告日数</div>
            <div className="result-v">{data.results.streak_days}日継続中</div>
          </div>

          <div className="result-row">
            <div className="result-k">週の計画達成率</div>
            <div className="result-v">今週 {data.results.week_achieved_rate_pct}% 達成</div>
          </div>

          <div className="pie">
            <div>達成：{data.results.pie.achieved}</div>
            <div>未達：{data.results.pie.not_achieved}</div>
            <div>未報告：{data.results.pie.unreported}</div>
          </div>

          <div className="result-row">
            <div className="result-k">週の合計勉強時間</div>
            <div className="result-v">{data.results.week_total_hours}h</div>
          </div>

          <button className="btn-secondary" type="button" onClick={() => setShowAvg(!showAvg)}>
            1日の勉強時間を表示
          </button>

          {showAvg && (
            <div className="result-row">
              <div className="result-k">1日の勉強時間</div>
              <div className="result-v">{data.results.avg_daily_hours}h</div>
            </div>
          )}

          <div className="result-row">
            <div className="result-k">評価</div>
            <div className="result-v">{data.results.grade}</div>
          </div>

          <div className="positive">{data.results.grade_message}</div>
        </div>
      )}
    </div>
  );
}
