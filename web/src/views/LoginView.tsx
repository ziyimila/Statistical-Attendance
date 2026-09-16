import { useState } from 'react';
import { api } from '../api';
import Icon from '../components/Icon';

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
        <div className="login-mark">
          <Icon name="check" size={28} />
        </div>
        <h1>上学打卡</h1>
        <p className="lead">
          家庭口令是自家的门锁：挡住外人，也用来区分这条记录是妈妈还是爸爸记的。手机和电脑用同一个口令，看到的是同一份数据。
        </p>
        <input
          className="input"
          type="password"
          placeholder="妈妈或爸爸的口令"
          value={code}
          autoFocus
          onChange={(event) => setCode(event.target.value)}
        />
        {error ? <p className="error small center-text">{error}</p> : null}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.trim().length === 0}>
          {busy ? '登录中…' : '进去'}
        </button>
        <p className="muted tiny-text center-text">
          口令写在项目根目录的 .env 里（CODE_MOM 是妈妈的，CODE_DAD 是爸爸的），登录后可以在设置页修改。
        </p>
      </form>
    </div>
  );
}
