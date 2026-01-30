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

    // お気に入り削除のハンドラー
  const handleRemoveFavorite = async (favoriteId: number, touristSpotId: number) => {
    if (!window.confirm("この観光地をお気に入りから削除しますか？")) return;

    try {
      const response = await apiRequest(getApiUrl(`/favorites/tourist-spots/${touristSpotId}`), {
        method: 'DELETE',
      });

      if (response.ok) {
        // 成功したらローカルの状態を更新して画面から消す
        setFavorites(prev => prev.filter(f => f.id !== favoriteId));
        alert("お気に入りから削除しました。");
      } else {
        const errorData = await response.json();
        alert(`削除に失敗しました: ${errorData.error || '不明なエラー'}`);
      }
    } catch (err) {
      console.error("削除リクエストエラー:", err);
      alert("通信エラーが発生しました。");
    }
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
                お気に入り観光地への経路
              </h1>
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
                進行可能なリンク
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
                
                // 1. ここで「次の一歩」が一致する観光地を探す
                const targetSpots = favorites.filter(favorite => {
                  const route = favoriteRoutes[favorite.id];
                  return route && route.path && route.path.length > 1 && route.path[1].id === linkInfo.to_node.id;
                });

                return (
                  <div key={index} style={{
                    background: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    border: targetSpots.length > 0 ? '2px solid #3b82f6' : '1px solid #e0f2fe',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1e40af', marginBottom: '4px' }}>
                        → {linkInfo.to_node.name || `ノード${linkInfo.to_node.id}`}
                      </div>
                      
                      {/* 2. 観光地名を表示する部分を追加 */}
                      {targetSpots.length > 0 && (
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#3b82f6', 
                          fontWeight: 'bold',
                          background: '#eff6ff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          marginBottom: '4px',
                          display: 'inline-block'
                        }}>
                          {targetSpots.map(s => s.tourist_spot.name).join(', ')} 方面
                        </div>
                      )}

                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        距離: {Math.round(linkInfo.distance)}m
                      </div>
                    </div>
                    <button
                      onClick={() => moveToLink(linkInfo.link.id)}
                      style={{
                        background: targetSpots.length > 0 ? '#e923e9' : '#3b82f6',
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
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: '15px'
                      }}>
                        <h3 style={{ margin: '0', color: '#92400e', fontSize: '1.2rem' }}>
                          {currentNode.name} → {favorite.tourist_spot.name}
                        </h3>
                        
                        {/* 混雑度マーク */}
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: 'white',
                          backgroundColor: (() => {
                            const congestion = getCongestionLevel(favorite.tourist_spot.current_count, favorite.tourist_spot.max_capacity);
                            return congestion.color;
                          })(),
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                          {(() => {
                            const congestion = getCongestionLevel(favorite.tourist_spot.current_count, favorite.tourist_spot.max_capacity);
                            // 混雑レベルに応じた表示テキスト
                            const getCongestionText = (level: string) => {
                              switch (level) {
                                case '空いている': return '空き';
                                case '少し空いている': return '空き';
                                case '普通': return '普通';
                                case '混雑': return '混雑';
                                case '非常に混雑': return '大混雑';
                                case '満員': return '満員';
                                default: return '不明';
                              }
                            };
                            return getCongestionText(congestion.level);
                          })()}
                        </div>
                      </div>
                      
                      {/* 観光地詳細ボタン */}
                      <div style={{ marginBottom: '15px', textAlign: 'right' }}>
                        <button
                          onClick={() => window.location.href = `/tourist-spot/${favorite.tourist_spot.id}`}
                          style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
                          }}
                        >
                          詳細を見る
                        </button>
                      </div>
                      
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
                          {/* 到着判定 - デバッグ情報 */}
                          {(() => {
                            // nearest_node_idによる判定
                            const arrivedByNodeId = currentNode && favorite.tourist_spot.nearest_node_id && currentNode.id === favorite.tourist_spot.nearest_node_id;
                            
                            // 座標による判定（nearest_node_idがない場合のフォールバック）
                            
                            
                            const isArrived = arrivedByNodeId 
                            
                            console.log('到着判定デバッグ:', {
                              currentNodeId: currentNode?.id,
                              nearestNodeId: favorite.tourist_spot.nearest_node_id,
                              touristSpotCoords: { x: favorite.tourist_spot.x, y: favorite.tourist_spot.y },
                              currentNodeCoords: currentNode ? { x: currentNode.x, y: currentNode.y } : null,
                              arrivedByNodeId,
                              isArrived
                            });
                            
                            // nearest_node_idが未設定の場合の警告
                            if (!favorite.tourist_spot.nearest_node_id) {
                              console.warn(`観光地 "${favorite.tourist_spot.name}" の最寄りノードが設定されていません。管理画面でnearest_node_idを設定してください。`);
                            }
                            
                            return isArrived ? (
                              /* 到着時の祝福表示 */
                              <div style={{ 
                                textAlign: 'center', 
                                padding: '40px 20px',
                                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                borderRadius: '12px',
                                border: '2px solid #f59e0b',
                                marginBottom: '20px'
                              }}>
                                <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🎉</div>
                                <h3 style={{ 
                                  color: '#92400e', 
                                  fontSize: '1.5rem', 
                                  marginBottom: '10px',
                                  fontWeight: 'bold'
                                }}>
                                  おめでとうございます！
                                </h3>
                                <p style={{ 
                                  color: '#92400e', 
                                  fontSize: '1.1rem',
                                  marginBottom: '20px',
                                  lineHeight: '1.6'
                                }}>
                                  {favorite.tourist_spot.name}に到着しました！<br />
                                  素晴らしい旅をお楽しみください。
                                </p>
                                
                                {/* 特典ボタン */}
                                {favorite.tourist_spot.reward_url && (
                                  <button
                                    onClick={() => window.open(favorite.tourist_spot.reward_url, '_blank')}
                                    style={{
                                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                      color: 'white',
                                      border: 'none',
                                      padding: '15px 30px',
                                      borderRadius: '25px',
                                      fontSize: '1.1rem',
                                      fontWeight: 'bold',
                                      cursor: 'pointer',
                                      boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                                      transition: 'all 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'translateY(-2px)';
                                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = '0 4px 15px rgba(245, 158, 11, 0.3)';
                                    }}
                                  >
                                    特典を受け取る
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRemoveFavorite(favorite.id, favorite.tourist_spot.id)}
                                  style={{
                                    background: 'white',
                                    color: '#dc2626',
                                    border: '2px solid #dc2626',
                                    padding: '12px 24px',
                                    borderRadius: '25px',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#fef2f2';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'white';
                                  }}
                                >
                                  ⭐ お気に入りを解除
                                </button>
                              </div>
                            ) : (
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
                                  <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>
                                      {(() => {
                                        const congestion = getCongestionLevel(favorite.tourist_spot.current_count, favorite.tourist_spot.max_capacity);
                                        // 混雑レベルに応じたアイコン
                                        const getCongestionIcon = (level: string) => {
                                          switch (level) {
                                            case '空いている': return '😊';
                                            case '少し空いている': return '🙂';
                                            case '普通': return '😐';
                                            case '混雑': return '😟';
                                            case '非常に混雑': return '😰';
                                            case '満員': return '😱';
                                            default: return '❓';
                                          }
                                        };
                                        return getCongestionIcon(congestion.level);
                                      })()}
                                    </div>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: (() => {
                                      const congestion = getCongestionLevel(favorite.tourist_spot.current_count, favorite.tourist_spot.max_capacity);
                                      return congestion.color;
                                    })() }}>
                                      {(() => {
                                        const congestion = getCongestionLevel(favorite.tourist_spot.current_count, favorite.tourist_spot.max_capacity);
                                        return congestion.level;
                                      })()}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#92400e', marginTop: '4px' }}>
                                      {favorite.tourist_spot.current_count}/{favorite.tourist_spot.max_capacity}人
                                    </div>
                                    <div style={{ fontSize: '14px', color: '#92400e' }}>現在の混雑</div>
                                  </div>
                                </div>

                                {/* 経路詳細 */}
                                <div style={{ marginBottom: '15px' }}>
                                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#92400e' }}>進行ルート（リンク単位）</h4>
                                  
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
                            );
                          })()}
                        </>
                      ) : (
                        /* 到着時の祝福表示（経路が見つからない場合も到着とみなす） */
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '40px 20px',
                          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                          borderRadius: '12px',
                          border: '2px solid #f59e0b',
                          marginBottom: '20px'
                        }}>
                          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🎉</div>
                          <h3 style={{ 
                            color: '#92400e', 
                            fontSize: '1.5rem', 
                            marginBottom: '10px',
                            fontWeight: 'bold'
                          }}>
                            おめでとうございます！
                          </h3>
                          <p style={{ 
                            color: '#92400e', 
                            fontSize: '1.1rem',
                            marginBottom: '20px',
                            lineHeight: '1.6'
                          }}>
                            {favorite.tourist_spot.name}に到着しました！<br />
                            素晴らしい旅をお楽しみください。
                          </p>
                          
                          {/* 特典ボタン */}
                          {favorite.tourist_spot.reward_url && (
                            <button
                              onClick={() => window.open(favorite.tourist_spot.reward_url, '_blank')}
                              style={{
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '15px 30px',
                                borderRadius: '25px',
                                fontSize: '1.1rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                                transition: 'all 0.3s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.4)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 15px rgba(245, 158, 11, 0.3)';
                              }}
                            >
                              🎁 特典を受け取る
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveFavorite(favorite.id, favorite.tourist_spot.id)}
                            style={{
                              background: 'white',
                              color: '#dc2626',
                              border: '2px solid #dc2626',
                              padding: '12px 24px',
                              borderRadius: '25px',
                              fontSize: '1rem',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#fef2f2';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'white';
                            }}
                          >
                            ⭐ お気に入りを解除
                          </button>
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