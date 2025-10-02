import React, { useState, useEffect, useRef } from "react";
// ...existing code...
import MapView from "./MapView";
import { logger } from "./logger";
import "./App.css";

const Admin: React.FC = () => {
  // ドラッグ＆ドロップ用
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // ログ表示用
  const [logs, setLogs] = useState<any[]>([]);
  const [logStats, setLogStats] = useState<any>({});
  const [showLogView, setShowLogView] = useState(false);

  // 画像アップロード
  const handleImageDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("http://localhost:8080/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("アップロード失敗");
      const data = await res.json();
      if (data.url) {
        setImageUrlInput(data.url);
        setImageMsg("画像をアップロードしました");
      } else {
        setImageMsg("アップロード失敗");
      }
    } catch (err: any) {
      setImageMsg(err.message || "アップロード失敗");
    }
  };
  // 画像用 state
  const [images, setImages] = useState<{ id: number; link_id: number; order: number; url: string }[]>([]);
  const [imageLinkId, setImageLinkId] = useState(0);
  const [imageOrder, setImageOrder] = useState(1);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageMsg, setImageMsg] = useState<string | null>(null);

  // 画像一覧取得
  const fetchImages = () => {
    fetch("http://localhost:8080/images")
      .then(res => res.json())
      .then(data => setImages(data))
      .catch(() => setImages([]));
  };
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [congestion, setCongestion] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [selectedTouristSpotId, setSelectedTouristSpotId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Link用
  const [nodes, setNodes] = useState<{ id: number; name: string; latitude?: number; longitude?: number }[]>([]);
  const [links, setLinks] = useState<{ id: number; from_node_id: number; to_node_id: number; distance: number }[]>([]);
  const [fromNodeId, setFromNodeId] = useState(0);
  const [toNodeId, setToNodeId] = useState(0);
  const [distance, setDistance] = useState(0);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  // 観光地用 state
  const [touristSpots, setTouristSpots] = useState<any[]>([]);
  const [spotName, setSpotName] = useState("");
  const [spotDescription, setSpotDescription] = useState("");
  const [spotCategory, setSpotCategory] = useState("");
  const [spotNodeId, setSpotNodeId] = useState(0);
  const [spotMaxCapacity, setSpotMaxCapacity] = useState(100);
  const [spotCurrentCount, setSpotCurrentCount] = useState(0);
  const [spotIsOpen, setSpotIsOpen] = useState(true);
  const [spotOpeningTime, setSpotOpeningTime] = useState("09:00");
  const [spotClosingTime, setSpotClosingTime] = useState("18:00");
  const [spotEntryFee, setSpotEntryFee] = useState(0);
  const [spotWebsite, setSpotWebsite] = useState("");
  const [spotPhoneNumber, setSpotPhoneNumber] = useState("");
  const [spotImageURL, setSpotImageURL] = useState("");
  const [spotMsg, setSpotMsg] = useState<string | null>(null);

  // 観光地一覧取得
  const fetchTouristSpots = () => {
    fetch("http://localhost:8080/tourist-spots")
      .then(res => res.json())
      .then(data => setTouristSpots(data))
      .catch(() => setTouristSpots([]));
  };

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
    fetchImages();
    fetchTouristSpots();
    logger.logPageView('/admin');
  }, []);
  
  // ログ取得関数
  const fetchLogs = async () => {
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch('http://localhost:8080/api/logs?limit=50'),
        fetch('http://localhost:8080/api/logs/stats')
      ]);
      
      if (logsRes.ok && statsRes.ok) {
        const logsData = await logsRes.json();
        const statsData = await statsRes.json();
        setLogs(logsData.logs || []);
        setLogStats(statsData);
      }
    } catch (error) {
      console.error('ログ取得エラー:', error);
    }
  };

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
          tourist_spot_id: selectedTouristSpotId || undefined,
        }),
      });
      if (!res.ok) throw new Error("登録失敗");
      setMessage("ノードを登録しました");
      setName(""); 
      setLatitude(""); 
      setLongitude(""); 
      setCongestion(0); 
      setSelectedTouristSpotId(null);
      fetchNodes();
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "40px auto" }}>
      {/* --- ノード登録フォーム --- */}
      <div className="card">
        <h2 className="login-title">管理者ノード登録</h2>
        <form onSubmit={handleSubmit} className="login-form" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="名前" required />
          <input type="number" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="緯度 (例: 35.68)" required step="any" />
          <input type="number" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="経度 (例: 139.76)" required step="any" />
          <input 
            type="number" 
            value={congestion} 
            onChange={e => setCongestion(Number(e.target.value))} 
            placeholder="人数 (例: 15)" 
            min="0" 
            max="99999"
            style={{ width: "70%", marginBottom: 12, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
          <select 
            value={selectedTouristSpotId || ""} 
            onChange={e => setSelectedTouristSpotId(e.target.value ? Number(e.target.value) : null)}
            style={{ width: "70%", marginBottom: 12, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          >
            <option value="">関連する観光地（任意）</option>
            {touristSpots.map(spot => (
              <option key={spot.id} value={spot.id}>{spot.name}</option>
            ))}
          </select>
          <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="画像URL (任意)" style={{ marginBottom: 12 }} />
          <button type="submit">ノード登録</button>
        </form>
        {message && <p style={{ color: message && message.includes("登録") ? "#16a34a" : "#dc2626", marginTop: 16 }}>{message}</p>}
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
        {linkMsg && <p style={{ color: linkMsg && linkMsg.includes("登録") ? "#16a34a" : "#dc2626", marginTop: 16 }}>{linkMsg}</p>}
      </div>

      {/* --- 観光地作成フォーム --- */}
      <div className="card">
        <h2 className="login-title" style={{ fontSize: "1.3rem" }}>観光地登録</h2>
        <form
          onSubmit={async e => {
            e.preventDefault();
            setSpotMsg(null);
            if (!spotNodeId || !spotName || !spotMaxCapacity) {
              setSpotMsg("必須項目を入力してください");
              return;
            }
            try {
              const res = await fetch("http://localhost:8080/tourist-spots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  node_id: spotNodeId,
                  name: spotName,
                  description: spotDescription,
                  category: spotCategory,
                  max_capacity: spotMaxCapacity,
                  current_count: spotCurrentCount,
                  is_open: spotIsOpen,
                  opening_time: spotOpeningTime,
                  closing_time: spotClosingTime,
                  entry_fee: spotEntryFee,
                  website: spotWebsite,
                  phone_number: spotPhoneNumber,
                  image_url: spotImageURL,
                }),
              });
              if (!res.ok) throw new Error("登録失敗");
              setSpotMsg("観光地を登録しました");
              setSpotName("");
              setSpotDescription("");
              setSpotCategory("");
              setSpotNodeId(0);
              setSpotMaxCapacity(100);
              setSpotCurrentCount(0);
              setSpotIsOpen(true);
              setSpotOpeningTime("09:00");
              setSpotClosingTime("18:00");
              setSpotEntryFee(0);
              setSpotWebsite("");
              setSpotPhoneNumber("");
              setSpotImageURL("");
              fetchTouristSpots();
            } catch (err: any) {
              setSpotMsg(err.message);
            }
          }}
          className="login-form"
          style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          <input type="text" value={spotName} onChange={e => setSpotName(e.target.value)} placeholder="観光地名" required style={{ marginBottom: 12 }} />
          <select value={spotNodeId} onChange={e => setSpotNodeId(Number(e.target.value))} required style={{ width: "70%", marginBottom: 12 }}>
            <option value={0}>メインノードを選択</option>
            {nodes.map(n => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
          <input type="text" value={spotCategory} onChange={e => setSpotCategory(e.target.value)} placeholder="カテゴリ（神社、公園など）" style={{ marginBottom: 12 }} />
          <input type="number" value={spotMaxCapacity} onChange={e => setSpotMaxCapacity(Number(e.target.value))} placeholder="許容人数" required min={1} style={{ marginBottom: 12 }} />
          <input type="number" value={spotCurrentCount} onChange={e => setSpotCurrentCount(Number(e.target.value))} placeholder="現在の人数" min={0} style={{ marginBottom: 12 }} />
          <textarea value={spotDescription} onChange={e => setSpotDescription(e.target.value)} placeholder="説明（任意）" style={{ marginBottom: 12, width: "70%", minHeight: 60 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input type="time" value={spotOpeningTime} onChange={e => setSpotOpeningTime(e.target.value)} />
            <span>〜</span>
            <input type="time" value={spotClosingTime} onChange={e => setSpotClosingTime(e.target.value)} />
          </div>
          <input type="number" value={spotEntryFee} onChange={e => setSpotEntryFee(Number(e.target.value))} placeholder="入場料（円）" min={0} style={{ marginBottom: 12 }} />
          <input type="url" value={spotWebsite} onChange={e => setSpotWebsite(e.target.value)} placeholder="公式サイト（任意）" style={{ marginBottom: 12 }} />
          <input type="tel" value={spotPhoneNumber} onChange={e => setSpotPhoneNumber(e.target.value)} placeholder="電話番号（任意）" style={{ marginBottom: 12 }} />
          <input type="url" value={spotImageURL} onChange={e => setSpotImageURL(e.target.value)} placeholder="画像URL（任意）" style={{ marginBottom: 12 }} />
          <label style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={spotIsOpen} onChange={e => setSpotIsOpen(e.target.checked)} /> 営業中
          </label>
          <button type="submit">観光地登録</button>
        </form>
        {spotMsg && <p style={{ color: spotMsg && spotMsg.includes("登録") ? "#16a34a" : "#dc2626", marginTop: 16 }}>{spotMsg}</p>}
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

      {/* --- Image追加フォーム --- */}
      <div className="card">
        <h2 className="login-title" style={{ fontSize: "1.1rem" }}>画像登録</h2>
        <div
          ref={dropRef}
          onDragOver={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
          onDrop={handleImageDrop}
          style={{
            border: dragActive ? "2px solid #2563eb" : "2px dashed #94a3b8",
            background: dragActive ? "#e0e7ff" : "#f8fafc",
            borderRadius: 8,
            padding: 20,
            marginBottom: 16,
            textAlign: "center",
            color: "#334155",
            cursor: "pointer"
          }}
        >
          ここに画像ファイルをドラッグ＆ドロップ
        </div>
        <form
          onSubmit={async e => {
            e.preventDefault();
            setImageMsg(null);
            if (!imageLinkId || !imageUrlInput) {
              setImageMsg("リンクと画像URLを指定してください");
              return;
            }
            try {
              const res = await fetch("http://localhost:8080/images", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  link_id: imageLinkId,
                  order: imageOrder,
                  url: imageUrlInput,
                }),
              });
              if (!res.ok) throw new Error("登録失敗");
              setImageMsg("画像を登録しました");
              setImageLinkId(0); setImageOrder(1); setImageUrlInput("");
              fetchImages();
            } catch (err: any) {
              setImageMsg(err.message);
            }
          }}
          className="login-form"
          style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          <select value={imageLinkId} onChange={e => setImageLinkId(Number(e.target.value))} required style={{ width: "70%", marginBottom: 12 }}>
            <option value={0}>リンクを選択</option>
            {links.map(l => (
              <option key={l.id} value={l.id}>
                {nodes.find(n => n.id === l.from_node_id)?.name ?? l.from_node_id} → {nodes.find(n => n.id === l.to_node_id)?.name ?? l.to_node_id} (ID:{l.id})
              </option>
            ))}
          </select>
          <input type="number" value={imageOrder} onChange={e => setImageOrder(Number(e.target.value))} placeholder="順番" min={1} required style={{ marginBottom: 12 }} />
          <input type="text" value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)} placeholder="画像URL" required style={{ marginBottom: 12 }} />
          <button type="submit">画像登録</button>
        </form>
        {imageMsg && <p style={{ color: imageMsg && imageMsg.includes("登録") ? "#16a34a" : "#dc2626", marginTop: 16 }}>{imageMsg}</p>}
      </div>

      {/* --- 画像一覧 --- */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>画像一覧</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              <th>ID</th><th>リンク</th><th>順番</th><th>画像URL</th>
            </tr>
          </thead>
          <tbody>
            {images.map(img => (
              <tr key={img.id}>
                <td>{img.id}</td>
                <td>{(() => {
                  const l = links.find(lk => lk.id === img.link_id);
                  if (!l) return img.link_id;
                  const from = nodes.find(n => n.id === l.from_node_id)?.name ?? l.from_node_id;
                  const to = nodes.find(n => n.id === l.to_node_id)?.name ?? l.to_node_id;
                  return `${from} → ${to} (ID:${l.id})`;
                })()}</td>
                <td>{img.order}</td>
                <td><a href={img.url} target="_blank" rel="noopener noreferrer">{img.url}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- 観光地一覧 --- */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>観光地一覧</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              <th>ID</th><th>名前</th><th>カテゴリ</th><th>許容人数</th><th>現在人数</th><th>混雑度</th><th>営業状況</th>
            </tr>
          </thead>
          <tbody>
            {touristSpots.map(spot => (
              <tr key={spot.id}>
                <td>{spot.id}</td>
                <td>{spot.name}</td>
                <td>{spot.category || '-'}</td>
                <td>{spot.max_capacity}</td>
                <td>{spot.current_count}</td>
                <td style={{ 
                  color: spot.current_count / spot.max_capacity >= 0.8 ? '#ef4444' : 
                         spot.current_count / spot.max_capacity >= 0.6 ? '#f59e0b' : '#22c55e' 
                }}>
                  {Math.round(spot.current_count / spot.max_capacity * 100)}%
                </td>
                <td>{spot.is_open ? '営業中' : '閉鎖中'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- ユーザーログ表示 --- */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>
          ユーザーログ管理
          <button 
            onClick={() => {
              setShowLogView(!showLogView);
              if (!showLogView) fetchLogs();
            }}
            style={{ marginLeft: 12, fontSize: 12, padding: '4px 8px' }}
          >
            {showLogView ? 'ログを隠す' : 'ログを表示'}
          </button>
        </h3>
        
        {showLogView && (
          <>
            {/* ログ統計 */}
            <div style={{ marginBottom: 16, padding: 12, background: "#f8f9fa", borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px 0' }}>統計情報</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: 12 }}>
                <div><strong>総ログ数:</strong> {logStats.total_logs || 0}</div>
                <div><strong>ユニークユーザー:</strong> {logStats.unique_users || 0}</div>
                <div><strong>セッション数:</strong> {logStats.unique_sessions || 0}</div>
                <div><strong>ページビュー:</strong> {logStats.page_views || 0}</div>
                <div><strong>アクション数:</strong> {logStats.actions || 0}</div>
                <div><strong>エラー数:</strong> {logStats.errors || 0}</div>
              </div>
            </div>
            
            {/* ログテーブル */}
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 4 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9' }}>
                  <tr>
                    <th style={{ padding: 4, border: '1px solid #e2e8f0' }}>時間</th>
                    <th style={{ padding: 4, border: '1px solid #e2e8f0' }}>ユーザー</th>
                    <th style={{ padding: 4, border: '1px solid #e2e8f0' }}>種類</th>
                    <th style={{ padding: 4, border: '1px solid #e2e8f0' }}>カテゴリ</th>
                    <th style={{ padding: 4, border: '1px solid #e2e8f0' }}>アクション</th>
                    <th style={{ padding: 4, border: '1px solid #e2e8f0' }}>パス</th>
                    <th style={{ padding: 4, border: '1px solid #e2e8f0' }}>データ</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: 4, border: '1px solid #e2e8f0' }}>
                        {new Date(log.created_at).toLocaleString('ja-JP')}
                      </td>
                      <td style={{ padding: 4, border: '1px solid #e2e8f0' }}>
                        {log.user_id || 'ゲスト'}
                      </td>
                      <td style={{ padding: 4, border: '1px solid #e2e8f0' }}>
                        <span style={{
                          padding: '2px 4px',
                          borderRadius: 2,
                          fontSize: 10,
                          color: 'white',
                          background: log.log_type === 'page_view' ? '#22c55e' :
                                     log.log_type === 'action' ? '#3b82f6' :
                                     log.log_type === 'api_call' ? '#f59e0b' :
                                     log.log_type === 'error' ? '#ef4444' : '#6b7280'
                        }}>
                          {log.log_type}
                        </span>
                      </td>
                      <td style={{ padding: 4, border: '1px solid #e2e8f0' }}>{log.category}</td>
                      <td style={{ padding: 4, border: '1px solid #e2e8f0' }}>{log.action}</td>
                      <td style={{ padding: 4, border: '1px solid #e2e8f0' }}>{log.path}</td>
                      <td style={{ padding: 4, border: '1px solid #e2e8f0', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.data && (
                          typeof log.data === 'string' && log.data.startsWith('{') ? 
                            (() => {
                              try {
                                return JSON.stringify(JSON.parse(log.data), null, 1);
                              } catch {
                                return log.data;
                              }
                            })() : 
                            log.data
                        )}
                        {log.error && <span style={{ color: '#ef4444' }}>{log.error}</span>}
                        {log.duration && <span style={{ color: '#6b7280' }}>({log.duration}ms)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Admin;

