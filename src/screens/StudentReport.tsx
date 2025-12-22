import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gasCall, todayJst, toHourMinOptions } from "../api";

type AutoLoginResp =
  | { ok: true; student_key: string; group_name: string; display_name: string }
  | { ok: false; message: string };

type GetWeekResp =
  | {
      ok: true;
      calendar: { date: string; mark: "" | "○" | "◎" }[];
      selected_date: string;
      existing_report: {
        report_date: string;
        plan_status: "achieved" | "not_achieved";
        study_minutes: number;
        not_achieved_reason: string | null;
        improvement_choice: string | null;
      } | null;
      improvement_support: { raw: string; text: string } | null;
    }
  | { ok: false; message: string };

type SubmitResp =
  | {
      ok: true;
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

const REASONS = ["時間がなかった", "疲れていた", "スマホ・ゲーム", "難しくて止まった", "その他"] as const;

const IMPROVEMENTS: Record<string, string[]> = {
  "時間がなかった": [
    "昼休みに5分だけ勉強する",
    "通学中に5分だけ勉強する",
    "帰宅してすぐ5分だけ勉強する",
    "お風呂前に5分だけ勉強する"
  ],
  "疲れていた": [
    "明日10分早く起きて5分だけ勉強する",
    "立ったまま5分だけ勉強する",
    "ストレッチしてから5分だけ勉強する",
    "いつもと場所を変えて勉強する",
    "チームメンバーと自習室で勉強する"
  ],
  "スマホ・ゲーム": [
    "別の部屋に置いてから勉強する",
    "スマホ・ゲームの時間帯を決めておく",
    "先に勉強を終わらせる",
    "いつもと場所を変えて勉強する"
  ],
  "難しくて止まった": [
    "一旦飛ばして後で考えてみる",
    "不明点を付箋に書いて次へ進む",
    "すぐに飛ばして明日考えてみる",
    "その日の勉強後にまとめて質問する"
  ],
  "その他": []
};

export default function StudentReport() {
  const nav = useNavigate();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [studentKey, setStudentKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [groupName, setGroupName] = useState("");

  const [selectedDate, setSelectedDate] = useState(todayJst());
  const [calendar, setCalendar] = useState<{ date: string; mark: "" | "○" | "◎" }[]>([]);
  const [existing, setExisting] = useState<GetWeekResp extends any ? any : any>(null);
  const [improvementSupport, setImprovementSupport] = useState<{ raw: string; text: string } | null>(null);

  // フォーム状態
  const [planStatus, setPlanStatus] = useState<"achieved" | "not_achieved">("achieved");
  const timeOptions = useMemo(() => toHourMinOptions(), []);
  const [studyMinutes, setStudyMinutes] = useState<number>(0);
  const [reason, setReason] = useState<string>("");
  const [reasonOther, setReasonOther] = useState<string>("");
  const [improveChoice, setImproveChoice] = useState<string>("");
  const [improveOther, setImproveOther] = useState<string>("");

  // 成果（送信後のみ表示）
  const [results, setResults] = useState<SubmitResp extends any ? any : any>(null);
  const [showAvg, setShowAvg] = useState(false);

  // 自動ログイン
  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("device_token") || "";
      if (!token) {
        nav("/student-login", { replace: true });
        return;
      }
      setBusy(true);
      setMsg("");
      try {
        const res = await gasCall<AutoLoginResp>("/auth/auto-login", { device_token: token });
        if (!res.ok) {
          localStorage.removeItem("device_token");
          nav("/student-login", { replace: true });
          return;
        }
        setStudentKey(res.student_key);
        setGroupName(res.group_name);
        setDisplayName(res.display_name);
      } catch {
        setMsg("通信に失敗しました。");
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 週表示取得
  useEffect(() => {
    if (!studentKey) return;
    (async () => {
      setBusy(true);
      setMsg("");
      try {
        const res = await gasCall<GetWeekResp>("/student/get-week", {
          student_key: studentKey,
          selected_date: selectedDate
        });

        if (!res.ok) {
          setMsg(res.message || "現在は利用できません。");
          return;
        }

        setCalendar(res.calendar || []);
        setSelectedDate(res.selected_date || selectedDate);
        setExisting(res.existing_report || null);
        setImprovementSupport(res.improvement_support || null);

        // 既存がある場合はフォームに反映（編集モード）
        if (res.existing_report) {
          setPlanStatus(res.existing_report.plan_status);
          setStudyMinutes(res.existing_report.study_minutes);
          const r = res.existing_report.not_achieved_reason || "";
          setReason(r || "");
          setReasonOther(r === "その他" ? (r || "") : "");
          setImproveChoice(res.existing_report.improvement_choice || "");
          setImproveOther("");
        } else {
          setPlanStatus("achieved");
          setStudyMinutes(0);
          setReason("");
          setReasonOther("");
          setImproveChoice("");
          setImproveOther("");
          // ※送信前に成果表示は禁止なので、日付切替時は成果を消す
          setResults(null);
          setShowAvg(false);
        }
      } catch {
        setMsg("通信に失敗しました。");
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentKey, selectedDate]);

  const showReason = planStatus === "not_achieved";
  const showImprove = planStatus === "not_achieved" && !!reason;
  const improveOptions = reason && IMPROVEMENTS[reason] ? IMPROVEMENTS[reason] : [];

  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (!studentKey) return false;
    if (!selectedDate) return false;
    if (!planStatus) return false;
    if (!Number.isFinite(studyMinutes) || studyMinutes < 0 || studyMinutes > 720) return false;

    if (showReason && !reason) return false;
    return true;
  }, [busy, studentKey, selectedDate, planStatus, studyMinutes, showReason, reason]);

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setMsg("");

    try {
      const notAchievedReason =
        planStatus === "not_achieved"
          ? (reason === "その他" ? (reasonOther || "その他") : reason)
          : "";

      const improvement =
        planStatus === "not_achieved"
          ? (improveChoice || improveOther || "")
          : "";

      const res = await gasCall<SubmitResp>("/student/submit", {
        student_key: studentKey,
        report_date: selectedDate,
        plan_status: planStatus,
        study_minutes: studyMinutes,
        not_achieved_reason: notAchievedReason,
        improvement_choice: improvement
      });

      if (!res.ok) {
        setMsg(res.message || "送信に失敗しました。");
        return;
      }

      setResults(res.results);
      setShowAvg(false);

      // 送信後、週表示を更新（○/◎反映・既存反映・支援ブロック更新）
      const gw = await gasCall<GetWeekResp>("/student/get-week", {
        student_key: studentKey,
        selected_date: selectedDate
      });
      if (gw.ok) {
        setCalendar(gw.calendar || []);
        setExisting(gw.existing_report || null);
        setImprovementSupport(gw.improvement_support || null);
      }
    } catch {
      setMsg("通信に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h1 className="title">報告・成果</h1>
        <div className="subnote">
          {displayName ? `${displayName}（${groupName}）` : "読み込み中..."}
        </div>
        {msg && <div className="message">{msg}</div>}
      </div>

      {/* 今日の工夫（前日分） */}
      <div className="card">
        <h2 className="h2">今日の工夫（前日分）</h2>
        {improvementSupport ? (
          <div className="support">{improvementSupport.text}</div>
        ) : (
          <div className="support-min"> </div>
        )}
      </div>

      {/* 今週カレンダー */}
      <div className="card">
        <h2 className="h2">今週</h2>
        <div className="calendar">
          {calendar.map((d) => {
            const isSel = d.date === selectedDate;
            return (
              <button
                key={d.date}
                className={`day ${isSel ? "day-sel" : ""}`}
                onClick={() => setSelectedDate(d.date)}
                disabled={busy}
                type="button"
              >
                <div className="day-date">{d.date.slice(5)}</div>
                <div className="day-mark">{d.mark}</div>
              </button>
            );
          })}
        </div>
        <div className="hint">◎：達成＋報告提出済み　／　○：報告提出済み　／　空白：未報告</div>
      </div>

      {/* 報告提出フォーム */}
      <div className="card">
        <h2 className="h2">報告提出</h2>

        <div className="field">
          <label>① 本日の学習計画（必須）</label>
          <select value={planStatus} onChange={(e) => setPlanStatus(e.target.value as any)} disabled={busy}>
            <option value="achieved">達成できた</option>
            <option value="not_achieved">達成できなかった</option>
          </select>
          <div className="hint">学習計画表の最低限の分量ができたら、達成できたでOKです</div>
        </div>

        <div className="field">
          <label>② 本日の勉強時間（必須）</label>
          <select value={String(studyMinutes)} onChange={(e) => setStudyMinutes(Number(e.target.value))} disabled={busy}>
            {timeOptions.map((o) => (
              <option key={o.minutes} value={o.minutes}>{o.label}</option>
            ))}
          </select>
        </div>

        {showReason && (
          <div className="field">
            <label>③ できなかった理由</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy}>
              <option value="">選択してください</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {reason === "その他" && (
              <div className="field">
                <label className="small">（任意）その他の内容</label>
                <input value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} disabled={busy} />
              </div>
            )}
          </div>
        )}

        {showImprove && (
          <div className="field">
            <label>④ 明日からの工夫</label>

            {improveOptions.length > 0 ? (
              <>
                <select value={improveChoice} onChange={(e) => setImproveChoice(e.target.value)} disabled={busy}>
                  <option value="">選択してください</option>
                  {improveOptions.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
                <div className="field">
                  <label className="small">（任意）その他</label>
                  <input value={improveOther} onChange={(e) => setImproveOther(e.target.value)} disabled={busy} />
                </div>
              </>
            ) : (
              <>
                <div className="hint">（任意）自由入力のみ</div>
                <input value={improveOther} onChange={(e) => setImproveOther(e.target.value)} disabled={busy} />
              </>
            )}
          </div>
        )}

        <button className="btn" disabled={!canSubmit} onClick={submit}>
          {busy ? "送信中..." : "送信する"}
        </button>

        {existing && (
          <div className="note">
            選択した日は送信済みです。内容を修正して再送信すると上書きされます。
          </div>
        )}
      </div>

      {/* 成果（送信後のみ表示） */}
      {results && (
        <div className="card">
          <h2 className="h2">成果</h2>

          <div className="result-row">
            <div className="result-k">連続報告日数</div>
            <div className="result-v">{results.streak_days}日継続中</div>
          </div>

          <div className="result-row">
            <div className="result-k">週の計画達成率</div>
            <div className="result-v">今週 {results.week_achieved_rate_pct}% 達成</div>
          </div>

          <div className="pie">
            <div>達成：{results.pie.achieved}</div>
            <div>未達：{results.pie.not_achieved}</div>
            <div>未報告：{results.pie.unreported}</div>
          </div>

          <div className="result-row">
            <div className="result-k">週の合計勉強時間</div>
            <div className="result-v">{results.week_total_hours}h</div>
          </div>

          <button className="btn-secondary" type="button" onClick={() => setShowAvg(!showAvg)}>
            1日の勉強時間を表示
          </button>

          {showAvg && (
            <div className="result-row">
              <div className="result-k">1日の勉強時間</div>
              <div className="result-v">{results.avg_daily_hours}h</div>
            </div>
          )}

          <div className="result-row">
            <div className="result-k">評価</div>
            <div className="result-v">{results.grade}</div>
          </div>

          <div className="positive">{results.grade_message}</div>
        </div>
      )}
    </div>
  );
}
