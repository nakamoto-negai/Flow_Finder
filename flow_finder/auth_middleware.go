package main

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// 認証が必要なミドルウェア
func AuthRequired(redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Authorization ヘッダーからトークンを取得
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "認証が必要です",
				"message": "Authorization ヘッダーが見つかりません",
			})
			c.Abort()
			return
		}

		// Bearer トークンの形式をチェック
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "無効なトークン形式です",
				"message": "Bearer トークン形式を使用してください",
			})
			c.Abort()
			return
		}

		token := tokenParts[1]

		// Redisからトークンに対応するユーザーIDを取得
		userIDStr, err := redisClient.Get(context.Background(), "auth_token:"+token).Result()
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "無効または期限切れのトークンです",
				"message": "再度ログインしてください",
			})
			c.Abort()
			return
		}

		// ユーザーIDを数値に変換
		userID, err := strconv.ParseUint(userIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "無効なユーザーIDです",
				"message": "再度ログインしてください",
			})
			c.Abort()
			return
		}

		// コンテキストにユーザーIDを設定
		c.Set("user_id", uint(userID))
		c.Next()
	}
}

// ユーザーIDをコンテキストから取得するヘルパー関数
func GetUserIDFromContext(c *gin.Context) (uint, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return 0, false
	}

	id, ok := userID.(uint)
	return id, ok
}

// 認証不要だが、ログイン済みの場合はユーザーIDを設定するミドルウェア
func OptionalAuth(redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.Next()
			return
		}

		token := tokenParts[1]
		userIDStr, err := redisClient.Get(context.Background(), "auth_token:"+token).Result()
		if err != nil {
			c.Next()
			return
		}

		userID, err := strconv.ParseUint(userIDStr, 10, 32)
		if err != nil {
			c.Next()
			return
		}

		c.Set("user_id", uint(userID))
		c.Next()
	}
}

// 管理者権限が必要なミドルウェア
func AdminRequired(db *gorm.DB, redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// まず認証チェック
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "認証が必要です",
				"message": "Authorization ヘッダーが見つかりません",
			})
			c.Abort()
			return
		}

		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "無効なトークン形式です",
				"message": "Bearer トークン形式を使用してください",
			})
			c.Abort()
			return
		}

		token := tokenParts[1]

		// Redisからトークンに対応するユーザーIDを取得
		userIDStr, err := redisClient.Get(context.Background(), "auth_token:"+token).Result()
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "無効または期限切れのトークンです",
				"message": "再度ログインしてください",
			})
			c.Abort()
			return
		}

		// ユーザーIDを数値に変換
		userID, err := strconv.ParseUint(userIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "無効なユーザーIDです",
				"message": "再度ログインしてください",
			})
			c.Abort()
			return
		}

		// データベースからユーザー情報を取得して管理者かチェック
		var user User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "ユーザーが見つかりません",
				"message": "無効なユーザーです",
			})
			c.Abort()
			return
		}

		// 管理者権限チェック
		if !user.IsAdmin {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "管理者権限が必要です",
				"message": "この操作を実行する権限がありません",
			})
			c.Abort()
			return
		}

		// コンテキストにユーザーIDを設定
		c.Set("user_id", uint(userID))
		c.Next()
	}
}
