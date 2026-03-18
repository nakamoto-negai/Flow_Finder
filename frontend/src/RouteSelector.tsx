import React, { useEffect, useState, useRef } from 'react';
import Header from './Header';
import { getApiUrl, STATIC_BASE_URL } from './config';
import { apiRequest } from './api';
import { logger } from './logger';

interface NodeImage {
  id: number;
  url: string;
  original_name: string;
  node_id: number;
  order: number;
}

interface ImagePin {
  id: number;
  node_image_id: number;
  link_id: number;
  x: number;
  y: number;
  label: string;
  link?: { id: number; from_node_id: number; to_node_id: number };
}

interface TouristSpot {
  id: number;
  name: string;
  nearest_node_id?: number;
}

interface RouteInfo {
  path: { id: number }[];
  total_distance: number;
}

const RouteSelector: React.FC = () => {
  const [images, setImages] = useState<NodeImage[]>([]);
  const [pinsByImage, setPinsByImage] = useState<Record<number, ImagePin[]>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 観光地・経路・お気に入り
  const [allTouristSpots, setAllTouristSpots] = useState<TouristSpot[]>([]);
  const [allRoutes, setAllRoutes] = useState<Record<number, RouteInfo>>({});
  const [favoriteSpotIds, setFavoriteSpotIds] = useState<Set<number>>(new Set());

  // MapViewと同じビューアーstate
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgRenderedWidth, setImgRenderedWidth] = useState<number | null>(null);

  const imageViewerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const getNodeId = (): number | null => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('node_id');
    return id ? parseInt(id, 10) : null;
  };

  useEffect(() => {
    const nodeId = getNodeId();
    logger.logPageView(`/route-selector?node_id=${nodeId ?? ''}`);
    if (!nodeId) {
      setError('ノードIDが指定されていません');
      setLoading(false);
      return;
    }

    // 画像・ピン・観光地・お気に入りを並行取得
    Promise.all([
      fetch(getApiUrl(`/nodes/${nodeId}/images`)).then(r => r.json()),
      fetch(getApiUrl('/tourist-spots')).then(r => r.json()),
      apiRequest(getApiUrl('/favorites/tourist-spots')).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(async ([imgData, spotData, favData]) => {
      // 画像
      const imgs: NodeImage[] = Array.isArray(imgData) ? imgData : [];
      setImages(imgs);

      // ピン
      const pinResults = await Promise.all(
        imgs.map(img =>
          fetch(getApiUrl(`/node-images/${img.id}/pins`))
            .then(r => r.json())
            .then((pins: ImagePin[]) => ({ id: img.id, pins: Array.isArray(pins) ? pins : [] }))
            .catch(() => ({ id: img.id, pins: [] }))
        )
      );
      const pinsMap: Record<number, ImagePin[]> = {};
      pinResults.forEach(({ id, pins }) => { pinsMap[id] = pins; });
      setPinsByImage(pinsMap);

      // 観光地
      const spots: TouristSpot[] = Array.isArray(spotData) ? spotData : [];
      setAllTouristSpots(spots);

      // お気に入りID set
      const favArray = Array.isArray(favData) ? favData : [];
      setFavoriteSpotIds(new Set(favArray.map((f: any) => f.tourist_spot_id ?? f.tourist_spot?.id)));

      // 全観光地への経路をダイクストラで計算
      const routeEntries = await Promise.all(
        spots
          .filter(s => s.nearest_node_id)
          .map(s =>
            fetch(getApiUrl('/dijkstra'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-User-Id': localStorage.getItem('userId') || '',
                'X-Session-Id': sessionStorage.getItem('session_id') || '',
              },
              body: JSON.stringify({ start_node_id: nodeId, end_node_id: s.nearest_node_id, spot_name: s.name }),
            })
              .then(r => r.ok ? r.json() : null)
              .then(d => d?.path?.length > 1 ? { spotId: s.id, route: { path: d.path, total_distance: d.total_distance } as RouteInfo } : null)
              .catch(() => null)
          )
      );
      const routesMap: Record<number, RouteInfo> = {};
      routeEntries.forEach(e => { if (e) routesMap[e.spotId] = e.route; });
      setAllRoutes(routesMap);
    })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false));
  }, []);

  // 画像切り替え時にビューアーリセット
  const resetViewer = () => {
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
    setImgRenderedWidth(null);
  };

  // MapViewと同じハンドラー
  const nextImage = () => { setCurrentIndex(prev => (prev + 1) % images.length); resetViewer(); };
  const prevImage = () => { setCurrentIndex(prev => (prev - 1 + images.length) % images.length); resetViewer(); };
  const zoomIn = () => setImageScale(prev => Math.min(prev + 0.5, 5));
  const zoomOut = () => {
    setImageScale(prev => Math.max(prev - 0.5, 1));
    if (imageScale <= 1.5) setImagePosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && imageViewerRef.current) {
      const newX = e.clientX - dragStart.x;
      const viewerWidth = imageViewerRef.current.offsetWidth;
      const img = imageViewerRef.current.querySelector('img');
      if (img) {
        const imageWidth = img.offsetWidth * imageScale;
        setImagePosition({ x: Math.max(viewerWidth - imageWidth, Math.min(0, newX)), y: 0 });
      }
    }
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - imagePosition.x, y: e.touches[0].clientY - imagePosition.y });
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1 && imageViewerRef.current) {
      const newX = e.touches[0].clientX - dragStart.x;
      const viewerWidth = imageViewerRef.current.offsetWidth;
      const img = imageViewerRef.current.querySelector('img');
      if (img) {
        const imageWidth = img.offsetWidth * imageScale;
        setImagePosition({ x: Math.max(viewerWidth - imageWidth, Math.min(0, newX)), y: 0 });
      }
    }
  };
  const handleTouchEnd = () => setIsDragging(false);
  const handleImgLoad = () => { if (imgRef.current) setImgRenderedWidth(imgRef.current.offsetWidth); };

  // ピンの方向にある観光地を返す
  const getSpotsInDirection = (pin: ImagePin): TouristSpot[] => {
    if (!pin.link) return [];
    return allTouristSpots.filter(spot => {
      const route = allRoutes[spot.id];
      return route && route.path.length > 1 && route.path[1].id === pin.link!.to_node_id;
    });
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a' }}>
        <Header />
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>読み込み中...</div>
      </div>
    );
  }

  if (error || images.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a' }}>
        <Header />
        <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center', color: '#94a3b8', padding: '0 16px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
          <p style={{ fontSize: 18 }}>{error || 'このノードには360°画像が登録されていません'}</p>
          <button onClick={() => window.history.back()} style={{ marginTop: 24, padding: '10px 28px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>
            戻る
          </button>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex];
  const currentPins = pinsByImage[currentImage.id] ?? [];
  const transformStyle = `scale(${imageScale}) translate(${imagePosition.x / imageScale}px, 0px)`;
  const transitionStyle = isDragging ? 'none' : 'transform 0.2s ease';

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>
      <Header />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <h2 style={{ color: '#f1f5f9', textAlign: 'center', marginBottom: 4 }}>ルートを選択</h2>
        <p style={{ color: '#94a3b8', textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
          横にスワイプすることで周囲を確認できます
        </p>

        {/* 360°ビューアー */}
        <div
          ref={imageViewerRef}
          style={{
            position: 'relative', width: '100%',
            height: 'calc(90vh - 220px)', minHeight: '400px', maxHeight: '700px',
            background: '#000', borderRadius: '12px', overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none',
          }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        >
          {/* 360°画像 */}
          <img
            ref={imgRef}
            src={`${STATIC_BASE_URL}${currentImage.url}`}
            alt={currentImage.original_name}
            onLoad={handleImgLoad}
            style={{
              width: 'auto', height: '100%', minWidth: '100%',
              objectFit: 'cover', objectPosition: 'center',
              transform: transformStyle, transition: transitionStyle, pointerEvents: 'none',
            }}
            draggable={false}
          />

          {/* ピンオーバーレイ（画像と同じtransformで追従） */}
          {imgRenderedWidth != null && currentPins.length > 0 && (
            <div style={{
              position: 'absolute', left: 0, top: 0,
              width: imgRenderedWidth, height: '100%',
              transform: transformStyle, transition: transitionStyle,
              transformOrigin: 'center center', pointerEvents: 'none',
            }}>
              {currentPins.map(pin => {
                const spotsInDir = getSpotsInDirection(pin);
                const hasFavorite = spotsInDir.some(s => favoriteSpotIds.has(s.id));
                const pinColor = hasFavorite ? '#e923e9' : '#2563eb';

                return (
                  <button
                    key={pin.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      const spotsInDir = getSpotsInDirection(pin);
                      logger.logAction('route_navigate', 'navigation', {
                        link_id: pin.link_id,
                        label: pin.label,
                        spots: spotsInDir.map(s => s.name),
                        start_node_id: getNodeId(),
                      });
                      window.location.href = `/link-image?id=${pin.link_id}`;
                    }}
                    style={{
                      position: 'absolute',
                      left: `${pin.x}%`, top: `${pin.y}%`,
                      transform: 'translate(-50%, -50%)',
                      background: pinColor,
                      border: '3px solid #fff', borderRadius: '50%',
                      width: 48, height: 48, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
                      padding: 0, pointerEvents: 'auto', zIndex: 10,
                    }}
                  >
                    <span style={{ color: '#fff', fontSize: 22, lineHeight: 1 }}>→</span>

                    {/* 方面ラベル（ピンの上に表示） */}
                    <div style={{
                      position: 'absolute',
                      bottom: '110%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0,0,0,0.85)',
                      color: '#fff',
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      lineHeight: 1.4,
                      textAlign: 'center',
                    }}>
                      {pin.label && <div style={{ fontWeight: 'bold', marginBottom: spotsInDir.length > 0 ? 2 : 0 }}>{pin.label}</div>}
                      {spotsInDir.length > 0 && (
                        <div>
                          {spotsInDir.map((s, i) => (
                            <span key={s.id} style={{ color: favoriteSpotIds.has(s.id) ? '#f9a8d4' : '#bfdbfe' }}>
                              {s.name}{i < spotsInDir.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                          <span style={{ color: '#d1d5db' }}> 方面</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 前後ナビゲーション */}
          {images.length > 1 && (
            <>
              <button onClick={prevImage} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '48px', height: '48px', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}>‹</button>
              <button onClick={nextImage} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '48px', height: '48px', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}>›</button>
            </>
          )}

          {/* ズームコントロール */}
          <div style={{ position: 'absolute', bottom: '16px', right: '16px', display: 'flex', gap: '8px' }}>
            <button onClick={zoomOut} disabled={imageScale <= 1} style={{ background: imageScale <= 1 ? 'rgba(100,100,100,0.6)' : 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '8px', width: '40px', height: '40px', fontSize: '20px', cursor: imageScale <= 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { if (imageScale > 1) e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; }} onMouseLeave={e => { if (imageScale > 1) e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; }}>−</button>
            <button onClick={zoomIn} disabled={imageScale >= 5} style={{ background: imageScale >= 5 ? 'rgba(100,100,100,0.6)' : 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '8px', width: '40px', height: '40px', fontSize: '20px', cursor: imageScale >= 5 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { if (imageScale < 5) e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; }} onMouseLeave={e => { if (imageScale < 5) e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; }}>+</button>
          </div>

          {/* ドットインジケーター */}
          {images.length > 1 && (
            <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: '20px' }}>
              {images.map((_, i) => (
                <div key={i} onClick={() => { setCurrentIndex(i); resetViewer(); }} style={{ width: '8px', height: '8px', borderRadius: '50%', background: i === currentIndex ? 'white' : 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'all 0.2s' }} />
              ))}
            </div>
          )}

          {/* 画像情報 */}
          <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '14px' }}>
            {currentIndex + 1} / {images.length}{imageScale > 1 && ` · ${(imageScale * 100).toFixed(0)}%`}
          </div>

          {currentPins.length === 0 && (
            <div style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: '#f1f5f9', padding: '6px 16px', borderRadius: 20, fontSize: 13, whiteSpace: 'nowrap' }}>
              この画像にはルートが設定されていません
            </div>
          )}
        </div>

        {/* 凡例 */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16, fontSize: 13, color: '#94a3b8' }}>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#2563eb', borderRadius: '50%', marginRight: 4, verticalAlign: 'middle' }} />通常ルート</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#e923e9', borderRadius: '50%', marginRight: 4, verticalAlign: 'middle' }} />お気に入り方面</span>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => window.history.back()} style={{ padding: '10px 28px', background: '#475569', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}>
            戻る
          </button>
        </div>
      </div>
    </div>
  );
};

export default RouteSelector;
