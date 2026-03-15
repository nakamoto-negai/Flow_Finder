import React, { useState, useEffect } from 'react';
import { getApiUrl } from './config';
import { getAuthHeaders } from './api';

interface CategoryGroup {
  id: number;
  name: string;
  display_order: number;
  is_active: boolean;
}

interface TouristSpotCategory {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  display_order: number;
  is_active: boolean;
  group_id: number | null;
  group?: CategoryGroup;
}

interface CategorySelectorProps {
  onComplete: (selectedCategories?: string[]) => void;
}

const CategoryGrid: React.FC<{
  cats: TouristSpotCategory[];
  processing: Record<number, boolean>;
  completed: Record<number, boolean>;
  onAdd: (id: number, name: string) => void;
}> = ({ cats, processing, completed, onAdd }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '16px',
    padding: '20px',
    background: '#fafafa',
  }}>
    {cats.map(category => {
      const isDone = completed[category.id];
      const isProc = processing[category.id];
      return (
        <div
          key={category.id}
          style={{
            background: 'white',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            border: isDone ? `2px solid ${category.color}` : '2px solid transparent',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.13)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)'; }}
        >
          {/* カラーバー */}
          <div style={{ height: '6px', background: `linear-gradient(90deg, ${category.color}, ${category.color}99)` }} />

          <div style={{ padding: '18px' }}>
            {/* アイコン + 名前 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                background: `${category.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '24px',
              }}>
                {category.icon}
              </div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#1f2937', lineHeight: '1.3' }}>
                {category.name}
              </h3>
            </div>

            {/* 説明 */}
            {category.description && (
              <p style={{ margin: '0 0 14px 0', color: '#6b7280', fontSize: '13px', lineHeight: '1.6' }}>
                {category.description}
              </p>
            )}

            {/* ボタン */}
            <button
              onClick={() => onAdd(category.id, category.name)}
              disabled={isProc}
              style={{
                width: '100%',
                padding: '10px 0',
                background: isDone
                  ? `linear-gradient(135deg, #10b981, #059669)`
                  : isProc
                  ? '#d1d5db'
                  : `linear-gradient(135deg, ${category.color}, ${category.color}cc)`,
                color: isProc ? '#9ca3af' : 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: isProc ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                letterSpacing: '0.03em',
                boxShadow: isDone || isProc ? 'none' : `0 4px 12px ${category.color}55`,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => { if (!isProc) e.currentTarget.style.opacity = '0.88'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              {isDone ? '✅ 追加完了' : isProc ? '⏳ 追加中...' : '✚ 興味ある！'}
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

const CategorySelector: React.FC<CategorySelectorProps> = ({ onComplete }) => {
  const [categories, setCategories] = useState<TouristSpotCategory[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<number | 'ungrouped'>>(new Set());
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<Record<number, boolean>>({});
  const [completed, setCompleted] = useState<Record<number, boolean>>({});
  const [favoriteSpotIds, setFavoriteSpotIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // カテゴリー一覧を取得
  const fetchCategories = async () => {
    setLoading(true);
    try {
      const [catRes, groupRes] = await Promise.all([
        fetch(getApiUrl('/tourist-spot-categories'), { headers: getAuthHeaders() }),
        fetch(getApiUrl('/category-groups'), { headers: getAuthHeaders() }),
      ]);
      if (!catRes.ok) throw new Error('カテゴリーの取得に失敗しました');
      const data = await catRes.json();
      setCategories(Array.isArray(data) ? data.filter((cat: TouristSpotCategory) => cat.is_active) : []);
      if (groupRes.ok) {
        const groupData = await groupRes.json();
        const gs: CategoryGroup[] = Array.isArray(groupData) ? groupData : [];
        setGroups(gs);
        // 初期状態ですべてのグループを展開
        setExpandedGroupIds(new Set(gs.map(g => g.id as number | 'ungrouped')));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // カテゴリーの観光地を一括お気に入り登録
  const addCategoryToFavorites = async (categoryId: number, categoryName: string) => {
    setProcessing(prev => ({ ...prev, [categoryId]: true }));
    setError(null);

    try {
      // トグル動作: 既に完了状態なら一括解除、それ以外は追加
      if (completed[categoryId]) {
        // そのカテゴリーの観光地を取得
        const spotsRes = await fetch(getApiUrl(`/tourist-spots?category=${encodeURIComponent(categoryName)}`), {
          headers: getAuthHeaders(),
        });
        if (!spotsRes.ok) throw new Error('My地点の取得に失敗しました');
        const spots = await spotsRes.json();

        // favoriteSpotIds を使って対象のみ削除
        const toRemove = spots
          .map((s: any) => s.id)
          .filter((id: number) => favoriteSpotIds.has(id));

        // 並列で削除リクエストを送る
        await Promise.all(toRemove.map((id: number) =>
          fetch(getApiUrl(`/favorites/tourist-spots/${id}`), {
            method: 'DELETE',
            headers: getAuthHeaders(),
          })
        ));

        // UI更新
        setCompleted(prev => ({ ...prev, [categoryId]: false }));

        // favoriteSpotIds を更新（削除したものを取り除く）
        setFavoriteSpotIds(prev => {
          const next = new Set(prev);
          toRemove.forEach((id: number) => next.delete(id));
          return next;
        });
      } else {
        // 追加
        const response = await fetch(getApiUrl(`/favorites/categories/${categoryId}/add-all`), {
          method: 'POST',
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'My地点登録に失敗しました');
        }

        // 追加成功したら完了フラグを永続的に表示
        setCompleted(prev => ({ ...prev, [categoryId]: true }));

        // 最新の favorites を再取得して favoriteSpotIds を更新
        const favRes = await fetch(getApiUrl('/favorites/tourist-spots'), { headers: getAuthHeaders() });
        if (favRes.ok) {
          const favData = await favRes.json();
          const ids = new Set<number>(favData.map((f: any) => f.tourist_spot_id));
          setFavoriteSpotIds(ids);
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setProcessing(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // 初回ロード時にユーザーのお気に入りを取得して各カテゴリーの状態を決める
  useEffect(() => {
    const fetchFavoritesAndSet = async () => {
      try {
        const favRes = await fetch(getApiUrl('/favorites/tourist-spots'), { headers: getAuthHeaders() });
        if (!favRes.ok) return;
        const favData = await favRes.json();
        const favIds = new Set<number>(favData.map((f: any) => f.tourist_spot_id));
        setFavoriteSpotIds(favIds);

        // 各カテゴリーの観光地を取得して、1つでもお気に入りなら completed を true にする
        await Promise.all(categories.map(async (cat) => {
          const spotsRes = await fetch(getApiUrl(`/tourist-spots?category=${encodeURIComponent(cat.name)}`), {
            headers: getAuthHeaders(),
          });
          if (!spotsRes.ok) return;
          const spots = await spotsRes.json();
          const hasFavorite = spots.some((s: any) => favIds.has(s.id));
          if (hasFavorite) {
            setCompleted(prev => ({ ...prev, [cat.id]: true }));
          }
        }));
      } catch (e) {
        // ignore
      }
    };

    if (categories.length > 0) fetchFavoritesAndSet();
  }, [categories]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'white',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '40px'
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '16px'
          }}>
            興味のあるカテゴリーを選択
          </h1>
          <button
            onClick={() => onComplete([])}
            style={{
              padding: '10px 24px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            スキップ →
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              onClick={() => {
                
                window.location.href = '/tutorials';
                
              }}
              style={{ marginTop: 8, padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8,marginBottom: '20px' }}
            >
              チュートリアルを見る
            </button>
          </div>
        {error && (
          <div style={{
            padding: '12px',
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
            カテゴリーを読み込み中...
          </div>
        ) : categories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
            利用可能なカテゴリーがありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* グループあり: アコーディオン */}
            {groups.map((g) => {
              const groupCats = categories
                .filter(cat => cat.group_id === g.id)
                .sort((a, b) => a.display_order - b.display_order);
              if (groupCats.length === 0) return null;
              const isOpen = expandedGroupIds.has(g.id);
              return (
                <div key={g.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <button
                    onClick={() => {
                      setExpandedGroupIds(prev => {
                        const next = new Set(prev);
                        if (next.has(g.id)) next.delete(g.id); else next.add(g.id);
                        return next;
                      });
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 8px',
                      background: 'white',
                      border: 'none', cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white'; }}
                  >
                    <span style={{ fontSize: '17px', fontWeight: 'bold', color: '#1f2937' }}>
                      {g.name}
                    </span>
                    <span style={{
                      fontSize: '16px', color: '#9ca3af',
                      display: 'inline-block',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.3s',
                    }}>▾</span>
                  </button>
                  {isOpen && <CategoryGrid cats={groupCats} processing={processing} completed={completed} onAdd={addCategoryToFavorites} />}
                </div>
              );
            })}

            {/* グループなし: ヘッダーなしで直接表示 */}
            {(() => {
              const ungrouped = categories
                .filter(cat => cat.group_id === null)
                .sort((a, b) => a.display_order - b.display_order);
              if (ungrouped.length === 0) return null;
              return <CategoryGrid cats={ungrouped} processing={processing} completed={completed} onAdd={addCategoryToFavorites} />;
            })()}
          </div>
        )}

        <div style={{
          textAlign: 'center',
          marginTop: '40px'
        }}>
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            style={{
              padding: '14px 32px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: 'bold'
            }}
          >
            マップを見る
          </button>

          
        </div>
      </div>
    </div>
  );
};

export default CategorySelector;