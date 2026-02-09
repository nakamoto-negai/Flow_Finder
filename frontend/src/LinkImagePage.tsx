
import { useEffect, useState } from "react";
import Header from "./Header";
import { getApiUrl, API_BASE_URL } from './config';

interface Image {
  id: number;
  link_id: number;
  order: number;
  url: string;
}

const LinkImagePage: React.FC = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [linkId, setLinkId] = useState<number | null>(null);
  const [toNodeId, setToNodeId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromNode, setFromNode] = useState<any | null>(null);
  const [toNode, setToNode] = useState<any | null>(null);

  // URLからリンクIDを取得
  const getLinkIdFromUrl = (): number | null => {
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id');
    return idParam ? parseInt(idParam, 10) : null;
  };

  useEffect(() => {
    const urlLinkId = getLinkIdFromUrl();
    if (!urlLinkId) {
      setError("リンクIDが指定されていません。URLに ?id=1 のようにリンクIDを指定してください。");
      return;
    }
    setLinkId(urlLinkId);

    // ページビューのログ送信
    fetch(`${API_BASE_URL}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        log_type: 'page_view',
        category: 'navigation',
        action: 'view',
        path: window.location.pathname + window.location.search,
        duration: 0,
        data: JSON.stringify({ link_id: urlLinkId }),
        referrer: document.referrer || '',
        session_id: localStorage.getItem('session_id') || '',
        user_id: Number(localStorage.getItem('userId')) || undefined,
      })
    }).then(async res => {
      if (res.ok) {
        const data = await res.json();
        if (data.session_id) localStorage.setItem('session_id', data.session_id);
      }
    }).catch(() => {});

    fetch(getApiUrl("/images"))
      .then(res => res.json())
      .then((data) => {
        let imageArray = [];
        if (data && typeof data === 'object' && Array.isArray(data.value)) {
          imageArray = data.value;
        } else if (Array.isArray(data)) {
          imageArray = data;
        }
        const filtered = imageArray.filter((img: any) => img.link_id === urlLinkId).sort((a: any, b: any) => a.order - b.order);
        setImages(filtered);
      })
      .catch(err => {
        console.error("Images fetch error:", err);
        setImages([]);
      });

    // リンクの到着ノードID取得
    fetch(getApiUrl("/links"))
      .then(res => res.json())
      .then((data) => {
        let linkArray = [];
        if (data && typeof data === 'object' && Array.isArray(data.value)) {
          linkArray = data.value;
        } else if (Array.isArray(data)) {
          linkArray = data;
        }
        const link = linkArray.find((l: any) => l.id === urlLinkId);
        if (link) {
          setToNodeId(link.to_node_id);
          // ノード情報を取得
          fetch(getApiUrl("/nodes"))
            .then(res => res.json())
            .then((nodeData) => {
              let nodeArray = [];
              if (nodeData && typeof nodeData === 'object' && Array.isArray(nodeData.value)) {
                nodeArray = nodeData.value;
              } else if (Array.isArray(nodeData)) {
                nodeArray = nodeData;
              }
              const from = nodeArray.find((n: any) => n.id === link.from_node_id);
              const to = nodeArray.find((n: any) => n.id === link.to_node_id);
              setFromNode(from);
              setToNode(to);
            })
            .catch(err => console.error("Nodes fetch error:", err));
        }
      })
      .catch(err => {
        console.error("Links fetch error:", err);
      });
  }, []);

  const apiHost = API_BASE_URL;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Header />
      <div style={{ maxWidth: 500, margin: "32px auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0001", padding: 24, textAlign: "center" }}>
        {error ? (
          <div style={{ color: '#dc2626', fontSize: '16px', padding: '20px' }}>
            {error}
          </div>
        ) : linkId ? (
          <>
            <h2 style={{ marginBottom: 16 }}>
              {fromNode && toNode 
                ? `${fromNode.name || `ノード${fromNode.id}`} → ${toNode.name || `ノード${toNode.id}`}`
                : `リンクID: ${linkId} の画像`
              }
            </h2>
            
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
              onClick={async () => {
                if (toNodeId) {
                  // アクションログ送信
                  await fetch(`${API_BASE_URL}/api/logs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      log_type: 'action',
                      category: 'navigation',
                      action: 'arrive',
                      path: window.location.pathname + window.location.search,
                      duration: 0,
                      data: JSON.stringify({ link_id: linkId, to_node_id: toNodeId }),
                      referrer: document.referrer || '',
                      session_id: localStorage.getItem('session_id') || '',
                      user_id: Number(localStorage.getItem('userId')) || undefined,
                    })
                  });
                  window.location.href = `/links?node=${toNodeId}`;
                }
              }}
              disabled={!toNodeId}
            >
              {toNodeId ? '到着' : '到着地を読み込み中...'}
            </button>
          </>
        ) : (
          <div style={{ padding: '20px', color: '#6b7280' }}>
            読み込み中...
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkImagePage;
