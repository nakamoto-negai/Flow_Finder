package main

import (
	"container/heap"
	"fmt"
	"math"
	"gorm.io/gorm"
)

// グラフのエッジ（隣接リスト用）
type Edge struct {
	ToNodeID uint
	Weight   float64
	LinkID   uint // 元のLinkIDを保持
}

// ダイクストラ法用のノード情報
type DijkstraNode struct {
	NodeID   uint
	Distance float64
	Previous *uint // 前のノード（経路復元用）
	LinkID   *uint // 使用したリンクID
	Index    int   // ヒープ用インデックス
}

// 優先度付きキュー（最小ヒープ）の実装
type PriorityQueue []*DijkstraNode

func (pq PriorityQueue) Len() int { return len(pq) }

func (pq PriorityQueue) Less(i, j int) bool {
	return pq[i].Distance < pq[j].Distance
}

func (pq PriorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].Index = i
	pq[j].Index = j
}

func (pq *PriorityQueue) Push(x interface{}) {
	n := len(*pq)
	node := x.(*DijkstraNode)
	node.Index = n
	*pq = append(*pq, node)
}

func (pq *PriorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	node := old[n-1]
	old[n-1] = nil
	node.Index = -1
	*pq = old[0 : n-1]
	return node
}

// グラフ構築
func BuildGraph(db *gorm.DB) (map[uint][]Edge, error) {
	var links []Link
	if err := db.Find(&links).Error; err != nil {
		return nil, err
	}

	graph := make(map[uint][]Edge)
	
	for _, link := range links {
		// 双方向グラフとして構築（必要に応じて単方向に変更可能）
		graph[link.FromNodeID] = append(graph[link.FromNodeID], Edge{
			ToNodeID: link.ToNodeID,
			Weight:   link.Distance,
			LinkID:   link.ID,
		})
		
		// 逆方向も追加（双方向の場合）
		graph[link.ToNodeID] = append(graph[link.ToNodeID], Edge{
			ToNodeID: link.FromNodeID,
			Weight:   link.Distance,
			LinkID:   link.ID,
		})
	}
	
	return graph, nil
}

// ダイクストラ法の実装
func Dijkstra(graph map[uint][]Edge, startNodeID, endNodeID uint) (*DijkstraResult, error) {
	distances := make(map[uint]*DijkstraNode)
	pq := &PriorityQueue{}
	
	// 開始ノードの初期化
	startNode := &DijkstraNode{
		NodeID:   startNodeID,
		Distance: 0,
		Previous: nil,
		LinkID:   nil,
	}
	distances[startNodeID] = startNode
	heap.Push(pq, startNode)
	
	// 他のノードは無限大で初期化
	for nodeID := range graph {
		if nodeID != startNodeID {
			node := &DijkstraNode{
				NodeID:   nodeID,
				Distance: math.Inf(1),
				Previous: nil,
				LinkID:   nil,
			}
			distances[nodeID] = node
		}
	}
	
	for pq.Len() > 0 {
		current := heap.Pop(pq).(*DijkstraNode)
		
		// 目標ノードに到達した場合
		if current.NodeID == endNodeID {
			break
		}
		
		// 隣接ノードを探索
		for _, edge := range graph[current.NodeID] {
			neighbor := distances[edge.ToNodeID]
			newDistance := current.Distance + edge.Weight
			
			if newDistance < neighbor.Distance {
				neighbor.Distance = newDistance
				neighbor.Previous = &current.NodeID
				neighbor.LinkID = &edge.LinkID
				
				// ヒープに追加（既に処理済みでない場合）
				if neighbor.Index == -1 {
					heap.Push(pq, neighbor)
				} else {
					heap.Fix(pq, neighbor.Index)
				}
			}
		}
	}
	
	// 結果の構築
	result := &DijkstraResult{
		StartNodeID: startNodeID,
		EndNodeID:   endNodeID,
		TotalDistance: distances[endNodeID].Distance,
		Path: buildPath(distances, startNodeID, endNodeID),
	}
	
	return result, nil
}

// 経路復元
func buildPath(distances map[uint]*DijkstraNode, startNodeID, endNodeID uint) []PathStep {
	if distances[endNodeID].Distance == math.Inf(1) {
		return nil // 経路なし
	}
	
	var path []PathStep
	current := endNodeID
	
	for current != startNodeID {
		node := distances[current]
		if node.Previous == nil {
			break
		}
		
		step := PathStep{
			FromNodeID: *node.Previous,
			ToNodeID:   current,
			LinkID:     *node.LinkID,
			Distance:   node.Distance - distances[*node.Previous].Distance,
		}
		path = append([]PathStep{step}, path...) // 先頭に挿入
		current = *node.Previous
	}
	
	return path
}

// 結果の構造体
type DijkstraResult struct {
	StartNodeID   uint       `json:"start_node_id"`
	EndNodeID     uint       `json:"end_node_id"`
	TotalDistance float64    `json:"total_distance"`
	Path          []PathStep `json:"path"`
}

type PathStep struct {
	FromNodeID uint    `json:"from_node_id"`
	ToNodeID   uint    `json:"to_node_id"`
	LinkID     uint    `json:"link_id"`
	Distance   float64 `json:"distance"`
}

// 観光地を考慮した重み調整版
func DijkstraWithTouristWeight(graph map[uint][]Edge, startNodeID, endNodeID uint, db *gorm.DB) (*DijkstraResult, error) {
	// 観光地の混雑度を取得
	touristSpots := make(map[uint]*TouristSpot)
	var spots []TouristSpot
	db.Find(&spots)
	for _, spot := range spots {
		touristSpots[spot.NodeID] = &spot
	}
	
	// 重み調整されたグラフを作成
	adjustedGraph := make(map[uint][]Edge)
	for nodeID, edges := range graph {
		for _, edge := range edges {
			weight := edge.Weight
			
			// 到達先ノードに観光地がある場合、混雑度に応じて重みを調整
			if spot, exists := touristSpots[edge.ToNodeID]; exists {
				congestionRatio := float64(spot.CurrentCount) / float64(spot.MaxCapacity)
				// 混雑度が高いほど重みを増加（避けたいルート）
				weightMultiplier := 1.0 + (congestionRatio * 0.5) // 最大50%増加
				weight *= weightMultiplier
			}
			
			adjustedGraph[nodeID] = append(adjustedGraph[nodeID], Edge{
				ToNodeID: edge.ToNodeID,
				Weight:   weight,
				LinkID:   edge.LinkID,
			})
		}
	}
	
	return Dijkstra(adjustedGraph, startNodeID, endNodeID)
}