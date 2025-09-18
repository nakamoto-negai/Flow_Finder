package main

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

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
	// Node追加
	r.POST("/nodes", func(c *gin.Context) {
		var req struct {
			Name       string  `json:"name"`
			Latitude   float64 `json:"latitude"`
			Longitude  float64 `json:"longitude"`
			Congestion int     `json:"congestion"`
			Tourist    bool    `json:"tourist"`
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
			Tourist:    req.Tourist,
		}
		if err := db.Create(&node).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB insert error"})
			return
		}
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
		c.JSON(http.StatusOK, gin.H{"token": token, "user_id": user.ID})
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
}
