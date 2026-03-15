import React, { useEffect, useState } from 'react';
import { getApiUrl } from './config';

interface HeaderProps {
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch(getApiUrl('/settings/stamp_app_url'))
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.value) setStampUrl(d.value); })
      .catch(() => {});
  }, []);

  const close = () => setMenuOpen(false);

  const btnStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '12px 20px',
    background: 'transparent',
    color: '#1f2937',
    border: 'none',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '15px',
    textAlign: 'left',
    cursor: 'pointer',
  };

  return (
    <header style={{
      background: 'linear-gradient(135deg, #EA6D8D 0%, #EA6D8D 100%)',
      color: 'white',
      padding: '12px 24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* タイトル */}
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer' }}
          onClick={() => window.location.href = '/'}>
          OC道案内アプリ
        </h1>

        {/* ハンバーガーボタン */}
        <button
          onClick={() => setMenuOpen(prev => !prev)}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: 'pointer',
            color: 'white',
            fontSize: '20px',
            lineHeight: 1,
          }}
          aria-label="メニュー"
        >
          ☰
        </button>
      </div>

      {/* ドロップダウンメニュー */}
      {menuOpen && (
        <>
          {/* オーバーレイ */}
          <div
            onClick={close}
            style={{
              position: 'fixed', inset: 0, zIndex: 999,
            }}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: '24px',
            background: 'white',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            minWidth: '180px',
            zIndex: 1000,
            overflow: 'hidden',
          }}>
            <button style={btnStyle} onClick={() => { if (stampUrl) { window.open(stampUrl, '_blank'); close(); } else close(); }}
              disabled={!stampUrl}>
              スタンプ
            </button>
            <button style={btnStyle} onClick={() => { window.location.href = '/'; close(); }}>
              現在地選択
            </button>
            <button style={btnStyle} onClick={() => { window.location.href = '/favorites'; close(); }}>
              My地点
            </button>
            <button style={btnStyle} onClick={() => { window.location.href = '/tutorials'; close(); }}>
              利用方法
            </button>
            {isAdmin && (
              <button style={btnStyle} onClick={() => { window.location.href = '/dijkstra'; close(); }}>
                経路探索
              </button>
            )}
            {isAdmin && (
              <button style={btnStyle} onClick={() => { window.location.href = '/admin'; close(); }}>
                管理
              </button>
            )}
            {onLogout && (
              <button
                style={{ ...btnStyle, color: '#dc2626', borderBottom: 'none' }}
                onClick={() => { onLogout(); close(); }}
              >
                ログアウト
              </button>
            )}
          </div>
        </>
      )}
    </header>
  );
};

export default Header;
