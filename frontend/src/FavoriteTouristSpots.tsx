import React, { useState, useEffect } from 'react';
import type { TouristSpot } from './types';
import { apiRequest } from './api';
import { getApiUrl, STATIC_BASE_URL } from './config';

const FavoriteTouristSpots: React.FC = () => {
  const [allSpots, setAllSpots] = useState<TouristSpot[]>([]);
  const [favoriteSpotIds, setFavoriteSpotIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(getApiUrl('/tourist-spots')).then(r => r.json()),
      apiRequest(getApiUrl('/favorites/tourist-spots')).then(r => r.ok ? r.json() : []),
    ]).then(([spots, favs]) => {
      setAllSpots(Array.isArray(spots) ? spots : []);
      const ids = new Set<number>((Array.isArray(favs) ? favs : []).map((f: any) => f.tourist_spot_id ?? f.tourist_spot?.id));
      setFavoriteSpotIds(ids);
    }).catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false));
  }, []);

  const toggleFavorite = async (spot: TouristSpot) => {
    setToggling(spot.id);
    const isFav = favoriteSpotIds.has(spot.id);
    try {
      if (isFav) {
        const res = await apiRequest(getApiUrl(`/favorites/tourist-spots/${spot.id}`), { method: 'DELETE' });
        if (res.ok || res.status === 204) {
          setFavoriteSpotIds(prev => { const s = new Set(prev); s.delete(spot.id); return s; });
        }
      } else {
        const res = await apiRequest(getApiUrl('/favorites/tourist-spots'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tourist_spot_id: spot.id, priority: 3, notes: '' }),
        });
        if (res.ok) {
          setFavoriteSpotIds(prev => new Set(prev).add(spot.id));
        }
      }
    } catch {
      setError('操作に失敗しました');
    } finally {
      setToggling(null);
    }
  };

  const filtered = allSpots.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const favoriteCount = favoriteSpotIds.size;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px 40px' }}>
      <h2 style={{ color: '#1f2937', marginBottom: 4 }}>My地点一覧</h2>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
          My地点登録中: <strong>{favoriteCount}</strong> 件
        </p>
        <button
          onClick={() => window.location.href = '/category-selector'}
          style={{
            padding: '8px 18px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: 14,
          }}
        >
          ＋ カテゴリーからMy地点を追加
        </button>
      </div>

      {/* 検索 */}
      <input
        type="text"
        placeholder="スポットを検索..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', fontSize: 15,
          border: '1px solid #d1d5db', borderRadius: 8, marginBottom: 20,
          boxSizing: 'border-box',
        }}
      />

      {error && (
        <div style={{ color: '#dc2626', background: '#fef2f2', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>My地点が見つかりません</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(spot => {
            const isFav = favoriteSpotIds.has(spot.id);
            const isToggling = toggling === spot.id;
            return (
              <div key={spot.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'white', borderRadius: 10, padding: '14px 16px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                border: isFav ? '2px solid #f59e0b' : '1px solid #e5e7eb',
              }}>
                {/* 画像 */}
                {spot.image_url ? (
                  <img
                    src={spot.image_url.startsWith('http') ? spot.image_url : `${STATIC_BASE_URL}${spot.image_url}`}
                    alt={spot.name}
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 64, height: 64, background: '#f3f4f6', borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                    🏛️
                  </div>
                )}

                {/* 情報 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 16, color: '#1f2937', marginBottom: 2 }}>
                    {spot.name}
                    {isFav && <span style={{ marginLeft: 6, color: '#f59e0b', fontSize: 14 }}>★ お気に入り</span>}
                  </div>
                  {spot.description && (
                    <div style={{ fontSize: 13, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {spot.description}
                    </div>
                  )}
                </div>

                {/* トグルボタン */}
                <button
                  onClick={() => toggleFavorite(spot)}
                  disabled={isToggling}
                  style={{
                    flexShrink: 0,
                    padding: '8px 16px',
                    background: isFav ? '#fef3c7' : '#3b82f6',
                    color: isFav ? '#92400e' : 'white',
                    border: isFav ? '1px solid #f59e0b' : 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 'bold',
                    cursor: isToggling ? 'default' : 'pointer',
                    opacity: isToggling ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isToggling ? '...' : isFav ? '★ 解除' : '☆ 登録'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FavoriteTouristSpots;
