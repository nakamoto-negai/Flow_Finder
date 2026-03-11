import React, { useState, useEffect } from 'react';
import { getApiUrl } from './config';
import { getAuthHeaders } from './api';

interface TouristSpot {
  id: number;
  name: string;
  description: string;
  category: string;
  tourist_category?: {
    id: number;
    name: string;
    icon: string;
    color: string;
  };
  max_capacity: number;
  current_count: number;
  is_open: boolean;
}

const CongestionManager: React.FC = () => {
  const [touristSpots, setTouristSpots] = useState<TouristSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSpot, setEditingSpot] = useState<number | null>(null);
  const [visitorCounts, setVisitorCounts] = useState<Record<number, number>>({});

  // 観光地一覧を取得
  const fetchTouristSpots = async () => {
    try {
      const response = await fetch(getApiUrl('/tourist-spots'));
      if (!response.ok) throw new Error('観光地の取得に失敗しました');
      const data = await response.json();
      const spots = Array.isArray(data) ? data : [];
      setTouristSpots(spots);
      
      // 現在の来場者数を初期値として設定
      const counts: Record<number, number> = {};
      spots.forEach((spot: TouristSpot) => {
        counts[spot.id] = spot.current_count;
      });
      setVisitorCounts(counts);
    } catch (err: any) {
      setTouristSpots([]);
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchTouristSpots();
  }, []);

  // 来場者数を更新
  const updateVisitorCount = async (spotId: number) => {
    const count = visitorCounts[spotId];
    if (count === undefined || count < 0) {
      alert('有効な来場者数を入力してください');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(getApiUrl(`/tourist-spots/${spotId}/visitors`), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ current_count: count }),
      });

      if (!response.ok) {
        throw new Error('来場者数の更新に失敗しました');
      }

      alert('来場者数を更新しました');
      setEditingSpot(null);
      await fetchTouristSpots(); // 最新データを再取得
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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
      <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>混雑度管理 - 来場者数入力</h2>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '6px', marginBottom: '20px' }}>
          エラー: {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: '20px' }}>
        {touristSpots.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>観光地が登録されていません</p>
        ) : (
          touristSpots.map(spot => {
            const congestion = getCongestionLevel(spot.current_count, spot.max_capacity);
            const isEditing = editingSpot === spot.id;

            return (
              <div
                key={spot.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '20px',
                  backgroundColor: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', color: '#1f2937', fontSize: '18px' }}>{spot.name}</h3>
                    {spot.tourist_category && (
                      <span style={{ fontSize: '14px', color: spot.tourist_category.color || '#6b7280' }}>
                        {spot.tourist_category.icon} {spot.tourist_category.name}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                    最大収容人数: <span style={{ fontWeight: 'bold', color: '#1f2937' }}>{spot.max_capacity}人</span>
                  </div>
                  
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <label style={{ fontSize: '14px', color: '#1f2937', fontWeight: 'bold' }}>
                        現在の来場者数:
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={visitorCounts[spot.id] ?? spot.current_count}
                        onChange={(e) => setVisitorCounts({ ...visitorCounts, [spot.id]: parseInt(e.target.value) || 0 })}
                        style={{
                          width: '120px',
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                        }}
                      />
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>人</span>
                      <button
                        onClick={() => updateVisitorCount(spot.id)}
                        disabled={loading}
                        style={{
                          padding: '6px 16px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          opacity: loading ? 0.5 : 1,
                        }}
                      >
                        {loading ? '更新中...' : '更新'}
                      </button>
                      <button
                        onClick={() => setEditingSpot(null)}
                        disabled={loading}
                        style={{
                          padding: '6px 16px',
                          backgroundColor: '#6b7280',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>
                        現在の来場者数: <span style={{ fontWeight: 'bold', color: '#1f2937' }}>{spot.current_count}人</span>
                      </div>
                      <button
                        onClick={() => setEditingSpot(spot.id)}
                        style={{
                          padding: '6px 16px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        来場者数を入力
                      </button>
                    </div>
                  )}

                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: congestion.color + '20',
                      color: congestion.color,
                      fontWeight: 'bold',
                      fontSize: '14px',
                      display: 'inline-block',
                    }}
                  >
                    混雑度: {congestion.level}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CongestionManager;
