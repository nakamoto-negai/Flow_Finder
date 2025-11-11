
import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl, API_BASE_URL } from './config';
import type { Field, Node } from './types';

// 2点間の距離（ピクセル）を計算
function calcDistance(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.round(Math.sqrt(dx * dx + dy * dy));
}

const MapView: React.FC<{ linkMode?: boolean, onLinkCreated?: () => void }> = ({ linkMode = false, onLinkCreated }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selected, setSelected] = useState<Node[]>([]); // 選択ノード
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // 全フィールドを取得
    fetch(getApiUrl("/fields"))
      .then((res) => res.json())
      .then((data) => {
        const fieldsData = Array.isArray(data) ? data : [];
        setFields(fieldsData);
        // アクティブなフィールドまたは最初のフィールドを設定
        const activeFieldFromList = fieldsData.find((field: Field) => field.is_active) || fieldsData[0];
        setActiveField(activeFieldFromList);
      })
      .catch(() => {
        setFields([]);
        setActiveField(null);
      });

    // ノード一覧を取得
    fetch(getApiUrl("/nodes"))
      .then((res) => res.json())
      .then((data) => setNodes(Array.isArray(data) ? data : []))
      .catch(() => setNodes([]));
  }, []);

  // フィールド変更時の処理
  const handleFieldChange = (fieldId: number) => {
    const selectedField = fields.find(field => field.id === fieldId);
    if (selectedField) {
      setActiveField(selectedField);
      // フィールド変更時に選択状態をリセット
      setSelected([]);
      setLinkMsg(null);
    }
  };

  // 写真上のクリック処理
  const handleImageClick = (event: React.MouseEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const rect = img.getBoundingClientRect();
    
    // クリック位置を取得（表示画像上の座標）
    const displayX = event.clientX - rect.left;
    const displayY = event.clientY - rect.top;
    
    // 既存ノードがクリックされたかチェック（表示座標で判定）
    const clickedNode = nodes.find(node => {
      // ノードの座標を表示座標に変換して距離を計算
      const nodeDisplayX = activeField ? (node.x * img.offsetWidth) / activeField.width : node.x;
      const nodeDisplayY = activeField ? (node.y * img.offsetHeight) / activeField.height : node.y;
      const distance = Math.sqrt((nodeDisplayX - displayX) ** 2 + (nodeDisplayY - displayY) ** 2);
      return distance < 15; // 15ピクセル以内
    });

    if (clickedNode) {
      handleNodeClick(clickedNode);
    }
  };

  // ノードクリック処理
  const handleNodeClick = (node: Node) => {
    if (linkMode) {
      // リンク作成モードの場合
      if (selected.length === 0) setSelected([node]);
      else if (selected.length === 1 && selected[0].id !== node.id) setSelected([selected[0], node]);
      else setSelected([node]);
    } else {
      // 通常モードの場合：リンク一覧ページに遷移
      window.location.href = `/links?node=${node.id}`;
    }
  };

  const handleRegisterLink = async () => {
    if (selected.length !== 2) return;
    setLinkMsg(null);
    try {
      const res = await fetch(getApiUrl("/links"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_node_id: selected[0].id,
          to_node_id: selected[1].id,
          distance: calcDistance(selected[0].x, selected[0].y, selected[1].x, selected[1].y),
        }),
      });
      if (!res.ok) throw new Error("登録失敗");
      setLinkMsg("リンクを登録しました");
      setSelected([]);
      if (onLinkCreated) onLinkCreated();
    } catch (err: any) {
      setLinkMsg(err.message);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 800, margin: "24px auto", display: "block", position: "relative" }}>
      {/* コントロールパネル */}
      <div style={{ 
        marginBottom: 16, 
        padding: 16, 
        background: "#f8f9fa", 
        borderRadius: 8,
        display: "flex",
        gap: 16,
        alignItems: "center",
        flexWrap: "wrap"
      }}>
        {/* フィールド選択 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>フィールド:</label>
          <select
            value={activeField?.id || ''}
            onChange={(e) => handleFieldChange(Number(e.target.value))}
            style={{
              padding: '6px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '0.9rem',
              minWidth: '150px',
              background: 'white'
            }}
          >
            {fields.map(field => (
              <option key={field.id} value={field.id}>
                {field.name} {field.is_active ? '(アクティブ)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 操作説明 */}
        {!linkMode && (
          <div style={{ 
            color: "#6c757d", 
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}>
            ノードをクリックするとリンク一覧ページに移動します
          </div>
        )}
      </div>

      {/* 写真とノード表示 */}
      <div style={{ position: "relative", border: "2px solid #dee2e6", borderRadius: 8, overflow: "hidden" }}>
        <img
          ref={imageRef}
          src={activeField ? `${API_BASE_URL}${activeField.image_url}` : "/map-image.jpg"}
          alt={activeField ? activeField.name : "マップ画像"}
          style={{ 
            width: "100%", 
            maxWidth: 800,
            height: "auto",
            display: "block",
            cursor: "default"
          }}
          onClick={handleImageClick}
        />
        
        {/* ノードを表示 */}
        {nodes
          .filter(node => activeField ? node.field_id === activeField.id : true)
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
                  position: "absolute",
                  left: displayX - 10,
                  top: displayY - 10,
                  width: 20,
                  height: 20,
                  backgroundColor: selected.some(s => s.id === node.id) ? "#ff6b6b" : "#4ecdc4",
                  border: "2px solid white",
                  borderRadius: "50%",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  fontWeight: "bold",
                  color: "white",
                  transition: "all 0.2s ease",
                  transform: "scale(1)"
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClick(node);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.2)";
                  e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
                }}
                title={linkMode ? `${node.name} (混雑度: ${node.congestion})` : `${node.name} - クリックでリンク一覧を表示`}
              >
                {node.id}
              </div>
            );
          })}
      </div>

      {/* リンク作成UI */}
      {linkMode && selected.length === 2 && (
        <div style={{ position: "absolute", top: 20, left: 20, background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0002", padding: 16, zIndex: 1000 }}>
          <div><b>出発:</b> {selected[0].name}　<b>到着:</b> {selected[1].name}</div>
          <div style={{ margin: "8px 0" }}><b>距離:</b> {calcDistance(selected[0].x, selected[0].y, selected[1].x, selected[1].y)} px</div>
          <button onClick={handleRegisterLink} style={{ marginRight: 8 }}>リンク登録</button>
          <button onClick={() => setSelected([])}>キャンセル</button>
          {linkMsg && <div style={{ color: linkMsg.includes("登録") ? "#16a34a" : "#dc2626", marginTop: 8 }}>{linkMsg}</div>}
        </div>
      )}
      {linkMode && selected.length === 1 && (
        <div style={{ position: "absolute", top: 20, left: 20, background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0002", padding: 12, zIndex: 1000 }}>
          <div>2つのノードを選択してください</div>
          <div style={{ marginTop: 4 }}><b>1点目:</b> {selected[0].name}</div>
          <button onClick={() => setSelected([])} style={{ marginTop: 6 }}>キャンセル</button>
        </div>
      )}
    </div>
  );
};

export default MapView;
