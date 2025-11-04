import React, { useState, useEffect } from 'react';
import VisualLinkCreator from './VisualLinkCreator';
import type { Link, Node } from './types';

const LinkManager: React.FC = () => {
  const [links, setLinks] = useState<Link[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showVisualCreator, setShowVisualCreator] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [formData, setFormData] = useState({
    from_node_id: '',
    to_node_id: '',
    distance: 0,
    is_directed: false
  });

  useEffect(() => {
    fetchLinks();
    fetchNodes();
  }, []);

  const fetchLinks = async () => {
    try {
      const response = await fetch('http://localhost:8080/links');
      if (!response.ok) throw new Error('リンク取得に失敗しました');
      const data = await response.json();
      setLinks(Array.isArray(data) ? data : []);
    } catch (err) {
      setLinks([]); // エラー時も空配列を設定
      setError('リンク取得エラー: ' + (err as Error).message);
    }
  };

  const fetchNodes = async () => {
    try {
      const response = await fetch('http://localhost:8080/nodes');
      if (!response.ok) throw new Error('ノード取得に失敗しました');
      const data = await response.json();
      setNodes(Array.isArray(data) ? data : []);
    } catch (err) {
      setNodes([]); // エラー時も空配列を設定
      setError('ノード取得エラー: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (fromNodeId: number, toNodeId: number): number => {
    const fromNode = nodes.find(n => n.id === fromNodeId);
    const toNode = nodes.find(n => n.id === toNodeId);
    
    if (!fromNode || !toNode) return 0;
    
    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.from_node_id === formData.to_node_id) {
      setError('同じノード同士はリンクできません');
      return;
    }

    const distance = formData.distance || calculateDistance(
      Number(formData.from_node_id),
      Number(formData.to_node_id)
    );

    const linkData = {
      from_node_id: Number(formData.from_node_id),
      to_node_id: Number(formData.to_node_id),
      distance: distance,
      weight: distance,
      is_directed: formData.is_directed
    };

    try {
      const url = editingLink 
        ? `http://localhost:8080/links/${editingLink.id}`
        : 'http://localhost:8080/links';
      
      const method = editingLink ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(linkData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'リンク保存に失敗しました');
      }

      // フォームをリセット
      setFormData({
        from_node_id: '',
        to_node_id: '',
        distance: 0,
        is_directed: false
      });
      setShowAddForm(false);
      setEditingLink(null);
      
      // リンク一覧を更新
      await fetchLinks();
      
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (link: Link) => {
    setEditingLink(link);
    setFormData({
      from_node_id: link.from_node_id.toString(),
      to_node_id: link.to_node_id.toString(),
      distance: link.distance,
      is_directed: link.is_directed
    });
    setShowAddForm(true);
  };

  const handleDelete = async (linkId: number) => {
    if (!confirm('このリンクを削除しますか？')) return;

    try {
      const response = await fetch(`http://localhost:8080/links/${linkId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'リンク削除に失敗しました');
      }

      await fetchLinks();
    } catch (err) {
      setError('削除エラー: ' + (err as Error).message);
    }
  };

  const cancelEdit = () => {
    setShowAddForm(false);
    setEditingLink(null);
    setFormData({
      from_node_id: '',
      to_node_id: '',
      distance: 0,
      is_directed: false
    });
    setError('');
  };

  const getNodeName = (nodeId: number): string => {
    const node = nodes.find(n => n.id === nodeId);
    return node ? node.name : `Node ${nodeId}`;
  };

  const handleFromNodeChange = (fromNodeId: string) => {
    setFormData({ ...formData, from_node_id: fromNodeId });
    
    if (fromNodeId && formData.to_node_id && !formData.distance) {
      const distance = calculateDistance(Number(fromNodeId), Number(formData.to_node_id));
      setFormData(prev => ({ ...prev, from_node_id: fromNodeId, distance: Math.round(distance * 10) / 10 }));
    }
  };

  const handleToNodeChange = (toNodeId: string) => {
    setFormData({ ...formData, to_node_id: toNodeId });
    
    if (formData.from_node_id && toNodeId && !formData.distance) {
      const distance = calculateDistance(Number(formData.from_node_id), Number(toNodeId));
      setFormData(prev => ({ ...prev, to_node_id: toNodeId, distance: Math.round(distance * 10) / 10 }));
    }
  };

  const handleLinkCreated = async () => {
    await fetchLinks();
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '20px' }}>読み込み中...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px' 
      }}>
        <h2>🔗 リンク管理</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowVisualCreator(!showVisualCreator)}
            style={{
              padding: '10px 20px',
              backgroundColor: showVisualCreator ? '#6b7280' : '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            {showVisualCreator ? '🗂️ リスト表示' : '🗺️ マップ表示'}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            + 新しいリンクを追加
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* 視覚的リンク作成器 */}
      {showVisualCreator && (
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginBottom: '16px' }}>🔗 フィールド上でリンクを作成</h3>
          <VisualLinkCreator onLinkCreated={handleLinkCreated} />
        </div>
      )}

      {/* 追加・編集フォーム */}
      {showAddForm && (
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <h3>{editingLink ? 'リンク編集' : '新しいリンク追加'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  開始ノード *
                </label>
                <select
                  value={formData.from_node_id}
                  onChange={(e) => handleFromNodeChange(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
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

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  終了ノード *
                </label>
                <select
                  value={formData.to_node_id}
                  onChange={(e) => handleToNodeChange(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px'
                  }}
                >
                  <option value="">ノードを選択</option>
                  {nodes.map(node => (
                    <option 
                      key={node.id} 
                      value={node.id}
                      disabled={node.id.toString() === formData.from_node_id}
                    >
                      {node.name} (ID: {node.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  距離 (自動計算可能)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.distance}
                  onChange={(e) => setFormData({ ...formData, distance: Number(e.target.value) })}
                  placeholder="自動計算"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', marginTop: '28px' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_directed}
                    onChange={(e) => setFormData({ ...formData, is_directed: e.target.checked })}
                    style={{ marginRight: '8px' }}
                  />
                  有向リンク（一方向）
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                {editingLink ? '更新' : '追加'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* リンク一覧 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>ID</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>開始ノード</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>終了ノード</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>距離</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>重み</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>方向</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {links.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                  リンクがありません
                </td>
              </tr>
            ) : (
              links.map((link) => (
                <tr key={link.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px' }}>{link.id}</td>
                  <td style={{ padding: '12px' }}>
                    {getNodeName(link.from_node_id)}
                    <span style={{ color: '#6b7280', fontSize: '12px' }}> (ID: {link.from_node_id})</span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {getNodeName(link.to_node_id)}
                    <span style={{ color: '#6b7280', fontSize: '12px' }}> (ID: {link.to_node_id})</span>
                  </td>
                  <td style={{ padding: '12px' }}>{link.distance.toFixed(1)}</td>
                  <td style={{ padding: '12px' }}>{link.weight.toFixed(1)}</td>
                  <td style={{ padding: '12px' }}>
                    {link.is_directed ? (
                      <span style={{ color: '#f59e0b' }}>→ 有向</span>
                    ) : (
                      <span style={{ color: '#10b981' }}>↔ 双方向</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEdit(link)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(link.id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#ef4444',
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LinkManager;