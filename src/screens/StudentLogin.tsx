import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gasCall, groupOptions, hasAnySpace } from "../api";

type Resp =
  | { ok: true; device_token: string; student_key?: string; group_name?: string; display_name?: string }
  | { ok: false; message: string };

function emailHint(email: string): string {
  const e = email.trim();
  if (!e.includes("@")) return "";
  const [local, domain] = e.split("@");
  const head = (local || "").slice(0, 3);
  if (!domain) return "";
  return `ヒント：${head}***@${domain}`;
}

export default function StudentLogin() {
  const nav = useNavigate();
  const groups = useMemo(() => groupOptions(), []);
  const [group, setGroup] = useState(groups[0] || "グループ1");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const hasSpace = hasAnySpace(name);
  const hint = emailHint(email);

  const canSubmit =
    !busy &&
    !!group &&
    !!name.trim() &&
    !!email.trim() &&
    !hasSpace;

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
        setMsg(res.message || "入力内容をご確認ください。");
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
        <label>② 氏名（スペースなし必須）</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：山田太郎"
          disabled={busy}
        />
        {hasSpace && <div className="hint">氏名にスペース（全角/半角）は使用できません。</div>}
      </div>

      <div className="field">
        <label>③ メール</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="例：abc123@example.com"
          disabled={busy}
        />
        {hint && <div className="hint">{hint}</div>}
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
