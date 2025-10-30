package main

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// 認証関連のルートを登録
func RegisterAuthRoutes(r *gin.Engine, db *gorm.DB, redisClient *redis.Client) {
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
				sessionID = generateHandlerSessionID()
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
			sessionID = generateHandlerSessionID()
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
}