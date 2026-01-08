import React, { useState, useEffect } from "react";
import FieldManager from "./FieldManager";
import NodeManager from "./NodeManager";
import LinkManager from "./LinkManager";
import ImageManager from "./ImageManager";
import TouristSpotManager from "./TouristSpotManager";
import TouristSpotCategoryManager from "./TouristSpotCategoryManager";
import Header from "./Header";
import "./App.css";

const Admin: React.FC = () => {
  const [currentView, setCurrentView] = useState<'fields' | 'nodes' | 'links' | 'images' | 'tourist-spots' | 'tourist-categories' | 'logs'>('fields');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // localStorageから管理者フラグを確認
    const adminFlag = localStorage.getItem('isAdmin');
    setIsAdmin(adminFlag === 'true');
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div>読み込み中...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Header />
        <div style={{ 
          maxWidth: '600px', 
          margin: '100px auto', 
          padding: '40px',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: '20px' }}>アクセス拒否</h2>
          <p style={{ color: '#6b7280', marginBottom: '30px' }}>
            この管理画面にアクセスする権限がありません。<br />
            管理者ユーザーとしてログインしてください。
          </p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/';
            }}
            style={{
              padding: '10px 30px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ログイン画面へ戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Header />
      
      <div style={{ borderBottom: '1px solid #e5e7eb', background: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex' }}>
          {[
            { key: 'fields', label: 'フィールド管理' },
            { key: 'nodes', label: 'ノード管理' },
            { key: 'links', label: 'リンク管理' },
            { key: 'tourist-spots', label: '観光地管理' },
            { key: 'tourist-categories', label: 'カテゴリー管理' },
            { key: 'images', label: '画像管理' },
            { key: 'logs', label: 'ログ表示' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setCurrentView(tab.key as any)}
              style={{
                padding: '15px 20px',
                border: 'none',
                background: currentView === tab.key ? '#3b82f6' : 'transparent',
                color: currentView === tab.key ? 'white' : '#6b7280',
                cursor: 'pointer',
                borderBottom: currentView === tab.key ? '3px solid #3b82f6' : '3px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {currentView === 'fields' && <FieldManager />}
        
        {currentView === 'nodes' && <NodeManager />}
        
        {currentView === 'links' && <LinkManager />}
        
        {currentView === 'tourist-spots' && <TouristSpotManager />}
        
        {currentView === 'tourist-categories' && <TouristSpotCategoryManager />}
        
        {currentView === 'images' && <ImageManager />}
        
        {currentView === 'logs' && (
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <p>ログ表示機能は今後実装予定です</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
