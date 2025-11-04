package main

import (
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// メインのルートハンドラ登録関数
func SetupRoutes(r *gin.Engine, db *gorm.DB, redisClient *redis.Client) {
	// CORSミドルウェア
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-User-Id,X-Session-Id")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// ヘルスチェック
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "message": "Flow Finder API is running"})
	})

	// 各機能別ハンドラを登録
	RegisterAuthRoutes(r, db, redisClient)
	RegisterUserRoutes(r, db)
	RegisterNodeRoutes(r, db)
	RegisterLinkRoutes(r, db)
	RegisterTouristSpotRoutes(r, db)
	RegisterImageRoutes(r, db)
	RegisterDijkstraRoutes(r, db)
	RegisterFieldRoutes(r, db)
}
