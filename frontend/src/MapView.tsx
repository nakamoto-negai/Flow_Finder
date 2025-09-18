
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

const MapView: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);

  useEffect(() => {
    fetch("http://localhost:8080/nodes")
      .then((res) => res.json())
      .then((data) => setNodes(data))
      .catch(() => setNodes([]));
  }, []);

  return (
  <div style={{ width: 700, height: 400, margin: "24px auto", display: "block" }}>
      <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM} style={{ width: "100%", height: "100%", borderRadius: 8 }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {nodes.map((node) => (
          <Marker key={node.id} position={[node.latitude, node.longitude]} icon={nodeIcon}>
            <Popup>
              <b>{node.name}</b><br />
              混雑度: {node.congestion}<br />
              <button onClick={() => alert(`ノードID: ${node.id}\n名前: ${node.name}`)}>
                現在地
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;
