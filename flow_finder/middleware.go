package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log"
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
		// リクエストの詳細ログ
		sessionID := generateHandlerSessionID()
		log.Printf("[%s] === AuthMiddleware 開始 ===", sessionID)
		log.Printf("[%s] Path: %s %s", sessionID, c.Request.Method, c.Request.URL.Path)
		
		// 全ヘッダーをログ出力
		log.Printf("[%s] 受信したヘッダー:", sessionID)
		for key, values := range c.Request.Header {
			log.Printf("[%s]   %s: %v", sessionID, key, values)
		}
		
		userID := c.GetHeader("X-User-Id")
		token := c.GetHeader("Authorization")
		log.Printf("[%s] 認証ヘッダー - X-User-Id: '%s'", sessionID, userID)
		log.Printf("[%s] 認証ヘッダー - Authorization: '%s'", sessionID, token)
		
		if userID == "" || token == "" {
			log.Printf("[%s] 認証ヘッダーが見つかりません", sessionID)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "認証ヘッダーが見つかりません"})
			return
		}
		// トークンベースでRedisキーを生成（実際の保存形式と一致）
		key := "auth_token:" + token
		val, err := redisClient.Get(context.Background(), key).Result()
		if err == redis.Nil || val != userID {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		} else if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "redis error"})
			return
		}
		// ユーザーIDをコンテキストに設定
		c.Set("userID", userID)
		c.Next()
	}
}
