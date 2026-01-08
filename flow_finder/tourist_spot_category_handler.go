package main

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// 観光地カテゴリー関連のルートを登録
func RegisterTouristSpotCategoryRoutes(r *gin.Engine, db *gorm.DB) {
	categories := r.Group("/tourist-spot-categories")
	{
		// カテゴリ一覧取得
		categories.GET("", getTouristSpotCategoriesHandler(db))
		
		// 特定カテゴリ取得
		categories.GET("/:id", getTouristSpotCategoryHandler(db))
		
		// カテゴリ作成（管理者のみ）
		categories.POST("", touristSpotCategoryCreateHandler(db))
		
		// カテゴリ更新（管理者のみ）
		categories.PUT("/:id", touristSpotCategoryUpdateHandler(db))
		
		// カテゴリ削除（管理者のみ）
		categories.DELETE("/:id", touristSpotCategoryDeleteHandler(db))
	}
}

// カテゴリ一覧取得ハンドラ
func getTouristSpotCategoriesHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var categories []TouristSpotCategory
		
		// アクティブなカテゴリのみを表示順序でソート
		if err := db.Where("is_active = ?", true).
			Order("display_order ASC, created_at ASC").
			Find(&categories).Error; err != nil {
			c.JSON(500, gin.H{"error": "カテゴリの取得に失敗しました"})
			return
		}
		
		c.JSON(200, categories)
	}
}

// 特定カテゴリ取得ハンドラ
func getTouristSpotCategoryHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var category TouristSpotCategory
		
		if err := db.First(&category, id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(404, gin.H{"error": "カテゴリが見つかりません"})
			} else {
				c.JSON(500, gin.H{"error": "カテゴリの取得に失敗しました"})
			}
			return
		}
		
		c.JSON(200, category)
	}
}

// カテゴリ作成ハンドラ
func touristSpotCategoryCreateHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Name         string `json:"name" binding:"required"`
			Description  string `json:"description"`
			Icon         string `json:"icon"`
			Color        string `json:"color"`
			DisplayOrder int    `json:"display_order"`
			IsActive     *bool  `json:"is_active"`
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です", "details": err.Error()})
			return
		}
		
		category := TouristSpotCategory{
			Name:         req.Name,
			Description:  req.Description,
			Icon:         req.Icon,
			Color:        req.Color,
			DisplayOrder: req.DisplayOrder,
			IsActive:     true, // デフォルトはアクティブ
		}
		
		if req.IsActive != nil {
			category.IsActive = *req.IsActive
		}
		
		if err := db.Create(&category).Error; err != nil {
			c.JSON(500, gin.H{"error": "カテゴリの作成に失敗しました", "details": err.Error()})
			return
		}
		
		c.JSON(201, gin.H{"result": "ok", "category": category})
	}
}

// カテゴリ更新ハンドラ
func touristSpotCategoryUpdateHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var category TouristSpotCategory
		
		if err := db.First(&category, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "カテゴリが見つかりません"})
			return
		}
		
		var req struct {
			Name         *string `json:"name"`
			Description  *string `json:"description"`
			Icon         *string `json:"icon"`
			Color        *string `json:"color"`
			DisplayOrder *int    `json:"display_order"`
			IsActive     *bool   `json:"is_active"`
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です", "details": err.Error()})
			return
		}
		
		// 更新フィールド
		if req.Name != nil {
			category.Name = *req.Name
		}
		if req.Description != nil {
			category.Description = *req.Description
		}
		if req.Icon != nil {
			category.Icon = *req.Icon
		}
		if req.Color != nil {
			category.Color = *req.Color
		}
		if req.DisplayOrder != nil {
			category.DisplayOrder = *req.DisplayOrder
		}
		if req.IsActive != nil {
			category.IsActive = *req.IsActive
		}
		
		if err := db.Save(&category).Error; err != nil {
			c.JSON(500, gin.H{"error": "カテゴリの更新に失敗しました", "details": err.Error()})
			return
		}
		
		c.JSON(200, gin.H{"result": "ok", "category": category})
	}
}

// カテゴリ削除ハンドラ
func touristSpotCategoryDeleteHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		categoryID, err := strconv.ParseUint(id, 10, 32)
		if err != nil {
			c.JSON(400, gin.H{"error": "無効なIDです"})
			return
		}
		
		// そのカテゴリを使用している観光地があるかチェック
		var touristSpotCount int64
		db.Model(&TouristSpot{}).Where("category_id = ?", categoryID).Count(&touristSpotCount)
		
		if touristSpotCount > 0 {
			c.JSON(400, gin.H{
				"error": "このカテゴリを使用している観光地が存在するため削除できません",
				"count": touristSpotCount,
			})
			return
		}
		
		// カテゴリを削除
		if err := db.Delete(&TouristSpotCategory{}, categoryID).Error; err != nil {
			c.JSON(500, gin.H{"error": "カテゴリの削除に失敗しました", "details": err.Error()})
			return
		}
		
		c.JSON(200, gin.H{"result": "ok", "message": "カテゴリを削除しました"})
	}
}
