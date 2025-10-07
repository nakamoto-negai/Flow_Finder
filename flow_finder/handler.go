package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

//セッションIDを生成する関数
func generateSessionIDForHandler() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// ログ用のセッションID生成関数
func generateHandlerSessionID() string {
	return generateSessionIDForHandler()
}

// 認証ミドルウェア: AuthorizationヘッダーのトークンをRedisで検証
func AuthMiddleware(redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-User-Id")
		token := c.GetHeader("Authorization")
		if userID == "" || token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing auth headers"})
			return
		}
		key := "auth_token:" + userID
		val, err := redisClient.Get(context.Background(), key).Result()
		if err == redis.Nil || val != token {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		} else if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "redis error"})
			return
		}
		c.Next()
	}
}

// ユーザーAPIハンドラ群
func RegisterUserRoutes(r *gin.Engine, db *gorm.DB, redisClient *redis.Client) {
	// Image追加
	r.POST("/images", func(c *gin.Context) {
		var req struct {
			LinkID uint   `json:"link_id"`
			Order  int    `json:"order"`
			URL    string `json:"url"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "invalid request"})
			return
		}
		img := Image{
			LinkID: req.LinkID,
			Order:  req.Order,
			URL:    req.URL,
		}
		if err := db.Create(&img).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB insert error"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "create", "images", fmt.Sprintf("%d", img.ID), c)
		
		c.JSON(200, gin.H{"result": "ok", "id": img.ID})
	})

	// Image一覧取得
	r.GET("/images", func(c *gin.Context) {
		var images []Image
		if err := db.Find(&images).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB select error"})
			return
		}
		c.JSON(200, images)
	})
	// Node追加
	r.POST("/nodes", func(c *gin.Context) {
		var req struct {
			Name          string  `json:"name"`
			Latitude      float64 `json:"latitude"`
			Longitude     float64 `json:"longitude"`
			Congestion    int     `json:"congestion"`
			TouristSpotID *uint   `json:"tourist_spot_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "invalid request"})
			return
		}
		node := Node{
			Name:          req.Name,
			Latitude:      req.Latitude,
			Longitude:     req.Longitude,
			Congestion:    req.Congestion,
			TouristSpotID: req.TouristSpotID,
		}
		if err := db.Create(&node).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB insert error"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "create", "nodes", fmt.Sprintf("%d", node.ID), c)
		
		c.JSON(200, gin.H{"result": "ok", "id": node.ID})
	})
	// Node一覧取得
	r.GET("/nodes", func(c *gin.Context) {
		var nodes []Node
		if err := db.Find(&nodes).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB select error"})
			return
		}
		c.JSON(200, nodes)
	})
	// ユーザー追加
	r.POST("/users", func(c *gin.Context) {
		var req struct {
			Name string `json:"name"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "invalid request"})
			return
		}
		user := User{Name: req.Name}
		if err := db.Create(&user).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB insert error"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = &user.ID  // 新規作成されたユーザー自身のID
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "create", "users", fmt.Sprintf("%d", user.ID), c)
		
		c.JSON(200, gin.H{"result": "ok"})
	})

	// ログインAPI（例: ユーザー名のみで認証）
	r.POST("/login", func(c *gin.Context) {
		var req struct {
			Name string `json:"name"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		var user User
		if err := db.Where("name = ?", req.Name).First(&user).Error; err != nil {
			// ログイン失敗をログに記録
			sessionID := c.GetHeader("X-Session-Id")
			if sessionID == "" {
				sessionID = generateSessionIDForHandler()
			}
			LogUserActivity(db, UserLog{
				UserID:    nil, // ゲストユーザー
				SessionID: sessionID,
				LogType:   LogTypeAction,
				Category:  CategoryAuth,
				Action:    ActionLogin,
				Path:      "/login",
				UserAgent: c.Request.UserAgent(),
				IPAddress: c.ClientIP(),
				Error:     "user not found",
			})
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			return
		}
		token, err := GenerateToken(32)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
			return
		}
		// トークンをRedisに保存（有効期限1時間）
		if err := SaveTokenToRedis(context.Background(), redisClient, user.ID, token, time.Hour); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save token"})
			return
		}
		
		// ログイン成功をログに記録
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateSessionIDForHandler()
		}
		LogUserActivity(db, UserLog{
			UserID:    &user.ID, // ポインター型に変更
			SessionID: sessionID,
			LogType:   LogTypeAction,
			Category:  CategoryAuth,
			Action:    ActionLogin,
			Path:      "/login",
			UserAgent: c.Request.UserAgent(),
			IPAddress: c.ClientIP(),
		})
		
		c.JSON(http.StatusOK, gin.H{"token": token, "user_id": user.ID, "session_id": sessionID})
	})

	// ユーザー一覧取得
	r.GET("/users", func(c *gin.Context) {
		var users []User
		if err := db.Find(&users).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB select error"})
			return
		}
		c.JSON(200, users)
	})

	// Link追加
	r.POST("/links", func(c *gin.Context) {
		var req struct {
			FromNodeID uint    `json:"from_node_id"`
			ToNodeID   uint    `json:"to_node_id"`
			Distance   float64 `json:"distance"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "invalid request"})
			return
		}
		link := Link{
			FromNodeID: req.FromNodeID,
			ToNodeID:   req.ToNodeID,
			Distance:   req.Distance,
		}
		if err := db.Create(&link).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB insert error"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "create", "links", fmt.Sprintf("%d", link.ID), c)
		
		c.JSON(200, gin.H{"result": "ok", "id": link.ID})
	})

	// Link一覧取得
	r.GET("/links", func(c *gin.Context) {
		var links []Link
		if err := db.Find(&links).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB select error"})
			return
		}
		c.JSON(200, links)
	})

	// === 観光地関連API ===
	
	// 観光地一覧取得
	r.GET("/tourist-spots", func(c *gin.Context) {
		var spots []TouristSpot
		query := db.Preload("Node")
		
		// カテゴリフィルタ
		if category := c.Query("category"); category != "" {
			query = query.Where("category = ?", category)
		}
		
		// 営業中のみフィルタ
		if open := c.Query("open"); open == "true" {
			query = query.Where("is_open = ?", true)
		}
		
		if err := query.Find(&spots).Error; err != nil {
			c.JSON(500, gin.H{"error": "データ取得エラー"})
			return
		}
		c.JSON(200, spots)
	})

	// 観光地詳細取得
	r.GET("/tourist-spots/:id", func(c *gin.Context) {
		id := c.Param("id")
		var spot TouristSpot
		if err := db.Preload("Node").First(&spot, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "観光地が見つかりません"})
			return
		}
		c.JSON(200, spot)
	})

	// 観光地作成
	r.POST("/tourist-spots", func(c *gin.Context) {
		var req struct {
			NodeID       uint    `json:"node_id" binding:"required"`
			Name         string  `json:"name" binding:"required"`
			Description  string  `json:"description"`
			Category     string  `json:"category"`
			MaxCapacity  int     `json:"max_capacity" binding:"required,min=1"`
			CurrentCount int     `json:"current_count"`
			IsOpen       bool    `json:"is_open"`
			OpeningTime  string  `json:"opening_time"`
			ClosingTime  string  `json:"closing_time"`
			EntryFee     int     `json:"entry_fee"`
			Website      string  `json:"website"`
			PhoneNumber  string  `json:"phone_number"`
			ImageURL     string  `json:"image_url"`
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です", "details": err.Error()})
			return
		}
		
		// ノードが存在するか確認
		var node Node
		if err := db.First(&node, req.NodeID).Error; err != nil {
			c.JSON(400, gin.H{"error": "指定されたノードが存在しません"})
			return
		}
		
		spot := TouristSpot{
			NodeID:       req.NodeID,
			Name:         req.Name,
			Description:  req.Description,
			Category:     req.Category,
			MaxCapacity:  req.MaxCapacity,
			CurrentCount: req.CurrentCount,
			IsOpen:       req.IsOpen,
			OpeningTime:  req.OpeningTime,
			ClosingTime:  req.ClosingTime,
			EntryFee:     req.EntryFee,
			Website:      req.Website,
			PhoneNumber:  req.PhoneNumber,
			ImageURL:     req.ImageURL,
		}
		
		if err := db.Create(&spot).Error; err != nil {
			c.JSON(500, gin.H{"error": "観光地作成に失敗しました"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "create", "tourist_spots", strconv.Itoa(int(spot.ID)), c)
		
		c.JSON(201, gin.H{"result": "ok", "id": spot.ID, "spot": spot})
	})

	// 観光地更新
	r.PUT("/tourist-spots/:id", func(c *gin.Context) {
		id := c.Param("id")
		var spot TouristSpot
		if err := db.First(&spot, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "観光地が見つかりません"})
			return
		}
		
		var req struct {
			Name         *string `json:"name"`
			Description  *string `json:"description"`
			Category     *string `json:"category"`
			MaxCapacity  *int    `json:"max_capacity"`
			CurrentCount *int    `json:"current_count"`
			IsOpen       *bool   `json:"is_open"`
			OpeningTime  *string `json:"opening_time"`
			ClosingTime  *string `json:"closing_time"`
			EntryFee     *int    `json:"entry_fee"`
			Website      *string `json:"website"`
			PhoneNumber  *string `json:"phone_number"`
			ImageURL     *string `json:"image_url"`
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です"})
			return
		}
		
		// フィールドを更新（ポインタがnilでない場合のみ）
		if req.Name != nil {
			spot.Name = *req.Name
		}
		if req.Description != nil {
			spot.Description = *req.Description
		}
		if req.Category != nil {
			spot.Category = *req.Category
		}
		if req.MaxCapacity != nil {
			spot.MaxCapacity = *req.MaxCapacity
		}
		if req.CurrentCount != nil {
			spot.CurrentCount = *req.CurrentCount
		}
		if req.IsOpen != nil {
			spot.IsOpen = *req.IsOpen
		}
		if req.OpeningTime != nil {
			spot.OpeningTime = *req.OpeningTime
		}
		if req.ClosingTime != nil {
			spot.ClosingTime = *req.ClosingTime
		}
		if req.EntryFee != nil {
			spot.EntryFee = *req.EntryFee
		}
		if req.Website != nil {
			spot.Website = *req.Website
		}
		if req.PhoneNumber != nil {
			spot.PhoneNumber = *req.PhoneNumber
		}
		if req.ImageURL != nil {
			spot.ImageURL = *req.ImageURL
		}
		
		if err := db.Save(&spot).Error; err != nil {
			c.JSON(500, gin.H{"error": "観光地更新に失敗しました"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "update", "tourist_spots", id, c)
		
		c.JSON(200, gin.H{"result": "ok", "spot": spot})
	})

	// 観光地削除
	r.DELETE("/tourist-spots/:id", func(c *gin.Context) {
		id := c.Param("id")
		
		if err := db.Delete(&TouristSpot{}, id).Error; err != nil {
			c.JSON(500, gin.H{"error": "削除に失敗しました"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "delete", "tourist_spots", id, c)
		
		c.JSON(200, gin.H{"result": "ok"})
	})

	// 人数変更（入場・退場）
	r.POST("/tourist-spots/:id/visitors", func(c *gin.Context) {
		id := c.Param("id")
		var req struct {
			Action string `json:"action" binding:"required"` // "enter" or "exit"
			Count  int    `json:"count" binding:"required,min=1"`
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です"})
			return
		}
		
		var spot TouristSpot
		if err := db.First(&spot, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "観光地が見つかりません"})
			return
		}
		
		switch req.Action {
		case "enter":
			if !spot.AddVisitors(req.Count) {
				c.JSON(400, gin.H{
					"error": "許容人数を超過します",
					"current": spot.CurrentCount,
					"max": spot.MaxCapacity,
					"available": spot.MaxCapacity - spot.CurrentCount,
				})
				return
			}
		case "exit":
			spot.RemoveVisitors(req.Count)
		default:
			c.JSON(400, gin.H{"error": "actionは'enter'または'exit'である必要があります"})
			return
		}
		
		if err := db.Save(&spot).Error; err != nil {
			c.JSON(500, gin.H{"error": "人数更新に失敗しました"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "update", "tourist_spots", id, c)
		
		c.JSON(200, gin.H{
			"result": "ok",
			"action": req.Action,
			"count": req.Count,
			"current_count": spot.CurrentCount,
			"max_capacity": spot.MaxCapacity,
			"congestion_level": spot.GetCongestionLevel(),
			"congestion_ratio": spot.GetCongestionRatio(),
		})
	})

	// 混雑状況取得
	r.GET("/tourist-spots/:id/congestion", func(c *gin.Context) {
		id := c.Param("id")
		var spot TouristSpot
		if err := db.First(&spot, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "観光地が見つかりません"})
			return
		}
		
		c.JSON(200, gin.H{
			"id": spot.ID,
			"name": spot.Name,
			"current_count": spot.CurrentCount,
			"max_capacity": spot.MaxCapacity,
			"congestion_level": spot.GetCongestionLevel(),
			"congestion_ratio": spot.GetCongestionRatio(),
			"is_currently_open": spot.IsCurrentlyOpen(),
		})
	})

	// === ダイクストラ法による最短経路検索API ===
	
	// 最短経路検索（距離ベース）
	r.GET("/api/shortest-path/:start/:end", func(c *gin.Context) {
		startID, err1 := strconv.Atoi(c.Param("start"))
		endID, err2 := strconv.Atoi(c.Param("end"))
		
		if err1 != nil || err2 != nil {
			c.JSON(400, gin.H{"error": "無効なノードIDです"})
			return
		}
		
		// グラフを構築
		graph, err := BuildGraph(db)
		if err != nil {
			c.JSON(500, gin.H{"error": "グラフ構築エラー"})
			return
		}
		
		// ダイクストラ法実行
		result, err := Dijkstra(graph, uint(startID), uint(endID))
		if err != nil {
			c.JSON(500, gin.H{"error": "経路計算エラー"})
			return
		}
		
		// ノード名を付加した結果を作成
		var enrichedPath []gin.H
		for _, step := range result.Path {
			var fromNode, toNode Node
			db.First(&fromNode, step.FromNodeID)
			db.First(&toNode, step.ToNodeID)
			
			enrichedPath = append(enrichedPath, gin.H{
				"from_node_id":   step.FromNodeID,
				"to_node_id":     step.ToNodeID,
				"from_node_name": fromNode.Name,
				"to_node_name":   toNode.Name,
				"link_id":        step.LinkID,
				"distance":       step.Distance,
			})
		}
		
		c.JSON(200, gin.H{
			"start_node_id":  result.StartNodeID,
			"end_node_id":    result.EndNodeID,
			"total_distance": result.TotalDistance,
			"path":           enrichedPath,
			"path_length":    len(enrichedPath),
		})
	})
	
	// 観光地混雑度を考慮した最短経路検索
	r.GET("/api/smart-path/:start/:end", func(c *gin.Context) {
		startID, err1 := strconv.Atoi(c.Param("start"))
		endID, err2 := strconv.Atoi(c.Param("end"))
		
		if err1 != nil || err2 != nil {
			c.JSON(400, gin.H{"error": "無効なノードIDです"})
			return
		}
		
		// グラフを構築
		graph, err := BuildGraph(db)
		if err != nil {
			c.JSON(500, gin.H{"error": "グラフ構築エラー"})
			return
		}
		
		// 観光地混雑度を考慮したダイクストラ法実行
		result, err := DijkstraWithTouristWeight(graph, uint(startID), uint(endID), db)
		if err != nil {
			c.JSON(500, gin.H{"error": "経路計算エラー"})
			return
		}
		
		// 通常の最短経路も計算（比較用）
		normalResult, _ := Dijkstra(graph, uint(startID), uint(endID))
		
		// ノード名を付加した結果を作成
		var enrichedPath []gin.H
		for _, step := range result.Path {
			var fromNode, toNode Node
			db.First(&fromNode, step.FromNodeID)
			db.First(&toNode, step.ToNodeID)
			
			// 到達先ノードの観光地情報も取得
			var touristSpot *TouristSpot
			if toNode.TouristSpotID != nil {
				db.First(&touristSpot, *toNode.TouristSpotID)
			}
			
			stepInfo := gin.H{
				"from_node_id":   step.FromNodeID,
				"to_node_id":     step.ToNodeID,
				"from_node_name": fromNode.Name,
				"to_node_name":   toNode.Name,
				"link_id":        step.LinkID,
				"distance":       step.Distance,
			}
			
			if touristSpot != nil {
				stepInfo["tourist_spot"] = gin.H{
					"id":               touristSpot.ID,
					"name":             touristSpot.Name,
					"current_count":    touristSpot.CurrentCount,
					"max_capacity":     touristSpot.MaxCapacity,
					"congestion_ratio": float64(touristSpot.CurrentCount) / float64(touristSpot.MaxCapacity) * 100,
				}
			}
			
			enrichedPath = append(enrichedPath, stepInfo)
		}
		
		c.JSON(200, gin.H{
			"start_node_id":     result.StartNodeID,
			"end_node_id":       result.EndNodeID,
			"total_distance":    result.TotalDistance,
			"path":              enrichedPath,
			"path_length":       len(enrichedPath),
			"normal_distance":   normalResult.TotalDistance,
			"distance_difference": result.TotalDistance - normalResult.TotalDistance,
			"avoided_congestion": result.TotalDistance > normalResult.TotalDistance,
		})
	})
}
