import React, { useState, useEffect } from 'react';

interface Field {
  id: number;
  name: string;
  description: string;
  image_url: string;
  width: number;
  height: number;
  is_active: boolean;
  created_at: string;
}

const FieldManager: React.FC = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadData, setUploadData] = useState({
    name: '',
    description: '',
    width: 800,
    height: 600,
    image: null as File | null
  });
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadFields();
  }, []);

  const loadFields = async () => {
    try {
      const response = await fetch('http://localhost:8080/fields');
      const data = await response.json();
      // データが配列でない場合は空配列を設定
      setFields(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('フィールド取得エラー:', error);
      setFields([]); // エラー時も空配列を設定
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData.image || !uploadData.name.trim()) {
      alert('ファイル名と画像を選択してください');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('name', uploadData.name);
    formData.append('description', uploadData.description);
    formData.append('width', uploadData.width.toString());
    formData.append('height', uploadData.height.toString());
    formData.append('image', uploadData.image);

    try {
      const response = await fetch('http://localhost:8080/fields', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setShowUploadForm(false);
        setUploadData({ name: '', description: '', width: 800, height: 600, image: null });
        loadFields();
        alert('フィールドが作成されました');
      } else {
        const error = await response.json();
        alert('アップロードエラー: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      alert('アップロードに失敗しました: ' + error);
    } finally {
      setIsUploading(false);
    }
  };

  const activateField = async (fieldId: number) => {
    try {
      const response = await fetch(`http://localhost:8080/fields/${fieldId}/activate`, {
        method: 'POST'
      });

      if (response.ok) {
        loadFields();
        alert('フィールドをアクティブにしました');
      } else {
        alert('アクティブ化に失敗しました');
      }
    } catch (error) {
      alert('エラーが発生しました: ' + error);
    }
  };

  const deleteField = async (fieldId: number) => {
    if (!confirm('このフィールドを削除しますか？')) return;

    try {
      const response = await fetch(`http://localhost:8080/fields/${fieldId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadFields();
        alert('フィールドが削除されました');
      } else {
        alert('削除に失敗しました');
      }
    } catch (error) {
      alert('エラーが発生しました: ' + error);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>フィールド管理</h2>
        <button
          onClick={() => setShowUploadForm(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          新しいフィールドを追加
        </button>
      </div>

      {/* アップロードフォーム */}
      {showUploadForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            width: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3>新しいフィールドを追加</h3>
            <form onSubmit={handleUpload}>
              <div style={{ marginBottom: '15px' }}>
                <label>フィールド名 *</label>
                <input
                  type="text"
                  value={uploadData.name}
                  onChange={(e) => setUploadData({ ...uploadData, name: e.target.value })}
                  style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label>説明</label>
                <textarea
                  value={uploadData.description}
                  onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px', height: '80px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label>幅 (px)</label>
                  <input
                    type="number"
                    value={uploadData.width}
                    onChange={(e) => setUploadData({ ...uploadData, width: parseInt(e.target.value) || 800 })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                    min="100"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>高さ (px)</label>
                  <input
                    type="number"
                    value={uploadData.height}
                    onChange={(e) => setUploadData({ ...uploadData, height: parseInt(e.target.value) || 600 })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                    min="100"
                  />
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label>画像ファイル *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setUploadData({ ...uploadData, image: e.target.files?.[0] || null })}
                  style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: isUploading ? '#6c757d' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isUploading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isUploading ? 'アップロード中...' : 'アップロード'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* フィールド一覧 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {fields.map((field) => (
          <div
            key={field.id}
            style={{
              border: field.is_active ? '3px solid #28a745' : '1px solid #ddd',
              borderRadius: '8px',
              padding: '15px',
              backgroundColor: field.is_active ? '#f8fff8' : 'white'
            }}
          >
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <img
                src={`http://localhost:8080${field.image_url}`}
                alt={field.name}
                style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px' }}
              />
              {field.is_active && (
                <div style={{
                  position: 'absolute',
                  top: '5px',
                  right: '5px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  ACTIVE
                </div>
              )}
            </div>
            <h4 style={{ margin: '0 0 8px 0' }}>{field.name}</h4>
            {field.description && (
              <p style={{ fontSize: '14px', color: '#666', margin: '0 0 8px 0' }}>{field.description}</p>
            )}
            <p style={{ fontSize: '12px', color: '#999', margin: '0 0 15px 0' }}>
              {field.width} × {field.height} px
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {!field.is_active && (
                <button
                  onClick={() => activateField(field.id)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  アクティブ化
                </button>
              )}
              <button
                onClick={() => deleteField(field.id)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#dc3545',
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

      {fields.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          フィールドがまだ作成されていません。<br />
          「新しいフィールドを追加」ボタンから始めましょう。
        </div>
      )}
    </div>
  );
};

export default FieldManager;