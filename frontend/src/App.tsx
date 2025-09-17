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

  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:8080/users')
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((data) => setUsers(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="App">
      <h1>ユーザー一覧</h1>
      {loading && <p>読み込み中...</p>}
      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
      <ul>
        {users.map((user) => (
          <li key={user.ID}>{user.Name}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
