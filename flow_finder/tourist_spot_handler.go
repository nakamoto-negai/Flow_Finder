package main

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// 観光地関連のルートを登録
func RegisterTouristSpotRoutes(r *gin.Engine, db *gorm.DB) {
	// 観光地一覧取得
	r.GET("/tourist-spots", func(c *gin.Context) {
		var spots []TouristSpot
		query := db.Model(&TouristSpot{}) // NodeをPreloadしない（循環参照回避）
		
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
	r.POST("/tourist-spots", touristSpotCreateHandler(db))

	// 観光地更新
	r.PUT("/tourist-spots/:id", touristSpotUpdateHandler(db))

	// 観光地削除
	r.DELETE("/tourist-spots/:id", touristSpotDeleteHandler(db))

	// 観光地の来場者数管理
	r.POST("/tourist-spots/:id/visitors", touristSpotVisitorHandler(db))

	// 観光地の混雑状況取得
	r.GET("/tourist-spots/:id/congestion", touristSpotCongestionHandler(db))
}

// 観光地作成ハンドラ
func touristSpotCreateHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Name         string  `json:"name" binding:"required"`
			Description  string  `json:"description"`
			Category     string  `json:"category"`
			Latitude     float64 `json:"latitude"`
			Longitude    float64 `json:"longitude"`
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
			Latitude:     req.Latitude,
			Longitude:    req.Longitude,
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

		// 座標が指定されている場合、最寄りのノードを見つけて関連付ける
		if req.Latitude != 0 && req.Longitude != 0 {
			nearestNodeID, err := spot.FindNearestNode(db)
			if err == nil && nearestNodeID != 0 {
				spot.NodeID = &nearestNodeID
				
				// 距離も計算して保存
				var nearestNode Node
				if err := db.First(&nearestNode, nearestNodeID).Error; err == nil {
					spot.DistanceToNode = calculateDistance(spot.Latitude, spot.Longitude, nearestNode.Latitude, nearestNode.Longitude)
				}
			}
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
	}
}

// 観光地更新ハンドラ
func touristSpotUpdateHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var spot TouristSpot
		if err := db.First(&spot, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "観光地が見つかりません"})
			return
		}
		
		var req struct {
			Name         *string  `json:"name"`
			Description  *string  `json:"description"`
			Category     *string  `json:"category"`
			Latitude     *float64 `json:"latitude"`
			Longitude    *float64 `json:"longitude"`
			MaxCapacity  *int     `json:"max_capacity"`
			CurrentCount *int     `json:"current_count"`
			IsOpen       *bool    `json:"is_open"`
			OpeningTime  *string  `json:"opening_time"`
			ClosingTime  *string  `json:"closing_time"`
			EntryFee     *int     `json:"entry_fee"`
			Website      *string  `json:"website"`
			PhoneNumber  *string  `json:"phone_number"`
			ImageURL     *string  `json:"image_url"`
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
		if req.Latitude != nil {
			spot.Latitude = *req.Latitude
		}
		if req.Longitude != nil {
			spot.Longitude = *req.Longitude
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
		
		// 座標が更新された場合、最寄りのノードを再検索
		if (req.Latitude != nil || req.Longitude != nil) && spot.Latitude != 0 && spot.Longitude != 0 {
			nearestNodeID, err := spot.FindNearestNode(db)
			if err == nil && nearestNodeID != 0 {
				spot.NodeID = &nearestNodeID
			}
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
	}
}

// 観光地削除ハンドラ
func touristSpotDeleteHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		
		if err := db.Delete(&TouristSpot{}, id).Error; err != nil {
			c.JSON(500, gin.H{"error": "観光地削除に失敗しました"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "delete", "tourist_spots", id, c)
		
		c.JSON(200, gin.H{"result": "ok", "message": "観光地が削除されました"})
	}
}

// 観光地の来場者数管理ハンドラ
func touristSpotVisitorHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var spot TouristSpot
		if err := db.First(&spot, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "観光地が見つかりません"})
			return
		}
		
		var req struct {
			Action string `json:"action" binding:"required"` // "increment" or "decrement"
			Count  int    `json:"count"`                      // デフォルト1
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です"})
			return
		}
		
		if req.Count == 0 {
			req.Count = 1
		}
		
		switch req.Action {
		case "increment":
			if err := spot.IncrementVisitors(req.Count); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
		case "decrement":
			if err := spot.DecrementVisitors(req.Count); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
		default:
			c.JSON(400, gin.H{"error": "無効なアクションです。'increment' または 'decrement' を指定してください"})
			return
		}
		
		if err := db.Save(&spot).Error; err != nil {
			c.JSON(500, gin.H{"error": "来場者数の更新に失敗しました"})
			return
		}
		
		c.JSON(200, gin.H{
			"result":         "ok",
			"current_count":  spot.CurrentCount,
			"max_capacity":   spot.MaxCapacity,
			"congestion":     spot.GetCongestionLevel(),
		})
	}
}

// 観光地の混雑状況取得ハンドラ
func touristSpotCongestionHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var spot TouristSpot
		if err := db.First(&spot, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "観光地が見つかりません"})
			return
		}
		
		c.JSON(200, gin.H{
			"id":               spot.ID,
			"name":             spot.Name,
			"current_count":    spot.CurrentCount,
			"max_capacity":     spot.MaxCapacity,
			"congestion_level": spot.GetCongestionLevel(),
			"congestion_ratio": spot.GetCongestionRatio(),
			"is_open":          spot.IsOpen,
		})
	}
}