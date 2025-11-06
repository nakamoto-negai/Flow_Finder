import React, { useState } from "react";
import FieldManager from "./FieldManager";
import NodeManager from "./NodeManager";
import LinkManager from "./LinkManager";
import ImageManager from "./ImageManager";
import TouristSpotManager from "./TouristSpotManager";
import Header from "./Header";
import "./App.css";

const Admin: React.FC = () => {
  const [currentView, setCurrentView] = useState<'fields' | 'nodes' | 'links' | 'images' | 'tourist-spots' | 'logs'>('fields');

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
