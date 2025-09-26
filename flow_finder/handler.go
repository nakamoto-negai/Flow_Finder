package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
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
}
