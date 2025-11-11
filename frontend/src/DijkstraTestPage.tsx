import React, { useState, useEffect, Fragment } from 'react';
import { getApiUrl } from './config';

interface Node {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

interface TouristSpot {
  id: number;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  node_id?: number;
  node?: Node;
}

interface PathStep {
  from_node_id: number;
  to_node_id: number;
  from_node_name: string;
  to_node_name: string;
  link_id: number;
  distance: number;
}

interface DijkstraResult {
  start_node_id: number;
  end_node_id: number;
  total_distance: number;
  path: PathStep[];
  path_length: number;
}

const DijkstraTestPage: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [touristSpots, setTouristSpots] = useState<TouristSpot[]>([]);
  const [nodesWithSpots, setNodesWithSpots] = useState<Node[]>([]);
  const [startNodeId, setStartNodeId] = useState<number>(0);
  const [endNodeId, setEndNodeId] = useState<number>(0);
  const [result, setResult] = useState<DijkstraResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showTouristSpots, setShowTouristSpots] = useState(false);

  // ノード一覧を取得
  useEffect(() => {
    fetch(getApiUrl('/nodes'))
      .then(res => res.json())
      .then(data => setNodes(data))
      .catch(err => console.error('ノード取得エラー:', err));
  }, []);

  // 観光地一覧を取得
  useEffect(() => {
    fetch(getApiUrl('/tourist-spots'))
      .then(res => res.json())
      .then(data => {
        setTouristSpots(data);
        // 観光地を持つノードを抽出
        const uniqueNodeIds = [...new Set(data.filter((spot: TouristSpot) => spot.node_id).map((spot: TouristSpot) => spot.node_id))];
        fetch(getApiUrl('/nodes'))
          .then(res => res.json())
          .then(nodeData => {
            const spotsNodes = nodeData.filter((node: Node) => uniqueNodeIds.includes(node.id));
            setNodesWithSpots(spotsNodes);
          });
      })
      .catch(err => console.error('観光地取得エラー:', err));
  }, []);

  // 最短経路計算
  const calculatePath = async () => {
    if (!startNodeId || !endNodeId) {
      setError('開始地点と終了地点を選択してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl(`/api/shortest-path/${startNodeId}/${endNodeId}`));
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '経路計算に失敗しました');
      }
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // 結果をクリア
  const clearResults = () => {
    setResult(null);
    setError(null);
    setDebugInfo(null);
  };

  // デバッグ情報を取得
  const fetchDebugInfo = async () => {
    try {
      const response = await fetch(getApiUrl('/api/debug/graph'));
      if (response.ok) {
        const data = await response.json();
        setDebugInfo(data);
        console.log('グラフ構造:', data);
      }
    } catch (err) {
      console.error('デバッグ情報取得エラー:', err);
    }
  };

  // 距離をフォーマット
  const formatDistance = (distance: number) => {
    if (distance >= 1000) {
      return `${(distance / 1000).toFixed(2)}km`;
    }
    return `${Math.round(distance)}m`;
  };

  return (
    <div style={{ maxWidth: 800, margin: '20px auto', padding: 20 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 30 }}>🔍 ダイクストラ法テストページ</h1>

      {/* 入力部分 */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: 20, 
        borderRadius: 8, 
        marginBottom: 20,
        border: '1px solid #e9ecef'
      }}>
        <h2 style={{ margin: '0 0 15px 0', fontSize: '1.2rem' }}>経路検索設定</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 15 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>
              開始地点:
            </label>
            <select 
              value={startNodeId} 
              onChange={e => setStartNodeId(Number(e.target.value))}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value={0}>選択してください</option>
              {nodes.map(node => (
                <option key={node.id} value={node.id}>
                  {node.name} (ID: {node.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>
              終了地点:
            </label>
            <select 
              value={endNodeId} 
              onChange={e => setEndNodeId(Number(e.target.value))}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value={0}>選択してください</option>
              {nodes.map(node => (
                <option key={node.id} value={node.id}>
                  {node.name} (ID: {node.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button 
            onClick={calculatePath}
            disabled={loading || !startNodeId || !endNodeId}
            style={{ 
              padding: '10px 20px', 
              background: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: 4, 
              cursor: 'pointer',
              opacity: loading || !startNodeId || !endNodeId ? 0.6 : 1
            }}
          >
            最短経路を計算
          </button>
          
          <button 
            onClick={clearResults}
            style={{ 
              padding: '10px 20px', 
              background: '#6c757d', 
              color: 'white', 
              border: 'none', 
              borderRadius: 4, 
              cursor: 'pointer'
            }}
          >
            クリア
          </button>
          
          <button 
            onClick={fetchDebugInfo}
            style={{ 
              padding: '10px 20px', 
              background: '#ffc107', 
              color: 'black', 
              border: 'none', 
              borderRadius: 4, 
              cursor: 'pointer'
            }}
          >
            グラフ構造確認
          </button>
          
          <button 
            onClick={() => setShowTouristSpots(!showTouristSpots)}
            style={{ 
              padding: '10px 20px', 
              background: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: 4, 
              cursor: 'pointer'
            }}
          >
            {showTouristSpots ? '観光地一覧を隠す' : '観光地一覧を表示'}
          </button>
        </div>
      </div>

      {/* ナビゲーション */}
      <div style={{ marginBottom: 20, textAlign: 'center' }}>
        <a href="/" style={{ 
          padding: '8px 16px', 
          background: '#28a745', 
          color: 'white', 
          textDecoration: 'none', 
          borderRadius: 4,
          marginRight: 10
        }}>
          メインページに戻る
        </a>
        <a href="/admin" style={{ 
          padding: '8px 16px', 
          background: '#17a2b8', 
          color: 'white', 
          textDecoration: 'none', 
          borderRadius: 4 
        }}>
          管理画面
        </a>
      </div>

      {/* ローディング・エラー表示 */}
      {loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: 20, 
          background: '#e3f2fd', 
          borderRadius: 8, 
          marginBottom: 20 
        }}>
          <div>🔄 経路を計算中...</div>
        </div>
      )}

      {error && (
        <div style={{ 
          padding: 15, 
          background: '#f8d7da', 
          color: '#721c24', 
          borderRadius: 8, 
          marginBottom: 20,
          border: '1px solid #f5c6cb'
        }}>
          ❌ エラー: {error}
        </div>
      )}

      {/* デバッグ情報表示 */}
      {debugInfo && (
        <div style={{ 
          background: '#fff3cd', 
          padding: 20, 
          borderRadius: 8, 
          marginBottom: 20,
          border: '1px solid #ffeaa7'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#856404' }}>
            🔧 グラフ構造デバッグ情報
          </h3>
          
          <div style={{ marginBottom: 15 }}>
            <strong>ノード数:</strong> {debugInfo.node_count}
          </div>
          
          <h4 style={{ margin: '15px 0 10px 0' }}>ノード接続情報:</h4>
          <div style={{ maxHeight: 300, overflowY: 'auto', fontSize: '0.9rem' }}>
            {Object.entries(debugInfo.graph || {}).map(([nodeId, edges]: [string, any]) => (
              <div key={nodeId} style={{ 
                marginBottom: 10, 
                padding: 10, 
                background: '#f8f9fa', 
                borderRadius: 4 
              }}>
                <div style={{ fontWeight: 'bold' }}>
                  ノード {nodeId}: {Array.isArray(edges) ? edges.length : 0} 接続
                </div>
                {Array.isArray(edges) && edges.map((edge: any, index: number) => (
                  <div key={index} style={{ fontSize: '0.8rem', color: '#6c757d', marginLeft: 10 }}>
                    → ノード {edge.ToNodeID} (距離: {edge.Weight}, リンクID: {edge.LinkID})
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 観光地を持つノード一覧 */}
      {showTouristSpots && nodesWithSpots.length > 0 && (
        <div style={{ 
          background: '#e8f5e8', 
          padding: 20, 
          borderRadius: 8, 
          marginBottom: 20,
          border: '1px solid #b7e4c7'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#2d5016' }}>
            🏛️ 観光地を持つノード一覧
          </h3>
          
          <div style={{ marginBottom: 15 }}>
            <strong>観光地が関連付けられているノード数:</strong> {nodesWithSpots.length}
          </div>
          
          <div style={{ maxHeight: 300, overflowY: 'auto', fontSize: '0.9rem' }}>
            {nodesWithSpots.map((node) => {
              const relatedSpots = touristSpots.filter(spot => spot.node_id === node.id);
              return (
                <div key={node.id} style={{ 
                  marginBottom: 12, 
                  padding: 15, 
                  background: '#ffffff', 
                  borderRadius: 6,
                  border: '1px solid #b7e4c7',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    color: '#2d5016',
                    marginBottom: 8,
                    fontSize: '1rem'
                  }}>
                    📍 {node.name} (ID: {node.id})
                  </div>
                  <div style={{ 
                    fontSize: '0.85rem', 
                    color: '#6c757d', 
                    marginBottom: 8 
                  }}>
                    座標: {node.latitude.toFixed(6)}, {node.longitude.toFixed(6)}
                  </div>
                  <div style={{ marginLeft: 10 }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      color: '#495057', 
                      marginBottom: 5,
                      fontSize: '0.9rem'
                    }}>
                      関連する観光地 ({relatedSpots.length}件):
                    </div>
                    {relatedSpots.map((spot) => (
                      <div key={spot.id} style={{ 
                        fontSize: '0.8rem', 
                        color: '#6c757d', 
                        marginLeft: 15,
                        marginBottom: 3,
                        padding: '3px 0',
                        borderLeft: '2px solid #28a745',
                        paddingLeft: 8
                      }}>
                        🏛️ {spot.name}
                        {spot.description && (
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: '#868e96',
                            marginTop: 2 
                          }}>
                            {spot.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 結果表示 */}
      {result && (
        <div style={{ 
          background: 'white', 
          padding: 20, 
          borderRadius: 8, 
          border: '2px solid #007bff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#007bff' }}>
            📏 最短経路結果
          </h3>
          
          <div style={{ marginBottom: 15 }}>
            <strong>総距離:</strong> {formatDistance(result.total_distance)}
          </div>
          <div style={{ marginBottom: 15 }}>
            <strong>経由リンク数:</strong> {result.path ? result.path.length : 0}
          </div>
          <div style={{ marginBottom: 15 }}>
            <strong>通過ノード数:</strong> {result.path ? result.path.length + 1 : 0}
          </div>
          
          {/* 経路概要 */}
          {result.path && result.path.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>経路概要:</h4>
              <div style={{ 
                background: '#e9ecef', 
                padding: 15, 
                borderRadius: 6,
                border: '1px solid #ced4da'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  flexWrap: 'wrap',
                  gap: 8
                }}>
                  <span style={{ 
                    background: '#28a745', 
                    color: 'white', 
                    padding: '4px 8px', 
                    borderRadius: 12,
                    fontSize: '0.9rem',
                    fontWeight: 'bold'
                  }}>
                    🚩 {result.path[0]?.from_node_name}
                  </span>
                  
                  {result.path.map((step, index) => (
                    <Fragment key={index}>
                      <span style={{ color: '#6c757d' }}>→</span>
                      <span style={{ 
                        background: index === result.path.length - 1 ? '#dc3545' : '#007bff', 
                        color: 'white', 
                        padding: '4px 8px', 
                        borderRadius: 12,
                        fontSize: '0.9rem',
                        fontWeight: 'bold'
                      }}>
                        {index === result.path.length - 1 ? '🎯' : '📍'} {step.to_node_name}
                      </span>
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <h4 style={{ margin: '15px 0 10px 0' }}>経路詳細:</h4>
          {result.path && result.path.length > 0 ? (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {result.path.map((step, index) => (
                <div key={index} style={{ 
                  padding: 12, 
                  background: index % 2 === 0 ? '#f8f9fa' : '#ffffff', 
                  marginBottom: 4, 
                  borderRadius: 4,
                  border: '1px solid #e9ecef',
                  borderLeft: '4px solid #007bff'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: 5
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                      ステップ {index + 1}: {step.from_node_name} → {step.to_node_name}
                    </div>
                    <div style={{ 
                      fontSize: '0.9rem', 
                      color: '#28a745', 
                      fontWeight: 'bold' 
                    }}>
                      {formatDistance(step.distance)}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                    📍 ノード ID: {step.from_node_id} → {step.to_node_id} | 
                    🔗 リンク ID: {step.link_id}
                  </div>
                </div>
              ))}
              
              {/* 到着地点の表示 */}
              <div style={{ 
                padding: 12, 
                background: '#e8f5e8', 
                borderRadius: 4,
                border: '2px solid #28a745',
                marginTop: 8
              }}>
                <div style={{ fontWeight: 'bold', color: '#28a745', fontSize: '1rem' }}>
                  🎯 到着: {result.path[result.path.length - 1]?.to_node_name}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                  ノード ID: {result.path[result.path.length - 1]?.to_node_id}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ 
              padding: 20, 
              textAlign: 'center', 
              background: '#f8f9fa', 
              borderRadius: 4,
              color: '#6c757d'
            }}>
              経路情報がありません
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DijkstraTestPage;