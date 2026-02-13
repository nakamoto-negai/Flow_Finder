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
  const [availableLinks, setAvailableLinks] = useState<any[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allTouristSpots, setAllTouristSpots] = useState<any[]>([]);
  const [allRoutes, setAllRoutes] = useState<{[key: number]: RouteInfo}>({});
  const [arrivedSpots, setArrivedSpots] = useState<any[]>([]);

  // ログ送信関数
  const sendLog = async (action: string, detail: any = {}) => {
    const userId = localStorage.getItem('user_id');
    await apiRequest(getApiUrl('/logs'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        action,
        ...detail
      })
    });
  };

  // 混雑レベルの計算
  const getCongestionLevel = (current: number, max: number) => {
    if (max === 0) return { level: '不明', color: '#9ca3af' };
    
    const ratio = current / max;
    if (ratio >= 1.0) return { level: '満員', color: '#dc2626' };
    if (ratio >= 0.8) return { level: '非常に混雑', color: '#ea580c' };
    if (ratio >= 0.6) return { level: '混雑', color: '#d97706' };
    if (ratio >= 0.4) return { level: '普通', color: '#ca8a04' };
    if (ratio >= 0.2) return { level: '少し空いている', color: '#65a30d' };
    return { level: '空いている', color: '#16a34a' };
  };


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
          // 全観光地を取得して経路計算
          fetchAllTouristSpots().then(spots => {
            if (spots.length > 0) {
              calculateAllRoutes(spots, foundNode);
            }
          });
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
  const moveToLink = async (linkId: number) => {
    const userId = localStorage.getItem('user_id');
    await sendLog('link_click', { user_id: userId, link_id: linkId });
    window.location.href = `/link-image?id=${linkId}`;
  };

  // 全観光地データを取得
  const fetchAllTouristSpots = async () => {
    try {
      const response = await fetch(getApiUrl('/tourist-spots'));
      if (response.ok) {
        const data = await response.json();
        const spotsArray = Array.isArray(data) ? data : [];
        setAllTouristSpots(spotsArray);
        return spotsArray;
      }
    } catch (err) {
      console.error('全観光地の取得に失敗:', err);
    }
    return [];
  };

  // 全観光地への経路を計算
  const calculateAllRoutes = async (spots: any[], node: any) => {
    console.log(`${spots.length}件の観光地への経路を計算中...`);
    for (const spot of spots) {
      if (spot.nearest_node_id) {
        await calculateRouteToSpot(spot, node);
      }
    }
  };

  // 観光地への経路を計算（汎用）
  const calculateRouteToSpot = async (spot: any, node: any) => {
    if (!spot.nearest_node_id) return;

    try {
      const response = await fetch(getApiUrl('/dijkstra'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_node_id: node.id,
          end_node_id: spot.nearest_node_id
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.path && Array.isArray(data.path)) {
          setAllRoutes(prev => ({
            ...prev,
            [spot.id]: {
              path: data.path,
              total_distance: data.total_distance,
              node_count: data.node_count,
              estimated_time: data.total_distance / 80
            }
          }));
        }
      }
    } catch (err: any) {
      console.error(`経路計算エラー (${spot.name}):`, err.message);
    }
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

        // ログ: ユーザーのお気に入り観光地一覧
        if (favoritesData.length > 0) {
          const userId = localStorage.getItem('user_id');
          const favoriteSpotNames = favoritesData.map(f => f.tourist_spot.name).join(', ');
          await sendLog('favorite_list', {
            user_id: userId,
            favorite_spots: favoriteSpotNames
          });
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
      // ノード到着判定
      if (node.id === favorite.tourist_spot.nearest_node_id) {
        const userId = localStorage.getItem('user_id');
        await sendLog('arrived', {
          user_id: userId,
          tourist_spot_id: favorite.tourist_spot.id,
          node_id: node.id
        });
        // 到着した観光地を記録
        setArrivedSpots(prev => {
          if (!prev.some(s => s.id === favorite.tourist_spot.id)) {
            return [...prev, favorite.tourist_spot];
          }
          return prev;
        });
      }
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
            {/* 到着通知 */}
            {arrivedSpots.length > 0 && (
              <div style={{
                marginBottom: '24px',
                padding: '20px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                animation: 'slideIn 0.5s ease-out'
              }}>
               
                <div style={{
                  color: 'white',
                  fontSize: '1.3rem',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  marginBottom: '8px'
                }}>
                  おめでとうございます！
                </div>
                {arrivedSpots.map((spot, index) => (
                  <div key={spot.id} style={{
                    color: 'white',
                    fontSize: '1.1rem',
                    textAlign: 'center',
                    marginTop: index > 0 ? '8px' : '0'
                  }}>
                    「{spot.name}」に到着しました
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <h1 style={{ fontSize: "1.5rem", marginBottom: 10, color: '#1f2937' }}>
                {currentNode.name || `ノード ${currentNode.id}`} からの経路
              </h1>
            </div>

            {/* お気に入り観光地サマリー */}
            {favorites.length > 0 && (
              <div style={{
                marginBottom: '24px',
                padding: '20px',
                background: '#fffbeb',
                borderRadius: '12px',
                border: '2px solid #f59e0b'
              }}>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '1.1rem',
                  color: '#92400e',
                  fontWeight: 'bold'
                }}>
                  お気に入り観光地
                </h3>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                {favorites.map(favorite => {
                  const route = favoriteRoutes[favorite.id];
                  const spot = favorite.tourist_spot;
                  const congestion = getCongestionLevel(spot.current_count, spot.max_capacity);
                  return (
                    <div key={favorite.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      background: 'white',
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#92400e', minWidth: '80px' }}>
                        {spot.name}
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                        flex: 1
                      }}>
                        {/* 待ち時間 */}
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          background: spot.wait_time > 30 ? '#fee2e2' : (spot.wait_time > 10 ? '#fef3c7' : '#dcfce7'),
                          color: spot.wait_time > 30 ? '#dc2626' : (spot.wait_time > 10 ? '#b45309' : '#16a34a')
                        }}>
                          待ち {spot.wait_time}分
                        </span>
                        {/* 混雑度 */}
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          background: 'white',
                          color: congestion.color,
                          border: `1px solid ${congestion.color}`
                        }}>
                          {spot.max_capacity > 0 ? `${Math.round((spot.current_count / spot.max_capacity) * 100)}%` : '---'}
                        </span>
                        {/* 距離 */}
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          background: '#eff6ff',
                          color: '#1e40af'
                        }}>
                          {route ? `${route.total_distance.toFixed(0)}m` : '計算中...'}
                        </span>
                        {/* 所要時間 */}
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          background: '#f3e8ff',
                          color: '#7c3aed'
                        }}>
                          {route ? `約${Math.ceil(route.estimated_time || 0)}分` : '---'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            )}

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
                進行可能な経路
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
                  {availableLinks.map((linkInfo: any, index: number) => {
                
                // 1. ここで「次の一歩」が一致する観光地を探す（全観光地対象）
                const targetSpots = allTouristSpots.filter(spot => {
                  const route = allRoutes[spot.id];
                  return route && route.path && route.path.length > 1 && route.path[1].id === linkInfo.to_node.id;
                });

                // お気に入りの観光地のうち、このリンク方向に進むもの
                const favoriteSpotsInDirection = favorites.filter(favorite => {
                  const route = favoriteRoutes[favorite.id];
                  return route && route.path && route.path.length > 1 && route.path[1].id === linkInfo.to_node.id;
                });

                return (
                  <div key={index} style={{
                    background: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    border: favoriteSpotsInDirection.length > 0 ? '2px solid #3b82f6' : '1px solid #e0f2fe',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1e40af', marginBottom: '4px' }}>
                        → {linkInfo.to_node.name || `ノード${linkInfo.to_node.id}`}
                      </div>
                      
                      {/* 2. 観光地名を表示する部分（全観光地対象） */}
                      {targetSpots.length > 0 && (
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 'bold',
                          background: '#eff6ff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          marginBottom: '4px',
                          display: 'inline-block'
                        }}>
                          {targetSpots.map((s, i) => {
                            const isFav = favorites.some(f => f.tourist_spot.id === s.id);
                            return (
                              <span key={s.id} style={{ color: isFav ? '#f59e0b' : '#3b82f6' }}>
                                {s.name}{i < targetSpots.length - 1 && ', '}
                              </span>
                            );
                          })} 方面
                        </div>
                      )}

                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        距離: {Math.round(linkInfo.distance)}m
                      </div>
                    </div>
                    <button
                      onClick={() => moveToLink(linkInfo.link.id)}
                      style={{
                        background: favoriteSpotsInDirection.length > 0 ? '#e923e9' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      ここに進む
                    </button>
                  </div>
                );
              })}
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

          </>
        )}
      </div>
    </div>
  );
};

export default LinkListPage;