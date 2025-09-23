
import { useState, useEffect } from 'react';
import MapView from './MapView';
import Admin from './Admin';
import './App.css';


function App() {
  const [name, setName] = useState('');
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loginError, setLoginError] = useState<string | null>(null);
  // 現在地ノード選択用
  const [nodes, setNodes] = useState<{ id: number; name: string }[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch("http://localhost:8080/nodes")
      .then(res => res.json())
      .then(data => setNodes(data))
      .catch(() => setNodes([]));
  }, [token]);

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
          <h1>現在地を選択してください</h1>
          <button onClick={handleLogout}>ログアウト</button>
          <div style={{ marginTop: 16 }}>
            <select value={currentNodeId ?? ''} onChange={e => setCurrentNodeId(Number(e.target.value))} style={{ fontSize: 16, padding: 4 }}>
              <option value="">ノードを選択</option>
              {nodes.map(n => (
                <option key={n.id} value={n.id}>{n.name} (ID:{n.id})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {token && <MapView />}
    </div>
  );
}

export default App;
