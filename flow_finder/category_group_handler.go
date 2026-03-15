package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func RegisterCategoryGroupRoutes(r *gin.Engine, db *gorm.DB, redisClient *redis.Client) {
	// 公開: グループ一覧取得
	r.GET("/api/category-groups", func(c *gin.Context) {
		var groups []CategoryGroup
		if err := db.Where("is_active = ?", true).Order("display_order ASC, id ASC").Find(&groups).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "取得に失敗しました"})
			return
		}
		c.JSON(http.StatusOK, groups)
	})

	// 管理者: グループ作成
	r.POST("/api/category-groups", AdminRequired(db, redisClient), func(c *gin.Context) {
		var body struct {
			Name         string `json:"name" binding:"required"`
			DisplayOrder int    `json:"display_order"`
			IsActive     *bool  `json:"is_active"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nameは必須です"})
			return
		}
		isActive := true
		if body.IsActive != nil {
			isActive = *body.IsActive
		}
		group := CategoryGroup{Name: body.Name, DisplayOrder: body.DisplayOrder, IsActive: isActive}
		if err := db.Create(&group).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "作成に失敗しました"})
			return
		}
		c.JSON(http.StatusCreated, group)
	})

	// 管理者: グループ更新
	r.PUT("/api/category-groups/:id", AdminRequired(db, redisClient), func(c *gin.Context) {
		var group CategoryGroup
		if err := db.First(&group, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "グループが見つかりません"})
			return
		}
		var body struct {
			Name         *string `json:"name"`
			DisplayOrder *int    `json:"display_order"`
			IsActive     *bool   `json:"is_active"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "リクエストが無効です"})
			return
		}
		if body.Name != nil {
			group.Name = *body.Name
		}
		if body.DisplayOrder != nil {
			group.DisplayOrder = *body.DisplayOrder
		}
		if body.IsActive != nil {
			group.IsActive = *body.IsActive
		}
		db.Save(&group)
		c.JSON(http.StatusOK, group)
	})

	// 管理者: グループ削除
	r.DELETE("/api/category-groups/:id", AdminRequired(db, redisClient), func(c *gin.Context) {
		// グループを使用しているカテゴリのgroup_idをNULLに
		db.Model(&TouristSpotCategory{}).Where("group_id = ?", c.Param("id")).Update("group_id", nil)
		db.Delete(&CategoryGroup{}, c.Param("id"))
		c.Status(http.StatusNoContent)
	})
}
