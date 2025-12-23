import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gasCall, groupOptions, hasAnySpace } from "../api";

type Resp =
  | { ok: true; device_token: string; student_key?: string; group_name?: string; display_name?: string }
  | { ok: false; message: string };

type HintResp =
  | { ok: true; email_hint: string }
  | { ok: false; message: string };

export default function StudentLogin() {
  const nav = useNavigate();
  const groups = useMemo(() => groupOptions(), []);
  const [group, setGroup] = useState(groups[0] || "グループ1");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // 名簿由来のメールヒント
  const [emailHint, setEmailHint] = useState("");
  const [hintBusy, setHintBusy] = useState(false);

  const hasSpace = hasAnySpace(name);

  const canSubmit =
    !busy &&
    !!group &&
    !!name.trim() &&
    !!email.trim() &&
    !hasSpace;

  const canFetchHint =
    !!group &&
    !!name.trim() &&
    !hasSpace &&
    !busy;

  // グループ/氏名が入力されたら、名簿からメールヒントを取得
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!canFetchHint) {
        setEmailHint("");
        return;
      }

      setHintBusy(true);
      try {
        const r = await gasCall<HintResp>("/auth/email-hint", {
          group_name: group,
          name_raw: name
        });

        if (cancelled) return;

        if (r.ok) {
          setEmailHint(r.email_hint || "");
        } else {
          // 見つからない時はヒント非表示（UIは穏当）
          setEmailHint("");
        }
      } catch {
        if (!cancelled) setEmailHint("");
      } finally {
        if (!cancelled) setHintBusy(false);
      }
    }

    // タイピング中の連打を避けて少し遅延
    const t = window.setTimeout(run, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [group, name, canFetchHint]);

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setMsg("");

    try {
      const res = await gasCall<Resp>("/auth/first-login", {
        group_name: group,
        name_raw: name,
        email_raw: email
      });

      if (!res.ok) {
        setMsg(res.message || "入力内容に誤りがないかをご確認ください。");
        return;
      }

      localStorage.setItem("device_token", res.device_token);
      nav("/student", { replace: true });
    } catch {
      setMsg("通信に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h1 className="title">生徒 初回ログイン</h1>

      <div className="field">
        <label>① グループ名</label>
        <select value={group} onChange={(e) => setGroup(e.target.value)} disabled={busy}>
          {groups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>② 氏名（フルネーム）</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：山田太郎"
          disabled={busy}
        />
        {hasSpace && <div className="hint">スペースなしで入力してください。</div>}
      </div>

      <div className="field">
        <label>③ メール</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="例：abc123@example.com"
          disabled={busy}
        />

        {/* 名簿由来のヒント */}
        {!!emailHint && <div className="hint">{emailHint}</div>}
        {hintBusy && canFetchHint && !emailHint && (
          <div className="hint">名簿を確認中...</div>
        )}
      </div>

      <button className="btn" onClick={submit} disabled={!canSubmit}>
        {busy ? "処理中..." : "ログイン"}
      </button>

      {msg && <div className="message">{msg}</div>}

      <div className="note">
        同じデバイスでは次回から自動ログインになります。
      </div>
    </div>
  );
}
