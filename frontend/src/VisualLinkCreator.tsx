import React, { useState, useEffect, useRef } from 'react';
import type { Node, Field, Link } from './types';

interface VisualLinkCreatorProps {
  onLinkCreated?: () => void;
}

const VisualLinkCreator: React.FC<VisualLinkCreatorProps> = ({ onLinkCreated }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [isDirected, setIsDirected] = useState(false);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    fetchFields();
    fetchNodes();
    fetchLinks();
  }, []);

  useEffect(() => {
    if (fields.length > 0) {
      const active = fields.find(f => f.is_active) || fields[0];
      setActiveField(active);
    }
  }, [fields]);

  const fetchFields = async () => {
    try {
      const response = await fetch('http://localhost:8080/fields');
      if (!response.ok) throw new Error('フィールド取得に失敗しました');
      const data = await response.json();
      setFields(data);
    } catch (err) {
      console.error('フィールド取得エラー:', err);
    }
  };

  const fetchNodes = async () => {
    try {
      const response = await fetch('http://localhost:8080/nodes');
      if (!response.ok) throw new Error('ノード取得に失敗しました');
      const data = await response.json();
      setNodes(data);
    } catch (err) {
      console.error('ノード取得エラー:', err);
    }
  };

  const fetchLinks = async () => {
    try {
      const response = await fetch('http://localhost:8080/links');
      if (!response.ok) throw new Error('リンク取得に失敗しました');
      const data = await response.json();
      setLinks(data);
    } catch (err) {
      console.error('リンク取得エラー:', err);
    }
  };

  const handleNodeClick = (node: Node) => {
    if (!isCreatingLink) return;

    if (selectedNodes.length === 0) {
      setSelectedNodes([node]);
    } else if (selectedNodes.length === 1) {
      if (selectedNodes[0].id === node.id) {
        setSelectedNodes([]);
      } else {
        setSelectedNodes([selectedNodes[0], node]);
      }
    } else {
      setSelectedNodes([node]);
    }
  };

  const calculateDistance = (node1: Node, node2: Node): number => {
    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const createLink = async () => {
    if (selectedNodes.length !== 2) return;

    const [fromNode, toNode] = selectedNodes;
    const distance = calculateDistance(fromNode, toNode);

    try {
      const response = await fetch('http://localhost:8080/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_node_id: fromNode.id,
          to_node_id: toNode.id,
          distance: Math.round(distance * 10) / 10,
          weight: Math.round(distance * 10) / 10,
          is_directed: isDirected
        }),
      });

      if (!response.ok) throw new Error('リンク作成に失敗しました');

      // リセット
      setSelectedNodes([]);
      await fetchLinks();
      
      if (onLinkCreated) {
        onLinkCreated();
      }
    } catch (err) {
      alert('リンク作成に失敗しました: ' + (err as Error).message);
    }
  };

  const getNodeColor = (node: Node) => {
    if (selectedNodes.some(selected => selected.id === node.id)) {
      return '#ff6b6b'; // 選択されたノード
    }
    if (node.tourist) return '#ffd93d'; // 観光地
    return '#4ecdc4'; // 通常のノード
  };

  const renderLinks = () => {
    if (!activeField || !imageRef.current) return null;

    // 座標変換用の比率を計算
    const scaleX = imageRef.current.offsetWidth / activeField.width;
    const scaleY = imageRef.current.offsetHeight / activeField.height;

    return links
      .filter(link => {
        const fromNode = nodes.find(n => n.id === link.from_node_id && n.field_id === activeField.id);
        const toNode = nodes.find(n => n.id === link.to_node_id && n.field_id === activeField.id);
        return fromNode && toNode;
      })
      .map(link => {
        const fromNode = nodes.find(n => n.id === link.from_node_id);
        const toNode = nodes.find(n => n.id === link.to_node_id);
        
        if (!fromNode || !toNode) return null;

        // ノード座標を表示座標に変換
        const fromDisplayX = fromNode.x * scaleX;
        const fromDisplayY = fromNode.y * scaleY;
        const toDisplayX = toNode.x * scaleX;
        const toDisplayY = toNode.y * scaleY;

        return (
          <g key={link.id}>
            <line
              x1={fromDisplayX}
              y1={fromDisplayY}
              x2={toDisplayX}
              y2={toDisplayY}
              stroke="#6b7280"
              strokeWidth="2"
              opacity="0.7"
            />
            {link.is_directed && (
              <polygon
                points={`${toDisplayX - 5},${toDisplayY - 5} ${toDisplayX + 5},${toDisplayY - 5} ${toDisplayX},${toDisplayY + 5}`}
                fill="#6b7280"
                opacity="0.7"
              />
            )}
          </g>
        );
      });
  };

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      {/* コントロールパネル */}
      <div style={{
        marginBottom: '16px',
        padding: '16px',
        background: '#f8f9fa',
        borderRadius: '8px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        {/* フィールド選択 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontWeight: 'bold' }}>フィールド:</label>
          <select
            value={activeField?.id || ''}
            onChange={(e) => {
              const field = fields.find(f => f.id === Number(e.target.value));
              setActiveField(field || null);
            }}
            style={{
              padding: '4px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          >
            {fields.map(field => (
              <option key={field.id} value={field.id}>
                {field.name}
              </option>
            ))}
          </select>
        </div>

        {/* リンク作成モード切り替え */}
        <button
          onClick={() => {
            setIsCreatingLink(!isCreatingLink);
            setSelectedNodes([]);
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: isCreatingLink ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {isCreatingLink ? 'リンク作成モード終了' : 'リンク作成モード'}
        </button>

        {/* 有向リンクオプション */}
        {isCreatingLink && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={isDirected}
              onChange={(e) => setIsDirected(e.target.checked)}
            />
            有向リンク（一方向）
          </label>
        )}

        {isCreatingLink && (
          <span style={{ color: '#6c757d', fontSize: '0.9rem' }}>
            🔗 2つのノードを選択してリンクを作成してください
          </span>
        )}
      </div>

      {/* フィールド画像とノード・リンク表示 */}
      {activeField && (
        <div style={{ 
          position: 'relative', 
          border: '2px solid #dee2e6', 
          borderRadius: '8px', 
          overflow: 'hidden'
        }}>
          <img
            ref={imageRef}
            src={`http://localhost:8080${activeField.image_url}`}
            alt={activeField.name}
            style={{
              width: '100%',
              maxWidth: '800px',
              height: 'auto',
              display: 'block',
              cursor: isCreatingLink ? 'pointer' : 'default'
            }}
          />

          {/* SVGオーバーレイでリンクを描画 */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
            viewBox={imageRef.current ? `0 0 ${imageRef.current.offsetWidth} ${imageRef.current.offsetHeight}` : '0 0 800 600'}
            preserveAspectRatio="xMidYMid meet"
          >
            {renderLinks()}
            
            {/* 選択中のリンクをプレビュー */}
            {selectedNodes.length === 2 && activeField && imageRef.current && (
              <line
                x1={(selectedNodes[0].x * imageRef.current.offsetWidth) / activeField.width}
                y1={(selectedNodes[0].y * imageRef.current.offsetHeight) / activeField.height}
                x2={(selectedNodes[1].x * imageRef.current.offsetWidth) / activeField.width}
                y2={(selectedNodes[1].y * imageRef.current.offsetHeight) / activeField.height}
                stroke="#ff6b6b"
                strokeWidth="3"
                strokeDasharray="5,5"
                opacity="0.8"
              />
            )}
          </svg>

          {/* ノードを表示 */}
          {nodes
            .filter(node => node.field_id === activeField.id)
            .map((node) => {
              // ノードの座標を表示座標に変換
              const displayX = activeField && imageRef.current 
                ? (node.x * imageRef.current.offsetWidth) / activeField.width
                : node.x;
              const displayY = activeField && imageRef.current 
                ? (node.y * imageRef.current.offsetHeight) / activeField.height
                : node.y;

              return (
                <div
                  key={node.id}
                  style={{
                    position: 'absolute',
                    left: displayX - 12,
                    top: displayY - 12,
                    width: 24,
                    height: 24,
                    backgroundColor: getNodeColor(node),
                    border: '2px solid white',
                    borderRadius: '50%',
                    cursor: isCreatingLink ? 'pointer' : 'default',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: 'white',
                    zIndex: 10
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNodeClick(node);
                  }}
                  title={`${node.name} (混雑度: ${node.congestion})`}
                >
                  {node.id}
                </div>
              );
            })
          }

          {/* 凡例 */}
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(255,255,255,0.9)',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                backgroundColor: '#4ecdc4', 
                borderRadius: '50%', 
                marginRight: '6px' 
              }}></div>
              通常ノード
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                backgroundColor: '#ffd93d', 
                borderRadius: '50%', 
                marginRight: '6px' 
              }}></div>
              観光地
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                backgroundColor: '#ff6b6b', 
                borderRadius: '50%', 
                marginRight: '6px' 
              }}></div>
              選択中
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '12px', 
                height: '2px', 
                backgroundColor: '#6b7280', 
                marginRight: '6px' 
              }}></div>
              リンク
            </div>
          </div>
        </div>
      )}

      {/* リンク作成確認 */}
      {selectedNodes.length === 2 && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <strong>リンク作成準備完了</strong>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>開始:</strong> {selectedNodes[0].name} (ID: {selectedNodes[0].id})
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>終了:</strong> {selectedNodes[1].name} (ID: {selectedNodes[1].id})
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong>距離:</strong> {Math.round(calculateDistance(selectedNodes[0], selectedNodes[1]) * 10) / 10} px
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={createLink}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              リンクを作成
            </button>
            <button
              onClick={() => setSelectedNodes([])}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualLinkCreator;