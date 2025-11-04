import React, { useState, useEffect } from 'react';
import VisualNodeSelector from './VisualNodeSelector';
import type { Node as CommonNode, Field as CommonField } from './types';

interface Node extends CommonNode {
  created_at: string;
  updated_at: string;
}

interface Field extends CommonField {}

const NodeManager: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showVisualSelector, setShowVisualSelector] = useState(false);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    x: 0,
    y: 0,
    congestion: 0,
    tourist: false,
    field_id: ''
  });

  useEffect(() => {
    fetchNodes();
    fetchFields();
  }, []);

  const fetchNodes = async () => {
    try {
      const response = await fetch('http://localhost:8080/nodes');
      if (!response.ok) throw new Error('ノード取得に失敗しました');
      const data = await response.json();
      setNodes(Array.isArray(data) ? data : []);
    } catch (err) {
      setNodes([]); // エラー時も空配列を設定
      setError('ノード取得エラー: ' + (err as Error).message);
    }
  };

  const fetchFields = async () => {
    try {
      const response = await fetch('http://localhost:8080/fields');
      if (!response.ok) throw new Error('フィールド取得に失敗しました');
      const data = await response.json();
      setFields(Array.isArray(data) ? data : []);
    } catch (err) {
      setFields([]); // エラー時も空配列を設定
      setError('フィールド取得エラー: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeSelected = (node: CommonNode) => {
    // VisualNodeSelectorのNode型をNodeManager用に変換
    const managerNode: Node = {
      ...node,
      created_at: node.created_at || '',
      updated_at: node.updated_at || ''
    };
    setSelectedNode(managerNode);
    handleEdit(managerNode);
  };

  const handleNodeAdded = async () => {
    await fetchNodes();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const nodeData = {
      name: formData.name,
      x: Number(formData.x),
      y: Number(formData.y),
      congestion: Number(formData.congestion),
      tourist: formData.tourist,
      field_id: formData.field_id ? Number(formData.field_id) : null
    };

    try {
      const url = editingNode 
        ? `http://localhost:8080/nodes/${editingNode.id}`
        : 'http://localhost:8080/nodes';
      
      const method = editingNode ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nodeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'ノード保存に失敗しました');
      }

      // フォームをリセット
      setFormData({
        name: '',
        x: 0,
        y: 0,
        congestion: 0,
        tourist: false,
        field_id: ''
      });
      setShowAddForm(false);
      setEditingNode(null);
      
      // ノード一覧を更新
      await fetchNodes();
      
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (node: Node) => {
    setEditingNode(node);
    setFormData({
      name: node.name,
      x: node.x,
      y: node.y,
      congestion: node.congestion,
      tourist: node.tourist,
      field_id: node.field_id?.toString() || ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (nodeId: number) => {
    if (!confirm('このノードを削除しますか？')) return;

    try {
      const response = await fetch(`http://localhost:8080/nodes/${nodeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'ノード削除に失敗しました');
      }

      await fetchNodes();
    } catch (err) {
      setError('削除エラー: ' + (err as Error).message);
    }
  };

  const cancelEdit = () => {
    setShowAddForm(false);
    setEditingNode(null);
    setFormData({
      name: '',
      x: 0,
      y: 0,
      congestion: 0,
      tourist: false,
      field_id: ''
    });
    setError('');
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
        <h2>📍 ノード管理</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowVisualSelector(!showVisualSelector)}
            style={{
              padding: '10px 20px',
              backgroundColor: showVisualSelector ? '#6b7280' : '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            {showVisualSelector ? '🗂️ リスト表示' : '🗺️ マップ表示'}
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
            + 新しいノードを追加
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

      {/* 視覚的ノード選択器 */}
      {showVisualSelector && (
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginBottom: '16px' }}>📍 フィールド上でノードを選択・追加</h3>
          <VisualNodeSelector
            onNodeSelected={handleNodeSelected}
            onNodeAdded={handleNodeAdded}
            allowSelection={true}
            allowAddition={true}
            selectedNodeId={selectedNode?.id}
          />
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
          <h3>{editingNode ? 'ノード編集' : '新しいノード追加'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  ノード名 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  所属フィールド
                </label>
                <select
                  value={formData.field_id}
                  onChange={(e) => setFormData({ ...formData, field_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px'
                  }}
                >
                  <option value="">フィールドを選択</option>
                  {fields.map(field => (
                    <option key={field.id} value={field.id}>
                      {field.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  X座標
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.x}
                  onChange={(e) => setFormData({ ...formData, x: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Y座標
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.y}
                  onChange={(e) => setFormData({ ...formData, y: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  混雑度 (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.congestion}
                  onChange={(e) => setFormData({ ...formData, congestion: Number(e.target.value) })}
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
                    checked={formData.tourist}
                    onChange={(e) => setFormData({ ...formData, tourist: e.target.checked })}
                    style={{ marginRight: '8px' }}
                  />
                  観光地として設定
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
                {editingNode ? '更新' : '追加'}
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

      {/* ノード一覧 */}
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
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>名前</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>座標</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>混雑度</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>観光地</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>フィールド</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {nodes.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                  ノードがありません
                </td>
              </tr>
            ) : (
              nodes.map((node) => (
                <tr key={node.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px' }}>{node.id}</td>
                  <td style={{ padding: '12px' }}>{node.name}</td>
                  <td style={{ padding: '12px' }}>({node.x.toFixed(1)}, {node.y.toFixed(1)})</td>
                  <td style={{ padding: '12px' }}>{node.congestion}</td>
                  <td style={{ padding: '12px' }}>
                    {node.tourist ? (
                      <span style={{ color: '#10b981' }}>✓ はい</span>
                    ) : (
                      <span style={{ color: '#6b7280' }}>いいえ</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {node.field_id ? 
                      fields.find(f => f.id === node.field_id)?.name || `ID: ${node.field_id}` 
                      : '未設定'
                    }
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEdit(node)}
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
                        onClick={() => handleDelete(node.id)}
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

export default NodeManager;