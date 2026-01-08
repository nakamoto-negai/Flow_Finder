package main

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// お気に入りに追加するリクエスト構造体
type AddFavoriteRequest struct {
	TouristSpotID uint   `json:"tourist_spot_id"`
	Notes         string `json:"notes"`
	Priority      int    `json:"priority"`
}

// お気に入り詳細を更新するリクエスト構造体
type UpdateFavoriteRequest struct {
	Notes       *string    `json:"notes"`
	Priority    *int       `json:"priority"`
	VisitStatus *string    `json:"visit_status"`
	VisitDate   *time.Time `json:"visit_date"`
}

// お気に入り観光地一覧を取得
func getUserFavoriteTouristSpotsHandler(c *gin.Context, db *gorm.DB) {
	// 認証されたユーザーIDを取得
	userID, exists := GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "認証が必要です"})
		return
	}

	// クエリパラメータでフィルタリング
	priority := c.Query("priority")
	visitStatus := c.Query("visit_status")

	var favorites []FavoriteTouristSpotResponse
	var err error

	if priority != "" {
		priorityInt, parseErr := strconv.Atoi(priority)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "無効な優先度です"})
			return
		}
		favorites, err = GetFavoritesByPriority(db, userID, priorityInt)
	} else if visitStatus != "" {
		favorites, err = GetFavoritesByVisitStatus(db, userID, visitStatus)
	} else {
		favorites, err = GetUserFavoriteTouristSpots(db, userID)
	}

	if err != nil {
		// ログ記録
		log := UserLog{
			UserID:    &userID,
			SessionID: "system",
			LogType:   LogTypeError,
			Category:  CategoryData,
			Action:    "get_favorites",
			Path:      c.Request.URL.Path,
			Method:    c.Request.Method,
			Error:     err.Error(),
		}
		LogUserActivity(db, log)

		c.JSON(http.StatusInternalServerError, gin.H{"error": "お気に入り観光地の取得に失敗しました"})
		return
	}

	c.JSON(http.StatusOK, favorites)

	// 成功ログ記録
	log := UserLog{
		UserID:    &userID,
		SessionID: "system",
		LogType:   LogTypeAction,
		Category:  CategoryData,
		Action:    "get_favorites",
		Path:      c.Request.URL.Path,
		Method:    c.Request.Method,
	}
	LogUserActivity(db, log)
}

// お気に入りに追加
func addFavoriteTouristSpotHandler(c *gin.Context, db *gorm.DB) {
	// 認証されたユーザーIDを取得
	userID, exists := GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "認証が必要です"})
		return
	}

	var req AddFavoriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエストデータです"})
		return
	}

	// 観光地が存在するかチェック
	var touristSpot TouristSpot
	if err := db.First(&touristSpot, req.TouristSpotID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "指定された観光地が見つかりません"})
		return
	}

	// お気に入りに追加
	favorite, err := AddToFavorites(db, userID, req.TouristSpotID)
	if err != nil {
		if err.Error() == "UNIQUE constraint failed: user_favorite_tourist_spots.user_id, user_favorite_tourist_spots.tourist_spot_id" ||
			err.Error() == "duplicated key not allowed" {
			c.JSON(http.StatusConflict, gin.H{"error": "この観光地は既にお気に入りに追加されています"})
			return
		}
		// エラーログ記録
		log := UserLog{
			UserID:    &userID,
			SessionID: "system",
			LogType:   LogTypeError,
			Category:  CategoryData,
			Action:    "add_favorite",
			Path:      c.Request.URL.Path,
			Method:    c.Request.Method,
			Error:     err.Error(),
		}
		LogUserActivity(db, log)

		c.JSON(http.StatusInternalServerError, gin.H{"error": "お気に入りの追加に失敗しました"})
		return
	}

	// メモや優先度を更新
	if req.Notes != "" || req.Priority > 0 {
		updates := make(map[string]interface{})
		if req.Notes != "" {
			updates["notes"] = req.Notes
		}
		if req.Priority > 0 {
			updates["priority"] = req.Priority
		}

		if err := UpdateFavoriteDetails(db, userID, req.TouristSpotID, updates); err != nil {
			// 警告ログは記録しない（必要に応じて追加可能）
		}
	}

	c.JSON(http.StatusOK, favorite)
}

// お気に入りから削除
func removeFavoriteTouristSpotHandler(c *gin.Context, db *gorm.DB) {
	// 認証されたユーザーIDを取得
	userID, exists := GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "認証が必要です"})
		return
	}

	touristSpotID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効な観光地IDです"})
		return
	}

	// お気に入りから削除
	if err := RemoveFromFavorites(db, userID, uint(touristSpotID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "お気に入りの削除に失敗しました"})
		return
	}

	c.Status(http.StatusNoContent)
}

// お気に入りの詳細を更新
func updateFavoriteTouristSpotHandler(c *gin.Context, db *gorm.DB) {
	// 認証されたユーザーIDを取得
	userID, exists := GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "認証が必要です"})
		return
	}

	touristSpotID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効な観光地IDです"})
		return
	}

	var req UpdateFavoriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエストデータです"})
		return
	}

	// 更新データを作成
	updates := make(map[string]interface{})
	if req.Notes != nil {
		updates["notes"] = *req.Notes
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.VisitStatus != nil {
		updates["visit_status"] = *req.VisitStatus
	}
	if req.VisitDate != nil {
		updates["visit_date"] = *req.VisitDate
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "更新するデータがありません"})
		return
	}

	// お気に入りの詳細を更新
	if err := UpdateFavoriteDetails(db, userID, uint(touristSpotID), updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "お気に入りの更新に失敗しました"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "更新が完了しました"})
}

// お気に入り状態をチェック
func checkFavoriteTouristSpotHandler(c *gin.Context, db *gorm.DB) {
	// 認証されたユーザーIDを取得
	userID, exists := GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "認証が必要です"})
		return
	}

	touristSpotID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効な観光地IDです"})
		return
	}

	// お気に入り状態をチェック
	isFavorite, err := IsFavorite(db, userID, uint(touristSpotID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "お気に入り状態の確認に失敗しました"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"is_favorite": isFavorite})
}

// お気に入り観光地の統計情報を取得
func getFavoriteStatsHandler(c *gin.Context, db *gorm.DB) {
	// 認証されたユーザーIDを取得
	userID, exists := GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "認証が必要です"})
		return
	}

	// 各統計を取得
	var totalCount int64
	var visitedCount int64
	var plannedCount int64
	var notVisitedCount int64

	// 総数
	db.Model(&UserFavoriteTouristSpot{}).Where("user_id = ?", userID).Count(&totalCount)

	// 訪問済み数
	db.Model(&UserFavoriteTouristSpot{}).Where("user_id = ? AND visit_status = ?", userID, "訪問済み").Count(&visitedCount)

	// 訪問予定数
	db.Model(&UserFavoriteTouristSpot{}).Where("user_id = ? AND visit_status = ?", userID, "訪問予定").Count(&plannedCount)

	// 未訪問数
	db.Model(&UserFavoriteTouristSpot{}).Where("user_id = ? AND visit_status = ?", userID, "未訪問").Count(&notVisitedCount)

	visitedRate := float64(0)
	if totalCount > 0 {
		visitedRate = float64(visitedCount) / float64(totalCount) * 100
	}

	stats := map[string]interface{}{
		"total_count":       totalCount,
		"visited_count":     visitedCount,
		"planned_count":     plannedCount,
		"not_visited_count": notVisitedCount,
		"visited_rate":      visitedRate,
	}

	c.JSON(http.StatusOK, stats)
}

// お気に入り観光地関連のルートを登録
func RegisterFavoriteRoutes(r *gin.Engine, db *gorm.DB, redisClient *redis.Client) {
	favorites := r.Group("/favorites")
	favorites.Use(AuthRequired(redisClient)) // 認証必須
	{
		// お気に入り一覧取得
		favorites.GET("/tourist-spots", func(c *gin.Context) {
			getUserFavoriteTouristSpotsHandler(c, db)
		})

		// お気に入りに追加
		favorites.POST("/tourist-spots", func(c *gin.Context) {
			addFavoriteTouristSpotHandler(c, db)
		})

		// お気に入りから削除
		favorites.DELETE("/tourist-spots/:id", func(c *gin.Context) {
			removeFavoriteTouristSpotHandler(c, db)
		})

		// お気に入り詳細更新
		favorites.PUT("/tourist-spots/:id", func(c *gin.Context) {
			updateFavoriteTouristSpotHandler(c, db)
		})

		// お気に入り状態チェック
		favorites.GET("/tourist-spots/:id/check", func(c *gin.Context) {
			checkFavoriteTouristSpotHandler(c, db)
		})

		// お気に入り統計
		favorites.GET("/stats", func(c *gin.Context) {
			getFavoriteStatsHandler(c, db)
		})

		// カテゴリーの観光地を一括お気に入り追加
		favorites.POST("/categories/:categoryId/add-all", func(c *gin.Context) {
			addCategoryFavoritesHandler(c, db)
		})
	}
}

// カテゴリーの観光地を一括でお気に入りに追加
func addCategoryFavoritesHandler(c *gin.Context, db *gorm.DB) {
	// 認証されたユーザーIDを取得
	userID, exists := GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "認証が必要です"})
		return
	}

	// カテゴリーIDを取得
	categoryIDStr := c.Param("categoryId")
	categoryID, err := strconv.ParseUint(categoryIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効なカテゴリーIDです"})
		return
	}

	// カテゴリーが存在するかチェック
	var category TouristSpotCategory
	if err := db.First(&category, categoryID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "カテゴリーが見つかりません"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "カテゴリーの確認に失敗しました"})
		}
		return
	}

	// そのカテゴリーの観光地を取得
	var touristSpots []TouristSpot
	if err := db.Where("category_id = ?", categoryID).Find(&touristSpots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "観光地の取得に失敗しました"})
		return
	}

	if len(touristSpots) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message": "このカテゴリーには観光地がありません",
			"category": category.Name,
			"added_count": 0,
		})
		return
	}

	// 既にお気に入りに追加済みの観光地を確認
	var existingFavorites []UserFavoriteTouristSpot
	spotIDs := make([]uint, len(touristSpots))
	for i, spot := range touristSpots {
		spotIDs[i] = spot.ID
	}
	
	db.Where("user_id = ? AND tourist_spot_id IN ?", userID, spotIDs).Find(&existingFavorites)
	
	// 既に追加済みのIDのマップを作成
	existingMap := make(map[uint]bool)
	for _, existing := range existingFavorites {
		existingMap[existing.TouristSpotID] = true
	}

	// 新しくお気に入りに追加する観光地のみを処理
	var newFavorites []UserFavoriteTouristSpot
	addedCount := 0
	
	for _, spot := range touristSpots {
		if !existingMap[spot.ID] {
			newFavorites = append(newFavorites, UserFavoriteTouristSpot{
				UserID:        userID,
				TouristSpotID: spot.ID,
				Priority:      1, // デフォルト優先度
				Notes:         "",
				VisitStatus:   "未訪問",
			})
			addedCount++
		}
	}

	// バッチでお気に入りに追加
	if len(newFavorites) > 0 {
		if err := db.Create(&newFavorites).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "お気に入りの追加に失敗しました"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "お気に入りに追加しました",
		"category": category.Name,
		"total_spots": len(touristSpots),
		"added_count": addedCount,
		"already_existing": len(touristSpots) - addedCount,
	})
}
