import React, { useState, useEffect } from 'react';
import { getApiUrl } from './config';
import { getAuthHeaders } from './api';

interface CategoryGroup {
  id: number;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CategoryGroupManager: React.FC = () => {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null);
  const [formData, setFormData] = useState({ name: '', display_order: 0, is_active: true });

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl('/category-groups'), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('グループの取得に失敗しました');
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const saveGroup = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = editingGroup
        ? getApiUrl(`/category-groups/${editingGroup.id}`)
        : getApiUrl('/category-groups');
      const method = editingGroup ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || '保存に失敗しました');
      }
      await fetchGroups();
      handleCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const deleteGroup = async (id: number) => {
    if (!window.confirm('このグループを削除しますか？\n紐づくカテゴリーのグループ設定は解除されます。')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl(`/category-groups/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok && res.status !== 204) throw new Error('削除に失敗しました');
      await fetchGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (group: CategoryGroup) => {
    setEditingGroup(group);
    setFormData({ name: group.name, display_order: group.display_order, is_active: group.is_active });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingGroup(null);
    setFormData({ name: '', display_order: 0, is_active: true });
  };

  useEffect(() => { fetchGroups(); }, []);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>カテゴリーグループ管理</h2>
        <button
          onClick={() => setShowForm(true)}
          disabled={loading}
          style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
        >
          新しいグループを追加
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '4px', color: '#dc2626', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {showForm && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0 }}>{editingGroup ? 'グループ編集' : 'グループ作成'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>グループ名 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="例: 自然・景観"
                style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>表示順序</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={e => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                min="0"
                style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
            />
            アクティブ
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={saveGroup}
              disabled={loading || !formData.name.trim()}
              style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
            >
              {loading ? '処理中...' : editingGroup ? '更新' : '作成'}
            </button>
            <button
              onClick={handleCancel}
              style={{ padding: '10px 20px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {loading && groups.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>読み込み中...</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>グループがありません</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>順序</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>グループ名</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>状態</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>作成日</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <tr key={group.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px' }}>{group.display_order}</td>
                  <td style={{ padding: '12px', fontWeight: '500' }}>{group.name}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500',
                      background: group.is_active ? '#dcfce7' : '#fee2e2',
                      color: group.is_active ? '#15803d' : '#dc2626',
                    }}>
                      {group.is_active ? 'アクティブ' : '無効'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#6b7280' }}>
                    {new Date(group.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => startEdit(group)}
                        style={{ padding: '4px 8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deleteGroup(group.id)}
                        style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
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

export default CategoryGroupManager;
