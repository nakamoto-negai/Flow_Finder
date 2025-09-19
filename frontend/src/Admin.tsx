import React, { useState, useEffect } from "react";
import MapView from "./MapView";
import "./App.css";

const Admin: React.FC = () => {
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [congestion, setCongestion] = useState(0);
  const [tourist, setTourist] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // Link用
  const [nodes, setNodes] = useState<{ id: number; name: string; latitude?: number; longitude?: number }[]>([]);
  const [links, setLinks] = useState<{ id: number; from_node_id: number; to_node_id: number; distance: number }[]>([]);
  const [fromNodeId, setFromNodeId] = useState(0);
  const [toNodeId, setToNodeId] = useState(0);
  const [distance, setDistance] = useState(0);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  // ノード・リンク一覧取得
  const fetchNodes = () => {
    fetch("http://localhost:8080/nodes")
      .then(res => res.json())
      .then(data => setNodes(data))
      .catch(() => setNodes([]));
  };
  const fetchLinks = () => {
    fetch("http://localhost:8080/links")
      .then(res => res.json())
      .then(data => setLinks(data))
      .catch(() => setLinks([]));
  };
  useEffect(() => {
    fetchNodes();
    fetchLinks();
  }, []);

  // 地図リンク作成モード
  const [showMap, setShowMap] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await fetch("http://localhost:8080/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          congestion: Number(congestion),
          tourist,
          imageUrl: imageUrl || undefined,
        }),
      });
      if (!res.ok) throw new Error("登録失敗");
  setMessage("ノードを登録しました");
  setName(""); setLatitude(""); setLongitude(""); setCongestion(0); setTourist(false); setImageUrl("");
  fetchNodes();
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "40px auto" }}>
  <div className="card">
        <h2 className="login-title">管理者ノード登録</h2>
        <form onSubmit={handleSubmit} className="login-form" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="名前" required />
          <input type="number" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="緯度 (例: 35.68)" required step="any" />
          <input type="number" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="経度 (例: 139.76)" required step="any" />
          <select value={congestion} onChange={e => setCongestion(Number(e.target.value))} style={{ width: "70%", marginBottom: 12 }}>
            <option value={0}>空いてる</option>
            <option value={1}>普通</option>
            <option value={2}>混雑</option>
          </select>
          <label style={{ width: "70%", textAlign: "left", marginBottom: 12 }}>
            <input type="checkbox" checked={tourist} onChange={e => setTourist(e.target.checked)} /> 観光地
          </label>
          <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="画像URL (任意)" />
          <button type="submit">ノード登録</button>
        </form>
        {message && <p style={{ color: message.includes("登録") ? "#16a34a" : "#dc2626", marginTop: 16 }}>{message}</p>}
      </div>

      {/* --- Link追加フォーム --- */}
      <div className="card">
        <button type="button" style={{ marginBottom: 16 }} onClick={() => setShowMap(true)}>
          地図からリンク作成
        </button>
        <h2 className="login-title" style={{ fontSize: "1.3rem" }}>リンク登録</h2>
        <form
          onSubmit={async e => {
            e.preventDefault();
            setLinkMsg(null);
            if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) {
              setLinkMsg("ノードを正しく選択してください");
              return;
            }
            try {
              const res = await fetch("http://localhost:8080/links", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  from_node_id: fromNodeId,
                  to_node_id: toNodeId,
                  distance: Number(distance),
                }),
              });
              if (!res.ok) throw new Error("登録失敗");
              setLinkMsg("リンクを登録しました");
              setFromNodeId(0); setToNodeId(0); setDistance(0);
              fetchLinks();
            } catch (err: any) {
              setLinkMsg(err.message);
            }
          }}
          className="login-form"
          style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          <select value={fromNodeId} onChange={e => setFromNodeId(Number(e.target.value))} required style={{ width: "70%", marginBottom: 12 }}>
            <option value={0}>出発ノードを選択</option>
            {nodes.map(n => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
          <select value={toNodeId} onChange={e => setToNodeId(Number(e.target.value))} required style={{ width: "70%", marginBottom: 12 }}>
            <option value={0}>到着ノードを選択</option>
            {nodes.map(n => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
          <input type="number" value={distance} onChange={e => setDistance(Number(e.target.value))} placeholder="距離 (m)" required min={1} style={{ marginBottom: 12 }} />
          <button type="submit">リンク登録</button>
        </form>
        {linkMsg && <p style={{ color: linkMsg.includes("登録") ? "#16a34a" : "#dc2626", marginTop: 16 }}>{linkMsg}</p>}
      </div>
      {/* --- 地図リンク作成モーダル --- */}
      {showMap && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "#0007", zIndex: 2000,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px #0003", padding: 24, position: "relative" }}>
            <button onClick={() => setShowMap(false)} style={{ position: "absolute", top: 8, right: 12, fontSize: 20, background: "none", border: "none", cursor: "pointer" }}>×</button>
            <h3 style={{ marginBottom: 12 }}>地図からリンク作成</h3>
            <MapView linkMode onLinkCreated={() => { setShowMap(false); fetchLinks(); }} />
          </div>
        </div>
      )}
      {/* --- ノード一覧 --- */}
      <div className="card" style={{ marginTop: 32 }}>
        <h3 style={{ marginBottom: 12 }}>ノード一覧</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              <th>ID</th><th>名前</th><th>緯度</th><th>経度</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map(n => (
              <tr key={n.id}>
                <td>{n.id}</td><td>{n.name}</td><td>{n.latitude?.toFixed?.(5) ?? ""}</td><td>{n.longitude?.toFixed?.(5) ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- リンク一覧 --- */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>リンク一覧</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              <th>ID</th><th>出発ノード</th><th>到着ノード</th><th>距離(m)</th>
            </tr>
          </thead>
          <tbody>
            {links.map(l => (
              <tr key={l.id}>
                <td>{l.id}</td>
                <td>{nodes.find(n => n.id === l.from_node_id)?.name ?? l.from_node_id}</td>
                <td>{nodes.find(n => n.id === l.to_node_id)?.name ?? l.to_node_id}</td>
                <td>{l.distance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Admin;
