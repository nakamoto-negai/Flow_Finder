import React, { useState, useEffect } from 'react';
import { getApiUrl } from './config';
import { getAuthHeaders } from './api';

interface TouristSpot {
  id: number;
  name: string;
  description?: string;
  category: string;
  category_id?: number;
  tourist_category?: {
    id: number;
    name: string;
    icon: string;
    color: string;
  };
  nearest_node_id?: number;
  distance_to_nearest_node: number;
  x: number;
  y: number;
  max_capacity: number;
  current_count: number;
  is_open: boolean;
  opening_time: string;
  closing_time: string;
  entry_fee: number;
  website: string;
  phone_number: string;
  image_url?: string;
  reward_url?: string;
  rating: number;
  review_count: number;
  last_updated: string;
  created_at: string;
  updated_at: string;
}

interface TouristSpotDetailUserProps {
  spotId: number;
  onBack: () => void;
}

const TouristSpotDetailUser: React.FC<TouristSpotDetailUserProps> = ({ spotId, onBack }) => {
  const [spot, setSpot] = useState<TouristSpot | null>(null);
  const [loading, setLoading] = useState(false);
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

  // 観光地詳細を取得
  const fetchSpotDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl(`/tourist-spots/${spotId}`), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('観光地の取得に失敗しました');
      const data = await response.json();
      setSpot(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpotDetail();
  }, [spotId]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
          <div>読み込み中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ maxWidth: 800, margin: "32px auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0001", padding: 24 }}>
          <h1 style={{ color: "red" }}>エラーが発生しました</h1>
          <p>{error}</p>
          <button
            onClick={onBack}
            style={{
              background: '#6b7280',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (!spot) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>❌</div>
          <div>観光地が見つかりません</div>
        </div>
      </div>
    );
  }

  const congestion = getCongestionLevel(spot.current_count, spot.max_capacity);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* ヘッダー */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBack}
            style={{
              background: '#f3f4f6',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#374151',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ← 戻る
          </button>
          <h1 style={{ margin: 0, color: '#1f2937', fontSize: '1.5rem' }}>
            {spot.name}
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        {/* メイン画像 */}
        {spot.image_url && spot.image_url.trim() !== '' && (
          <div style={{ marginBottom: '32px' }}>
            <img
              src={spot.image_url}
              alt={spot.name}
              style={{
                width: '100%',
                height: '400px',
                objectFit: 'cover',
                borderRadius: '16px',
                boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
                border: '1px solid #e5e7eb'
              }}
            />
          </div>
        )}

        {/* 説明 */}
        {spot.description && spot.description.trim() !== '' && (
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ margin: '0 0 16px 0', color: '#1f2937', fontSize: '1.5rem', fontWeight: 'bold' }}>📝 詳細情報</h2>
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              lineHeight: '1.7',
              color: '#374151',
              fontSize: '16px'
            }}>
              {spot.description}
            </div>
          </div>
        )}

        {/* カテゴリと混雑状況 */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {spot.tourist_category && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: spot.tourist_category.color + '20',
              color: spot.tourist_category.color,
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              <span>{spot.tourist_category.icon}</span>
              {spot.tourist_category.name}
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: congestion.color + '20',
            color: congestion.color,
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            👥 {congestion.level} ({spot.current_count}/{spot.max_capacity}人)
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: spot.is_open ? '#dcfce7' : '#fee2e2',
            color: spot.is_open ? '#166534' : '#dc2626',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            {spot.is_open ? '🟢 営業中' : '🔴 営業時間外'}
          </div>
        </div>

        {/* 営業情報 */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0', color: '#1f2937', fontSize: '1.25rem' }}>🕒 営業情報</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>営業時間</div>
              <div style={{ fontSize: '16px', color: '#1f2937', fontWeight: 'bold' }}>
                {spot.opening_time} - {spot.closing_time}
              </div>
            </div>

            {spot.entry_fee > 0 && (
              <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>入場料</div>
                <div style={{ fontSize: '16px', color: '#1f2937', fontWeight: 'bold' }}>
                  ¥{spot.entry_fee.toLocaleString()}
                </div>
              </div>
            )}

            <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>評価</div>
              <div style={{ fontSize: '16px', color: '#1f2937', fontWeight: 'bold' }}>
                ⭐ {spot.rating.toFixed(1)} ({spot.review_count}件)
              </div>
            </div>
          </div>
        </div>

        {/* 連絡先情報 */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0', color: '#1f2937', fontSize: '1.25rem' }}>📞 連絡先</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {spot.website && (
              <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>ウェブサイト</div>
                <a
                  href={spot.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 'bold' }}
                >
                  公式サイトを見る →
                </a>
              </div>
            )}

            {spot.phone_number && (
              <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>電話番号</div>
                <a
                  href={`tel:${spot.phone_number}`}
                  style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 'bold' }}
                >
                  {spot.phone_number}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* 位置情報 */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0', color: '#1f2937', fontSize: '1.25rem' }}>📍 位置情報</h2>
          <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>座標</div>
            <div style={{ fontFamily: 'monospace', color: '#1f2937' }}>
              X: {spot.x}, Y: {spot.y}
            </div>
            {spot.nearest_node_id && (
              <div style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280' }}>
                最寄りノードID: {spot.nearest_node_id}
              </div>
            )}
          </div>
        </div>

        {/* 特典情報 */}
        {spot.reward_url && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 16px 0', color: '#1f2937', fontSize: '1.25rem' }}>🎁 特典情報</h2>
            <div style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              padding: '20px',
              borderRadius: '12px',
              border: '2px solid #f59e0b',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🎉</div>
              <p style={{ color: '#92400e', marginBottom: '16px', fontSize: '1rem' }}>
                {spot.name}の特典ページをご覧ください！
              </p>
              <button
                onClick={() => window.open(spot.reward_url, '_blank')}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '25px',
                  fontSize: '1rem',
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TouristSpotDetailUser;