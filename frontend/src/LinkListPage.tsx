import React, { useEffect, useState } from "react";
import Header from "./Header";

const LinkListPage: React.FC = () => {
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("LinkListPage useEffect started");
    
    // ノード一覧の取得
    setLoading(true);
    fetch("http://localhost:8080/nodes")
      .then(res => {
        console.log("Nodes response status:", res.status);
        return res.json();
      })
      .then(data => {
        console.log("Raw nodes data:", data);
        try {
          let nodeArray = [];
          if (data && typeof data === 'object' && data.value && Array.isArray(data.value)) {
            nodeArray = data.value;
          } else if (Array.isArray(data)) {
            nodeArray = data;
          }
          console.log("Processed nodes array:", nodeArray);
          setNodes(nodeArray);
        } catch (err) {
          console.error("Error processing nodes:", err);
          setNodes([]);
          setError("ノードデータの処理に失敗しました");
        }
      })
      .catch(err => {
        console.error("Nodes fetch error:", err);
        setNodes([]);
        setError("ノードデータの取得に失敗しました");
      });

    // リンク情報の取得
    fetch("http://localhost:8080/links")
      .then(res => {
        console.log("Links response status:", res.status);
        return res.json();
      })
      .then(data => {
        console.log("Raw links data:", data);
        try {
          let linkArray = [];
          if (data && typeof data === 'object' && data.value && Array.isArray(data.value)) {
            linkArray = data.value;
          } else if (Array.isArray(data)) {
            linkArray = data;
          }
          console.log("Processed links array:", linkArray);
          setLinks(linkArray);
        } catch (err) {
          console.error("Error processing links:", err);
          setLinks([]);
          setError("リンクデータの処理に失敗しました");
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Links fetch error:", err);
        setLinks([]);
        setError("リンクデータの取得に失敗しました");
        setLoading(false);
      });
  }, []);

  console.log("Current state:", { nodes, links, currentNodeId, loading, error });

  const handleNodeChange = (nodeId: number) => {
    setCurrentNodeId(nodeId);
  };

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Header currentNodeId={currentNodeId} onNodeChange={handleNodeChange} />
        <div style={{ maxWidth: 600, margin: "32px auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0001", padding: 24 }}>
          <h1 style={{ color: "red" }}>エラーが発生しました</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Header currentNodeId={currentNodeId} onNodeChange={handleNodeChange} />
      <div style={{ maxWidth: 600, margin: "32px auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0001", padding: 24 }}>
        <h1 style={{ fontSize: "1.3rem", marginBottom: 16 }}>リンク一覧ページ</h1>
      
      {loading && (
        <div style={{ textAlign: "center", padding: 20, color: "#666" }}>
          読み込み中...
        </div>
      )}

      {!loading && (
        <>
          <div style={{ marginBottom: 16 }}>
            <h3>デバッグ情報:</h3>
            <p>ノード数: {nodes ? nodes.length : "undefined"}</p>
            <p>リンク数: {links ? links.length : "undefined"}</p>
            <p>選択されたノードID: {currentNodeId || "なし"}</p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <select 
              value={currentNodeId || ''} 
              onChange={e => setCurrentNodeId(Number(e.target.value))} 
              style={{ fontSize: 16, padding: 8, borderRadius: 4, border: "1px solid #ccc", width: "100%" }}
            >
              <option value="">ノードを選択</option>
              {nodes && nodes.length > 0 && nodes.map((node, index) => (
                <option key={node.id || index} value={node.id}>
                  {node.name || `ノード${node.id}`} (ID:{node.id})
                </option>
              ))}
            </select>
          </div>

          {currentNodeId && links && links.length > 0 && (
            <div>
              <h3>選択されたノードから出発するリンク:</h3>
              {links
                .filter(link => link && link.from_node_id === currentNodeId)
                .map((link, index) => (
                  <div 
                    key={link.id || index} 
                    style={{ 
                      marginBottom: 16, 
                      padding: 16, 
                      border: "1px solid #e5e7eb", 
                      borderRadius: 8,
                      background: "#f9fafb"
                    }}
                  >
                    <h4 style={{ margin: "0 0 8px 0" }}>
                      ノード {link.from_node_id} → ノード {link.to_node_id}
                    </h4>
                    <p style={{ margin: "4px 0", fontSize: "0.9rem", color: "#666" }}>
                      距離: {link.distance}m | 重み: {link.weight} | 
                      方向: {link.is_directed ? "一方向" : "双方向"}
                    </p>
                    <button 
                      style={{ 
                        padding: "8px 16px", 
                        background: "#3b82f6", 
                        color: "white", 
                        border: "none", 
                        borderRadius: 4, 
                        cursor: "pointer" 
                      }}
                      onClick={() => window.location.href = `/links/${link.id}`}
                    >
                      ここに進む
                    </button>
                  </div>
                ))}
              
              {links.filter(link => link && link.from_node_id === currentNodeId).length === 0 && (
                <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>
                  選択されたノードから出発するリンクはありません
                </div>
              )}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
};

export default LinkListPage;
