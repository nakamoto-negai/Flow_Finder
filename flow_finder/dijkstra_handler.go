package main

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Dijkstra関連のルートを登録
func RegisterDijkstraRoutes(r *gin.Engine, db *gorm.DB) {
	// 最短経路計算
	r.POST("/dijkstra", dijkstraCalculationHandler(db))

	// 観光地間の最短経路
	r.POST("/tourist-spots/route", touristSpotRouteHandler(db))

	// 進行可能なリンク一覧取得
	r.GET("/nodes/:id/available-links", availableLinksHandler(db))

	// デバッグ用：グラフ構造表示
	r.GET("/debug/graph", debugGraphHandler(db))

	// デバッグ用：ノード間の距離計算
	r.POST("/debug/distance", debugDistanceHandler(db))
}

// Dijkstra最短経路計算ハンドラ
func dijkstraCalculationHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			StartNodeID uint `json:"start_node_id" binding:"required"`
			EndNodeID   uint `json:"end_node_id" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です", "details": err.Error()})
			return
		}

		if req.StartNodeID == req.EndNodeID {
			c.JSON(400, gin.H{"error": "開始ノードと終了ノードは異なる必要があります"})
			return
		}

		// ノードの存在確認
		var startNode, endNode Node
		if err := db.First(&startNode, req.StartNodeID).Error; err != nil {
			c.JSON(404, gin.H{"error": "開始ノードが見つかりません"})
			return
		}
		if err := db.First(&endNode, req.EndNodeID).Error; err != nil {
			c.JSON(404, gin.H{"error": "終了ノードが見つかりません"})
			return
		}

		// グラフを構築
		graph, err := BuildGraph(db)
		if err != nil {
			c.JSON(500, gin.H{"error": "グラフ構築に失敗しました", "details": err.Error()})
			return
		}

		// Dijkstraアルゴリズムを実行
		result, err := Dijkstra(graph, req.StartNodeID, req.EndNodeID, db)
		if err != nil {
			c.JSON(500, gin.H{"error": "経路計算に失敗しました", "details": err.Error()})
			return
		}

		if result == nil {
			c.JSON(404, gin.H{"error": "経路が見つかりませんでした"})
			return
		}

		// 経路上のノード情報を取得
		var pathNodes []Node
		if len(result.Path) > 0 {
			// 開始ノードを追加
			pathNodes = append(pathNodes, startNode)

			// 経路の各ステップから終了ノードを取得
			for _, step := range result.Path {
				var toNode Node
				if err := db.First(&toNode, step.ToNodeID).Error; err == nil {
					pathNodes = append(pathNodes, toNode)
				}
			}
		} else {
			// 経路がない場合は開始ノードのみ
			pathNodes = append(pathNodes, startNode)
		}

		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "read", "dijkstra_calculation",
			strconv.Itoa(int(req.StartNodeID))+"-"+strconv.Itoa(int(req.EndNodeID)), c)

		c.JSON(200, gin.H{
			"result":         "ok",
			"start_node":     startNode,
			"end_node":       endNode,
			"path":           pathNodes,
			"path_steps":     result.Path,
			"total_distance": result.TotalDistance,
			"node_count":     len(pathNodes),
		})
	}
}

// 観光地間の最短経路計算ハンドラ
func touristSpotRouteHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			StartSpotID uint `json:"start_spot_id" binding:"required"`
			EndSpotID   uint `json:"end_spot_id" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です", "details": err.Error()})
			return
		}

		if req.StartSpotID == req.EndSpotID {
			c.JSON(400, gin.H{"error": "開始観光地と終了観光地は異なる必要があります"})
			return
		}

		// 観光地の存在確認とノード情報取得
		var startSpot, endSpot TouristSpot
		if err := db.Preload("Node").First(&startSpot, req.StartSpotID).Error; err != nil {
			c.JSON(404, gin.H{"error": "開始観光地が見つかりません"})
			return
		}
		if err := db.Preload("Node").First(&endSpot, req.EndSpotID).Error; err != nil {
			c.JSON(404, gin.H{"error": "終了観光地が見つかりません"})
			return
		}

		// 観光地に関連付けられたノードがあるかチェック
		if startSpot.NodeID == nil {
			c.JSON(400, gin.H{"error": "開始観光地にノードが関連付けられていません"})
			return
		}
		if endSpot.NodeID == nil {
			c.JSON(400, gin.H{"error": "終了観光地にノードが関連付けられていません"})
			return
		}

		// グラフを構築
		graph, err := BuildGraph(db)
		if err != nil {
			c.JSON(500, gin.H{"error": "グラフ構築に失敗しました", "details": err.Error()})
			return
		}

		// Dijkstraアルゴリズムを実行
		result, err := Dijkstra(graph, *startSpot.NodeID, *endSpot.NodeID, db)
		if err != nil {
			c.JSON(500, gin.H{"error": "経路計算に失敗しました", "details": err.Error()})
			return
		}

		if result == nil {
			c.JSON(404, gin.H{"error": "経路が見つかりませんでした"})
			return
		}

		// 経路上のノード情報を取得
		var pathNodes []Node
		if len(result.Path) > 0 {
			// 開始ノードを追加
			if startSpot.Node != nil {
				pathNodes = append(pathNodes, *startSpot.Node)
			}

			// 経路の各ステップから終了ノードを取得
			for _, step := range result.Path {
				var toNode Node
				if err := db.First(&toNode, step.ToNodeID).Error; err == nil {
					pathNodes = append(pathNodes, toNode)
				}
			}
		} else {
			// 経路がない場合は開始ノードのみ
			if startSpot.Node != nil {
				pathNodes = append(pathNodes, *startSpot.Node)
			}
		}

		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "read", "tourist_spot_route",
			strconv.Itoa(int(req.StartSpotID))+"-"+strconv.Itoa(int(req.EndSpotID)), c)

		c.JSON(200, gin.H{
			"result":         "ok",
			"start_spot":     startSpot,
			"end_spot":       endSpot,
			"path":           pathNodes,
			"path_steps":     result.Path,
			"total_distance": result.TotalDistance,
			"node_count":     len(pathNodes),
			"estimated_time": result.TotalDistance / 5.0, // 時速5km想定での所要時間（時間）
		})
	}
}

// デバッグ用：グラフ構造表示ハンドラ
func debugGraphHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 全ノード取得
		var nodes []Node
		if err := db.Find(&nodes).Error; err != nil {
			c.JSON(500, gin.H{"error": "ノードの取得に失敗しました"})
			return
		}

		// 全リンク取得
		var links []Link
		if err := db.Preload("FromNode").Preload("ToNode").Find(&links).Error; err != nil {
			c.JSON(500, gin.H{"error": "リンクの取得に失敗しました"})
			return
		}

		// 隣接リスト形式での表現
		adjacencyList := make(map[uint][]gin.H)
		for _, link := range links {
			fromID := link.FromNodeID
			adjacencyList[fromID] = append(adjacencyList[fromID], gin.H{
				"to_node_id": link.ToNodeID,
				"to_node":    link.ToNode,
				"distance":   link.Distance,
				"weight":     link.Weight,
			})

			// 双方向リンクの場合、逆方向も追加
			if !link.IsDirected {
				toID := link.ToNodeID
				adjacencyList[toID] = append(adjacencyList[toID], gin.H{
					"to_node_id": link.FromNodeID,
					"to_node":    link.FromNode,
					"distance":   link.Distance,
					"weight":     link.Weight,
				})
			}
		}

		// 観光地情報も取得
		var spots []TouristSpot
		db.Where("node_id IS NOT NULL").Find(&spots)

		c.JSON(200, gin.H{
			"result":         "ok",
			"node_count":     len(nodes),
			"link_count":     len(links),
			"nodes":          nodes,
			"links":          links,
			"adjacency_list": adjacencyList,
			"tourist_spots":  spots,
		})
	}
}

// デバッグ用：ノード間の距離計算ハンドラ
func debugDistanceHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			FromNodeID uint `json:"from_node_id" binding:"required"`
			ToNodeID   uint `json:"to_node_id" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です", "details": err.Error()})
			return
		}

		// ノードの存在確認
		var fromNode, toNode Node
		if err := db.First(&fromNode, req.FromNodeID).Error; err != nil {
			c.JSON(404, gin.H{"error": "開始ノードが見つかりません"})
			return
		}
		if err := db.First(&toNode, req.ToNodeID).Error; err != nil {
			c.JSON(404, gin.H{"error": "終了ノードが見つかりません"})
			return
		}

		// 直線距離を計算
		directDistance := calculateDistance(fromNode.X, fromNode.Y, toNode.X, toNode.Y)

		// リンクが存在するかチェック
		var link Link
		linkExists := false
		linkDistance := 0.0

		// 双方向チェック
		if err := db.Where("(from_node_id = ? AND to_node_id = ?) OR (from_node_id = ? AND to_node_id = ? AND is_directed = false)",
			req.FromNodeID, req.ToNodeID, req.ToNodeID, req.FromNodeID).First(&link).Error; err == nil {
			linkExists = true
			linkDistance = link.Distance
		}

		c.JSON(200, gin.H{
			"result":          "ok",
			"from_node":       fromNode,
			"to_node":         toNode,
			"direct_distance": directDistance,
			"link_exists":     linkExists,
			"link_distance":   linkDistance,
			"difference":      linkDistance - directDistance,
		})
	}
}

// 進行可能なリンク一覧取得ハンドラ
func availableLinksHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nodeIDStr := c.Param("id")
		nodeID, err := strconv.ParseUint(nodeIDStr, 10, 32)
		if err != nil {
			c.JSON(400, gin.H{"error": "無効なノードIDです"})
			return
		}

		// ノードの存在確認
		var currentNode Node
		if err := db.First(&currentNode, uint(nodeID)).Error; err != nil {
			c.JSON(404, gin.H{"error": "ノードが見つかりません"})
			return
		}

		// 現在のノードから進行可能なリンクを取得（自身が開始ノードのもののみ）
		var availableLinks []struct {
			Link     Link `json:"link"`
			ToNode   Node `json:"to_node"`
			Distance float64 `json:"distance"`
		}

		// 出発ノードとしてのリンクのみ取得
		var outgoingLinks []Link
		if err := db.Preload("ToNode").Where("from_node_id = ?", nodeID).Find(&outgoingLinks).Error; err != nil {
			c.JSON(500, gin.H{"error": "リンクの取得に失敗しました"})
			return
		}

		for _, link := range outgoingLinks {
			availableLinks = append(availableLinks, struct {
				Link     Link `json:"link"`
				ToNode   Node `json:"to_node"`
				Distance float64 `json:"distance"`
			}{
				Link:     link,
				ToNode:   link.ToNode,
				Distance: link.Distance,
			})
		}

		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "read", "available_links", nodeIDStr, c)

		c.JSON(200, gin.H{
			"result":           "ok",
			"current_node":     currentNode,
			"available_links":  availableLinks,
			"link_count":       len(availableLinks),
		})
	}
}
