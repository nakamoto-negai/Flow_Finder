import React, { useState, useEffect, useRef } from 'react';
import type { Node, Field } from './types';
import { getApiUrl, STATIC_BASE_URL } from './config';
import { getAuthHeaders } from './api';

interface VisualNodeSelectorProps {
  onNodeSelected?: (node: Node) => void;
  onNodeAdded?: (nodeData: { name: string; x: number; y: number; field_id: number }) => void;
  allowSelection?: boolean;
  allowAddition?: boolean;
  selectedNodeId?: number;
}

const VisualNodeSelector: React.FC<VisualNodeSelectorProps> = ({
  onNodeSelected,
  onNodeAdded,
  allowSelection = true,
  allowAddition = false,
  selectedNodeId
}) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    fetchFields();
    fetchNodes();
  }, []);

  useEffect(() => {
    if (fields.length > 0) {
      const active = fields.find(f => f.is_active) || fields[0];
      setActiveField(active);
    }
  }, [fields]);

  const fetchFields = async () => {
    try {
      const response = await fetch(getApiUrl('/fields'));
      if (!response.ok) throw new Error('フィールド取得に失敗しました');
      const data = await response.json();
      setFields(data);
    } catch (err) {
      console.error('フィールド取得エラー:', err);
    }
  };

  const fetchNodes = async () => {
    try {
      const response = await fetch(getApiUrl('/nodes'));
      if (!response.ok) throw new Error('ノード取得に失敗しました');
      const data = await response.json();
      setNodes(data);
    } catch (err) {
      console.error('ノード取得エラー:', err);
    }
  };

  const handleImageClick = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!activeField) return;

    const img = event.currentTarget;
    const rect = img.getBoundingClientRect();
    
    // クリック位置を取得（表示画像上の座標）
    const displayX = event.clientX - rect.left;
    const displayY = event.clientY - rect.top;
    
    // 画像の実際のサイズと表示サイズの比率を計算
    const scaleX = activeField.width / img.offsetWidth;
    const scaleY = activeField.height / img.offsetHeight;
    
    // 実際の画像座標に変換
    const actualX = displayX * scaleX;
    const actualY = displayY * scaleY;

    // 既存ノードがクリックされたかチェック（表示座標で判定）
    const clickedNode = nodes
      .filter(node => node.field_id === activeField.id)
      .find(node => {
        // ノードの座標を表示座標に変換して距離を計算
        const nodeDisplayX = node.x / scaleX;
        const nodeDisplayY = node.y / scaleY;
        const distance = Math.sqrt((nodeDisplayX - displayX) ** 2 + (nodeDisplayY - displayY) ** 2);
        return distance < 15; // 15ピクセル以内
      });

    if (clickedNode && allowSelection) {
      if (onNodeSelected) {
        onNodeSelected(clickedNode);
      }
    } else if (isAddingNode && allowAddition) {
      // 新しいノード追加モード（実際の画像座標を使用）
      setClickPosition({ x: actualX, y: actualY });
      setShowNodeForm(true);
    }
  };

  const handleAddNode = async () => {
    if (!clickPosition || !newNodeName.trim() || !activeField) return;

    const nodeData = {
      name: newNodeName,
      x: clickPosition.x,
      y: clickPosition.y,
      field_id: activeField.id
    };

    try {
      const response = await fetch(getApiUrl('/nodes'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...nodeData,
          congestion: 1,
          tourist: false
        }),
      });

      if (!response.ok) throw new Error('ノード追加に失敗しました');

      // ノード一覧を再取得
      await fetchNodes();

      // フォームをリセット
      setNewNodeName('');
      setShowNodeForm(false);
      setClickPosition(null);
      setIsAddingNode(false);

      if (onNodeAdded) {
        onNodeAdded(nodeData);
      }
    } catch (err) {
      alert('ノード追加に失敗しました: ' + (err as Error).message);
    }
  };

  const getNodeColor = (node: Node) => {
    if (node.id === selectedNodeId) return '#ff6b6b'; // 選択されたノード
    if (node.tourist) return '#ffd93d'; // 観光地
    return '#4ecdc4'; // 通常のノード
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

        {/* ノード追加モード切り替え */}
        {allowAddition && (
          <button
            onClick={() => setIsAddingNode(!isAddingNode)}
            style={{
              padding: '8px 16px',
              backgroundColor: isAddingNode ? '#dc3545' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isAddingNode ? 'ノード追加モード終了' : 'ノード追加モード'}
          </button>
        )}

        {isAddingNode && (
          <span style={{ color: '#6c757d', fontSize: '0.9rem' }}>
            📍 写真上をクリックしてノードを追加してください
          </span>
        )}
      </div>

      {/* フィールド画像とノード表示 */}
      {activeField && (
        <div style={{ 
          position: 'relative', 
          border: '2px solid #dee2e6', 
          borderRadius: '8px', 
          overflow: 'hidden'
        }}>
          <img
            ref={imageRef}
            src={`${STATIC_BASE_URL}${activeField.image_url}`}
            alt={activeField.name}
            style={{
              width: '100%',
              maxWidth: '800px',
              height: 'auto',
              display: 'block',
              cursor: isAddingNode ? 'crosshair' : allowSelection ? 'pointer' : 'default'
            }}
            onClick={handleImageClick}
          />

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
                    cursor: allowSelection ? 'pointer' : 'default',
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
                    if (allowSelection && onNodeSelected) {
                      onNodeSelected(node);
                    }
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
            {selectedNodeId && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  backgroundColor: '#ff6b6b', 
                  borderRadius: '50%', 
                  marginRight: '6px' 
                }}></div>
                選択中
              </div>
            )}
          </div>
        </div>
      )}

      {/* ノード追加フォーム */}
      {showNodeForm && clickPosition && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          padding: '20px',
          zIndex: 1000,
          minWidth: '300px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>新しいノードを追加</h3>
          <div style={{ marginBottom: '12px' }}>
            <strong>位置:</strong> X={Math.round(clickPosition.x)}, Y={Math.round(clickPosition.y)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              placeholder="ノード名を入力"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleAddNode}
              disabled={!newNodeName.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: newNodeName.trim() ? '#28a745' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: newNodeName.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              追加
            </button>
            <button
              onClick={() => {
                setShowNodeForm(false);
                setClickPosition(null);
                setNewNodeName('');
                setIsAddingNode(false);
              }}
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

      {/* オーバーレイ（モーダル背景） */}
      {showNodeForm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 999
          }}
          onClick={() => {
            setShowNodeForm(false);
            setClickPosition(null);
            setNewNodeName('');
            setIsAddingNode(false);
          }}
        />
      )}
    </div>
  );
};

export default VisualNodeSelector;