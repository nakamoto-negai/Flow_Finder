
import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { nodeIcon } from "./nodeIcon";
import "leaflet/dist/leaflet.css";

type Node = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  congestion: number;
  tourist: boolean;
};

const MAP_CENTER: [number, number] = [35.6895, 139.6917];
const MAP_ZOOM = 13;


// 2点間の距離（m）を計算
function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000; // 地球半径[m]
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
}

const MapView: React.FC<{ linkMode?: boolean, onLinkCreated?: () => void }> = ({ linkMode = false, onLinkCreated }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selected, setSelected] = useState<Node[]>([]); // 選択ノード
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:8080/nodes")
      .then((res) => res.json())
      .then((data) => setNodes(data))
      .catch(() => setNodes([]));
  }, []);

  // リンク作成モード: ノード2つ選択でUI表示
  const handleMarkerClick = (node: Node) => {
    if (!linkMode) return;
    if (selected.length === 0) setSelected([node]);
    else if (selected.length === 1 && selected[0].id !== node.id) setSelected([selected[0], node]);
    else setSelected([node]);
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
          distance: calcDistance(selected[0].latitude, selected[0].longitude, selected[1].latitude, selected[1].longitude),
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
    <div style={{ width: 700, height: 400, margin: "24px auto", display: "block", position: "relative" }}>
      <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM} style={{ width: "100%", height: "100%", borderRadius: 8 }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {nodes.map((node) => (
          <Marker
            key={node.id}
            position={[node.latitude, node.longitude]}
            icon={nodeIcon}
            eventHandlers={linkMode ? { click: () => handleMarkerClick(node) } : {}}
          >
            <Popup>
              <b>{node.name}</b><br />
              混雑度: {node.congestion}<br />
              <button onClick={() => window.location.href = `/links?node=${node.id}`}>
                現在地
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {/* リンク作成UI */}
      {linkMode && selected.length === 2 && (
        <div style={{ position: "absolute", top: 20, left: 20, background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0002", padding: 16, zIndex: 1000 }}>
          <div><b>出発:</b> {selected[0].name}　<b>到着:</b> {selected[1].name}</div>
          <div style={{ margin: "8px 0" }}><b>距離:</b> {calcDistance(selected[0].latitude, selected[0].longitude, selected[1].latitude, selected[1].longitude)} m</div>
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
