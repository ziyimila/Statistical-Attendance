import { useState } from 'react';
import { api } from '../api';

export default function LoginView({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.login(code.trim());
      onSuccess();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : '登录失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen center">
      <form
        className="card login"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h1>上学打卡</h1>
        <p className="muted small">输入家庭口令，手机和电脑看到的是同一份记录</p>
        <input
          className="input"
          type="password"
          placeholder="家庭口令"
          value={code}
          autoFocus
          onChange={(event) => setCode(event.target.value)}
        />
        {error ? <p className="error small">{error}</p> : null}
        <button type="submit" className="primary" disabled={busy || code.trim().length === 0}>
          {busy ? '登录中…' : '进去'}
        </button>
      </form>
    </div>
  );
}
