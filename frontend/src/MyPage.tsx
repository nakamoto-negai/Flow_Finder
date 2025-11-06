import React, { useState, useEffect } from 'react';
import Header from './Header';
import { apiRequest } from './api';

const MyPage: React.FC = () => {
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // localStorageからユーザー情報を取得
    const storedUserId = localStorage.getItem('userId');
    const storedIsAdmin = localStorage.getItem('isAdmin') === 'true';
    
    setUserId(storedUserId || '');
    setIsAdmin(storedIsAdmin);
    
    // ユーザー情報を取得
    fetchUserInfo(storedUserId);
  }, []);

  const fetchUserInfo = async (userId: string | null) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiRequest(`http://localhost:8080/users`);
      if (response.ok) {
        const users = await response.json();
        const user = users.find((u: any) => u.ID === parseInt(userId));
        if (user) {
          setUserName(user.name || 'ユーザー');
        } else {
          setUserName('ユーザー');
        }
      }
    } catch (err) {
      console.error('ユーザー情報の取得に失敗:', err);
      setUserName('ユーザー');
    } finally {
      setLoading(false);
    }
  };



  const handleLogout = () => {
    if (confirm('ログアウトしますか？')) {
      localStorage.clear();
      window.location.href = '/';
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Header onLogout={handleLogout} />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '50vh' 
        }}>
          <div>読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Header onLogout={handleLogout} />
      
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
        {/* プロフィールカード */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              color: 'white',
              fontWeight: 'bold'
            }}>
              {userName.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#1f2937' }}>
                {userName || 'ゲストユーザー'}
              </h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ 
                  fontSize: '14px', 
                  color: '#6b7280',
                  background: '#f3f4f6',
                  padding: '4px 12px',
                  borderRadius: '12px'
                }}>
                  ID: {userId}
                </span>
                {isAdmin && (
                  <span style={{
                    fontSize: '12px',
                    color: 'white',
                    background: '#ef4444',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontWeight: 'bold'
                  }}>
                    管理者
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* クイックアクション */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#1f2937' }}>
            クイックアクション
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <button
              onClick={() => window.location.href = '/favorites'}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '15px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
              onMouseOut={(e) => e.currentTarget.style.background = '#3b82f6'}
            >
              <span style={{ fontSize: '20px' }}></span>
              <span>お気に入り観光地を見る</span>
            </button>

            <button
              onClick={() => window.location.href = '/location'}
              style={{
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '15px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#059669'}
              onMouseOut={(e) => e.currentTarget.style.background = '#10b981'}
            >
              <span style={{ fontSize: '20px' }}></span>
              <span>現在地から観光地を探す</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => window.location.href = '/admin'}
                style={{
                  background: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '15px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#7c3aed'}
                onMouseOut={(e) => e.currentTarget.style.background = '#8b5cf6'}
              >
                <span style={{ fontSize: '20px' }}></span>
                <span>管理画面を開く</span>
              </button>
            )}
          </div>
        </div>

        {/* アカウント設定 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#1f2937' }}>
            アカウント設定
          </h3>
          <button
            onClick={handleLogout}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '15px',
              cursor: 'pointer',
              width: '100%',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
            onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyPage;
