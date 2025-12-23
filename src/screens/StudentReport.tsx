import React, { useEffect, useMemo, useState, useRef  } from "react";
import { useNavigate } from "react-router-dom";
import { gasCall, todayJst, toHourMinOptions } from "../api";

type AutoLoginResp =
  | { ok: true; student_key: string; group_name: string; display_name: string }
  | { ok: false; message: string };

type GetWeekResp =
  | {
      ok: true;
      calendar: { date: string; mark: "" | "〇" | "◎" }[];
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

        // ▼ 追加：チーム評価（無い場合もあるので optional にして互換性維持）
        team_grade?: "S" | "A" | "B" | "C";
        team_grade_message?: string; // 肯定文言のみ
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

/** "YYYY-MM-DD" → "M月D日" */
function formatMonthDay(dateStr: string): string {
  const m = dateStr.slice(5, 7).replace(/^0/, "");
  const d = dateStr.slice(8, 10).replace(/^0/, "");
  return `${m}月${d}日`;
}

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

export default function StudentReport() {
  const nav = useNavigate();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [studentKey, setStudentKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [groupName, setGroupName] = useState("");

  const [selectedDate, setSelectedDate] = useState(todayJst());
  const [calendar, setCalendar] = useState<{ date: string; mark: "" | "〇" | "◎" }[]>([]);
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

  const resultsRef = useRef<HTMLDivElement | null>(null);

  // 成果カードが表示されたら自動スクロール（中心に表示）
  useEffect(() => {
    if (!results) return;
    const el = resultsRef.current;
    if (!el) return;
    // 連続送信時にも気づけるように毎回スクロール
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [results]);

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
        planStatus === "not_achieved" ? (reason === "その他" ? (reasonOther || "その他") : reason) : "";

      const improvement = planStatus === "not_achieved" ? (improveChoice || improveOther || "") : "";

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
        <div className="subnote">{displayName ? `${displayName}（${groupName}）` : "読み込み中..."}</div>
        {msg && <div className="message">{msg}</div>}
      </div>

      {/* 今日意識する工夫（前日分） */}
      <div className="card">
        <h2 className="h2">今日意識する工夫</h2>
        {improvementSupport ? <div className="support">{improvementSupport.text}</div> : <div className="support-min"> </div>}
      </div>

      {/* 今週カレンダー */}
      <div className="card">
        <h2 className="h2">今週</h2>
        <div className="calendar">
          {calendar.map((d) => {
            const isSel = d.date === selectedDate;
            const markClass = d.mark === "◎" ? "mark-double" : "mark-circle";
            return (
              <button
                key={d.date}
                className={`day ${isSel ? "day-sel" : ""}`}
                onClick={() => setSelectedDate(d.date)}
                disabled={busy}
                type="button"
              >
                <div className="day-date">{formatMonthDay(d.date)}</div>

                <div className="day-mark">
                  {d.mark ? (
                    <span className={`mark ${markClass}`} aria-label={d.mark === "◎" ? "学習計画達成" : "報告提出達成"}>
                      {d.mark}
                    </span>
                  ) : (
                    // 空セルも高さを揃えてレイアウト安定（見た目のみ）
                    <span className="mark" style={{ opacity: 0 }} aria-hidden="true">
                      〇
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="hint">◎：学習計画達成　○：報告提出達成</div>
      </div>

      {/* 報告提出フォーム */}
      <div className="card">
        <h2 className="h2">報告を提出する</h2>

        <div className="field">
          <label>① 本日の学習計画</label>
          <select value={planStatus} onChange={(e) => setPlanStatus(e.target.value as any)} disabled={busy}>
            <option value="achieved">達成できた</option>
            <option value="not_achieved">達成できなかった</option>
          </select>
          <div className="hint">学習計画表の最低限の分量ができたら【達成できた】でOKです</div>
        </div>

        <div className="field">
          <label>② 本日の勉強時間</label>
          <select value={String(studyMinutes)} onChange={(e) => setStudyMinutes(Number(e.target.value))} disabled={busy}>
            {timeOptions.map((o) => (
              <option key={o.minutes} value={o.minutes}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {showReason && (
          <div className="field">
            <label>③ できなかった理由</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy}>
              <option value="">選択してください</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {reason === "その他" && (
              <div className="field">
                <label className="small">その他の内容</label>
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
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
                <div className="field">
                  <label className="small">その他</label>
                  <input value={improveOther} onChange={(e) => setImproveOther(e.target.value)} disabled={busy} />
                </div>
              </>
            ) : (
              <>
                <div className="hint">自由入力のみ</div>
                <input value={improveOther} onChange={(e) => setImproveOther(e.target.value)} disabled={busy} />
              </>
            )}
          </div>
        )}

        <button className="btn" disabled={!canSubmit} onClick={submit}>
          {busy ? "読み込み中..." : "送信する"}
        </button>

        {existing && <div className="note">選択した日は送信済みです。内容を修正して再送信すると上書きされます。</div>}
      </div>

      {/* 成果（送信後のみ表示） */}
      {results && (
        <div className="card" ref={resultsRef}>
          <h2 className="h2">学習進捗</h2>

          {/* 指標カード（中央揃え・色はCSSで制御） */}
          <div className="metrics">
            <div className="metric streak">
              <div className="mk">連続報告日数</div>
              <div className="mv">{results.streak_days}日</div>
              <div className="ms">継続中</div>
            </div>

            <div className="metric total">
              <div className="mk">週の合計勉強時間</div>
              <div className="mv">{hoursToJa(results.week_total_hours)}</div>
              <div className="ms">今週の合計</div>
            </div>

            <div className="metric grade">
              <div className="mk">個人評価</div>
              <div className="mv">{results.grade}</div>
              <div className="ms">今週の評価</div>
            </div>

            {/* ▼ 追加：チーム評価（APIが返さない場合は非表示） */}
            {results.team_grade && (
              <div className="metric team">
                <div className="mk">チーム評価</div>
                <div className="mv">{results.team_grade}</div>
                <div className="ms">今週の評価</div>
              </div>
            )}
          </div>

          {/* 週の計画達成率：正方形カード（円グラフ＋注釈） */}
          <div className="result-row">
            <div className="result-k">週の計画達成率</div>
          </div>

          {(() => {
            const { a, n, u, p1, p2 } = pieToDegVars(results.pie);
            return (
              <div className="pie-card">
                <div className="pie-chart" style={{ ["--p1" as any]: p1, ["--p2" as any]: p2 }}>
                  <div className="pie-center" aria-label={`今週 ${results.week_achieved_rate_pct}% 達成`}>
                    <div className="pie-center-top">今週</div>
                    <div className="pie-center-pct">{results.week_achieved_rate_pct}%</div>
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
              <div className="result-v">{hoursToJa(results.avg_daily_hours)}</div>
            </div>
          )}

          {/* ひとことコメント（左上ラベルはCSSで固定） */}
          <div className="positive">
            <div className="card-badge">ひとことコメント</div>
            {results.grade_message}
          </div>
        </div>
      )}
    </div>
  );
}
