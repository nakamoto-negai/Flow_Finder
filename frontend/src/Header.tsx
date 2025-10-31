import React, { useState, useEffect } from 'react';

interface Node {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

interface HeaderProps {
  currentNodeId?: number | null;
  onNodeChange?: (nodeId: number) => void;
  showLocationPicker?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  currentNodeId, 
  onNodeChange, 
  showLocationPicker = true 
}) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(currentNodeId || null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  useEffect(() => {
    // ノード一覧を取得
    fetch("http://localhost:8080/nodes")
      .then(res => res.json())
      .then(data => {
        let nodeArray = [];
        if (data && typeof data === 'object' && Array.isArray(data.value)) {
          nodeArray = data.value;
        } else if (Array.isArray(data)) {
          nodeArray = data;
        }
        setNodes(nodeArray);
      })
      .catch(err => {
        console.error("Nodes fetch error:", err);
        setNodes([]);
      });
  }, []);

  useEffect(() => {
    setSelectedNodeId(currentNodeId || null);
  }, [currentNodeId]);

  // 現在地を取得してもっとも近いノードを見つける
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('このブラウザでは位置情報がサポートされていません');
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        // 最も近いノードを計算
        let nearestNode: Node | null = null;
        let minDistance = Infinity;
        
        for (const node of nodes) {
          const distance = calculateDistance(userLat, userLng, node.latitude, node.longitude);
          if (distance < minDistance) {
            minDistance = distance;
            nearestNode = node;
          }
        }
        
        if (nearestNode !== null) {
          const foundNode = nearestNode as Node;
          setSelectedNodeId(foundNode.id);
          if (onNodeChange) {
            onNodeChange(foundNode.id);
          }
          alert(`最も近い地点: ${foundNode.name} (約${Math.round(minDistance * 1000)}m)`);
        }
        
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('位置情報の取得に失敗しました:', error);
        alert('位置情報の取得に失敗しました。位置情報の許可を確認してください。');
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  // 2点間の距離を計算（ハヴァーサイン公式）
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // 地球の半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleNodeChange = (nodeId: number) => {
    setSelectedNodeId(nodeId);
    if (onNodeChange) {
      onNodeChange(nodeId);
    }
  };

  return (
    <header style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
            🗺️ Flow Finder
          </h1>
        </div>

        {/* 現在地選択 */}
        {showLocationPicker && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(255,255,255,0.1)',
            padding: '8px 16px',
            borderRadius: '24px',
            backdropFilter: 'blur(10px)'
          }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>📍 現在地:</span>
            
            <select
              value={selectedNodeId || ''}
              onChange={(e) => handleNodeChange(Number(e.target.value))}
              style={{
                background: 'rgba(255,255,255,0.9)',
                color: '#333',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.9rem',
                minWidth: '150px',
                outline: 'none'
              }}
            >
              <option value="">地点を選択</option>
              {nodes.map(node => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>

            <button
              onClick={getCurrentLocation}
              disabled={isGettingLocation}
              style={{
                background: isGettingLocation ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                cursor: isGettingLocation ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (!isGettingLocation) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                }
              }}
              onMouseOut={(e) => {
                if (!isGettingLocation) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                }
              }}
            >
              {isGettingLocation ? '📡 取得中...' : '🎯 自動取得'}
            </button>
          </div>
        )}

        {/* ナビゲーションメニュー */}
        <nav style={{ display: 'flex', gap: '16px' }}>
          <button
            onClick={() => window.location.href = '/links'}
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
            📋 リンク
          </button>
          
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
            🧭 経路探索
          </button>
          
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
            ⚙️ 管理
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;