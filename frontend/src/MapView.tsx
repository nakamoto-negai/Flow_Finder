
import React, { useEffect, useState, useRef } from "react";
import type { Field } from './types';

type Node = {
  id: number;
  name: string;
  x: number;  // 写真上のX座標
  y: number;  // 写真上のY座標
  congestion: number;
  tourist: boolean;
};

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
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [newNodeName, setNewNodeName] = useState("");
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [clickPosition, setClickPosition] = useState<{ x: number, y: number } | null>(null);
  const [activeField, setActiveField] = useState<Field | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // アクティブなフィールドを取得
    fetch("http://localhost:8080/fields/active")
      .then((res) => res.json())
      .then((data) => setActiveField(data))
      .catch(() => setActiveField(null));

    // ノード一覧を取得
    fetch("http://localhost:8080/nodes")
      .then((res) => res.json())
      .then((data) => setNodes(data))
      .catch(() => setNodes([]));
  }, []);

  // 写真上のクリック処理
  const handleImageClick = (event: React.MouseEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const rect = img.getBoundingClientRect();
    
    // クリック位置を取得（表示画像上の座標）
    const displayX = event.clientX - rect.left;
    const displayY = event.clientY - rect.top;
    
    // 画像の実際のサイズと表示サイズの比率を計算
    const scaleX = activeField ? activeField.width / img.offsetWidth : 1;
    const scaleY = activeField ? activeField.height / img.offsetHeight : 1;
    
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
    } else if (isAddingNode) {
      // 新しいノード追加モード（実際の画像座標を使用）
      const actualX = displayX * scaleX;
      const actualY = displayY * scaleY;
      setClickPosition({ x: actualX, y: actualY });
      setShowNodeForm(true);
    }
  };

  // ノードクリック処理（リンク作成用）
  const handleNodeClick = (node: Node) => {
    if (!linkMode) return;
    if (selected.length === 0) setSelected([node]);
    else if (selected.length === 1 && selected[0].id !== node.id) setSelected([selected[0], node]);
    else setSelected([node]);
  };

  // 新しいノードを追加
  const handleAddNode = async () => {
    if (!clickPosition || !newNodeName.trim()) return;

    try {
      const res = await fetch("http://localhost:8080/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newNodeName,
          x: clickPosition.x,
          y: clickPosition.y,
          congestion: 1,
          tourist: false,
          field_id: activeField?.id
        }),
      });
      
      if (!res.ok) throw new Error("ノード追加失敗");
      
      // ノード一覧を再取得
      const updatedNodes = await fetch("http://localhost:8080/nodes").then(res => res.json());
      setNodes(updatedNodes);
      
      // フォームをリセット
      setNewNodeName("");
      setShowNodeForm(false);
      setClickPosition(null);
      setIsAddingNode(false);
    } catch (err: any) {
      alert("ノード追加に失敗しました: " + err.message);
    }
  };

  const handleRegisterLink = async () => {
    if (selected.length !== 2) return;
    setLinkMsg(null);
    try {
      const res = await fetch("http://localhost:8080/links", {
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
        <button
          onClick={() => setIsAddingNode(!isAddingNode)}
          style={{
            padding: "8px 16px",
            backgroundColor: isAddingNode ? "#dc3545" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer"
          }}
        >
          {isAddingNode ? "ノード追加モード終了" : "ノード追加モード"}
        </button>
        
        {isAddingNode && (
          <span style={{ color: "#6c757d", fontSize: "0.9rem" }}>
            📍 写真上をクリックしてノードを追加してください
          </span>
        )}
      </div>

      {/* 写真とノード表示 */}
      <div style={{ position: "relative", border: "2px solid #dee2e6", borderRadius: 8, overflow: "hidden" }}>
        <img
          ref={imageRef}
          src={activeField ? `http://localhost:8080${activeField.image_url}` : "/map-image.jpg"}
          alt={activeField ? activeField.name : "マップ画像"}
          style={{ 
            width: "100%", 
            maxWidth: 800,
            height: "auto",
            display: "block",
            cursor: isAddingNode ? "crosshair" : "default"
          }}
          onClick={handleImageClick}
        />
        
        {/* ノードを表示 */}
        {nodes.map((node) => {
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
                color: "white"
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
        })}
      </div>

      {/* ノード追加フォーム */}
      {showNodeForm && clickPosition && (
        <div style={{ 
          position: "absolute", 
          top: 100, 
          left: 20, 
          background: "#fff", 
          borderRadius: 8, 
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)", 
          padding: 20, 
          zIndex: 1000,
          minWidth: 300
        }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#333" }}>新しいノードを追加</h3>
          <div style={{ marginBottom: 12 }}>
            <strong>位置:</strong> X={Math.round(clickPosition.x)}, Y={Math.round(clickPosition.y)}
          </div>
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              placeholder="ノード名を入力"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 4,
                fontSize: "14px"
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button 
              onClick={handleAddNode}
              disabled={!newNodeName.trim()}
              style={{
                padding: "8px 16px",
                backgroundColor: newNodeName.trim() ? "#28a745" : "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: newNodeName.trim() ? "pointer" : "not-allowed"
              }}
            >
              追加
            </button>
            <button 
              onClick={() => {
                setShowNodeForm(false);
                setClickPosition(null);
                setNewNodeName("");
              }}
              style={{
                padding: "8px 16px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

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
