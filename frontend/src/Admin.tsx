import React, { useState } from "react";
import "./App.css";

const Admin: React.FC = () => {
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [congestion, setCongestion] = useState(0);
  const [tourist, setTourist] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 500, margin: "40px auto" }}>
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
  );
};

export default Admin;
