import React, { useEffect, useState } from 'react';
import { getApiUrl } from './config';

interface Tutorial {
  id: number;
  title: string;
  description?: string;
  file_name?: string;
  url?: string;
  category?: string;
}

const TutorialViewer: React.FC = () => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  const getCategoriesFromQuery = (): string[] => {
    const params = new URLSearchParams(window.location.search);
    const csv = params.get('categories') || params.get('category') || '';
    if (!csv) return [];
    return csv.split(',').map(s => decodeURIComponent(s).trim()).filter(Boolean);
  };

  useEffect(() => {
    const categories = getCategoriesFromQuery();
    const fetchAndFilter = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = getApiUrl('/tutorials');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: チュートリアルの読み込みに失敗しました`);
        const data = await res.json();
        let list: Tutorial[] = Array.isArray(data) ? data : [];
        if (categories.length > 0) {
          const lower = categories.map(c => c.toLowerCase());
          list = list.filter(t => t.category && lower.includes(t.category.toLowerCase()));
        }
        setTutorials(list);
        setCurrentIndex(0);
        setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラーが発生しました');
        setLoading(false);
      }
    };
    fetchAndFilter();
  }, []);

  const goToPrevious = () => { setImgSize(null); setCurrentIndex(i => Math.max(0, i - 1)); };
  const goToNext = () => { setImgSize(null); setCurrentIndex(i => Math.min(tutorials.length - 1, i + 1)); };

  if (loading) return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>読み込み中...</div>;
  if (error) return <div style={{ minHeight: '60vh', color: '#c00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>エラー: {error}</div>;
  if (tutorials.length === 0) return <div style={{ minHeight: '60vh', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>チュートリアルが見つかりません</div>;

  const t = tutorials[currentIndex];

  return (
    <div style={{ padding: 20, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: imgSize ? imgSize.w : 880 }}>
        <div style={{ border: '1px solid #e6e6e6', borderRadius: 8, overflow: 'hidden', background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }}>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={t.url}
              alt={t.title}
              onLoad={(e) => {
                const img = e.currentTarget;
                setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>

          <div style={{ padding: '20px 24px' }}>
            {t.description && <p style={{ margin: 0, color: '#444', lineHeight: 1.5 }}>{t.description}</p>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
            <div>
              <button
                onClick={() => {
                  if (currentIndex === 0) window.history.back();
                  else goToPrevious();
                }}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
              >
                ← 戻る
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: '#666', fontSize: 14 }}>{currentIndex + 1} / {tutorials.length}</div>
              <button
                onClick={() => {
                  if (currentIndex === tutorials.length - 1) window.history.back();
                  else goToNext();
                }}
                style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#007bff', color: '#fff', cursor: 'pointer' }}
              >
                {currentIndex === tutorials.length - 1 ? '完了' : '次へ →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialViewer;
