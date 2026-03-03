import React, { useState, useEffect } from 'react';
import { getApiUrl, API_BASE_URL, STATIC_BASE_URL } from './config';
import { getAuthHeaders, getAuthHeadersForFormData } from './api';

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
  reward_url: string;
  rating: number;
  review_count: number;
  last_updated: string;
  created_at: string;
  updated_at: string;
}

interface Node {
  id: number;
  name: string;
  x: number;
  y: number;
  congestion: number;
  tourist: boolean;
  field_id?: number;
}

interface TouristSpotCategory {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  display_order: number;
  is_active: boolean;
}

const TouristSpotManager: React.FC = () => {
  const [touristSpots, setTouristSpots] = useState<TouristSpot[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [categories, setCategories] = useState<TouristSpotCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSpot, setEditingSpot] = useState<TouristSpot | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // お気に入り機能用の状態
  const [favoriteStates, setFavoriteStates] = useState<Record<number, boolean>>({});
  const [favoriteLoading, setFavoriteLoading] = useState<Record<number, boolean>>({});

  // 新規作成/編集用のフォームデータ
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    category_id: '',
    nearest_node_id: '',
    x: 0,
    y: 0,
    max_capacity: 100,
    current_count: 0,
    is_open: true,
    opening_time: '09:00',
    closing_time: '18:00',
    entry_fee: 0,
    website: '',
    phone_number: '',
    image_url: '',
    reward_url: '',
    rating: 0
  });

  // カテゴリー一覧を取得
  const fetchCategories = async () => {
    try {
      const response = await fetch(getApiUrl('/tourist-spot-categories'), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('カテゴリーの取得に失敗しました');
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('カテゴリー取得エラー:', err);
      setCategories([]);
    }
  };

  // データ取得
  useEffect(() => {
    fetchTouristSpots();
    fetchNodes();
    fetchCategories();
  }, []);

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

  const fetchNodes = async () => {
    try {
      const response = await fetch(getApiUrl('/nodes'));
      if (!response.ok) throw new Error('ノードの取得に失敗しました');
      const data = await response.json();
      setNodes(Array.isArray(data) ? data : []);
    } catch (err) {
      setNodes([]);
      console.error('ノード取得エラー:', err);
    }
  };

  // お気に入り状態を確認する関数
  const checkFavoriteStatus = async (spotId: number) => {
    try {
      const response = await fetch(getApiUrl(`/favorites/tourist-spots/${spotId}/check`));
      if (response.ok) {
        const data = await response.json();
        setFavoriteStates(prev => ({ ...prev, [spotId]: data.is_favorite }));
      }
    } catch (err) {
      console.error('お気に入り状態確認エラー:', err);
    }
  };

  // 観光地取得時にお気に入り状態もチェック
  useEffect(() => {
    if (touristSpots.length > 0) {
      touristSpots.forEach(spot => checkFavoriteStatus(spot.id));
    }
  }, [touristSpots]);

  // お気に入りの追加/削除
  const toggleFavorite = async (spotId: number) => {
    setFavoriteLoading(prev => ({ ...prev, [spotId]: true }));
    
    try {
      const isFavorite = favoriteStates[spotId];
      
      if (isFavorite) {
        // お気に入りから削除
        const response = await fetch(getApiUrl(`/favorites/tourist-spots/${spotId}`), {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        
        if (response.ok) {
          setFavoriteStates(prev => ({ ...prev, [spotId]: false }));
        } else {
          setError('お気に入りの削除に失敗しました');
        }
      } else {
        // お気に入りに追加
        const response = await fetch(getApiUrl('/favorites/tourist-spots'), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ 
            tourist_spot_id: spotId,
            notes: '',
            priority: 1
          }),
        });
        
        if (response.ok) {
          setFavoriteStates(prev => ({ ...prev, [spotId]: true }));
        } else {
          const errorData = await response.json();
          setError(errorData.error || 'お気に入りの追加に失敗しました');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFavoriteLoading(prev => ({ ...prev, [spotId]: false }));
    }
  };

  // フォームのリセット
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      category_id: '',
      nearest_node_id: '',
      x: 0,
      y: 0,
      max_capacity: 100,
      current_count: 0,
      is_open: true,
      opening_time: '09:00',
      closing_time: '18:00',
      entry_fee: 0,
      website: '',
      phone_number: '',
      image_url: '',
      reward_url: '',
      rating: 0
    });
    setEditingSpot(null);
    setShowCreateForm(false);
    setError(null);
    setSelectedFile(null);
  };

  // ファイル選択処理
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // ファイルサイズチェック（5MB以下）
      if (file.size > 5 * 1024 * 1024) {
        setError('ファイルサイズは5MB以下にしてください');
        return;
      }
      
      // ファイル形式チェック
      if (!file.type.startsWith('image/')) {
        setError('画像ファイルを選択してください');
        return;
      }
      
      setSelectedFile(file);
      setError(null);
    }
  };

  // 画像アップロード処理
  const uploadImage = async (): Promise<string | null> => {
    if (!selectedFile) return null;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      // 画像アップロードAPI（ファイルストレージ）を使用
      const response = await fetch(getApiUrl('/upload'), {
        method: 'POST',
        headers: getAuthHeadersForFormData(),
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '画像のアップロードに失敗しました');
      }

      const data = await response.json();
      const imageUrl = data.image_url || data.url;
      // 相対パスを絶対URLに変換
      return imageUrl.startsWith('http') ? imageUrl : `${STATIC_BASE_URL}${imageUrl}`;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  // 新規作成
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      setError('観光地名は必須です');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let imageUrl = formData.image_url;
      
      // ファイルが選択されている場合はアップロード
      if (selectedFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const submitData = {
        ...formData,
        image_url: imageUrl,
        nearest_node_id: formData.nearest_node_id ? Number(formData.nearest_node_id) : null,
        category_id: formData.category_id ? Number(formData.category_id) : null
      };

      const response = await fetch(getApiUrl('/tourist-spots'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '作成に失敗しました');
      }

      await fetchTouristSpots();
      resetForm();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 編集開始
  const handleEdit = (spot: TouristSpot) => {
    setFormData({
      name: spot.name,
      description: spot.description,
      category: spot.category,
      category_id: spot.category_id?.toString() || '',
      nearest_node_id: spot.nearest_node_id?.toString() || '',
      x: spot.x,
      y: spot.y,
      max_capacity: spot.max_capacity,
      current_count: spot.current_count,
      is_open: spot.is_open,
      opening_time: spot.opening_time,
      closing_time: spot.closing_time,
      entry_fee: spot.entry_fee,
      website: spot.website,
      phone_number: spot.phone_number,
      image_url: spot.image_url,
      reward_url: spot.reward_url,
      rating: spot.rating
    });
    setEditingSpot(spot);
    setShowCreateForm(true);
  };

  // 更新
  const handleUpdate = async () => {
    if (!editingSpot) return;

    setLoading(true);
    setError(null);

    try {
      let imageUrl = formData.image_url;
      
      // ファイルが選択されている場合はアップロード
      if (selectedFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const submitData = {
        ...formData,
        image_url: imageUrl,
        nearest_node_id: formData.nearest_node_id ? Number(formData.nearest_node_id) : null,
        category_id: formData.category_id ? Number(formData.category_id) : null
      };

      const response = await fetch(getApiUrl(`/tourist-spots/${editingSpot.id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新に失敗しました');
      }

      await fetchTouristSpots();
      resetForm();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 削除
  const handleDelete = async (id: number) => {
    if (!confirm('この観光地を削除しますか？')) return;

    try {
      const response = await fetch(getApiUrl(`/tourist-spots/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error('削除に失敗しました');
      
      await fetchTouristSpots();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // 来場者数の増減
  const handleVisitorChange = async (spotId: number, change: number) => {
    try {
      const response = await fetch(getApiUrl(`/tourist-spots/${spotId}/visitors`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ count: change }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '来場者数の更新に失敗しました');
      }

      await fetchTouristSpots();
    } catch (err: any) {
      setError(err.message);
    }
  };

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>観光地管理</h2>

      {/* 作成ボタン */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowCreateForm(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          ➕ 新しい観光地を追加
        </button>
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

      {/* 作成/編集フォーム */}
      {showCreateForm && (
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '8px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginBottom: '20px', color: '#374151' }}>
            {editingSpot ? '観光地を編集' : '新しい観光地を作成'}
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
            {/* 基本情報 */}
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                観光地名 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
                placeholder="観光地名を入力"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                カテゴリ
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => {
                  const categoryId = e.target.value;
                  const selectedCategory = categories.find(cat => cat.id.toString() === categoryId);
                  setFormData({ 
                    ...formData, 
                    category_id: categoryId,
                    category: selectedCategory ? selectedCategory.name : ''
                  });
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              >
                <option value="">カテゴリを選択</option>
                {categories.filter(cat => cat.is_active).map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                最寄りノード
              </label>
              <select
                value={formData.nearest_node_id}
                onChange={(e) => setFormData({ ...formData, nearest_node_id: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              >
                <option value="">ノードを選択</option>
                {nodes.map(node => (
                  <option key={node.id} value={node.id}>
                    {node.name} (ID: {node.id})
                  </option>
                ))}
              </select>
            </div>

            {/* 座標 */}
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                X座標
              </label>
              <input
                type="number"
                value={formData.x}
                onChange={(e) => setFormData({ ...formData, x: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                Y座標
              </label>
              <input
                type="number"
                value={formData.y}
                onChange={(e) => setFormData({ ...formData, y: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
            </div>

            {/* 収容関連 */}
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                最大収容人数
              </label>
              <input
                type="number"
                min="0"
                value={formData.max_capacity}
                onChange={(e) => setFormData({ ...formData, max_capacity: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                現在の来場者数
              </label>
              <input
                type="number"
                min="0"
                value={formData.current_count}
                onChange={(e) => setFormData({ ...formData, current_count: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
            </div>

            {/* 営業時間 */}
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                開場時間
              </label>
              <input
                type="time"
                value={formData.opening_time}
                onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                閉場時間
              </label>
              <input
                type="time"
                value={formData.closing_time}
                onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
            </div>

            {/* その他情報 */}
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                入場料（円）
              </label>
              <input
                type="number"
                min="0"
                value={formData.entry_fee}
                onChange={(e) => setFormData({ ...formData, entry_fee: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                評価（0-5）
              </label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
            </div>
          </div>

          {/* 全幅フィールド */}
          <div style={{ marginTop: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              説明
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                minHeight: '80px',
                resize: 'vertical'
              }}
              placeholder="観光地の説明を入力"
            />
          </div>

          <div style={{ marginTop: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              公式サイト
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
              placeholder="https://example.com"
            />
          </div>

          <div style={{ marginTop: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              電話番号
            </label>
            <input
              type="tel"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
              placeholder="03-1234-5678"
            />
          </div>

          <div style={{ marginTop: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              特典ページURL
            </label>
            <input
              type="url"
              value={formData.reward_url}
              onChange={(e) => setFormData({ ...formData, reward_url: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
              placeholder="https://example.com/reward"
            />
          </div>

          <div style={{ marginTop: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              画像
            </label>
            
            {/* ファイル選択 */}
            <div style={{ marginBottom: '10px' }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
              {selectedFile && (
                <div style={{ 
                  marginTop: '8px', 
                  fontSize: '14px', 
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  選択済み: {selectedFile.name}
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    style={{
                      padding: '2px 6px',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    削除
                  </button>
                </div>
              )}
            </div>

            {/* または、URL入力 */}
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
              または画像URLを入力:
            </div>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
              placeholder="https://example.com/image.jpg"
            />
            
            {/* 画像プレビュー */}
            {(formData.image_url || selectedFile) && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>
                  プレビュー:
                </div>
                {selectedFile ? (
                  <img
                    src={URL.createObjectURL(selectedFile)}
                    alt="選択された画像"
                    style={{
                      maxWidth: '200px',
                      maxHeight: '150px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb'
                    }}
                  />
                ) : formData.image_url ? (
                  <img
                    src={formData.image_url}
                    alt="画像プレビュー"
                    style={{
                      maxWidth: '200px',
                      maxHeight: '150px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb'
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : null}
              </div>
            )}
          </div>

          <div style={{ marginTop: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={formData.is_open}
                onChange={(e) => setFormData({ ...formData, is_open: e.target.checked })}
              />
              営業中
            </label>
          </div>

          {/* ボタン */}
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button
              onClick={editingSpot ? handleUpdate : handleCreate}
              disabled={loading || uploading}
              style={{
                padding: '10px 20px',
                backgroundColor: (loading || uploading) ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (loading || uploading) ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              {uploading ? '画像アップロード中...' : loading ? '処理中...' : editingSpot ? '更新' : '作成'}
            </button>
            <button
              onClick={resetForm}
              disabled={loading || uploading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (loading || uploading) ? 'not-allowed' : 'pointer'
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

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
          観光地一覧 ({touristSpots.length}件)
        </h3>
        
        {touristSpots.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            観光地が登録されていません
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {touristSpots.map(spot => {
              const congestion = getCongestionLevel(spot.current_count, spot.max_capacity);
              const nearestNode = nodes.find(n => n.id === spot.nearest_node_id);
              
              return (
                <div key={spot.id} style={{ 
                  padding: '15px 20px', 
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '15px'
                }}>
                  {/* 画像 */}
                  {spot.image_url && (
                    <img
                      src={spot.image_url}
                      alt={spot.name}
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        flexShrink: 0
                      }}
                    />
                  )}
                  
                  {/* 情報 */}
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
                      {!spot.tourist_category && spot.category && (
                        <span style={{ 
                          padding: '2px 8px', 
                          background: '#e0e7ff', 
                          color: '#3730a3', 
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}>
                          {spot.category}
                        </span>
                      )}
                      <span style={{ 
                        padding: '2px 8px', 
                        background: congestion.color, 
                        color: 'white', 
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        {congestion.level}
                      </span>
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
                        {nearestNode ? (
                          <span style={{ marginLeft: '15px' }}><strong>最寄り:</strong> {nearestNode.name}</span>
                        ) : (
                          <span style={{ marginLeft: '15px', color: '#dc2626', fontWeight: 'bold' }}>
                            ⚠️ 最寄りノード未設定
                          </span>
                        )}
                        <span style={{ marginLeft: '15px' }}><strong>座標:</strong> ({spot.x}, {spot.y})</span>
                      </div>
                      <div>
                        <strong>営業時間:</strong> {spot.opening_time} - {spot.closing_time}
                        {spot.entry_fee > 0 && <span style={{ marginLeft: '15px' }}><strong>入場料:</strong> ¥{spot.entry_fee.toLocaleString()}</span>}
                        {spot.rating > 0 && <span style={{ marginLeft: '15px' }}><strong>評価:</strong> ⭐{spot.rating}/5</span>}
                      </div>
                      {(spot.website || spot.phone_number) && (
                        <div>
                          {spot.website && <a href={spot.website} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', marginRight: '15px' }}>🌐 公式サイト</a>}
                          {spot.phone_number && <span><strong>TEL:</strong> {spot.phone_number}</span>}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                        作成: {formatDate(spot.created_at)} | 更新: {formatDate(spot.updated_at)}
                      </div>
                    </div>
                  </div>

                  {/* 操作ボタン */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleVisitorChange(spot.id, 1)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#16a34a',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        +1
                      </button>
                      <button
                        onClick={() => handleVisitorChange(spot.id, -1)}
                        disabled={spot.current_count <= 0}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: spot.current_count <= 0 ? '#9ca3af' : '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: spot.current_count <= 0 ? 'not-allowed' : 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        -1
                      </button>
                    </div>
                    
                    {/* お気に入りボタン */}
                    <button
                      onClick={() => toggleFavorite(spot.id)}
                      disabled={favoriteLoading[spot.id]}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: favoriteStates[spot.id] ? '#dc2626' : '#f59e0b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: favoriteLoading[spot.id] ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        opacity: favoriteLoading[spot.id] ? 0.6 : 1
                      }}
                    >
                      {favoriteLoading[spot.id] 
                        ? '処理中...' 
                        : favoriteStates[spot.id] 
                          ? 'お気に入り解除' 
                          : 'お気に入り'}
                    </button>
                    
                    <button
                      onClick={() => handleEdit(spot)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#f59e0b',
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
                      onClick={() => handleDelete(spot.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#dc2626',
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TouristSpotManager;