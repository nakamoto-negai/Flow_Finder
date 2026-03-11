import React, { useState, useEffect } from 'react';
import { getApiUrl, STATIC_BASE_URL } from './config';
import { getAuthHeadersForFormData, getAuthHeaders } from './api';

interface Node {
  id: number;
  name: string;
  x: number;
  y: number;
  field_id: number;
}

interface NodeImage {
  id: number;
  node_id: number;
  original_name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  url: string;
  order: number;
  created_at: string;
}

const NodeImageManager: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [images, setImages] = useState<NodeImage[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    try {
      const response = await fetch(getApiUrl('/nodes'));
      if (response.ok) {
        const data = await response.json();
        setNodes(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('ノード取得エラー:', error);
    }
  };

  const fetchNodeImages = async (nodeId: number) => {
    try {
      const response = await fetch(getApiUrl(`/nodes/${nodeId}/images`));
      if (response.ok) {
        const data = await response.json();
        setImages(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('画像取得エラー:', error);
    }
  };

  const handleNodeSelect = (node: Node) => {
    setSelectedNode(node);
    fetchNodeImages(node.id);
  };

  const handleUpload = async () => {
    if (!selectedNode || !uploadFile) {
      setMessage({ type: 'error', text: 'ノードとファイルを選択してください' });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('image', uploadFile);

      const response = await fetch(getApiUrl(`/nodes/${selectedNode.id}/images`), {
        method: 'POST',
        headers: getAuthHeadersForFormData(),
        body: formData
      });

      if (response.ok) {
        setMessage({ type: 'success', text: '画像をアップロードしました' });
        setUploadFile(null);
        fetchNodeImages(selectedNode.id);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'アップロードに失敗しました' });
      }
    } catch (error) {
      console.error('アップロードエラー:', error);
      setMessage({ type: 'error', text: '通信エラーが発生しました' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (imageId: number) => {
    if (!window.confirm('この画像を削除しますか？')) return;

    try {
      const response = await fetch(getApiUrl(`/node-images/${imageId}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setMessage({ type: 'success', text: '画像を削除しました' });
        if (selectedNode) {
          fetchNodeImages(selectedNode.id);
        }
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || '削除に失敗しました' });
      }
    } catch (error) {
      console.error('削除エラー:', error);
      setMessage({ type: 'error', text: '通信エラーが発生しました' });
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '24px', fontSize: '1.8rem', color: '#1f2937' }}>
        ノード画像管理
      </h2>

      {message && (
        <div style={{
          padding: '12px 20px',
          marginBottom: '20px',
          borderRadius: '8px',
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* ノード選択 */}
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          maxHeight: '600px',
          overflowY: 'auto'
        }}>
          <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', color: '#374151' }}>
            ノードを選択
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {nodes.map(node => (
              <button
                key={node.id}
                onClick={() => handleNodeSelect(node)}
                style={{
                  padding: '12px',
                  background: selectedNode?.id === node.id ? '#dbeafe' : 'white',
                  border: `2px solid ${selectedNode?.id === node.id ? '#3b82f6' : '#e5e7eb'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  fontWeight: selectedNode?.id === node.id ? 'bold' : 'normal'
                }}
                onMouseEnter={(e) => {
                  if (selectedNode?.id !== node.id) {
                    e.currentTarget.style.background = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedNode?.id !== node.id) {
                    e.currentTarget.style.background = 'white';
                  }
                }}
              >
                <div style={{ fontSize: '14px', color: '#6b7280' }}>ID: {node.id}</div>
                <div style={{ fontSize: '16px', color: '#1f2937' }}>{node.name || `ノード${node.id}`}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 画像管理エリア */}
        <div>
          {selectedNode ? (
            <>
              {/* アップロードセクション */}
              <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                marginBottom: '24px'
              }}>
                <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', color: '#374151' }}>
                  {selectedNode.name || `ノード${selectedNode.id}`} に画像をアップロード
                </h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px'
                    }}
                  />
                  <button
                    onClick={handleUpload}
                    disabled={!uploadFile || isUploading}
                    style={{
                      padding: '10px 24px',
                      background: uploadFile && !isUploading ? '#3b82f6' : '#9ca3af',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: uploadFile && !isUploading ? 'pointer' : 'not-allowed',
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isUploading ? 'アップロード中...' : 'アップロード'}
                  </button>
                </div>
              </div>

              {/* 画像一覧 */}
              <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', color: '#374151' }}>
                  登録済み画像 ({images.length}件)
                </h3>
                {images.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                    gap: '16px'
                  }}>
                    {images.map(image => (
                      <div
                        key={image.id}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        <img
                          src={`${STATIC_BASE_URL}${image.url}`}
                          alt={image.original_name}
                          style={{
                            width: '100%',
                            height: '200px',
                            objectFit: 'cover'
                          }}
                        />
                        <div style={{ padding: '12px' }}>
                          <div style={{ 
                            fontSize: '14px', 
                            color: '#374151',
                            marginBottom: '8px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {image.original_name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                            {(image.file_size / 1024).toFixed(1)} KB
                          </div>
                          <button
                            onClick={() => handleDelete(image.id)}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#dc2626';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#ef4444';
                            }}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#9ca3af'
                  }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📷</div>
                    <div>このノードには画像が登録されていません</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{
              background: 'white',
              padding: '60px 20px',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              textAlign: 'center',
              color: '#9ca3af'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👈</div>
              <div>左側からノードを選択してください</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NodeImageManager;
