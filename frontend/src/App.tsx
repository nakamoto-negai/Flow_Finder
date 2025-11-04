
import { useState, useEffect } from 'react';
import MapView from './MapView';
import Admin from './Admin';
import DijkstraTestPage from './DijkstraTestPage';
import Header from './Header';
import { logger } from './logger';
import './App.css';


function App() {
  const [name, setName] = useState('');
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSignupMode, setIsSignupMode] = useState(false);

  useEffect(() => {
    // ページビューログを送信
    logger.logPageView();
    
    // ページ離脱時のログ送信
    const handleBeforeUnload = () => {
      logger.logPageLeave();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
      
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [token]);

  // ログイン処理
  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('http://localhost:8080/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Session-Id': logger.sessionId || ''
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('ログイン失敗');
      const data = await res.json();
      setToken(data.token);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user_id', String(data.user_id));
      
      // ログイン成功をログに記録
      logger.logLogin(data.user_id);
      
      // セッションIDがサーバーから返された場合は更新
      if (data.session_id) {
        logger.updateSessionId(data.session_id);
      }
      
      setName('');
    } catch (err: any) {
      setLoginError(err.message);
      logger.logError('Login failed: ' + err.message, 'login_form');
    }
  };

  // サインアップ処理
  const handleSignup = async (e: any) => {
    e.preventDefault();
    setLoginError(null);
    try {
      // ユーザーを作成
      const signupRes = await fetch('http://localhost:8080/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Session-Id': logger.sessionId || ''
        },
        body: JSON.stringify({ name }),
      });
      
      if (signupRes.status === 409) {
        throw new Error('このユーザーIDは既に使用されています');
      }
      if (!signupRes.ok) {
        throw new Error('ユーザー作成に失敗しました');
      }
      
      // 作成後、自動的にログイン
      const loginRes = await fetch('http://localhost:8080/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Session-Id': logger.sessionId || ''
        },
        body: JSON.stringify({ name }),
      });
      if (!loginRes.ok) throw new Error('自動ログインに失敗しました');
      
      const data = await loginRes.json();
      setToken(data.token);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user_id', String(data.user_id));
      
      // ログイン成功をログに記録
      logger.logLogin(data.user_id);
      logger.logAction('signup', 'auth', { user_id: data.user_id, name });
      
      // セッションIDがサーバーから返された場合は更新
      if (data.session_id) {
        logger.updateSessionId(data.session_id);
      }
      
      setName('');
      setIsSignupMode(false);
    } catch (err: any) {
      setLoginError(err.message);
      logger.logError('Signup failed: ' + err.message, 'signup_form');
    }
  };

  // ログアウト処理
  const handleLogout = () => {
    logger.logLogout();
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
  };


  // 簡易ルーティング
  if (window.location.pathname === "/admin") {
    return <Admin />;
  }
  
  if (window.location.pathname === "/dijkstra") {
    return <DijkstraTestPage />;
  }

  return (
    <div className="App">
      {!token && <h1>{isSignupMode ? 'ユーザー登録' : 'ログイン'}</h1>}
      {!token ? (
        <div className="card">
          <form onSubmit={isSignupMode ? handleSignup : handleLogin} className="login-form">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ユーザーID"
              required
            />
            <button type="submit">
              {isSignupMode ? 'ユーザー登録' : 'ログイン'}
            </button>
            {loginError && <p style={{ color: 'red' }}>{loginError}</p>}
          </form>
          
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setIsSignupMode(!isSignupMode);
                setLoginError(null);
                setName('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {isSignupMode ? 'すでにアカウントをお持ちの方はこちら' : '新規ユーザー登録はこちら'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <Header 
            onLogout={handleLogout}
          />
          <MapView />
        </>
      )}
    </div>
  );
}

export default App;
