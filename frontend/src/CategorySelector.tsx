import React, { useState, useEffect } from 'react';
import { getApiUrl } from './config';
import { getAuthHeaders } from './api';

interface TouristSpotCategory {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  display_order: number;
  is_active: boolean;
}

interface CategorySelectorProps {
  onComplete: () => void;
}

const CategorySelector: React.FC<CategorySelectorProps> = ({ onComplete }) => {
  const [categories, setCategories] = useState<TouristSpotCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<Record<number, boolean>>({});
  const [completed, setCompleted] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // カテゴリー一覧を取得
  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/tourist-spot-categories'), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('カテゴリーの取得に失敗しました');
      const data = await response.json();
      setCategories(Array.isArray(data) ? data.filter(cat => cat.is_active) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // カテゴリーの観光地を一括お気に入り登録
  const addCategoryToFavorites = async (categoryId: number) => {
    setProcessing(prev => ({ ...prev, [categoryId]: true }));
    setError(null);

    try {
      const response = await fetch(getApiUrl(`/favorites/categories/${categoryId}/add-all`), {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'お気に入り登録に失敗しました');
      }

      await response.json(); // レスポンスを消費
      setCompleted(prev => ({ ...prev, [categoryId]: true }));
      
      // 成功メッセージを一時的に表示
      setTimeout(() => {
        setCompleted(prev => ({ ...prev, [categoryId]: false }));
      }, 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setProcessing(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
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
          <p style={{
            fontSize: '18px',
            color: '#6b7280',
            marginBottom: '20px'
          }}>
            気になるカテゴリーの「興味ある！」ボタンを押すと、<br />
            そのカテゴリーの観光地をまとめてお気に入りに追加できます
          </p>
          <button
            onClick={onComplete}
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
            後でスキップ →
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {categories
              .sort((a, b) => a.display_order - b.display_order)
              .map((category) => (
                <div
                  key={category.id}
                  style={{
                    background: 'white',
                    border: `2px solid ${category.color}20`,
                    borderRadius: '12px',
                    padding: '24px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    transition: 'all 0.3s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      fontSize: '32px',
                      marginRight: '12px'
                    }}>
                      {category.icon}
                    </div>
                    <div style={{
                      flex: 1
                    }}>
                      <h3 style={{
                        margin: 0,
                        fontSize: '20px',
                        fontWeight: 'bold',
                        color: category.color
                      }}>
                        {category.name}
                      </h3>
                    </div>
                  </div>
                  
                  {category.description && (
                    <p style={{
                      margin: '0 0 20px 0',
                      color: '#6b7280',
                      fontSize: '14px',
                      lineHeight: '1.5'
                    }}>
                      {category.description}
                    </p>
                  )}

                  <button
                    onClick={() => addCategoryToFavorites(category.id)}
                    disabled={processing[category.id] || completed[category.id]}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: completed[category.id] 
                        ? '#10b981' 
                        : processing[category.id]
                        ? '#9ca3af'
                        : category.color,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: processing[category.id] || completed[category.id] ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (!processing[category.id] && !completed[category.id]) {
                        e.currentTarget.style.opacity = '0.9';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    {completed[category.id] ? (
                      <>
                        ✅ 追加完了
                      </>
                    ) : processing[category.id] ? (
                      <>
                        ⏳ 追加中...
                      </>
                    ) : (
                      <>
                        興味ある！
                      </>
                    )}
                  </button>
                </div>
              ))}
          </div>
        )}

        <div style={{
          textAlign: 'center',
          marginTop: '40px'
        }}>
          <button
            onClick={onComplete}
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