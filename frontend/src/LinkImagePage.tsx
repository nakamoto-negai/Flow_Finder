
import { useEffect, useState } from "react";
import Header from "./Header";

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
      .then((data) => {
        let imageArray = [];
        if (data && typeof data === 'object' && Array.isArray(data.value)) {
          imageArray = data.value;
        } else if (Array.isArray(data)) {
          imageArray = data;
        }
        const filtered = imageArray.filter((img: any) => img.link_id === linkId).sort((a: any, b: any) => a.order - b.order);
        setImages(filtered);
      })
      .catch(err => {
        console.error("Images fetch error:", err);
        setImages([]);
      });
    
    // リンクの到着ノードID取得
    fetch(`http://localhost:8080/links`)
      .then(res => res.json())
      .then((data) => {
        let linkArray = [];
        if (data && typeof data === 'object' && Array.isArray(data.value)) {
          linkArray = data.value;
        } else if (Array.isArray(data)) {
          linkArray = data;
        }
        const link = linkArray.find((l: any) => l.id === linkId);
        if (link) setToNodeId(link.to_node_id);
      })
      .catch(err => {
        console.error("Links fetch error:", err);
      });
  }, [linkId]);

  const apiHost = `${window.location.protocol}//${window.location.hostname}:8080`;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Header showLocationPicker={false} />
      <div style={{ maxWidth: 500, margin: "32px auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0001", padding: 24, textAlign: "center" }}>
        <h2 style={{ marginBottom: 16 }}>リンクID: {linkId} の画像</h2>
        
        {images.length === 0 ? (
          <div style={{ margin: "40px 0", color: "#666", fontSize: "1.1rem" }}>
            画像が登録されていません
          </div>
        ) : (
          images.map(img => {
            const imgUrl = img.url.startsWith("/uploads/") ? `${apiHost}${img.url}` : img.url;
            return (
              <div key={img.id} style={{ marginBottom: 24 }}>
                <img src={imgUrl} alt={img.url} style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8 }} />
                <div style={{ marginTop: 8 }}>順番: {img.order}</div>
              </div>
            );
          })
        )}
        
        <button 
          style={{ 
            marginTop: 24, 
            fontSize: 18, 
            padding: '8px 32px', 
            background: toNodeId ? '#2563eb' : '#9ca3af', 
            color: '#fff', 
            border: 'none', 
            borderRadius: 6, 
            cursor: toNodeId ? 'pointer' : 'not-allowed' 
          }}
          onClick={() => {
            if (toNodeId) {
              window.location.href = `/links?node=${toNodeId}`;
            }
          }}
          disabled={!toNodeId}
        >
          {toNodeId ? '到着' : '到着地を読み込み中...'}
        </button>
      </div>
    </div>
  );
};

export default LinkImagePage;
