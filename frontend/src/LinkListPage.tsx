import React, { useEffect, useState } from "react";

interface Node {
  id: number;
  name: string;
}
interface Link {
  id: number;
  from_node_id: number;
  to_node_id: number;
  distance: number;
}


function getNodeIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const node = params.get("node");
  return node ? Number(node) : null;
}

const LinkListPage: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(getNodeIdFromQuery());

  useEffect(() => {
    fetch("http://localhost:8080/nodes")
      .then(res => res.json())
      .then(data => setNodes(data))
      .catch(() => setNodes([]));
    fetch("http://localhost:8080/links")
      .then(res => res.json())
      .then(data => setLinks(data))
      .catch(() => setLinks([]));
  }, []);

  return (
    <div style={{ maxWidth: 500, margin: "32px auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0001", padding: 24 }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: 16 }}>現在地から接続されているリンク</h1>
      <div style={{ marginBottom: 16 }}>
        <select value={currentNodeId ?? ''} onChange={e => setCurrentNodeId(Number(e.target.value))} style={{ fontSize: 16, padding: 4 }}>
          <option value="">ノードを選択</option>
          {nodes.map(n => (
            <option key={n.id} value={n.id}>{n.name} (ID:{n.id})</option>
          ))}
        </select>
      </div>
      {currentNodeId && (
        <ul>
          {links.filter(l => l.from_node_id === currentNodeId).map(l => {
            const otherNode = nodes.find(n => n.id === l.to_node_id);
            return (
              <li key={l.id} style={{ marginBottom: 8, display: "flex", alignItems: "center" }}>
                <span style={{ flex: 1 }}>
                  <b>リンクID:</b> {l.id}　<b>到着ノード:</b> {otherNode?.name ?? l.to_node_id}　<b>距離:</b> {l.distance}m
                </span>
                <button style={{ marginLeft: 12 }} onClick={() => window.location.href = `/links/${l.id}`}>ここに進む</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default LinkListPage;
