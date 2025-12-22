import React, { useState } from 'react'

export default function StudentLogin() {
  const [email, setEmail] = useState('')

  return (
    <div className="card">
      <h2>生徒ログイン</h2>
      <div className="field">
        <label>メールアドレス</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com" />
        <button onClick={() => alert(`仮ログイン: ${email}`)}>ログイン</button>
      </div>
    </div>
  )
}
