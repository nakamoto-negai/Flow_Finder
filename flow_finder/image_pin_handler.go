package main

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// 指定NodeImageのピン一覧を取得
func getImagePinsHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nodeImageIDStr := c.Param("id")
		nodeImageID, err := strconv.Atoi(nodeImageIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "無効なNodeImage IDです"})
			return
		}

		var pins []ImagePin
		if err := db.Where("node_image_id = ?", nodeImageID).
			Preload("Link").
			Order("id ASC").
			Find(&pins).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ピンの取得に失敗しました"})
			return
		}

		c.JSON(http.StatusOK, pins)
	}
}

// ピンを作成（Admin）
func createImagePinHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nodeImageIDStr := c.Param("id")
		nodeImageID, err := strconv.Atoi(nodeImageIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "無効なNodeImage IDです"})
			return
		}

		// NodeImageが存在するか確認
		var nodeImage NodeImage
		if err := db.First(&nodeImage, nodeImageID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "NodeImageが見つかりません"})
			return
		}

		var input struct {
			LinkID uint    `json:"link_id" binding:"required"`
			X      float64 `json:"x" binding:"required"`
			Y      float64 `json:"y" binding:"required"`
			Label  string  `json:"label"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエストです: " + err.Error()})
			return
		}

		// Linkが存在するか確認
		var link Link
		if err := db.First(&link, input.LinkID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "リンクが見つかりません"})
			return
		}

		pin := ImagePin{
			NodeImageID: uint(nodeImageID),
			LinkID:      input.LinkID,
			X:           input.X,
			Y:           input.Y,
			Label:       input.Label,
		}

		if err := db.Create(&pin).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ピンの作成に失敗しました"})
			return
		}

		// Linkをプリロードして返す
		db.Preload("Link").First(&pin, pin.ID)

		c.JSON(http.StatusOK, gin.H{"message": "ピンを作成しました", "pin": pin})
	}
}

// ピンを更新（Admin）
func updateImagePinHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "無効なID です"})
			return
		}

		var pin ImagePin
		if err := db.First(&pin, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "ピンが見つかりません"})
			return
		}

		var input struct {
			LinkID uint    `json:"link_id"`
			X      float64 `json:"x"`
			Y      float64 `json:"y"`
			Label  string  `json:"label"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエストです"})
			return
		}

		if input.LinkID != 0 {
			pin.LinkID = input.LinkID
		}
		pin.X = input.X
		pin.Y = input.Y
		pin.Label = input.Label

		if err := db.Save(&pin).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ピンの更新に失敗しました"})
			return
		}

		db.Preload("Link").First(&pin, pin.ID)
		c.JSON(http.StatusOK, gin.H{"message": "ピンを更新しました", "pin": pin})
	}
}

// ピンを削除（Admin）
func deleteImagePinHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "無効なIDです"})
			return
		}

		var pin ImagePin
		if err := db.First(&pin, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "ピンが見つかりません"})
			return
		}

		if err := db.Delete(&pin).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "削除に失敗しました"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "ピンを削除しました"})
	}
}

// ルート登録
func RegisterImagePinRoutes(r *gin.Engine, db *gorm.DB, redisClient *redis.Client) {
	// ユーザー用（認証不要）
	r.GET("/api/node-images/:id/pins", getImagePinsHandler(db))

	// 管理者用
	r.POST("/api/node-images/:id/pins", AdminRequired(db, redisClient), createImagePinHandler(db))
	r.PUT("/api/image-pins/:id", AdminRequired(db, redisClient), updateImagePinHandler(db))
	r.DELETE("/api/image-pins/:id", AdminRequired(db, redisClient), deleteImagePinHandler(db))
}
