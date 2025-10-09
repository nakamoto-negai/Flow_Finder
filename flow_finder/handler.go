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
			Name       string  `json:"name"`
			Latitude   float64 `json:"latitude"`
			Longitude  float64 `json:"longitude"`
			Congestion int     `json:"congestion"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "invalid request"})
			return
		}
		node := Node{
			Name:       req.Name,
			Latitude:   req.Latitude,
			Longitude:  req.Longitude,
			Congestion: req.Congestion,
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

	// Node詳細取得
	r.GET("/nodes/:id", func(c *gin.Context) {
		id := c.Param("id")
		var node Node
		if err := db.First(&node, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "ノードが見つかりません"})
			return
		}
		c.JSON(200, node)
	})

	// Node更新
	r.PUT("/nodes/:id", func(c *gin.Context) {
		id := c.Param("id")
		var node Node
		if err := db.First(&node, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "ノードが見つかりません"})
			return
		}
		
		var req struct {
			Name       *string  `json:"name"`
			Latitude   *float64 `json:"latitude"`
			Longitude  *float64 `json:"longitude"`
			Congestion *int     `json:"congestion"`
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です", "details": err.Error()})
			return
		}
		
		// フィールドを更新（ポインタがnilでない場合のみ）
		if req.Name != nil {
			node.Name = *req.Name
		}
		if req.Latitude != nil {
			node.Latitude = *req.Latitude
		}
		if req.Longitude != nil {
			node.Longitude = *req.Longitude
		}
		if req.Congestion != nil {
			node.Congestion = *req.Congestion
		}
		
		if err := db.Save(&node).Error; err != nil {
			c.JSON(500, gin.H{"error": "ノード更新に失敗しました"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "update", "nodes", id, c)
		
		c.JSON(200, gin.H{"result": "ok", "node": node})
	})

	// Node削除
	r.DELETE("/nodes/:id", func(c *gin.Context) {
		id := c.Param("id")
		
		// 削除前に関連するリンクをチェック
		var linkCount int64
		if err := db.Model(&Link{}).Where("from_node_id = ? OR to_node_id = ?", id, id).Count(&linkCount).Error; err != nil {
			c.JSON(500, gin.H{"error": "リンクのチェックに失敗しました"})
			return
		}
		
		if linkCount > 0 {
			c.JSON(400, gin.H{
				"error": "このノードは他のノードとリンクされているため削除できません",
				"link_count": linkCount,
				"message": "先に関連するリンクを削除してください",
			})
			return
		}
		
		if err := db.Delete(&Node{}, id).Error; err != nil {
			c.JSON(500, gin.H{"error": "ノード削除に失敗しました"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "delete", "nodes", id, c)
		
		c.JSON(200, gin.H{"result": "ok", "message": "ノードが削除されました"})
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

	// Link詳細取得
	r.GET("/links/:id", func(c *gin.Context) {
		id := c.Param("id")
		var link Link
		if err := db.First(&link, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "リンクが見つかりません"})
			return
		}
		
		// ノード名も含めて返す
		var fromNode, toNode Node
		db.First(&fromNode, link.FromNodeID)
		db.First(&toNode, link.ToNodeID)
		
		c.JSON(200, gin.H{
			"id":             link.ID,
			"from_node_id":   link.FromNodeID,
			"to_node_id":     link.ToNodeID,
			"from_node_name": fromNode.Name,
			"to_node_name":   toNode.Name,
			"distance":       link.Distance,
		})
	})

	// Link更新
	r.PUT("/links/:id", func(c *gin.Context) {
		id := c.Param("id")
		var link Link
		if err := db.First(&link, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "リンクが見つかりません"})
			return
		}
		
		var req struct {
			FromNodeID *uint    `json:"from_node_id"`
			ToNodeID   *uint    `json:"to_node_id"`
			Distance   *float64 `json:"distance"`
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です", "details": err.Error()})
			return
		}
		
		// フィールドを更新（ポインタがnilでない場合のみ）
		if req.FromNodeID != nil {
			// ノードの存在確認
			var fromNode Node
			if err := db.First(&fromNode, *req.FromNodeID).Error; err != nil {
				c.JSON(400, gin.H{"error": "指定された出発ノードが存在しません"})
				return
			}
			link.FromNodeID = *req.FromNodeID
		}
		if req.ToNodeID != nil {
			// ノードの存在確認
			var toNode Node
			if err := db.First(&toNode, *req.ToNodeID).Error; err != nil {
				c.JSON(400, gin.H{"error": "指定された到着ノードが存在しません"})
				return
			}
			link.ToNodeID = *req.ToNodeID
		}
		if req.Distance != nil {
			if *req.Distance <= 0 {
				c.JSON(400, gin.H{"error": "距離は正の値である必要があります"})
				return
			}
			link.Distance = *req.Distance
		}
		
		if err := db.Save(&link).Error; err != nil {
			c.JSON(500, gin.H{"error": "リンク更新に失敗しました"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "update", "links", id, c)
		
		c.JSON(200, gin.H{"result": "ok", "link": link})
	})

	// Link削除
	r.DELETE("/links/:id", func(c *gin.Context) {
		id := c.Param("id")
		
		if err := db.Delete(&Link{}, id).Error; err != nil {
			c.JSON(500, gin.H{"error": "リンク削除に失敗しました"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "delete", "links", id, c)
		
		c.JSON(200, gin.H{"result": "ok", "message": "リンクが削除されました"})
	})

	// === 観光地関連API ===
	
	// 観光地一覧取得
	r.GET("/tourist-spots", func(c *gin.Context) {
		var spots []TouristSpot
		query := db.Model(&TouristSpot{})
		
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
		if err := db.First(&spot, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "観光地が見つかりません"})
			return
		}
		c.JSON(200, spot)
	})

	// 観光地作成
	r.POST("/tourist-spots", func(c *gin.Context) {
		var req struct {
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
		
		spot := TouristSpot{
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
	
	// 共通の最短経路検索関数（他のAPIからも呼び出し可能）
	findShortestPath := func(startID, endID uint) (gin.H, error) {
		// グラフを構築
		graph, err := BuildGraph(db)
		if err != nil {
			return nil, fmt.Errorf("グラフ構築エラー: %v", err)
		}
		
		// ダイクストラ法実行
		result, err := Dijkstra(graph, startID, endID, db)
		if err != nil {
			return nil, fmt.Errorf("経路計算エラー: %v", err)
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
		
		return gin.H{
			"start_node_id":  result.StartNodeID,
			"end_node_id":    result.EndNodeID,
			"total_distance": result.TotalDistance,
			"path":           enrichedPath,
			"path_length":    len(enrichedPath),
		}, nil
	}
	
	// 最短経路検索（距離ベース）
	r.GET("/api/shortest-path/:start/:end", func(c *gin.Context) {
		startID, err1 := strconv.Atoi(c.Param("start"))
		endID, err2 := strconv.Atoi(c.Param("end"))
		
		if err1 != nil || err2 != nil {
			c.JSON(400, gin.H{"error": "無効なノードIDです"})
			return
		}
		
		result, err := findShortestPath(uint(startID), uint(endID))
		if err != nil {
			c.JSON(404, gin.H{"error": err.Error()})
			return
		}
		
		c.JSON(200, result)
	})
	
	// 観光地を考慮した最短経路検索API（観光地IDから関連ノードまたは最寄りノードを検索）
	r.GET("/api/shortest-path-to-spot/:start/:spot_id", func(c *gin.Context) {
		startID, err1 := strconv.Atoi(c.Param("start"))
		spotID, err2 := strconv.Atoi(c.Param("spot_id"))
		
		if err1 != nil || err2 != nil {
			c.JSON(400, gin.H{"error": "無効なIDです"})
			return
		}
		
		// 観光地情報を取得（ノード情報も含む）
		var spot TouristSpot
		if err := db.Preload("Node").First(&spot, spotID).Error; err != nil {
			c.JSON(404, gin.H{"error": "観光地が見つかりません"})
			return
		}
		
		var endNodeID uint
		
		// 外部キーで関連ノードが設定されている場合
		if spot.NodeID != nil {
			endNodeID = *spot.NodeID
		} else {
			// 外部キーがない場合は座標ベースで最寄りノードを検索
			nearestNodeID, err := spot.FindNearestNode(db)
			if err != nil {
				c.JSON(500, gin.H{"error": "最寄りノードの検索に失敗しました: " + err.Error()})
				return
			}
			endNodeID = nearestNodeID
		}
		
		result, err := findShortestPath(uint(startID), endNodeID)
		if err != nil {
			c.JSON(404, gin.H{"error": err.Error()})
			return
		}
		
		// 観光地情報を追加
		result["destination_spot"] = gin.H{
			"id":          spot.ID,
			"name":        spot.Name,
			"category":    spot.Category,
			"node_id":     endNodeID,
			"has_direct_node": spot.NodeID != nil,
		}
		
		c.JSON(200, result)
	})
	
	// デバッグ用: グラフ構造を確認するエンドポイント
	r.GET("/api/debug/graph", func(c *gin.Context) {
		graph, err := BuildGraph(db)
		if err != nil {
			c.JSON(500, gin.H{"error": "グラフ構築エラー"})
			return
		}
		
		c.JSON(200, gin.H{
			"graph": graph,
			"node_count": len(graph),
		})
	})
}
