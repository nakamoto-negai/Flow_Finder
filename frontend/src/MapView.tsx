
import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl, API_BASE_URL } from './config';
import type { Field, Node } from './types';

interface NodeImage {
  id: number;
  file_path: string;
  url: string;
  original_name: string;
  node_id: number;
  order: number;
}

// 2点間の距離（ピクセル）を計算
function calcDistance(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.round(Math.sqrt(dx * dx + dy * dy));
}

const MapView: React.FC<{ linkMode?: boolean, onLinkCreated?: () => void, fieldId?: number }> = ({ linkMode = false, onLinkCreated, fieldId }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selected, setSelected] = useState<Node[]>([]); // 選択ノード
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false); // 画像の読み込み状態
  const imageRef = useRef<HTMLImageElement>(null);
  const [selectedNodeForCard, setSelectedNodeForCard] = useState<Node | null>(null); // カード表示用
  const [nodeImages, setNodeImages] = useState<NodeImage[]>([]); // ノード画像
  const [loadingImages, setLoadingImages] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // 現在表示中の画像インデックス
  const [imageScale, setImageScale] = useState(1); // 画像のズーム倍率
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 }); // 画像の位置
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageViewerRef = useRef<HTMLDivElement>(null);
  const [touristSpots, setTouristSpots] = useState<any[]>([]);

  useEffect(() => {
    // 全フィールドを取得
    fetch(getApiUrl("/fields"))
      .then((res) => res.json())
      .then((data) => {
        const fieldsData = Array.isArray(data) ? data : [];
        setFields(fieldsData);
        
        // URLパラメータにfieldIdがある場合はそれを使用
        if (fieldId) {
          const selectedField = fieldsData.find((field: Field) => field.id === fieldId);
          if (selectedField) {
            setActiveField(selectedField);
          } else {
            // 指定されたフィールドが見つからない場合はデフォルト
            const activeFieldFromList = fieldsData.find((field: Field) => field.is_active) || fieldsData[0];
            setActiveField(activeFieldFromList);
          }
        } else {
          // fieldIdがない場合はアクティブなフィールドまたは最初のフィールドを設定
          const activeFieldFromList = fieldsData.find((field: Field) => field.is_active) || fieldsData[0];
          setActiveField(activeFieldFromList);
        }
      })
      .catch(() => {
        setFields([]);
        setActiveField(null);
      });

    // ノード一覧を取得
    fetch(getApiUrl("/nodes"))
      .then((res) => res.json())
      .then((data) => setNodes(Array.isArray(data) ? data : []))
      .catch(() => setNodes([]));

    // 観光地データを取得
    fetch(getApiUrl("/tourist-spots"))
      .then((res) => res.json())
      .then((data) => setTouristSpots(Array.isArray(data) ? data : []))
      .catch(() => setTouristSpots([]));
  }, [fieldId]);

  // activeFieldが変更されたら画像の読み込み状態をリセット
  useEffect(() => {
    setImageLoaded(false);
  }, [activeField]);

  // フィールド変更時の処理（別ページに遷移）
  const handleFieldChange = (fieldId: number) => {
    window.location.href = `/map/${fieldId}`;
  };

  // 画像読み込み完了ハンドラ
  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  // 写真上のクリック処理
  const handleImageClick = (event: React.MouseEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const rect = img.getBoundingClientRect();
    
    // クリック位置を取得（表示画像上の座標）
    const displayX = event.clientX - rect.left;
    const displayY = event.clientY - rect.top;
    
    // 既存ノードがクリックされたかチェック（表示座標で判定）
    const clickedNode = nodes.find(node => {
      // ノードの座標を表示座標に変換して距離を計算
      const nodeDisplayX = activeField ? (node.x * img.offsetWidth) / activeField.width : node.x;
      const nodeDisplayY = activeField ? (node.y * img.offsetHeight) / activeField.height : node.y;
      const distance = Math.sqrt((nodeDisplayX - displayX) ** 2 + (nodeDisplayY - displayY) ** 2);
      return distance < 18; // 18ピクセル以内
    });

    if (clickedNode) {
      handleNodeClick(clickedNode);
    }
  };

  // ノードクリック処理
  const handleNodeClick = async (node: Node) => {
    if (linkMode) {
      // リンク作成モードの場合
      if (selected.length === 0) setSelected([node]);
      else if (selected.length === 1 && selected[0].id !== node.id) setSelected([selected[0], node]);
      else setSelected([node]);
    } else {
      // 通常モードの場合：360度画像カードを表示
      setSelectedNodeForCard(node);
      setLoadingImages(true);
      
      // ノード画像を取得
      try {
        const response = await fetch(getApiUrl(`/nodes/${node.id}/images`));
        if (response.ok) {
          const images = await response.json();
          setNodeImages(Array.isArray(images) ? images : []);
        } else {
          setNodeImages([]);
        }
      } catch (error) {
        console.error('ノード画像の取得に失敗:', error);
        setNodeImages([]);
      } finally {
        setLoadingImages(false);
      }
    }
  };

  // 画像ビューアを閉じる
  const closeImageViewer = () => {
    setSelectedNodeForCard(null);
    setNodeImages([]);
    setCurrentImageIndex(0);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // 次の画像に移動
  const nextImage = () => {
    if (nodeImages.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % nodeImages.length);
      setImageScale(1);
      setImagePosition({ x: 0, y: 0 });
    }
  };

  // 前の画像に移動
  const prevImage = () => {
    if (nodeImages.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + nodeImages.length) % nodeImages.length);
      setImageScale(1);
      setImagePosition({ x: 0, y: 0 });
    }
  };

  // ズームイン
  const zoomIn = () => {
    setImageScale((prev) => Math.min(prev + 0.5, 5));
  };

  // ズームアウト
  const zoomOut = () => {
    setImageScale((prev) => Math.max(prev - 0.5, 1));
    if (imageScale <= 1.5) {
      setImagePosition({ x: 0, y: 0 });
    }
  };

  // ドラッグ開始
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
  };

  // ドラッグ中
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && imageViewerRef.current) {
      const newX = e.clientX - dragStart.x;
      const viewerWidth = imageViewerRef.current.offsetWidth;
      const img = imageViewerRef.current.querySelector('img');
      if (img) {
        const imageWidth = img.offsetWidth * imageScale;
        const maxX = 0;
        const minX = viewerWidth - imageWidth;
        const clampedX = Math.max(minX, Math.min(maxX, newX));
        setImagePosition({
          x: clampedX,
          y: 0
        });
      }
    }
  };

  // ドラッグ終了
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // タッチ操作対応
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ 
        x: e.touches[0].clientX - imagePosition.x, 
        y: e.touches[0].clientY - imagePosition.y 
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1 && imageViewerRef.current) {
      const newX = e.touches[0].clientX - dragStart.x;
      const viewerWidth = imageViewerRef.current.offsetWidth;
      const img = imageViewerRef.current.querySelector('img');
      if (img) {
        const imageWidth = img.offsetWidth * imageScale;
        const maxX = 0;
        const minX = viewerWidth - imageWidth;
        const clampedX = Math.max(minX, Math.min(maxX, newX));
        setImagePosition({
          x: clampedX,
          y: 0
        });
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleRegisterLink = async () => {
    if (selected.length !== 2) return;
    setLinkMsg(null);
    try {
      const res = await fetch(getApiUrl("/links"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_node_id: selected[0].id,
          to_node_id: selected[1].id,
          distance: calcDistance(selected[0].x, selected[0].y, selected[1].x, selected[1].y),
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
    <div style={{ width: "100%", maxWidth: 800, margin: "24px auto", display: "block", position: "relative" }}>
      {/* コントロールパネル */}
      <div style={{ 
        marginBottom: 16, 
        padding: 16, 
        background: "#f8f9fa", 
        borderRadius: 8
      }}>
        {/* フィールド選択 */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 'bold', fontSize: '1.2rem', display: 'block', marginBottom: 8 }}>フィールドを選択
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {fields.map(field => (
              <button
                key={field.id}
                onClick={() => handleFieldChange(field.id)}
                style={{
                  padding: '8px 16px',
                  border: activeField?.id === field.id ? '2px solid #4ecdc4' : '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  background: activeField?.id === field.id ? '#e8f5f4' : 'white',
                  cursor: 'pointer',
                  fontWeight: activeField?.id === field.id ? 'bold' : 'normal',
                  color: activeField?.id === field.id ? '#2c7a7b' : '#333',
                  transition: 'all 0.2s ease',
                  boxShadow: activeField?.id === field.id ? '0 2px 4px rgba(78, 205, 196, 0.3)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (activeField?.id !== field.id) {
                    e.currentTarget.style.background = '#f0f0f0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeField?.id !== field.id) {
                    e.currentTarget.style.background = 'white';
                  }
                }}
              >
                {field.name} {field.is_active ? '' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* 操作説明 */}
        {!linkMode && (
          <div style={{ 
            color: "#414242", 
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "15px"
          }}>
            現在地を選ぶと、周辺画像が表示されます
          </div>
        )}
      </div>

      {/* 写真とノード表示 */}
      <div style={{ position: "relative", border: "2px solid #dee2e6", borderRadius: 8, overflow: "hidden" }}>
        <img
          ref={imageRef}
          src={activeField ? `${API_BASE_URL}${activeField.image_url}` : "/map-image.jpg"}
          alt={activeField ? activeField.name : "マップ画像"}
          style={{ 
            width: "100%", 
            maxWidth: 800,
            height: "auto",
            display: "block",
            cursor: "default"
          }}
          onClick={handleImageClick}
          onLoad={handleImageLoad}
        />
        
        {/* ノードを表示（画像が読み込まれてから） */}
        {imageLoaded && nodes
          .filter(node => activeField ? node.field_id === activeField.id : true)
          .map((node) => {
            // ノードの座標を表示座標に変換
            const displayX = activeField && imageRef.current 
              ? (node.x * imageRef.current.offsetWidth) / activeField.width
              : node.x;
            const displayY = activeField && imageRef.current 
              ? (node.y * imageRef.current.offsetHeight) / activeField.height
              : node.y;

            // このノードに観光地が配置されているかチェック
            const hasTouristSpot = touristSpots.some(spot => spot.nearest_node_id === node.id);

            return (
              <div
                key={node.id}
                style={{
                  position: "absolute",
                  left: displayX - 12,
                  top: displayY - 12,
                  width: 24,
                  height: 24,
                  backgroundColor: selected.some(s => s.id === node.id) ? "#ff6b6b" : (hasTouristSpot ? "#f59e0b" : "#4ecdc4"),
                  border: "2px solid white",
                  borderRadius: "50%",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  fontWeight: "bold",
                  color: "white",
                  transition: "all 0.2s ease",
                  transform: "scale(1)"
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClick(node);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.2)";
                  e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
                }}
                title={linkMode ? `${node.name} (混雑度: ${node.congestion})` : `${node.name} - クリックでリンク一覧を表示`}
              >
                {node.id}
              </div>
            );
          })}
      </div>

      {/* リンク作成UI */}
      {linkMode && selected.length === 2 && (
        <div style={{ position: "absolute", top: 20, left: 20, background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #0002", padding: 16, zIndex: 1000 }}>
          <div><b>出発:</b> {selected[0].name}　<b>到着:</b> {selected[1].name}</div>
          <div style={{ margin: "8px 0" }}><b>距離:</b> {calcDistance(selected[0].x, selected[0].y, selected[1].x, selected[1].y)} px</div>
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

      {/* ノード画像カード（360度画像表示） */}
      {!linkMode && selectedNodeForCard && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
          onClick={closeImageViewer}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 閉じるボタン */}
            <button
              onClick={closeImageViewer}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ×
            </button>

            {/* カード内容 */}
            <div style={{ padding: '32px' }}>
              <h2 style={{ 
                margin: '0 0 12px 0', 
                fontSize: '1.8rem', 
                color: '#1f2937',
                textAlign: 'center',
                fontWeight: 'bold'
              }}>
                {selectedNodeForCard.name || `ノード ${selectedNodeForCard.id}`}
              </h2>
              <p style={{
                margin: '0 0 12px 0',
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '0.9rem'
              }}>
                横にスワイプすることで周囲を確認できます
              </p>

              {/* 画像表示エリア */}
              {loadingImages ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '60px 20px',
                  color: '#6b7280'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🔄</div>
                  <div>画像を読み込み中...</div>
                </div>
              ) : nodeImages.length > 0 ? (
                <div style={{ marginBottom: '24px' }}>
                  {/* 360度画像ビューア */}
                  <div 
                    ref={imageViewerRef}
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: 'calc(90vh - 220px)',
                      minHeight: '400px',
                      maxHeight: '700px',
                      background: '#000',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      cursor: isDragging ? 'grabbing' : 'grab',
                      userSelect: 'none'
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    <img 
                      src={`${API_BASE_URL}${nodeImages[currentImageIndex].url}`}
                      alt={nodeImages[currentImageIndex].original_name}
                      style={{
                        width: 'auto',
                        height: '100%',
                        minWidth: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        transform: `scale(${imageScale}) translate(${imagePosition.x / imageScale}px, 0px)`,
                        transition: isDragging ? 'none' : 'transform 0.2s ease',
                        pointerEvents: 'none'
                      }}
                      draggable={false}
                    />

                    {/* ナビゲーションボタン */}
                    {nodeImages.length > 1 && (
                      <>
                        <button
                          onClick={prevImage}
                          style={{
                            position: 'absolute',
                            left: '16px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'rgba(0, 0, 0, 0.6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '48px',
                            height: '48px',
                            fontSize: '24px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                          }}
                        >
                          ‹
                        </button>
                        <button
                          onClick={nextImage}
                          style={{
                            position: 'absolute',
                            right: '16px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'rgba(0, 0, 0, 0.6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '48px',
                            height: '48px',
                            fontSize: '24px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                          }}
                        >
                          ›
                        </button>
                      </>
                    )}

                    {/* ズームコントロール */}
                    <div style={{
                      position: 'absolute',
                      bottom: '16px',
                      right: '16px',
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <button
                        onClick={zoomOut}
                        disabled={imageScale <= 1}
                        style={{
                          background: imageScale <= 1 ? 'rgba(100, 100, 100, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          width: '40px',
                          height: '40px',
                          fontSize: '20px',
                          cursor: imageScale <= 1 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (imageScale > 1) {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (imageScale > 1) {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                          }
                        }}
                      >
                        −
                      </button>
                      <button
                        onClick={zoomIn}
                        disabled={imageScale >= 5}
                        style={{
                          background: imageScale >= 5 ? 'rgba(100, 100, 100, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          width: '40px',
                          height: '40px',
                          fontSize: '20px',
                          cursor: imageScale >= 5 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (imageScale < 5) {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (imageScale < 5) {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                          }
                        }}
                      >
                        +
                      </button>
                    </div>

                    {/* 画像インジケーター */}
                    {nodeImages.length > 1 && (
                      <div style={{
                        position: 'absolute',
                        bottom: '16px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: '8px',
                        background: 'rgba(0, 0, 0, 0.6)',
                        padding: '8px 16px',
                        borderRadius: '20px'
                      }}>
                        {nodeImages.map((_, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              setCurrentImageIndex(index);
                              setImageScale(1);
                              setImagePosition({ x: 0, y: 0 });
                            }}
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: index === currentImageIndex ? 'white' : 'rgba(255, 255, 255, 0.4)',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* 画像情報 */}
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      background: 'rgba(0, 0, 0, 0.6)',
                      color: 'white',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}>
                      {currentImageIndex + 1} / {nodeImages.length} 
                      {imageScale > 1 && ` · ${(imageScale * 100).toFixed(0)}%`}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '60px 20px',
                  background: '#f9fafb',
                  borderRadius: '12px',
                  border: '2px dashed #d1d5db',
                  marginBottom: '24px'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📷</div>
                  <div style={{ color: '#6b7280', fontSize: '1.1rem' }}>
                    この地点には画像が登録されていません
                  </div>
                </div>
              )}

              {/* 現在地選択ボタン */}
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => {
                    window.location.href = `/links?node=${selectedNodeForCard.id}`;
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #4ecdc4 0%, #44a7a0 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '16px 48px',
                    borderRadius: '12px',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(78, 205, 196, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(78, 205, 196, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(78, 205, 196, 0.3)';
                  }}
                >
                  ここを現在地に設定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
