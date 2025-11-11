import React, { useEffect, useState } from "react";
import Header from "./Header";
import { apiRequest } from './api';
import { getApiUrl } from './config';
import type { UserFavoriteTouristSpot, Node } from './types';

interface RouteInfo {
  path: Node[];
  total_distance: number;
  node_count: number;
  estimated_time?: number;
}

const LinkListPage: React.FC = () => {
  const [currentNode, setCurrentNode] = useState<any | null>(null);
  const [favorites, setFavorites] = useState<UserFavoriteTouristSpot[]>([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState<{[key: number]: RouteInfo}>({});
  const [routeLoading, setRouteLoading] = useState<{[key: number]: boolean}>({});
  const [availableLinks, setAvailableLinks] = useState<any[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URLからノードIDを取得
  const getNodeIdFromUrl = (): number | null => {
    const urlParams = new URLSearchParams(window.location.search);
    const nodeParam = urlParams.get('node');
    return nodeParam ? parseInt(nodeParam, 10) : null;
  };

  useEffect(() => {
    const nodeId = getNodeIdFromUrl();
    
    if (!nodeId) {
      setError("ノードIDが指定されていません。URLに ?node=1 のようにノードIDを指定してください。");
      return;
    }

    // ノード情報を取得
    fetch(getApiUrl("/nodes"))
      .then(res => res.json())
      .then(data => {
        let nodeArray = [];
        if (data && typeof data === 'object' && data.value && Array.isArray(data.value)) {
          nodeArray = data.value;
        } else if (Array.isArray(data)) {
          nodeArray = data;
        }
        
        const foundNode = nodeArray.find((node: any) => node.id === nodeId);
        if (foundNode) {
          setCurrentNode(foundNode);
          fetchFavorites(foundNode);
          fetchAvailableLinks(foundNode.id);
        } else {
          setError(`ノードID ${nodeId} が見つかりません`);
        }
      })
      .catch(err => {
        console.error("ノードデータの取得に失敗:", err);
        setError("ノードデータの取得に失敗しました");
      });
  }, []);

  // 進行可能なリンクを取得
  const fetchAvailableLinks = async (nodeId: number) => {
    setIsLoadingLinks(true);
    try {
      const response = await fetch(getApiUrl(`/nodes/${nodeId}/available-links`));
      if (response.ok) {
        const data = await response.json();
        setAvailableLinks(data.available_links || []);
      } else {
        console.error('進行可能なリンクの取得に失敗');
      }
    } catch (err) {
      console.error('進行可能なリンクの取得エラー:', err);
    } finally {
      setIsLoadingLinks(false);
    }
  };

  // 指定したリンクのLinkImagePageに移動
  const moveToLink = (linkId: number) => {
    window.location.href = `/link-image?id=${linkId}`;
  };

  // お気に入り観光地データを取得
  const fetchFavorites = async (node: any) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.log('認証トークンがありません');
        return;
      }

      const response = await apiRequest(getApiUrl('/favorites/tourist-spots'));
      if (response.ok) {
        const data = await response.json();
        const favoritesData = Array.isArray(data) ? data : [];
        setFavorites(favoritesData);
        
        // 全ての経路を自動計算
        if (favoritesData.length > 0) {
          calculateAllFavoriteRoutes(favoritesData, node);
        }
      } else if (response.status === 401) {
        setError('お気に入り機能を使用するにはログインが必要です。');
      }
    } catch (err) {
      console.error('お気に入り観光地の取得に失敗:', err);
    }
  };

  // 全てのお気に入り観光地への経路を計算
  const calculateAllFavoriteRoutes = async (favoritesData: UserFavoriteTouristSpot[], node: any) => {
    console.log(`${favoritesData.length}件のお気に入り観光地の経路を計算中...`);
    for (const favorite of favoritesData) {
      await calculateRouteToFavorite(favorite, node);
    }
  };

  // お気に入り観光地への経路を計算
  const calculateRouteToFavorite = async (favorite: UserFavoriteTouristSpot, node: any) => {
    const touristSpot = favorite.tourist_spot;
    console.log(`観光地「${touristSpot.name}」の経路を計算中...`);
    
    if (!touristSpot.nearest_node_id) {
      console.error(`観光地「${touristSpot.name}」に最寄りノードが設定されていません`);
      return;
    }

    setRouteLoading(prev => ({ ...prev, [favorite.id]: true }));

    try {
      const response = await fetch(getApiUrl('/dijkstra'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_node_id: node.id,
          end_node_id: touristSpot.nearest_node_id
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`経路計算結果 (${touristSpot.name}):`, data);
        
        if (data.path && Array.isArray(data.path)) {
          setFavoriteRoutes(prev => ({
            ...prev,
            [favorite.id]: {
              path: data.path,
              total_distance: data.total_distance,
              node_count: data.node_count,
              estimated_time: data.total_distance / 80 // 時速80m/分想定での所要時間（分）
            }
          }));
        }
      } else {
        const errorData = await response.json();
        console.error(`経路計算エラー (${touristSpot.name}):`, errorData.error);
      }
    } catch (err: any) {
      console.error(`経路計算エラー (${touristSpot.name}):`, err.message);
    } finally {
      setRouteLoading(prev => ({ ...prev, [favorite.id]: false }));
    }
  };

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Header />
        <div style={{ maxWidth: 800, margin: "32px auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0001", padding: 24 }}>
          <h1 style={{ color: "red" }}>エラーが発生しました</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Header />
      <div style={{ maxWidth: 800, margin: "32px auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0001", padding: 24 }}>
        {currentNode && (
          <>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <h1 style={{ fontSize: "1.5rem", marginBottom: 10, color: '#1f2937' }}>
                🗺️ お気に入り観光地への経路
              </h1>
              <div style={{ fontSize: '1rem', color: '#6b7280' }}>
                📍 現在地: <strong>{currentNode.name}</strong> (座標: {currentNode.x}, {currentNode.y})
              </div>
            </div>

            {/* 進行可能なリンク一覧 */}
            <div style={{ 
              marginBottom: '30px', 
              padding: '20px', 
              background: '#f0f9ff', 
              borderRadius: '8px',
              border: '2px solid #0ea5e9'
            }}>
              <h3 style={{ 
                fontSize: '1.2rem', 
                marginBottom: '15px', 
                color: '#0c4a6e',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                🚀 進行可能なリンク
              </h3>
              
              {isLoadingLinks ? (
                <div style={{ textAlign: 'center', color: '#6b7280' }}>
                  読み込み中...
                </div>
              ) : availableLinks.length > 0 ? (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                  gap: '12px' 
                }}>
                  {availableLinks.map((linkInfo: any, index: number) => (
                    <div key={index} style={{
                      background: 'white',
                      padding: '15px',
                      borderRadius: '8px',
                      border: '1px solid #e0f2fe',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '16px', 
                          color: '#1e40af',
                          marginBottom: '4px'
                        }}>
                          → {linkInfo.to_node.name || `ノード${linkInfo.to_node.id}`}
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280',
                          marginBottom: '2px'
                        }}>
                          リンクID: {linkInfo.link.id}
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280'
                        }}>
                          距離: {Math.round(linkInfo.distance)}m
                        </div>
                      </div>
                      <button
                        onClick={() => moveToLink(linkInfo.link.id)}
                        style={{
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
                      >
                        リンク表示
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#dc2626',
                  padding: '20px'
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🚫</div>
                  <div>進行可能なリンクがありません</div>
                </div>
              )}
            </div>

            {favorites.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: '#6b7280',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '2px dashed #d1d5db'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🌟</div>
                <div>お気に入り観光地が登録されていません</div>
                <div style={{ marginTop: '10px' }}>
                  <a href="/favorites" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                    お気に入り管理画面
                  </a>で観光地を追加してください
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '30px', textAlign: 'center', color: '#374151' }}>
                  🚶‍♂️ {favorites.length}件のお気に入り観光地への経路を自動計算しています...
                </div>

                {/* 全てのお気に入り観光地の経路を表示 */}
                {favorites.map(favorite => {
                  const routeInfo = favoriteRoutes[favorite.id];
                  const isLoading = routeLoading[favorite.id];
                  
                  return (
                    <div 
                      key={favorite.id}
                      style={{
                        background: '#fef3c7',
                        padding: '20px',
                        borderRadius: '12px',
                        border: '2px solid #f59e0b',
                        marginBottom: '25px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}
                    >
                      <h3 style={{ margin: '0 0 15px 0', color: '#92400e', fontSize: '1.2rem' }}>
                        🗺️ {currentNode.name} → {favorite.tourist_spot.name}
                      </h3>
                      
                      {isLoading ? (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '30px', 
                          color: '#92400e',
                          fontSize: '16px'
                        }}>
                          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔄</div>
                          <div>経路を計算中...</div>
                        </div>
                      ) : routeInfo ? (
                        <>
                          {/* 経路統計 */}
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                            gap: '12px',
                            marginBottom: '20px'
                          }}>
                            <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                                {routeInfo.total_distance.toFixed(0)}m
                              </div>
                              <div style={{ fontSize: '14px', color: '#92400e' }}>距離</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>
                                {Math.ceil(routeInfo.estimated_time || 0)}分
                              </div>
                              <div style={{ fontSize: '14px', color: '#92400e' }}>所要時間</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c3aed' }}>
                                {routeInfo.node_count}
                              </div>
                              <div style={{ fontSize: '14px', color: '#92400e' }}>経由点</div>
                            </div>
                          </div>

                          {/* 経路詳細 */}
                          <div style={{ marginBottom: '15px' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#92400e' }}>🚶‍♂️ 進行ルート（リンク単位）</h4>
                            
                            {/* リンクベースのルート表示 */}
                            <div style={{ 
                              background: '#f3f4f6',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db'
                            }}>
                              <div style={{ 
                                fontSize: '14px', 
                                color: '#374151',
                                lineHeight: '1.8'
                              }}>
                                {routeInfo.path.slice(0, -1).map((node: any, index: number) => {
                                  const nextNode = routeInfo.path[index + 1];
                                  const isFirst = index === 0;
                                  return (
                                    <div key={`${node.id}-${nextNode.id}`} style={{ 
                                      marginBottom: '8px',
                                      padding: '8px',
                                      background: isFirst ? '#dbeafe' : 'white',
                                      borderRadius: '6px',
                                      border: '1px solid #e5e7eb'
                                    }}>
                                      <div style={{ 
                                        fontWeight: 'bold',
                                        color: isFirst ? '#1e40af' : '#374151',
                                        marginBottom: '2px'
                                      }}>
                                        {isFirst ? '🏁 ' : `${index}. `}
                                        {node.name || `ノード${node.id}`} → {nextNode.name || `ノード${nextNode.id}`}
                                      </div>
                                      <div style={{ 
                                        fontSize: '12px', 
                                        color: '#6b7280'
                                      }}>
                                        このリンクを通って次のノードへ進む
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '30px', 
                          color: '#dc2626',
                          fontSize: '16px'
                        }}>
                          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>❌</div>
                          <div>経路が見つかりませんでした</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LinkListPage;