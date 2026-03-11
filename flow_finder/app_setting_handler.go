package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func RegisterAppSettingRoutes(r *gin.Engine, db *gorm.DB, redisClient *redis.Client) {
	// 公開: 設定値を取得
	r.GET("/api/settings/:key", func(c *gin.Context) {
		key := c.Param("key")
		var setting AppSetting
		if err := db.Where("key = ?", key).First(&setting).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "設定が見つかりません"})
			return
		}
		c.JSON(http.StatusOK, setting)
	})

	// 管理者: 設定値を登録・更新（upsert）
	r.PUT("/api/settings/:key", AdminRequired(db, redisClient), func(c *gin.Context) {
		key := c.Param("key")
		var body struct {
			Value string `json:"value" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "valueは必須です"})
			return
		}

		var setting AppSetting
		result := db.Where("key = ?", key).First(&setting)
		if result.Error != nil {
			// 新規作成
			setting = AppSetting{Key: key, Value: body.Value}
			if err := db.Create(&setting).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "設定の作成に失敗しました"})
				return
			}
		} else {
			// 更新
			if err := db.Model(&setting).Update("value", body.Value).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "設定の更新に失敗しました"})
				return
			}
		}
		c.JSON(http.StatusOK, setting)
	})
}
