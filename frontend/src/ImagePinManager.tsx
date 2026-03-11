import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl, STATIC_BASE_URL } from './config';
import { getAuthHeaders } from './api';

interface Node {
  id: number;
  name: string;
}

interface NodeImage {
  id: number;
  url: string;
  original_name: string;
  node_id: number;
  order: number;
}

interface Link {
  id: number;
  from_node_id: number;
  to_node_id: number;
}

interface ImagePin {
  id: number;
  node_image_id: number;
  link_id: number;
  x: number;
  y: number;
  label: string;
  link?: Link;
}

const ImagePinManager: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [nodeImages, setNodeImages] = useState<NodeImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<NodeImage | null>(null);
  const [pins, setPins] = useState<ImagePin[]>([]);
  const [pendingClick, setPendingClick] = useState<{ x: number; y: number } | null>(null);
  const [newPinLinkId, setNewPinLinkId] = useState<number | ''>('');
  const [newPinLabel, setNewPinLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    fetch(getApiUrl('/nodes'))
      .then(r => r.json())
      .then((data: Node[]) => setNodes(Array.isArray(data) ? data : []));
    fetch(getApiUrl('/links'))
      .then(r => r.json())
      .then((data: any) => {
        const arr = Array.isArray(data) ? data : (data.value ?? []);
        setLinks(arr);
      });
  }, []);

  useEffect(() => {
    if (selectedNodeId == null) { setNodeImages([]); setSelectedImage(null); return; }
    fetch(getApiUrl(`/nodes/${selectedNodeId}/images`))
      .then(r => r.json())
      .then((data: NodeImage[]) => {
        const imgs = Array.isArray(data) ? data : [];
        setNodeImages(imgs);
        setSelectedImage(imgs[0] ?? null);
      });
  }, [selectedNodeId]);

  useEffect(() => {
    if (!selectedImage) { setPins([]); return; }
    fetch(getApiUrl(`/node-images/${selectedImage.id}/pins`))
      .then(r => r.json())
      .then((data: ImagePin[]) => setPins(Array.isArray(data) ? data : []));
  }, [selectedImage]);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = imgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingClick({ x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) });
    setNewPinLinkId('');
    setNewPinLabel('');
  };

  const savePin = async () => {
    if (!selectedImage || !pendingClick || newPinLinkId === '') return;
    setSaving(true);
    try {
      const res = await fetch(getApiUrl(`/node-images/${selectedImage.id}/pins`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ link_id: Number(newPinLinkId), x: pendingClick.x, y: pendingClick.y, label: newPinLabel }),
      });
      if (!res.ok) throw new Error('作成失敗');
      const data = await res.json();
      setPins(prev => [...prev, data.pin]);
      setPendingClick(null);
      setMessage('ピンを追加しました');
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage('エラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const deletePin = async (pinId: number) => {
    if (!confirm('このピンを削除しますか？')) return;
    const res = await fetch(getApiUrl(`/image-pins/${pinId}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      setPins(prev => prev.filter(p => p.id !== pinId));
      setMessage('ピンを削除しました');
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const nodeLinks = links.filter(l => l.from_node_id === selectedNodeId || l.to_node_id === selectedNodeId);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px' }}>
      <h2 style={{ marginBottom: 20 }}>ピン管理（360°画像 → ルート）</h2>

      {message && (
        <div style={{ background: '#dcfce7', color: '#166534', padding: '10px 16px', borderRadius: 6, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {/* ノード選択 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontWeight: 500 }}>ノード選択:</label>
        <select
          value={selectedNodeId ?? ''}
          onChange={e => setSelectedNodeId(e.target.value ? Number(e.target.value) : null)}
          style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 4, minWidth: 200 }}
        >
          <option value=''>-- ノードを選択 --</option>
          {nodes.map(n => (
            <option key={n.id} value={n.id}>{n.name || `ノード ${n.id}`}</option>
          ))}
        </select>
      </div>

      {nodeImages.length === 0 && selectedNodeId && (
        <p style={{ color: '#6b7280' }}>このノードには画像がありません</p>
      )}

      {/* 画像サムネイル一覧 */}
      {nodeImages.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {nodeImages.map(img => (
            <img
              key={img.id}
              src={`${STATIC_BASE_URL}${img.url}`}
              alt={img.original_name}
              onClick={() => setSelectedImage(img)}
              style={{
                width: 80, height: 60, objectFit: 'cover', borderRadius: 4, cursor: 'pointer',
                border: selectedImage?.id === img.id ? '3px solid #2563eb' : '3px solid transparent',
              }}
            />
          ))}
        </div>
      )}

      {/* 選択中の画像 + ピン */}
      {selectedImage && (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              画像をクリックしてピンを配置してください
            </p>
            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
              <img
                ref={imgRef}
                src={`${STATIC_BASE_URL}${selectedImage.url}`}
                alt={selectedImage.original_name}
                onClick={handleImageClick}
                style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair', borderRadius: 8, border: '1px solid #e5e7eb' }}
              />

              {/* 既存ピン */}
              {pins.map(pin => (
                <div
                  key={pin.id}
                  style={{
                    position: 'absolute',
                    left: `${pin.x}%`,
                    top: `${pin.y}%`,
                    transform: 'translate(-50%, -50%)',
                    background: '#2563eb',
                    border: '2px solid #fff',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 14,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                    cursor: 'pointer',
                    zIndex: 10,
                  }}
                  title={`${pin.label || ''} (Link ${pin.link_id}) — クリックで削除`}
                  onClick={(e) => { e.stopPropagation(); deletePin(pin.id); }}
                >
                  ×
                </div>
              ))}

              {/* 仮ピン（クリック位置） */}
              {pendingClick && (
                <div style={{
                  position: 'absolute',
                  left: `${pendingClick.x}%`,
                  top: `${pendingClick.y}%`,
                  transform: 'translate(-50%, -50%)',
                  background: '#f59e0b',
                  border: '2px solid #fff',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  zIndex: 20,
                  pointerEvents: 'none',
                }} />
              )}
            </div>
          </div>

          {/* ピン設定フォーム */}
          <div style={{ width: 260, flexShrink: 0 }}>
            <h4 style={{ marginTop: 0 }}>ピン一覧</h4>
            {pins.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>ピンなし</p>}
            {pins.map(pin => (
              <div key={pin.id} style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 10px', marginBottom: 8, fontSize: 13 }}>
                <div><strong>Link ID:</strong> {pin.link_id}</div>
                {pin.label && <div><strong>ラベル:</strong> {pin.label}</div>}
                <div style={{ color: '#6b7280' }}>位置: ({pin.x.toFixed(1)}%, {pin.y.toFixed(1)}%)</div>
                <button
                  onClick={() => deletePin(pin.id)}
                  style={{ marginTop: 4, padding: '2px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                >
                  削除
                </button>
              </div>
            ))}

            {pendingClick && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: 14, marginTop: 16 }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 14 }}>新規ピン追加</h4>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                  位置: ({pendingClick.x}%, {pendingClick.y}%)
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>リンク *</label>
                  <select
                    value={newPinLinkId}
                    onChange={e => setNewPinLinkId(e.target.value ? Number(e.target.value) : '')}
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }}
                  >
                    <option value=''>-- リンク選択 --</option>
                    {nodeLinks.map(l => (
                      <option key={l.id} value={l.id}>Link {l.id} (Node {l.from_node_id}→{l.to_node_id})</option>
                    ))}
                    {nodeLinks.length === 0 && links.map(l => (
                      <option key={l.id} value={l.id}>Link {l.id} (Node {l.from_node_id}→{l.to_node_id})</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>ラベル（任意）</label>
                  <input
                    type='text'
                    value={newPinLabel}
                    onChange={e => setNewPinLabel(e.target.value)}
                    placeholder='例: 北口へ'
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={savePin}
                    disabled={saving || newPinLinkId === ''}
                    style={{ flex: 1, padding: '6px', background: newPinLinkId === '' ? '#9ca3af' : '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: newPinLinkId === '' ? 'not-allowed' : 'pointer', fontSize: 13 }}
                  >
                    {saving ? '保存中...' : '追加'}
                  </button>
                  <button
                    onClick={() => setPendingClick(null)}
                    style={{ flex: 1, padding: '6px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImagePinManager;
