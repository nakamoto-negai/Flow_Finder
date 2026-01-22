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

interface CongestionRecord {
  id: number;
  tourist_spot_id: number;
  level: number;
  recorded_at: string;
  note: string;
  created_at: string;
  updated_at: string;
}

interface CongestionManagerProps {
  onViewDetail?: (spotId: number) => void;
}

const CongestionManager: React.FC<CongestionManagerProps> = ({ onViewDetail }) => {
  const [touristSpots, setTouristSpots] = useState<TouristSpot[]>([]);
  const [congestionData, setCongestionData] = useState<Record<number, CongestionRecord[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 観光地一覧を取得
  const fetchTouristSpots = async () => {
    try {
      const response = await fetch(getApiUrl('/tourist-spots'));
      if (!response.ok) throw new Error('観光地の取得に失敗しました');
      const data = await response.json();
      setTouristSpots(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setTouristSpots([]);
      setError(err.message);
    }
  };

  // 指定観光地の混雑履歴を取得
  const fetchCongestionForSpot = async (spotId: number) => {
    try {
      const response = await fetch(getApiUrl(`/tourist-spots/${spotId}/congestion`), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return;
      const data = await response.json();
      const records = Array.isArray(data.records) ? data.records : [];
      setCongestionData(prev => ({ ...prev, [spotId]: records }));
    } catch (err) {
      console.error('混雑履歴取得エラー:', err);
    }
  };

  // 全ての観光地の混雑履歴を取得
  const fetchAllCongestionData = async () => {
    setLoading(true);
    setError(null);
    try {
      for (const spot of touristSpots) {
        await fetchCongestionForSpot(spot.id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTouristSpots();
  }, []);

  useEffect(() => {
    if (touristSpots.length > 0) {
      fetchAllCongestionData();
    }
  }, [touristSpots]);

  const getCongestionLevelText = (level: number) => {
    switch (level) {
      case 0: return '混雑なし';
      case 1: return 'やや混雑';
      case 2: return '混雑';
      case 3: return '非常に混雑';
      default: return '不明';
    }
  };

  const getCongestionLevelColor = (level: number) => {
    switch (level) {
      case 0: return '#16a34a';
      case 1: return '#ca8a04';
      case 2: return '#ea580c';
      case 3: return '#dc2626';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>混雑度管理</h2>

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

      {/* 更新ボタン */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={fetchAllCongestionData}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: '500'
          }}
        >
          {loading ? '更新中...' : '📊 データを更新'}
        </button>
      </div>

      {/* 観光地一覧 */}
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
          観光地別混雑履歴 ({touristSpots.length}件)
        </h3>

        {touristSpots.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            観光地が登録されていません
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {touristSpots.map(spot => {
              const records = congestionData[spot.id] || [];
              const latestRecord = records.length > 0 ? records[0] : null;

              return (
                <div key={spot.id} style={{
                  padding: '15px 20px',
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '15px'
                }}>
                  {/* 観光地情報 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, color: '#1f2937' }}>{spot.name}</h4>
                      {spot.tourist_category && (
                        <span style={{
                          padding: '2px 8px',
                          background: spot.tourist_category.color + '20',
                          color: spot.tourist_category.color,
                          borderRadius: '12px',
                          fontSize: '12px',
                          border: `1px solid ${spot.tourist_category.color}40`
                        }}>
                          {spot.tourist_category.icon} {spot.tourist_category.name}
                        </span>
                      )}
                      {!spot.is_open && (
                        <span style={{
                          padding: '2px 8px',
                          background: '#dc2626',
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}>
                          閉場中
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                      {spot.description && <div style={{ marginBottom: '4px' }}>{spot.description}</div>}
                      <div>
                        <strong>収容:</strong> {spot.current_count}/{spot.max_capacity}人
                      </div>
                    </div>

                    {/* 最新の混雑情報 */}
                    {latestRecord && (
                      <div style={{ marginTop: '10px', padding: '10px', background: '#f9fafb', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                          <span style={{ fontWeight: '500', color: '#374151' }}>最新の混雑状況:</span>
                          <span style={{
                            padding: '2px 8px',
                            background: getCongestionLevelColor(latestRecord.level),
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}>
                            {getCongestionLevelText(latestRecord.level)}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          記録日時: {formatDate(latestRecord.recorded_at)}
                          {latestRecord.note && <span style={{ marginLeft: '15px' }}>メモ: {latestRecord.note}</span>}
                        </div>
                      </div>
                    )}

                    {/* 混雑履歴 */}
                    {records.length > 0 && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                          履歴 ({records.length}件)
                        </div>
                        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                          {records.map((record) => (
                            <div key={record.id} style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid #f3f4f6',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{
                                  padding: '1px 6px',
                                  background: getCongestionLevelColor(record.level),
                                  color: 'white',
                                  borderRadius: '8px',
                                  fontSize: '11px'
                                }}>
                                  {getCongestionLevelText(record.level)}
                                </span>
                                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                  {formatDate(record.recorded_at)}
                                </span>
                              </div>
                              {record.note && (
                                <span style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                  {record.note}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {records.length === 0 && (
                      <div style={{ marginTop: '10px', padding: '10px', background: '#fef3c7', borderRadius: '6px', color: '#92400e' }}>
                        まだ混雑記録がありません
                      </div>
                    )}
                  </div>

                  {/* 操作ボタン */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => onViewDetail?.(spot.id)}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      混雑度入力
                    </button>
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

export default CongestionManager;