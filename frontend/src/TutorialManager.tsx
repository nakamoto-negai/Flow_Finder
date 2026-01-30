import React, { useEffect, useState } from 'react';
import { getApiUrl, API_BASE_URL } from './config';
import { getAuthHeadersForFormData, getAuthHeaders } from './api';

interface Tutorial {
  id: number;
  title: string;
  description?: string;
  file_name?: string;
  file_path?: string;
  mime_type?: string;
  order?: number;
  is_active?: boolean;
  category?: string;
  url?: string;
}

const TutorialManager: React.FC = () => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [order, setOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchTutorials(); }, []);

  const fetchTutorials = async () => {
    try {
      const res = await fetch(getApiUrl('/tutorials'));
      if (!res.ok) throw new Error('チュートリアルの取得に失敗しました');
      const data = await res.json();
      setTutorials(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || 'エラー');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f && !f.type.startsWith('image/')) {
      setError('画像ファイルのみ選択してください');
      return;
    }
    setSelectedFile(f);
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) { setError('ファイルを選択してください'); return; }
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('title', title || selectedFile.name);
      fd.append('description', description);
      fd.append('category', category);
      fd.append('order', String(order));
      fd.append('is_active', isActive ? 'true' : 'false');

      const res = await fetch(getApiUrl('/tutorials/upload'), {
        method: 'POST',
        body: fd,
        headers: getAuthHeadersForFormData(),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'アップロードに失敗しました');
      }

      // reset
      setSelectedFile(null); setTitle(''); setDescription(''); setOrder(0); setCategory('general'); setIsActive(true);
      const fileInput = document.getElementById('tutorial-file-input') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      await fetchTutorials();
    } catch (e: any) {
      setError(e.message || 'エラー');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('このチュートリアルを削除しますか？')) return;
    try {
      const res = await fetch(getApiUrl(`/tutorials/${id}`), { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('削除に失敗しました');
      await fetchTutorials();
    } catch (e: any) { setError(e.message || 'エラー'); }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 16 }}>チュートリアル管理</h2>

      <div style={{ background: 'white', padding: 16, borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <h3>新しいチュートリアルを追加</h3>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>画像ファイル *</label>
          <input id="tutorial-file-input" type="file" accept="image/*" onChange={handleFileChange} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>タイトル</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>説明</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6 }}>カテゴリ</label>
            <input value={category} onChange={e => setCategory(e.target.value)} style={{ padding: 8 }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6 }}>表示順</label>
            <input type="number" value={order} onChange={e => setOrder(Number(e.target.value))} style={{ padding: 8, width: 100 }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6 }}>有効</label>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
          </div>
        </div>

        {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}

        <button onClick={handleUpload} disabled={loading || !selectedFile} style={{ padding: '8px 14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6 }}>
          {loading ? 'アップロード中...' : 'アップロード'}
        </button>
      </div>

      <div style={{ background: 'white', padding: 16, borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <h3>登録済みチュートリアル</h3>
        {tutorials.length === 0 ? (
          <p style={{ color: '#6b7280' }}>チュートリアルがありません</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {tutorials.map(t => (
              <div key={t.id} style={{ display: 'flex', gap: 12, alignItems: 'center', border: '1px solid #e5e7eb', padding: 12, borderRadius: 8 }}>
                <div style={{ width: 120, height: 80, overflow: 'hidden', background: '#f3f4f6' }}>
                  <img src={t.url || `${API_BASE_URL}${t.file_path || ''}`} alt={t.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3C/svg%3E'; }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{t.title}</div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>{t.description}</div>
                  <div style={{ color: '#9ca3af', fontSize: 12 }}>カテゴリ: {t.category} ・ 表示順: {t.order}</div>
                </div>
                <div>
                  <button onClick={() => handleDelete(t.id)} style={{ padding: '6px 10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6 }}>削除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TutorialManager;
