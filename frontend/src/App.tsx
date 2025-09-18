
import { useEffect, useState } from 'react';
import './App.css';

type User = {
  ID: number;
  Name: string;
};

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('user_id'));
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
      setUserId(String(data.user_id));
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
    setUserId(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    setUsers([]);
  };

  // 認証付きユーザー一覧取得
  useEffect(() => {
    if (!token || !userId) return;
    setLoading(true);
    setError(null);
    fetch('http://localhost:8080/users', {
      headers: {
        'Authorization': token,
        'X-User-Id': userId,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((data) => setUsers(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, userId]);

  return (
    <div className="App">
      <h1>ログイン</h1>
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
          <span>ログイン中: ユーザーID {userId}</span>
          <button onClick={handleLogout} style={{ marginLeft: 16 }}>ログアウト</button>
        </div>
      )}

      {token && (
        <>
          <h2>ユーザー一覧</h2>
          {loading && <p>読み込み中...</p>}
          {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
          <ul>
            {users.map((user) => (
              <li key={user.ID}>{user.Name}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default App;
