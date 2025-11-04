package main

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ユーザー関連のルートを登録
func RegisterUserRoutes(r *gin.Engine, db *gorm.DB) {
	// ユーザー追加
	r.POST("/users", func(c *gin.Context) {
		var req struct {
			Name string `json:"name"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "invalid request"})
			return
		}

		// 既存ユーザーの重複チェック
		var existingUser User
		if err := db.Where("name = ?", req.Name).First(&existingUser).Error; err == nil {
			c.JSON(409, gin.H{"error": "user already exists"})
			return
		}

		user := User{Name: req.Name}
		if err := db.Create(&user).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB insert error"})
			return
		}

		// データベース操作ログを記録
		var userID *uint = &user.ID // 新規作成されたユーザー自身のID
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "create", "users", fmt.Sprintf("%d", user.ID), c)

		c.JSON(200, gin.H{"result": "ok", "user_id": user.ID})
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
