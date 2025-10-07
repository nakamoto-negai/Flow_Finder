import React, { useEffect, useState } from "react";

interface Node {
  id: number;
  name: string;
}

interface TouristDestination {
  id: number;
  name: string;
  category: string;
  current_count: number;
  max_capacity: number;
  congestion_ratio: number;
  is_open: boolean;
  type: "main_destination" | "related_destination";
}

interface EnhancedLink {
  id: number;
  from_node: string;
  to_node: string;
  distance: number;
  label: string;
  enhanced_label: string;
  destinations: TouristDestination[];
  has_tourist_destinations: boolean;
}

interface ApiResponse {
  links: EnhancedLink[];
  total: number;
}

function getNodeIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const node = params.get("node");
  return node ? Number(node) : null;
}

const LinkListPage: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [enhancedLinks, setEnhancedLinks] = useState<EnhancedLink[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(getNodeIdFromQuery());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // ノード一覧の取得
    fetch("http://localhost:8080/nodes")
      .then(res => res.json())
      .then(data => setNodes(data))
      .catch(() => setNodes([]));

    // 拡張リンク情報の取得
    setLoading(true);
    fetch("http://localhost:8080/api/links/with-destinations")
      .then(res => res.json())
      .then((data: ApiResponse) => {
        setEnhancedLinks(data.links);
        setLoading(false);
      })
      .catch(() => {
        setEnhancedLinks([]);
        setLoading(false);
      });
  }, []);

  // 混雑度に応じた色の取得
  const getCongestionColor = (ratio: number) => {
    if (ratio >= 80) return "#ef4444"; // 赤（非常に混雑）
    if (ratio >= 60) return "#f59e0b"; // オレンジ（混雑）
    if (ratio >= 40) return "#eab308"; // 黄色（普通）
    return "#22c55e"; // 緑（空いている）
  };

  // 混雑度のラベル取得
  const getCongestionLabel = (ratio: number) => {
    if (ratio >= 80) return "非常に混雑";
    if (ratio >= 60) return "混雑";
    if (ratio >= 40) return "普通";
    return "空いている";
  };

  return (
    <div style={{ maxWidth: 600, margin: "32px auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0001", padding: 24 }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: 16 }}>現在地から接続されているリンク</h1>
      
      <div style={{ marginBottom: 16 }}>
        <select 
          value={currentNodeId ?? ''} 
          onChange={e => setCurrentNodeId(Number(e.target.value))} 
          style={{ fontSize: 16, padding: 8, borderRadius: 4, border: "1px solid #ccc", width: "100%" }}
        >
          <option value="">ノードを選択</option>
          {nodes.map(n => (
            <option key={n.id} value={n.id}>{n.name} (ID:{n.id})</option>
          ))}
        </select>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 20, color: "#666" }}>
          読み込み中...
        </div>
      )}

      {currentNodeId && !loading && (
        <div>
          {enhancedLinks
            .filter(link => {
              // 選択されたノードから出発するリンクをフィルタ
              const fromNode = nodes.find(n => n.name === link.from_node);
              return fromNode?.id === currentNodeId;
            })
            .map(link => (
              <div 
                key={link.id} 
                style={{ 
                  marginBottom: 16, 
                  padding: 16, 
                  border: "1px solid #e5e7eb", 
                  borderRadius: 8,
                  background: link.has_tourist_destinations ? "#f0f9ff" : "#f9fafb"
                }}
              >
                {/* リンク基本情報 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#1f2937" }}>
                    {link.enhanced_label}
                  </h3>
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

                {/* 観光地情報 */}
                {link.has_tourist_destinations && (
                  <div style={{ marginTop: 12 }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "0.9rem", color: "#374151" }}>
                      🏛️ 到達できる観光地:
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {link.destinations.map(dest => (
                        <div 
                          key={dest.id}
                          style={{ 
                            padding: 12, 
                            background: "white", 
                            borderRadius: 6, 
                            border: "1px solid #e5e7eb",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <strong style={{ color: "#1f2937" }}>{dest.name}</strong>
                              {dest.category && (
                                <span style={{ 
                                  padding: "2px 6px", 
                                  background: "#e5e7eb", 
                                  borderRadius: 4, 
                                  fontSize: "0.8rem",
                                  color: "#6b7280"
                                }}>
                                  {dest.category}
                                </span>
                              )}
                              <span style={{ 
                                padding: "2px 6px", 
                                background: dest.type === "main_destination" ? "#dbeafe" : "#f3f4f6", 
                                borderRadius: 4, 
                                fontSize: "0.7rem",
                                color: dest.type === "main_destination" ? "#1e40af" : "#6b7280"
                              }}>
                                {dest.type === "main_destination" ? "メイン" : "関連"}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 16, fontSize: "0.8rem", color: "#6b7280" }}>
                              <span>人数: {dest.current_count}/{dest.max_capacity}人</span>
                              <span style={{ color: getCongestionColor(dest.congestion_ratio) }}>
                                混雑度: {Math.round(dest.congestion_ratio)}% ({getCongestionLabel(dest.congestion_ratio)})
                              </span>
                              <span style={{ 
                                color: dest.is_open ? "#22c55e" : "#ef4444",
                                fontWeight: "bold"
                              }}>
                                {dest.is_open ? "営業中" : "閉鎖中"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 観光地情報がない場合 */}
                {!link.has_tourist_destinations && (
                  <div style={{ color: "#6b7280", fontSize: "0.9rem", fontStyle: "italic" }}>
                    このリンクの先に観光地はありません
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {currentNodeId && !loading && enhancedLinks.filter(link => {
        const fromNode = nodes.find(n => n.name === link.from_node);
        return fromNode?.id === currentNodeId;
      }).length === 0 && (
        <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>
          選択されたノードから出発するリンクはありません
        </div>
      )}
    </div>
  );
};

export default LinkListPage;
