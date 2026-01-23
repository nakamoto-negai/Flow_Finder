import React, { useState } from 'react';
import { getApiUrl } from './config';

interface LoginProps {
  onLogin: (token: string, userId: number, isNewUser?: boolean) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignupMode, setIsSignupMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('ユーザー名を入力してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl('/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'ログインに失敗しました');
      }

      const data = await response.json();
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('userId', data.user_id);
      localStorage.setItem('isAdmin', data.is_admin ? 'true' : 'false');
      onLogin(data.token, data.user_id, false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('ユーザー名を入力してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ユーザーを作成
      const signupRes = await fetch(getApiUrl('/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (signupRes.status === 409) {
        throw new Error('このユーザー名は既に使用されています');
      }
      if (!signupRes.ok) {
        const errorData = await signupRes.json();
        throw new Error(errorData.error || 'ユーザー作成に失敗しました');
      }

      // 作成後、自動的にログイン
      const loginRes = await fetch(getApiUrl('/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!loginRes.ok) {
        throw new Error('自動ログインに失敗しました');
      }

      const data = await loginRes.json();
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('userId', data.user_id);
      localStorage.setItem('isAdmin', data.is_admin ? 'true' : 'false');
      // サインアップ直後は新規ユーザーなのでフラグを渡す
      onLogin(data.token, data.user_id, true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = isSignupMode ? handleSignup : handleLogin;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
          Flow Finder {isSignupMode ? 'ユーザー登録' : 'ログイン'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500',
              color: '#555'
            }}>
              ユーザー名
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              placeholder="ユーザー名を入力"
              disabled={loading}
            />
          </div>

          {error && (
            <div style={{
              color: '#dc2626',
              backgroundColor: '#fef2f2',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '20px',
              border: '1px solid #fecaca',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? (isSignupMode ? 'ユーザー登録中...' : 'ログイン中...') : (isSignupMode ? 'ユーザー登録' : 'ログイン')}
          </button>
        </form>

        {/* モード切替ボタン */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setIsSignupMode(!isSignupMode);
              setError(null);
              setName('');
            }}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              textDecoration: 'underline',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {isSignupMode ? 'すでにアカウントをお持ちの方はこちら' : '新規ユーザー登録はこちら'}
          </button>
        </div>

        <div style={{
          marginTop: '30px',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '4px',
          fontSize: '14px',
          color: '#6b7280'
        }}>
          <p style={{ margin: 0, marginBottom: '8px' }}>
            <strong>テスト用ユーザー:</strong>
          </p>
          <p style={{ margin: 0 }}>
            ユーザー名: <code style={{ backgroundColor: '#e5e7eb', padding: '2px 4px', borderRadius: '2px' }}>テストユーザー</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;