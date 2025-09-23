
import { useEffect, useState } from "react";

interface Image {
  id: number;
  link_id: number;
  order: number;
  url: string;
}

const LinkImagePage: React.FC<{ linkId: number }> = ({ linkId }) => {
  const [images, setImages] = useState<Image[]>([]);
  const [toNodeId, setToNodeId] = useState<number | null>(null);

  useEffect(() => {
    fetch("http://localhost:8080/images")
      .then(res => res.json())
      .then((data: Image[]) => {
        const filtered = data.filter(img => img.link_id === linkId).sort((a, b) => a.order - b.order);
        setImages(filtered);
      });
    // リンクの到着ノードID取得
    fetch(`http://localhost:8080/links`)
      .then(res => res.json())
      .then((links: any[]) => {
        const link = links.find(l => l.id === linkId);
        if (link) setToNodeId(link.to_node_id);
      });
  }, [linkId]);

  if (images.length === 0) return <div style={{ margin: 40 }}>画像が登録されていません</div>;

  const apiHost = `${window.location.protocol}//${window.location.hostname}:8080`;

  return (
    <div style={{ maxWidth: 500, margin: "32px auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0001", padding: 24, textAlign: "center" }}>
      <h2 style={{ marginBottom: 16 }}>リンクID: {linkId} の画像</h2>
      {images.map(img => {
        const imgUrl = img.url.startsWith("/uploads/") ? `${apiHost}${img.url}` : img.url;
        return (
          <div key={img.id} style={{ marginBottom: 24 }}>
            <img src={imgUrl} alt={img.url} style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8 }} />
            <div style={{ marginTop: 8 }}>順番: {img.order}</div>
          </div>
        );
      })}
      <button style={{ marginTop: 24, fontSize: 18, padding: '8px 32px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        onClick={() => {
          if (toNodeId) {
            window.location.href = `/links?node=${toNodeId}`;
          }
        }}
        disabled={!toNodeId}
      >到着</button>
    </div>
  );
};

export default LinkImagePage;
