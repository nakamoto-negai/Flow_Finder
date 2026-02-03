package main

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// 観光地関連のルートを登録
func RegisterTouristSpotRoutes(r *gin.Engine, db *gorm.DB, redisClient *redis.Client) {
	// 観光地一覧取得
	r.GET("/tourist-spots", func(c *gin.Context) {
		var spots []TouristSpot
		query := db.Model(&TouristSpot{}).Preload("TouristCategory") // カテゴリ情報をプリロード

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

		// 最寄りノードが設定されていない観光地を自動設定
		for i := range spots {
			if spots[i].NodeID == nil {
				nearestNodeID, err := spots[i].FindNearestNode(db)
				if err == nil && nearestNodeID > 0 {
					spots[i].NodeID = &nearestNodeID
					// データベースを更新
					db.Model(&spots[i]).Update("node_id", nearestNodeID)
				}
			}
		}

		c.JSON(200, spots)
	})

	// 観光地詳細取得
	r.GET("/tourist-spots/:id", func(c *gin.Context) {
		id := c.Param("id")
		var spot TouristSpot
		if err := db.Preload("Node").Preload("TouristCategory").First(&spot, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "観光地が見つかりません"})
			return
		}
		c.JSON(200, spot)
	})

	// 観光地作成（管理者専用）
	r.POST("/tourist-spots", AdminRequired(db, redisClient), touristSpotCreateHandler(db))

	// 観光地更新（管理者専用）
	r.PUT("/tourist-spots/:id", AdminRequired(db, redisClient), touristSpotUpdateHandler(db))

	// 観光地削除（管理者専用）
	r.DELETE("/tourist-spots/:id", AdminRequired(db, redisClient), touristSpotDeleteHandler(db))

	// 観光地の来場者数管理
	r.POST("/tourist-spots/:id/visitors", touristSpotVisitorHandler(db))

	// 観光地の混雑状況取得
	r.GET("/tourist-spots/:id/congestion", touristSpotCongestionHandler(db))
	// 管理者が混雑レベルを記録する（時刻付き保存）
	r.POST("/tourist-spots/:id/congestion", AdminRequired(db, redisClient), touristSpotSetCongestionHandler(db))
}

// 観光地作成ハンドラ
func touristSpotCreateHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Name         string  `json:"name" binding:"required"`
			Description  string  `json:"description"`
			Category     string  `json:"category"`
			CategoryID   *uint   `json:"category_id"`
			NodeID       *uint   `json:"nearest_node_id"`
			X            float64 `json:"x"`
			Y            float64 `json:"y"`
			MaxCapacity  int     `json:"max_capacity" binding:"required,min=1"`
			CurrentCount int     `json:"current_count"`
			IsOpen       bool    `json:"is_open"`
			OpeningTime  string  `json:"opening_time"`
			ClosingTime  string  `json:"closing_time"`
			EntryFee     int     `json:"entry_fee"`
			Website      string  `json:"website"`
			PhoneNumber  string  `json:"phone_number"`
			ImageURL     string  `json:"image_url"`
			RewardURL    string  `json:"reward_url"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です", "details": err.Error()})
			return
		}

		spot := TouristSpot{
			Name:         req.Name,
			Description:  req.Description,
			Category:     req.Category,
			CategoryID:   req.CategoryID,
			X:            req.X,
			Y:            req.Y,
			MaxCapacity:  req.MaxCapacity,
			CurrentCount: req.CurrentCount,
			IsOpen:       req.IsOpen,
			OpeningTime:  req.OpeningTime,
			ClosingTime:  req.ClosingTime,
			EntryFee:     req.EntryFee,
			Website:      req.Website,
			PhoneNumber:  req.PhoneNumber,
			ImageURL:     req.ImageURL,
			RewardURL:    req.RewardURL,
		}

		// 最寄りノードが指定されている場合
		if req.NodeID != nil {
			spot.NodeID = req.NodeID
		} else if req.X != 0 && req.Y != 0 {
			// 座標が指定されている場合、最寄りのノードを見つけて関連付ける
			nearestNodeID, err := spot.FindNearestNode(db)
			if err == nil && nearestNodeID != 0 {
				spot.NodeID = &nearestNodeID

				// 距離も計算して保存
				var nearestNode Node
				if err := db.First(&nearestNode, nearestNodeID).Error; err == nil {
					spot.DistanceToNode = calculateDistance(spot.X, spot.Y, nearestNode.X, nearestNode.Y)
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

		// 変更履歴を記録
		RecordChangeHistory(db, "tourist_spots", strconv.Itoa(int(spot.ID)), userID, "create", nil, spot)

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

		// 変更前のデータを保存
		beforeSpot := spot

		var req struct {
			Name         *string  `json:"name"`
			Description  *string  `json:"description"`
			Category     *string  `json:"category"`
			CategoryID   **uint   `json:"category_id"`
			NodeID       **uint   `json:"nearest_node_id"`
			X            *float64 `json:"x"`
			Y            *float64 `json:"y"`
			MaxCapacity  *int     `json:"max_capacity"`
			CurrentCount *int     `json:"current_count"`
			IsOpen       *bool    `json:"is_open"`
			OpeningTime  *string  `json:"opening_time"`
			ClosingTime  *string  `json:"closing_time"`
			EntryFee     *int     `json:"entry_fee"`
			Website      *string  `json:"website"`
			PhoneNumber  *string  `json:"phone_number"`
			ImageURL     *string  `json:"image_url"`
			RewardURL    *string  `json:"reward_url"`
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
		if req.CategoryID != nil {
			spot.CategoryID = *req.CategoryID
		}
		if req.NodeID != nil {
			spot.NodeID = *req.NodeID
		}
		if req.X != nil {
			spot.X = *req.X
		}
		if req.Y != nil {
			spot.Y = *req.Y
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
		if req.RewardURL != nil {
			spot.RewardURL = *req.RewardURL
		}

		// 座標が更新された場合、最寄りのノードを再検索
		if (req.X != nil || req.Y != nil) && spot.X != 0 && spot.Y != 0 {
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

		// 変更履歴を記録
		RecordChangeHistory(db, "tourist_spots", id, userID, "update", beforeSpot, spot)

		c.JSON(200, gin.H{"result": "ok", "spot": spot})
	}
}

// 観光地削除ハンドラ
func touristSpotDeleteHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// 削除前のデータを取得
		var spot TouristSpot
		db.First(&spot, id)

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

		// 変更履歴を記録
		RecordChangeHistory(db, "tourist_spots", id, userID, "delete", spot, nil)

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

		// 変更前の状態を保存
		beforeSpot := spot

		var req struct {
			Action       string `json:"action"`        // "increment" or "decrement" (optional)
			Count        int    `json:"count"`         // for increment/decrement
			CurrentCount *int   `json:"current_count"` // for direct set
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です"})
			return
		}

		// 直接来場者数を設定する場合
		if req.CurrentCount != nil {
			if *req.CurrentCount < 0 {
				c.JSON(400, gin.H{"error": "来場者数は0以上である必要があります"})
				return
			}
			spot.CurrentCount = *req.CurrentCount
		} else {
			// incrementまたはdecrementの場合
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
				c.JSON(400, gin.H{"error": "無効なアクションです。'increment' または 'decrement' を指定するか、'current_count' を指定してください"})
				return
			}
		}

		if err := db.Save(&spot).Error; err != nil {
			c.JSON(500, gin.H{"error": "来場者数の更新に失敗しました"})
			return
		}

		// 変更履歴を記録
		var userID *uint = nil
		if uid, exists := GetUserIDFromContext(c); exists {
			userID = &uid
		}
		RecordChangeHistory(db, "tourist_spots", strconv.Itoa(int(spot.ID)), userID, "update", beforeSpot, spot)

		c.JSON(200, gin.H{
			"result":        "ok",
			"current_count": spot.CurrentCount,
			"max_capacity":  spot.MaxCapacity,
			"congestion":    spot.GetCongestionLevel(),
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

		// 最新の混雑記録（直近10件）を取得
		var records []CongestionRecord
		if recs, err := GetCongestionRecords(db, spot.ID, 10); err == nil {
			records = recs
		}

		c.JSON(200, gin.H{
			"id":               spot.ID,
			"name":             spot.Name,
			"current_count":    spot.CurrentCount,
			"max_capacity":     spot.MaxCapacity,
			"congestion_level": spot.GetCongestionLevel(),
			"congestion_ratio": spot.GetCongestionRatio(),
			"is_open":          spot.IsOpen,
			"records":          records,
		})
	}
}

// 管理者が混雑レベルを記録するハンドラ
func touristSpotSetCongestionHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		// 観光地が存在するかチェック
		var spot TouristSpot
		if err := db.First(&spot, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "観光地が見つかりません"})
			return
		}

		var req struct {
			Level      *int   `json:"level" binding:"required"`
			RecordedAt string `json:"recorded_at"` // RFC3339 optional
			Note       string `json:"note"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "無効なリクエストです", "details": err.Error()})
			return
		}

		if req.Level == nil || *req.Level < 0 || *req.Level > 3 {
			c.JSON(400, gin.H{"error": "level は0から3の範囲で指定してください"})
			return
		}

		recordedAt := time.Now()
		if req.RecordedAt != "" {
			if t, err := time.Parse(time.RFC3339, req.RecordedAt); err == nil {
				recordedAt = t
			}
		}

		// DBに記録
		rec, err := AddCongestionRecord(db, spot.ID, *req.Level, recordedAt, req.Note)
		if err != nil {
			c.JSON(500, gin.H{"error": "混雑記録の保存に失敗しました"})
			return
		}

		c.JSON(201, gin.H{"result": "ok", "record": rec})
	}
}
