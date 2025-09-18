import React from "react";

// シンプルな地図表示（OpenStreetMap埋め込み例）
const MapView: React.FC = () => {
  return (
    <div style={{ width: "100%", height: "70vh", margin: "24px 0" }}>
      <iframe
        title="map"
        width="100%"
        height="100%"
        frameBorder="0"
        scrolling="no"
        marginHeight={0}
        marginWidth={0}
        src="https://www.openstreetmap.org/export/embed.html?bbox=139.6917%2C35.6895%2C139.7017%2C35.6995&layer=mapnik"
        style={{ border: "1px solid black", borderRadius: 8, width: "100%", height: "100%" }}
      ></iframe>
    </div>
  );
};

export default MapView;
