import React, { useEffect, useState } from "react";
import Header from "./Header";

const LinkListPage: React.FC = () => {
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [currentNode, setCurrentNode] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URLからノードIDを取得
  const getNodeIdFromUrl = (): number | null => {
    const urlParams = new URLSearchParams(window.location.search);
    const nodeParam = urlParams.get('node');
    return nodeParam ? parseInt(nodeParam, 10) : null;
  };

  useEffect(() => {
    console.log("LinkListPage useEffect started");
    
    setLoading(true);
    
    // URLからノードIDを取得
    const nodeId = getNodeIdFromUrl();
    
    // ノード一覧の取得
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
          
          // 指定されたノードIDに対応するノードを設定
          if (nodeId && nodeArray.length > 0) {
            const foundNode = nodeArray.find((node: any) => node.id === nodeId);
            if (foundNode) {
              setCurrentNode(foundNode);
            } else {
              setError(`ノードID ${nodeId} が見つかりません`);
            }
          } else if (!nodeId) {
            setError("ノードIDが指定されていません。URLに ?node=1 のようにノードIDを指定してください。");
          }
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

  console.log("Current state:", { nodes, links, currentNode, loading, error });

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Header />
        <div style={{ maxWidth: 600, margin: "32px auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0001", padding: 24 }}>
          <h1 style={{ color: "red" }}>エラーが発生しました</h1>
          <p>{error}</p>
          <div style={{ marginTop: '20px' }}>
            <h3>利用可能なノード一覧:</h3>
            {nodes.length > 0 ? (
              <ul>
                {nodes.map(node => (
                  <li key={node.id}>
                    <a href={`/links?node=${node.id}`} style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                      {node.name} (ID: {node.id})
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>ノードが見つかりません</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Header />
      <div style={{ maxWidth: 600, margin: "32px auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0001", padding: 24 }}>
        {currentNode ? (
          <>
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{ fontSize: "1.5rem", marginBottom: 0 }}>
                📍 {currentNode.name}
              </h1>
              <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                ID: {currentNode.id}
              </div>
            </div>
            
            {currentNode.tourist && (
              <div style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '0.9rem'
              }}>
                🌟 観光地スポット
              </div>
            )}
            
            <div style={{
              background: '#f1f5f9',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '20px',
              fontSize: '0.9rem'
            }}>
              <strong>ノード情報:</strong><br />
              座標: ({currentNode.x}, {currentNode.y})<br />
              混雑度: {currentNode.congestion}/10
            </div>
          </>
        ) : (
          <h1 style={{ fontSize: "1.3rem", marginBottom: 16 }}>ノード情報</h1>
        )}
      
      {loading && (
        <div style={{ textAlign: "center", padding: 20, color: "#666" }}>
          読み込み中...
        </div>
      )}

      {!loading && currentNode && (
        <>
          <h2 style={{ fontSize: "1.2rem", marginBottom: 16, borderBottom: '2px solid #e5e7eb', paddingBottom: '8px' }}>
            このノードから出発できるルート
          </h2>

          {links && links.length > 0 && (
            <div>
              {links
                .filter(link => link && link.from_node_id === currentNode.id)
                .map((link, index) => {
                  const toNode = nodes.find((node: any) => node.id === link.to_node_id);
                  return (
                    <div 
                      key={link.id || index} 
                      style={{ 
                        marginBottom: 16, 
                        padding: 16, 
                        border: "1px solid #e5e7eb", 
                        borderRadius: 8,
                        background: "#f9fafb",
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <h3 style={{ margin: "0 0 8px 0", fontSize: '1.1rem' }}>
                        🚶‍♂️ {currentNode.name} → {toNode ? toNode.name : `ノード${link.to_node_id}`}
                      </h3>
                      <div style={{ margin: "8px 0", fontSize: "0.9rem", color: "#666" }}>
                        <div>📏 距離: {link.distance}m</div>
                        <div>⚖️ 重み: {link.weight}</div>
                        <div>🧭 方向: {link.is_directed ? "一方向" : "双方向"}</div>
                        {toNode && (
                          <div>📍 到着地: {toNode.name} (座標: {toNode.x}, {toNode.y})</div>
                        )}
                      </div>
                      <button 
                        style={{ 
                          padding: "10px 20px", 
                          background: "#3b82f6", 
                          color: "white", 
                          border: "none", 
                          borderRadius: 6, 
                          cursor: "pointer",
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#3b82f6'}
                        onClick={() => window.location.href = `/links/${link.id}`}
                      >
                        このルートを進む →
                      </button>
                    </div>
                  );
                })}
              
              {links.filter(link => link && link.from_node_id === currentNode.id).length === 0 && (
                <div style={{ 
                  textAlign: "center", 
                  padding: 40, 
                  color: "#6b7280", 
                  background: '#f8fafc', 
                  borderRadius: 8,
                  border: '2px dashed #d1d5db'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🚫</div>
                  <div>このノードから出発するルートはありません</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                    管理者にルートの追加を依頼してください
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div style={{ 
            marginTop: '30px', 
            padding: '20px', 
            background: '#f1f5f9', 
            borderRadius: 8,
            borderLeft: '4px solid #3b82f6'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>🗺️ 他のノードを探索</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {nodes.filter(node => node.id !== currentNode.id).map(node => (
                <a
                  key={node.id}
                  href={`/links?node=${node.id}`}
                  style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    background: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    color: '#374151',
                    textDecoration: 'none',
                    fontSize: '0.8rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#3b82f6';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = '#374151';
                  }}
                >
                  {node.name}
                </a>
              ))}
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
};

export default LinkListPage;
