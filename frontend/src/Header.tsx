import React, { useEffect, useState } from 'react';
import { getApiUrl } from './config';

interface HeaderProps {
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onLogout
}) => {
  // localStorageから管理者フラグを取得
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const [stampUrl, setStampUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(getApiUrl('/settings/stamp_app_url'))
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.value) setStampUrl(d.value); })
      .catch(() => {});
  }, []);

  return (
    <header style={{
      background: 'linear-gradient(135deg, #EA6D8D 0%, #EA6D8D 100%)',
      color: 'white',
      padding: '12px 24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* ロゴ・タイトル */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '1.5rem', 
            fontWeight: 'bold',
            cursor: 'pointer'
          }} onClick={() => window.location.href = '/'}>
            Flow Finder
          </h1>
        </div>

        {/* ナビゲーションメニュー */}
        <nav style={{ display: 'flex', gap: '16px' }}>
          <button
            onClick={() => { if (stampUrl) window.open(stampUrl, '_blank'); }}
            style={{
              background: 'transparent',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.9rem',
              cursor: stampUrl ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              opacity: stampUrl ? 1 : 0.5,
            }}
            onMouseOver={(e) => { if (stampUrl) e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            スタンプ
          </button>

          <button
            onClick={() => window.location.href = '/'}
            style={{
              background: 'transparent',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            現在地選択
          </button>

          <button
            onClick={() => window.location.href = '/favorites'}
            style={{
              background: 'transparent',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            お気に入り
          </button>

          <button
            onClick={() => window.location.href = '/tutorials'}
            style={{
              background: 'rgba(59, 246, 84, 0.8)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgb(0, 255, 34)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(59, 246, 84, 0.8)'}
          >
            利用方法
          </button>
          
          {isAdmin && (
          <button
            onClick={() => window.location.href = '/dijkstra'}
            style={{
              background: 'transparent',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            経路探索
          </button>
          )}
          {/* 管理者のみ表示 */}
          {isAdmin && (
            <button
              onClick={() => window.location.href = '/admin'}
              style={{
                background: 'transparent',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              管理
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              style={{
                background: 'rgba(220, 53, 69, 0.8)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(220, 53, 69, 1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(220, 53, 69, 0.8)'}
            >
              ログアウト
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;