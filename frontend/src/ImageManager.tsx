import React, { useState, useEffect } from 'react';

interface Image {
  id: number;
  original_name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_hash: string;
  mime_type: string;
  uploaded_at: string;
  url: string;
  link_id?: number;
  order: number;
}

interface Link {
  id: number;
  from_node_id: number;
  to_node_id: number;
  distance: number;
  weight: number;
  is_directed: boolean;
}

const ImageManager: React.FC = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<number | ''>('');
  const [order, setOrder] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 画像とリンクのデータを取得
  useEffect(() => {
    fetchImages();
    fetchLinks();
  }, []);

  const fetchImages = async () => {
    try {
      const response = await fetch('http://localhost:8080/images');
      if (!response.ok) throw new Error('画像の取得に失敗しました');
      const data = await response.json();
      // データが配列でない場合は空配列を設定
      setImages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('画像取得エラー:', err);
      setImages([]); // エラー時も空配列を設定
      setError('画像の取得に失敗しました');
    }
  };

  const fetchLinks = async () => {
    try {
      const response = await fetch('http://localhost:8080/links');
      if (!response.ok) throw new Error('リンクの取得に失敗しました');
      const data = await response.json();
      // データが配列でない場合は空配列を設定
      setLinks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('リンク取得エラー:', err);
      setLinks([]); // エラー時も空配列を設定
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 画像ファイルのみ許可
      if (!file.type.startsWith('image/')) {
        setError('画像ファイルのみアップロード可能です');
        return;
      }
      // ファイルサイズ制限（10MB）
      if (file.size > 10 * 1024 * 1024) {
        setError('ファイルサイズは10MB以下にしてください');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('ファイルを選択してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (selectedLinkId) {
        formData.append('link_id', selectedLinkId.toString());
      }
      formData.append('order', order.toString());

      const response = await fetch('http://localhost:8080/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'アップロードに失敗しました');
      }

      // アップロード成功
      setSelectedFile(null);
      setSelectedLinkId('');
      setOrder(1);
      await fetchImages();
      
      // ファイル入力をリセット
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (imageId: number) => {
    if (!confirm('この画像を削除しますか？')) return;

    try {
      const response = await fetch(`http://localhost:8080/images/${imageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('削除に失敗しました');
      
      await fetchImages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP');
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>画像管理</h2>

      {/* アップロードセクション */}
      <div style={{ 
        background: 'white', 
        padding: '20px', 
        borderRadius: '8px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginBottom: '15px', color: '#374151' }}>新しい画像をアップロード</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            画像ファイル *
          </label>
          <input
            id="file-input"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px'
            }}
          />
          {selectedFile && (
            <div style={{ marginTop: '5px', fontSize: '14px', color: '#6b7280' }}>
              選択されたファイル: {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </div>
          )}
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            関連リンク（オプション）
          </label>
          <select
            value={selectedLinkId}
            onChange={(e) => setSelectedLinkId(e.target.value === '' ? '' : Number(e.target.value))}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px'
            }}
          >
            <option value="">関連リンクなし</option>
            {links.map(link => (
              <option key={link.id} value={link.id}>
                リンク {link.id}: ノード{link.from_node_id} → ノード{link.to_node_id}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            表示順
          </label>
          <input
            type="number"
            min="1"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            style={{
              width: '100px',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px'
            }}
          />
        </div>

        {error && (
          <div style={{ 
            color: '#dc2626', 
            background: '#fef2f2', 
            padding: '10px', 
            borderRadius: '4px',
            marginBottom: '15px'
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={loading || !selectedFile}
          style={{
            padding: '10px 20px',
            backgroundColor: loading || !selectedFile ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || !selectedFile ? 'not-allowed' : 'pointer',
            fontWeight: '500'
          }}
        >
          {loading ? 'アップロード中...' : 'アップロード'}
        </button>
      </div>

      {/* 画像一覧 */}
      <div style={{ 
        background: 'white', 
        padding: '20px', 
        borderRadius: '8px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginBottom: '15px', color: '#374151' }}>アップロード済み画像</h3>
        
        {images.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
            アップロードされた画像がありません
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {images.map(image => (
              <div key={image.id} style={{ 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px', 
                padding: '15px',
                display: 'flex',
                gap: '15px',
                alignItems: 'flex-start'
              }}>
                {/* 画像プレビュー */}
                <div style={{ flexShrink: 0 }}>
                  <img
                    src={`http://localhost:8080${image.file_path}`}
                    alt={image.original_name}
                    style={{
                      width: '100px',
                      height: '100px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      border: '1px solid #e5e7eb'
                    }}
                  />
                </div>

                {/* 画像情報 */}
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#1f2937' }}>
                    {image.original_name}
                  </h4>
                  <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                    <div><strong>ID:</strong> {image.id}</div>
                    <div><strong>ファイル名:</strong> {image.file_name}</div>
                    <div><strong>サイズ:</strong> {formatFileSize(image.file_size)}</div>
                    <div><strong>MIMEタイプ:</strong> {image.mime_type}</div>
                    <div><strong>アップロード日時:</strong> {formatDate(image.uploaded_at)}</div>
                    {image.link_id && (
                      <div><strong>関連リンク:</strong> リンク {image.link_id}</div>
                    )}
                    <div><strong>表示順:</strong> {image.order}</div>
                  </div>
                </div>

                {/* 削除ボタン */}
                <div style={{ flexShrink: 0 }}>
                  <button
                    onClick={() => handleDelete(image.id)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageManager;