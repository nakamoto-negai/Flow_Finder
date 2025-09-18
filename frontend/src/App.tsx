
import { useState } from 'react';
import MapView from './MapView';
import Admin from './Admin';
import './App.css';


function App() {
  const [name, setName] = useState('');
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loginError, setLoginError] = useState<string | null>(null);

  // ログイン処理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('http://localhost:8080/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('ログイン失敗');
  const data = await res.json();
  setToken(data.token);
  localStorage.setItem('token', data.token);
  localStorage.setItem('user_id', String(data.user_id));
  setName('');
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  // ログアウト処理
  const handleLogout = () => {
  setToken(null);
  localStorage.removeItem('token');
  localStorage.removeItem('user_id');
  };


  // 簡易ルーティング: /adminなら管理画面、それ以外は通常画面
  if (window.location.pathname === "/admin") {
    return <Admin />;
  }

  return (
    <div className="App">
      {!token && <h1>ログイン</h1>}
      {!token ? (
        <form onSubmit={handleLogin} style={{ marginBottom: 24 }}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="ユーザー名"
            required
          />
          <button type="submit">ログイン</button>
          {loginError && <p style={{ color: 'red' }}>{loginError}</p>}
        </form>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <h1>地図から現在地を指定してください</h1>
          <button onClick={handleLogout}>ログアウト</button>
        </div>
      )}

      {token && <MapView />}
    </div>
  );
}

export default App;
