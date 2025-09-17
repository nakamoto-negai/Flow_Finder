package main

import (
    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
)

// ユーザーAPIハンドラ群
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
        user := User{Name: req.Name}
        if err := db.Create(&user).Error; err != nil {
            c.JSON(500, gin.H{"error": "DB insert error"})
            return
        }
        c.JSON(200, gin.H{"result": "ok"})
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
