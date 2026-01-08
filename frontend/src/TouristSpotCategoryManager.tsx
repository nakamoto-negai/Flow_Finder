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
  created_at: string;
  updated_at: string;
}

const TouristSpotCategoryManager: React.FC = () => {
  const [categories, setCategories] = useState<TouristSpotCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TouristSpotCategory | null>(null);

  // フォームデータ
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    color: '#3b82f6',
    display_order: 0,
    is_active: true
  });

  // カテゴリ一覧を取得
  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(getApiUrl('/tourist-spot-categories'), {
        headers: {
          ...getAuthHeaders(),
        },
      });
      
      if (!response.ok) {
        throw new Error('カテゴリーの取得に失敗しました');
      }
      
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoading(false);
    }
  };

  // カテゴリ作成
  const createCategory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(getApiUrl('/tourist-spot-categories'), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'カテゴリーの作成に失敗しました');
      }
      
      await fetchCategories();
      setShowCreateForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // カテゴリ更新
  const updateCategory = async () => {
    if (!editingCategory) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(getApiUrl(`/tourist-spot-categories/${editingCategory.id}`), {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'カテゴリーの更新に失敗しました');
      }
      
      await fetchCategories();
      setEditingCategory(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // カテゴリ削除
  const deleteCategory = async (id: number) => {
    if (!window.confirm('このカテゴリーを削除しますか？')) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(getApiUrl(`/tourist-spot-categories/${id}`), {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'カテゴリーの削除に失敗しました');
      }
      
      await fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // フォームをリセット
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon: '',
      color: '#3b82f6',
      display_order: 0,
      is_active: true
    });
  };

  // 編集開始
  const startEdit = (category: TouristSpotCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      display_order: category.display_order,
      is_active: category.is_active
    });
    setShowCreateForm(true);
  };

  // キャンセル
  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingCategory(null);
    resetForm();
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>観光地カテゴリー管理</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          新しいカテゴリーを追加
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '4px',
          color: '#dc2626',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* カテゴリー作成・編集フォーム */}
      {showCreateForm && (
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <h3>{editingCategory ? 'カテゴリー編集' : 'カテゴリー作成'}</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                カテゴリー名 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                placeholder="例: 神社・寺院"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                アイコン
              </label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({...formData, icon: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                placeholder="例: ⛩️"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                表示色
              </label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({...formData, color: e.target.value})}
                style={{
                  width: '100%',
                  padding: '4px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  height: '38px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                表示順序
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({...formData, display_order: parseInt(e.target.value) || 0})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                min="0"
              />
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              説明
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
                resize: 'vertical'
              }}
              placeholder="カテゴリーの説明"
            />
          </div>

          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              />
              アクティブ
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              onClick={editingCategory ? updateCategory : createCategory}
              disabled={loading || !formData.name.trim()}
              style={{
                padding: '10px 20px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              {loading ? '処理中...' : (editingCategory ? '更新' : '作成')}
            </button>
            <button
              onClick={handleCancel}
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
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* カテゴリー一覧 */}
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {loading && categories.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            読み込み中...
          </div>
        ) : categories.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            カテゴリーがありません
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>順序</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>カテゴリー名</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>アイコン</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>色</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>説明</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>状態</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>作成日</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px' }}>{category.display_order}</td>
                  <td style={{ padding: '12px', fontWeight: '500' }}>{category.name}</td>
                  <td style={{ padding: '12px', fontSize: '18px' }}>{category.icon}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: category.color,
                      borderRadius: '4px',
                      border: '1px solid #e5e7eb'
                    }} title={category.color} />
                  </td>
                  <td style={{ padding: '12px', maxWidth: '200px' }}>
                    <div style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {category.description}
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: category.is_active ? '#dcfce7' : '#fee2e2',
                      color: category.is_active ? '#15803d' : '#dc2626'
                    }}>
                      {category.is_active ? 'アクティブ' : '無効'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#6b7280' }}>
                    {new Date(category.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => startEdit(category)}
                        style={{
                          padding: '4px 8px',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deleteCategory(category.id)}
                        style={{
                          padding: '4px 8px',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TouristSpotCategoryManager;