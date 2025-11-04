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

// グラフ構築（一方通行リンク）
func BuildGraph(db *gorm.DB) (map[uint][]Edge, error) {
	var links []Link
	if err := db.Find(&links).Error; err != nil {
		return nil, err
	}

	fmt.Printf("Debug: Found %d directional links in database\n", len(links))
	
	graph := make(map[uint][]Edge)
	
	// すべてのノードをグラフに初期化（FromNodeIDとToNodeIDの両方）
	nodeSet := make(map[uint]bool)
	for _, link := range links {
		nodeSet[link.FromNodeID] = true
		nodeSet[link.ToNodeID] = true
	}
	
	// 全ノードをグラフのキーとして初期化
	for nodeID := range nodeSet {
		graph[nodeID] = []Edge{}
	}
	
	for _, link := range links {
		fmt.Printf("Debug: Processing link %d: %d -> %d (distance: %.2f, directed: %t)\n", 
			link.ID, link.FromNodeID, link.ToNodeID, link.Distance, link.IsDirected)
			
		// FromNodeからToNodeへのエッジを追加
		graph[link.FromNodeID] = append(graph[link.FromNodeID], Edge{
			ToNodeID: link.ToNodeID,
			Weight:   link.Weight,
			LinkID:   link.ID,
		})
		
		// 双方向リンクの場合（IsDirected = false）、逆方向も追加
		if !link.IsDirected {
			graph[link.ToNodeID] = append(graph[link.ToNodeID], Edge{
				ToNodeID: link.FromNodeID,
				Weight:   link.Weight,
				LinkID:   link.ID,
			})
		}
	}
	
	fmt.Printf("Debug: Directional graph built with %d nodes\n", len(graph))
	for nodeID, edges := range graph {
		fmt.Printf("Debug: Node %d has %d outgoing connections\n", nodeID, len(edges))
	}
	
	return graph, nil
}

// ダイクストラ法の実装
func Dijkstra(graph map[uint][]Edge, startNodeID, endNodeID uint, db *gorm.DB) (*DijkstraResult, error) {
	fmt.Printf("Debug: Starting Dijkstra from node %d to node %d\n", startNodeID, endNodeID)
	
	// グラフに存在するノードを確認
	fmt.Printf("Debug: Graph contains %d nodes: ", len(graph))
	nodeIDs := make([]uint, 0, len(graph))
	for nodeID := range graph {
		nodeIDs = append(nodeIDs, nodeID)
	}
	fmt.Printf("%v\n", nodeIDs)
	
	// 開始・終了ノードがグラフに存在するかチェック
	if _, exists := graph[startNodeID]; !exists {
		return nil, fmt.Errorf("開始ノード %d がグラフに存在しません（存在するノード: %v）", startNodeID, nodeIDs)
	}
	if _, exists := graph[endNodeID]; !exists {
		return nil, fmt.Errorf("終了ノード %d がグラフに存在しません（存在するノード: %v）", endNodeID, nodeIDs)
	}
	
	distances := make(map[uint]*DijkstraNode)
	pq := &PriorityQueue{}
	
	// 開始ノードの初期化
	startNode := &DijkstraNode{
		NodeID:   startNodeID,
		Distance: 0,
		Previous: nil,
		LinkID:   nil,
		Index:    -1, // ヒープ用インデックスを初期化
	}
	distances[startNodeID] = startNode
	heap.Push(pq, startNode)
	
	// データベースから全ノードを取得してすべてのノードを初期化
	var allNodes []Node
	if err := db.Find(&allNodes).Error; err != nil {
		return nil, fmt.Errorf("ノード取得エラー: %v", err)
	}
	
	fmt.Printf("Debug: Found %d total nodes in database\n", len(allNodes))
	
	// 全ノードを無限大で初期化
	for _, node := range allNodes {
		if node.ID != startNodeID {
			dijkstraNode := &DijkstraNode{
				NodeID:   node.ID,
				Distance: math.Inf(1),
				Previous: nil,
				LinkID:   nil,
				Index:    -1, // ヒープ用インデックスを初期化
			}
			distances[node.ID] = dijkstraNode
		}
	}
	
	fmt.Printf("Debug: Starting main loop with %d nodes in priority queue\n", pq.Len())
	
	for pq.Len() > 0 {
		fmt.Printf("Debug: Priority queue length: %d\n", pq.Len())
		current := heap.Pop(pq).(*DijkstraNode)
		fmt.Printf("Debug: Processing node %d with distance %.2f\n", current.NodeID, current.Distance)
		
		// 目標ノードに到達した場合
		if current.NodeID == endNodeID {
			fmt.Printf("Debug: Reached target node %d\n", endNodeID)
			break
		}
		
		// 隣接ノードを探索
		edges := graph[current.NodeID]
		fmt.Printf("Debug: Node %d has %d edges\n", current.NodeID, len(edges))
		
		for _, edge := range edges {
			neighbor := distances[edge.ToNodeID]
			newDistance := current.Distance + edge.Weight
			
			fmt.Printf("Debug: Checking edge to node %d: current=%.2f + weight=%.2f = %.2f vs existing=%.2f\n", 
				edge.ToNodeID, current.Distance, edge.Weight, newDistance, neighbor.Distance)
			
			if newDistance < neighbor.Distance {
				fmt.Printf("Debug: Updating node %d distance from %.2f to %.2f\n", 
					edge.ToNodeID, neighbor.Distance, newDistance)
				neighbor.Distance = newDistance
				neighbor.Previous = &current.NodeID
				neighbor.LinkID = &edge.LinkID
				
				// ヒープに追加（既に処理済みでない場合）
				if neighbor.Index == -1 {
					fmt.Printf("Debug: Adding node %d to priority queue\n", neighbor.NodeID)
					heap.Push(pq, neighbor)
					fmt.Printf("Debug: Priority queue size after push: %d\n", pq.Len())
				} else {
					fmt.Printf("Debug: Updating node %d in priority queue\n", neighbor.NodeID)
					heap.Fix(pq, neighbor.Index)
					fmt.Printf("Debug: Priority queue size after fix: %d\n", pq.Len())
				}
			}
		}
	}
	
	// 最終距離の確認
	finalDistance := distances[endNodeID].Distance
	fmt.Printf("Debug: Final distance to node %d: %.2f\n", endNodeID, finalDistance)
	
	// 経路が見つからない場合のチェック
	if finalDistance == math.Inf(1) {
		fmt.Printf("Debug: No path found - distance is infinite\n")
		return nil, fmt.Errorf("経路が見つかりませんでした (ノード %d から %d へ)", startNodeID, endNodeID)
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