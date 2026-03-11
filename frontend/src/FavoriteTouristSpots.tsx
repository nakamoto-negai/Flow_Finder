import React, { useState, useEffect } from 'react';
import type { UserFavoriteTouristSpot, TouristSpot } from './types';
import { apiRequest } from './api';
import { getApiUrl } from './config';

const FavoriteTouristSpots: React.FC = () => {
  const [favorites, setFavorites] = useState<UserFavoriteTouristSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'priority' | 'visit_status'>('all');
  const [priorityFilter, setPriorityFilter] = useState<number>(0);
  const [visitStatusFilter, setVisitStatusFilter] = useState<string>('');
  
  // 観光地追加用の状態
  const [allTouristSpots, setAllTouristSpots] = useState<TouristSpot[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogLoading, setAddDialogLoading] = useState(false);

  // データ取得
  useEffect(() => {
    fetchFavorites();
    fetchAllTouristSpots();
  }, [filter, priorityFilter, visitStatusFilter]);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      let url = getApiUrl('/favorites/tourist-spots');
      const params = new URLSearchParams();

      if (filter === 'priority' && priorityFilter > 0) {
        params.append('priority', priorityFilter.toString());
      } else if (filter === 'visit_status' && visitStatusFilter) {
        params.append('visit_status', visitStatusFilter);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await apiRequest(url);
      if (!response.ok) throw new Error('お気に入り観光地の取得に失敗しました');
      
      const data = await response.json();
      setFavorites(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };



  // 全観光地を取得
  const fetchAllTouristSpots = async () => {
    try {
      const response = await apiRequest(getApiUrl('/tourist-spots'));
      if (response.ok) {
        const data = await response.json();
        setAllTouristSpots(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('観光地一覧の取得に失敗:', err);
    }
  };

  // お気に入りから削除
  const removeFavorite = async (touristSpotId: number) => {
    if (!confirm('お気に入りから削除しますか？')) return;

    try {
      const response = await apiRequest(getApiUrl(`/favorites/tourist-spots/${touristSpotId}`), {
        method: 'DELETE',
      });

      if (response.ok) {
        setFavorites(prev => prev.filter(fav => fav.tourist_spot_id !== touristSpotId));
      } else {
        setError('削除に失敗しました');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // お気に入り詳細の更新
  const updateFavoriteDetails = async (
    touristSpotId: number,
    updates: { notes?: string; priority?: number; visit_status?: string; visit_date?: string }
  ) => {
    try {
      const response = await apiRequest(getApiUrl(`/favorites/tourist-spots/${touristSpotId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await fetchFavorites(); // リストを再取得
      } else {
        setError('更新に失敗しました');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // 訪問状況の更新
  const updateVisitStatus = async (touristSpotId: number, visitStatus: string) => {
    const visitDate = visitStatus === '訪問済み' ? new Date().toISOString() : undefined;
    await updateFavoriteDetails(touristSpotId, { visit_status: visitStatus, visit_date: visitDate });
  };

  // 優先度の更新
  const updatePriority = async (touristSpotId: number, priority: number) => {
    await updateFavoriteDetails(touristSpotId, { priority });
  };

  // メモの更新
  const updateNotes = async (touristSpotId: number, notes: string) => {
    await updateFavoriteDetails(touristSpotId, { notes });
  };

  // 新しい観光地をお気に入りに追加
  const addToFavorites = async (touristSpotId: number, priority: number = 1, notes: string = '') => {
    setAddDialogLoading(true);
    try {
      const response = await apiRequest(getApiUrl('/favorites/tourist-spots'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tourist_spot_id: touristSpotId,
          notes,
          priority
        }),
      });

      if (response.ok) {
        await fetchFavorites(); // リストを再取得
        setShowAddDialog(false);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'お気に入りの追加に失敗しました');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddDialogLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP');
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

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>お気に入り観光地</h2>

      {/* お気に入り追加ボタン */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowAddDialog(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          ➕ 新しい観光地をお気に入りに追加
        </button>

        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => window.location.href = '/category-selector'}
            style={{
              padding: '8px 18px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            ＋ カテゴリーから観光地を追加
          </button>
        </div>
      </div>

      {/* フィルター */}
      <div style={{ 
        background: 'white', 
        padding: '15px', 
        borderRadius: '8px', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ marginRight: '8px', fontWeight: '500' }}>フィルター:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'priority' | 'visit_status')}
              style={{
                padding: '6px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            >
              <option value="all">すべて</option>
              <option value="priority">優先度別</option>
              <option value="visit_status">訪問状況別</option>
            </select>
          </div>

          {filter === 'priority' && (
            <div>
              <label style={{ marginRight: '8px', fontWeight: '500' }}>優先度:</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(Number(e.target.value))}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              >
                <option value={0}>すべて</option>
                <option value={1}>★☆☆☆☆ (1)</option>
                <option value={2}>★★☆☆☆ (2)</option>
                <option value={3}>★★★☆☆ (3)</option>
                <option value={4}>★★★★☆ (4)</option>
                <option value={5}>★★★★★ (5)</option>
              </select>
            </div>
          )}

          {filter === 'visit_status' && (
            <div>
              <label style={{ marginRight: '8px', fontWeight: '500' }}>訪問状況:</label>
              <select
                value={visitStatusFilter}
                onChange={(e) => setVisitStatusFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              >
                <option value="">すべて</option>
                <option value="未訪問">未訪問</option>
                <option value="訪問予定">訪問予定</option>
                <option value="訪問済み">訪問済み</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div style={{ 
          color: '#dc2626', 
          background: '#fef2f2', 
          padding: '12px', 
          borderRadius: '6px',
          marginBottom: '20px',
          border: '1px solid #fecaca'
        }}>
          {error}
        </div>
      )}

      {/* お気に入り追加ダイアログ */}
      {showAddDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ marginBottom: '20px', color: '#374151' }}>観光地をお気に入りに追加</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                観光地を選択
              </label>
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                {allTouristSpots
                  .filter(spot => !favorites.some(fav => fav.tourist_spot_id === spot.id))
                  .map(spot => (
                    <div
                      key={spot.id}
                      onClick={() => {
                        const priority = 3; // デフォルト優先度
                        const notes = '';
                        addToFavorites(spot.id, priority, notes);
                      }}
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {spot.image_url && (
                        <img
                          src={spot.image_url}
                          alt={spot.name}
                          style={{
                            width: '50px',
                            height: '50px',
                            objectFit: 'cover',
                            borderRadius: '6px'
                          }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', color: '#1f2937' }}>{spot.name}</div>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>
                          {spot.category} | 座標: ({spot.x}, {spot.y})
                        </div>
                        {spot.description && (
                          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                            {spot.description.length > 50 ? spot.description.substring(0, 50) + '...' : spot.description}
                          </div>
                        )}
                      </div>
                      <button
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                        disabled={addDialogLoading}
                      >
                        {addDialogLoading ? '追加中...' : '追加'}
                      </button>
                    </div>
                  ))}
                {allTouristSpots.filter(spot => !favorites.some(fav => fav.tourist_spot_id === spot.id)).length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                    追加可能な観光地がありません
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddDialog(false)}
                disabled={addDialogLoading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: addDialogLoading ? 'not-allowed' : 'pointer'
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* お気に入り一覧 */}
      <div style={{ 
        background: 'white', 
        borderRadius: '8px', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <h3 style={{ 
          margin: 0, 
          padding: '15px 20px', 
          background: '#f9fafb', 
          borderBottom: '1px solid #e5e7eb',
          color: '#374151'
        }}>
          お気に入り一覧 ({favorites.length}件)
        </h3>
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            読み込み中...
          </div>
        ) : favorites.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            お気に入りの観光地がありません
          </div>
        ) : (
          <div style={{ maxHeight: '800px', overflowY: 'auto' }}>
            {favorites.map(favorite => {
              const spot = favorite.tourist_spot;
              const congestion = getCongestionLevel(spot.current_count, spot.max_capacity);
              
              return (
                <div key={favorite.id} style={{ 
                  padding: '20px', 
                  borderBottom: '1px solid #f3f4f6'
                }}>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    {/* 画像 */}
                    {spot.image_url && (
                      <img
                        src={spot.image_url}
                        alt={spot.name}
                        style={{
                          width: '120px',
                          height: '120px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          flexShrink: 0
                        }}
                      />
                    )}
                    
                    {/* 基本情報 */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0, color: '#1f2937', fontSize: '18px' }}>{spot.name}</h4>
                        {spot.category && (
                          <span style={{ 
                            padding: '2px 8px', 
                            background: '#e0e7ff', 
                            color: '#3730a3', 
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}>
                            {spot.category}
                          </span>
                        )}
                        <span style={{ 
                          padding: '2px 8px', 
                          background: congestion.color, 
                          color: 'white', 
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}>
                          {congestion.level}
                        </span>
                      </div>
                      
                      {spot.description && (
                        <p style={{ margin: '0 0 10px 0', color: '#6b7280', lineHeight: '1.5' }}>
                          {spot.description}
                        </p>
                      )}
                      
                      <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>
                        <div><strong>営業時間:</strong> {spot.opening_time} - {spot.closing_time}</div>
                        <div><strong>収容人数:</strong> {spot.current_count}/{spot.max_capacity}人</div>
                        {spot.entry_fee > 0 && <div><strong>入場料:</strong> ¥{spot.entry_fee.toLocaleString()}</div>}
                        {spot.rating > 0 && <div><strong>評価:</strong> ⭐{spot.rating}/5</div>}
                        <div><strong>座標:</strong> ({spot.x}, {spot.y})</div>
                      </div>

                      {(spot.website || spot.phone_number) && (
                        <div style={{ marginTop: '10px' }}>
                          {spot.website && (
                            <a 
                              href={spot.website} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              style={{ color: '#3b82f6', textDecoration: 'none', marginRight: '15px' }}
                            >
                              🌐 公式サイト
                            </a>
                          )}
                          {spot.phone_number && <span style={{ fontSize: '14px', color: '#6b7280' }}>📞 {spot.phone_number}</span>}
                        </div>
                      )}
                    </div>

                    {/* お気に入り詳細情報 */}
                    <div style={{ flexShrink: 0, width: '300px' }}>
                      <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
                        <h5 style={{ margin: '0 0 10px 0', color: '#374151' }}>お気に入り情報</h5>
                        
                        {/* 優先度 */}
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                            優先度
                          </label>
                          <select
                            value={favorite.priority}
                            onChange={(e) => updatePriority(favorite.tourist_spot_id, Number(e.target.value))}
                            style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                          >
                            <option value={1}>★☆☆☆☆ (1)</option>
                            <option value={2}>★★☆☆☆ (2)</option>
                            <option value={3}>★★★☆☆ (3)</option>
                            <option value={4}>★★★★☆ (4)</option>
                            <option value={5}>★★★★★ (5)</option>
                          </select>
                        </div>

                        {/* 訪問状況 */}
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                            訪問状況
                          </label>
                          <select
                            value={favorite.visit_status}
                            onChange={(e) => updateVisitStatus(favorite.tourist_spot_id, e.target.value)}
                            style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                          >
                            <option value="未訪問">未訪問</option>
                            <option value="訪問予定">訪問予定</option>
                            <option value="訪問済み">訪問済み</option>
                          </select>
                        </div>

                        {/* メモ */}
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                            メモ
                          </label>
                          <textarea
                            value={favorite.notes}
                            onChange={(e) => updateNotes(favorite.tourist_spot_id, e.target.value)}
                            placeholder="メモを入力..."
                            style={{ 
                              width: '100%', 
                              padding: '6px 8px', 
                              border: '1px solid #d1d5db', 
                              borderRadius: '4px', 
                              fontSize: '12px',
                              minHeight: '60px',
                              resize: 'vertical'
                            }}
                          />
                        </div>

                        {/* 日付情報 */}
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                          <div><strong>追加日:</strong> {formatDate(favorite.added_at)}</div>
                          {favorite.visit_date && (
                            <div><strong>訪問日:</strong> {formatDate(favorite.visit_date)}</div>
                          )}
                        </div>

                        {/* ルート選択ボタン */}
                        {spot.nearest_node_id && (
                          <button
                            onClick={() => { window.location.href = `/route-selector?node_id=${spot.nearest_node_id}`; }}
                            style={{
                              width: '100%',
                              marginTop: '10px',
                              padding: '6px 12px',
                              backgroundColor: '#2563eb',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            🗺️ ルートを選択
                          </button>
                        )}

                        {/* 削除ボタン */}
                        <button
                          onClick={() => removeFavorite(favorite.tourist_spot_id)}
                          style={{
                            width: '100%',
                            marginTop: '8px',
                            padding: '6px 12px',
                            backgroundColor: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          お気に入り解除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoriteTouristSpots;