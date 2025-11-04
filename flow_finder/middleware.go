package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// セッションIDを生成する関数
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