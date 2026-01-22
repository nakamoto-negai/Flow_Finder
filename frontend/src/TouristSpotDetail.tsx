import React, { useState, useEffect } from 'react';
import { getApiUrl } from './config';
import { getAuthHeaders } from './api';

interface TouristSpot {
  id: number;
  name: string;
  description: string;
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
  image_url: string;
  rating: number;
  review_count: number;
  last_updated: string;
  created_at: string;
  updated_at: string;
}

interface CongestionRecord {
  id: number;
  tourist_spot_id: number;
  level: number;
  recorded_at: string;
  note: string;
  created_at: string;
  updated_at: string;
}

interface TouristSpotDetailProps {
  spotId: number;
  onBack: () => void;
}

const TouristSpotDetail: React.FC<TouristSpotDetailProps> = ({ spotId, onBack }) => {
  const [spot, setSpot] = useState<TouristSpot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [congestionRecords, setCongestionRecords] = useState<CongestionRecord[]>([]);

  // 混雑入力用状態
  const [congestionLevel, setCongestionLevel] = useState<number>(0);
  const [recordedAt, setRecordedAt] = useState<string>(new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState(false);

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

  // 混雑履歴を取得
  const fetchCongestionRecords = async () => {
    try {
      const response = await fetch(getApiUrl(`/tourist-spots/${spotId}/congestion`), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('混雑履歴の取得に失敗しました');
      const data = await response.json();
      setCongestionRecords(Array.isArray(data.records) ? data.records : []);
    } catch (err: any) {
      console.error('混雑履歴取得エラー:', err);
    }
  };

  // 混雑レベルを保存
  const handleSaveCongestion = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl(`/tourist-spots/${spotId}/congestion`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          level: congestionLevel,
          recorded_at: new Date(recordedAt).toISOString(),
          note: note.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '混雑レベルの保存に失敗しました');
      }

      // 保存成功後、履歴を再取得
      await fetchCongestionRecords();
      // 入力フィールドをリセット
      setCongestionLevel(0);
      setRecordedAt(new Date().toISOString().slice(0, 16));
      setNote('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchSpotDetail();
    fetchCongestionRecords();
  }, [spotId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        読み込み中...
      </div>
    );
  }

  if (!spot) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>観光地が見つかりません</p>
        <button onClick={onBack} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          戻る
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
        <button
          onClick={onBack}
          style={{
            padding: '10px 20px',
            background: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ← 戻る
        </button>
        <h1 style={{ margin: 0, color: '#1f2937' }}>{spot.name} - 詳細管理</h1>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '30px' }}>
        {/* 左側: 観光地情報 */}
        <div>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <h2 style={{ marginTop: 0, color: '#374151' }}>基本情報</h2>

            {spot.image_url && (
              <img
                src={spot.image_url}
                alt={spot.name}
                style={{
                  width: '100%',
                  maxWidth: '300px',
                  height: '200px',
                  objectFit: 'cover',
                  borderRadius: '6px',
                  marginBottom: '20px'
                }}
              />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <strong>カテゴリ:</strong> {spot.tourist_category ? `${spot.tourist_category.icon} ${spot.tourist_category.name}` : spot.category}
              </div>
              <div>
                <strong>座標:</strong> ({spot.x}, {spot.y})
              </div>
              <div>
                <strong>収容人数:</strong> {spot.current_count}/{spot.max_capacity}人
              </div>
              <div>
                <strong>営業時間:</strong> {spot.opening_time} - {spot.closing_time}
              </div>
              <div>
                <strong>入場料:</strong> ¥{spot.entry_fee.toLocaleString()}
              </div>
              <div>
                <strong>評価:</strong> ⭐{spot.rating}/5 ({spot.review_count}件)
              </div>
            </div>

            {spot.description && (
              <div style={{ marginTop: '15px' }}>
                <strong>説明:</strong>
                <p style={{ margin: '5px 0', lineHeight: '1.5' }}>{spot.description}</p>
              </div>
            )}

            {(spot.website || spot.phone_number) && (
              <div style={{ marginTop: '15px' }}>
                <strong>連絡先:</strong>
                <div style={{ marginTop: '5px' }}>
                  {spot.website && (
                    <a href={spot.website} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', marginRight: '20px' }}>
                      🌐 公式サイト
                    </a>
                  )}
                  {spot.phone_number && <span>TEL: {spot.phone_number}</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右側: 混雑管理 */}
        <div>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <h2 style={{ marginTop: 0, color: '#374151' }}>混雑度入力</h2>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                混雑レベル
              </label>
              <select
                value={congestionLevel}
                onChange={(e) => setCongestionLevel(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              >
                <option value={0}>0 - 混雑なし</option>
                <option value={1}>1 - やや混雑</option>
                <option value={2}>2 - 混雑</option>
                <option value={3}>3 - 非常に混雑</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                記録日時
              </label>
              <input
                type="datetime-local"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                メモ（任意）
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="混雑状況の詳細なメモ"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '16px',
                  resize: 'vertical'
                }}
              />
            </div>

            <button
              onClick={handleSaveCongestion}
              disabled={saving}
              style={{
                width: '100%',
                padding: '12px',
                background: saving ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              {saving ? '保存中...' : '混雑度を保存'}
            </button>
          </div>

          {/* 混雑履歴 */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, color: '#374151' }}>混雑履歴</h3>

            {congestionRecords.length === 0 ? (
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>まだ記録がありません</p>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {congestionRecords.map(record => (
                  <div key={record.id} style={{
                    padding: '10px',
                    borderBottom: '1px solid #f3f4f6',
                    marginBottom: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <strong>レベル: {record.level}</strong>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {new Date(record.recorded_at).toLocaleString('ja-JP')}
                      </span>
                    </div>
                    {record.note && (
                      <p style={{ margin: '5px 0', fontSize: '14px', color: '#4b5563' }}>
                        {record.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TouristSpotDetail;