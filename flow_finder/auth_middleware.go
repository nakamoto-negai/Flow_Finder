package main

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// 認証が必要なミドルウェア
func AuthRequired(redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Authorization ヘッダーからトークンを取得
		userID := c.GetHeader("X-User-Id")
		token := c.GetHeader("Authorization")
		if userID == "" || token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "認証が必要です",
				"message": "認証ヘッダーが見つかりません",
			})
			c.Abort()
			return
		}

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

		// ユーザーIDの整合性チェック
		if userIDStr != userID {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "無効なトークンです",
				"message": "再度ログインしてください",
			})
			c.Abort()
			return
		}

		// ユーザーIDを数値に変換
		userIDNum, err := strconv.ParseUint(userID, 10, 32)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "無効なユーザーIDです",
				"message": "再度ログインしてください",
			})
			c.Abort()
			return
		}

		// コンテキストにユーザーIDを設定
		c.Set("user_id", uint(userIDNum))
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
		userID := c.GetHeader("X-User-Id")
		token := c.GetHeader("Authorization")
		if userID == "" || token == "" {
			c.Next()
			return
		}

		userIDStr, err := redisClient.Get(context.Background(), "auth_token:"+token).Result()
		if err != nil {
			c.Next()
			return
		}

		if userIDStr != userID {
			c.Next()
			return
		}

		userIDNum, err := strconv.ParseUint(userID, 10, 32)
		if err != nil {
			c.Next()
			return
		}

		c.Set("user_id", uint(userIDNum))
		c.Next()
	}
}

// 管理者権限が必要なミドルウェア
func AdminRequired(db *gorm.DB, redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// まず認証チェック
		userID := c.GetHeader("X-User-Id")
		token := c.GetHeader("Authorization")
		if userID == "" || token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "認証が必要です",
				"message": "認証ヘッダーが見つかりません",
			})
			c.Abort()
			return
		}

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

		// ユーザーIDの整合性チェック
		if userIDStr != userID {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "無効なトークンです",
				"message": "再度ログインしてください",
			})
			c.Abort()
			return
		}

		// ユーザーIDを数値に変換
		userIDNum, err := strconv.ParseUint(userID, 10, 32)
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
		if err := db.First(&user, userIDNum).Error; err != nil {
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
		c.Set("user_id", uint(userIDNum))
		c.Next()
	}
}
