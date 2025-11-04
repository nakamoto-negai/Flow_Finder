package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// フィールド関連のルートを登録
func RegisterFieldRoutes(r *gin.Engine, db *gorm.DB) {
	// フィールド一覧取得
	r.GET("/fields", func(c *gin.Context) {
		var fields []Field
		if err := db.Find(&fields).Error; err != nil {
			c.JSON(500, gin.H{"error": "フィールド取得に失敗しました"})
			return
		}
		c.JSON(200, fields)
	})

	// アクティブなフィールド取得
	r.GET("/fields/active", func(c *gin.Context) {
		field, err := GetActiveField(db)
		if err != nil {
			c.JSON(404, gin.H{"error": "アクティブなフィールドが見つかりません"})
			return
		}
		c.JSON(200, field)
	})

	// フィールド詳細取得
	r.GET("/fields/:id", func(c *gin.Context) {
		id := c.Param("id")
		var field Field
		if err := db.First(&field, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "フィールドが見つかりません"})
			return
		}
		c.JSON(200, field)
	})

	// フィールド作成（画像アップロード付き）
	r.POST("/fields", fieldCreateHandler(db))

	// フィールド更新
	r.PUT("/fields/:id", fieldUpdateHandler(db))

	// フィールドをアクティブに設定
	r.POST("/fields/:id/activate", func(c *gin.Context) {
		id := c.Param("id")
		var field Field
		if err := db.First(&field, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "フィールドが見つかりません"})
			return
		}

		if err := field.SetActive(db); err != nil {
			c.JSON(500, gin.H{"error": "フィールドのアクティブ化に失敗しました"})
			return
		}

		c.JSON(200, gin.H{"result": "ok", "message": "フィールドをアクティブにしました"})
	})

	// フィールド削除
	r.DELETE("/fields/:id", func(c *gin.Context) {
		id := c.Param("id")
		var field Field
		if err := db.First(&field, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "フィールドが見つかりません"})
			return
		}

		// 画像ファイルを削除
		if field.ImagePath != "" {
			os.Remove(field.ImagePath)
		}

		if err := db.Delete(&field).Error; err != nil {
			c.JSON(500, gin.H{"error": "フィールド削除に失敗しました"})
			return
		}

		c.JSON(200, gin.H{"result": "ok", "message": "フィールドが削除されました"})
	})

	// 注意: 画像ファイルの静的配信は image_handler.go の /uploads で既に設定済み
}

// フィールド作成ハンドラ
func fieldCreateHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// マルチパートフォームの解析
		if err := c.Request.ParseMultipartForm(10 << 20); err != nil { // 10MB制限
			c.JSON(400, gin.H{"error": "フォームの解析に失敗しました"})
			return
		}

		// フォームデータの取得
		name := c.PostForm("name")
		description := c.PostForm("description")
		widthStr := c.PostForm("width")
		heightStr := c.PostForm("height")

		if name == "" {
			c.JSON(400, gin.H{"error": "フィールド名は必須です"})
			return
		}

		// 幅と高さの変換
		width := 800
		height := 600
		if widthStr != "" {
			if w, err := strconv.Atoi(widthStr); err == nil && w > 0 {
				width = w
			}
		}
		if heightStr != "" {
			if h, err := strconv.Atoi(heightStr); err == nil && h > 0 {
				height = h
			}
		}

		// ファイルアップロード処理
		file, header, err := c.Request.FormFile("image")
		if err != nil {
			c.JSON(400, gin.H{"error": "画像ファイルが必要です"})
			return
		}
		defer file.Close()

		// ファイル拡張子チェック
		ext := strings.ToLower(filepath.Ext(header.Filename))
		if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" {
			c.JSON(400, gin.H{"error": "サポートされていないファイル形式です（jpg, png, gif のみ）"})
			return
		}

		// アップロードディレクトリの作成
		uploadDir := "./uploads/fields"
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			c.JSON(500, gin.H{"error": "アップロードディレクトリの作成に失敗しました"})
			return
		}

		// ファイル名の生成（タイムスタンプ + 元の拡張子）
		filename := fmt.Sprintf("%d%s", time.Now().Unix(), ext)
		filepath := filepath.Join(uploadDir, filename)

		// ファイル保存
		dst, err := os.Create(filepath)
		if err != nil {
			c.JSON(500, gin.H{"error": "ファイル保存に失敗しました"})
			return
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			c.JSON(500, gin.H{"error": "ファイルのコピーに失敗しました"})
			return
		}

		// フィールドをデータベースに保存
		field := Field{
			Name:        name,
			Description: description,
			ImagePath:   filepath,
			ImageURL:    fmt.Sprintf("/uploads/fields/%s", filename),
			Width:       width,
			Height:      height,
			IsActive:    false, // デフォルトは非アクティブ
		}

		if err := db.Create(&field).Error; err != nil {
			// ファイルを削除
			os.Remove(filepath)
			c.JSON(500, gin.H{"error": "データベース保存に失敗しました"})
			return
		}

		c.JSON(201, gin.H{
			"result":  "ok",
			"id":      field.ID,
			"field":   field,
			"message": "フィールドが作成されました",
		})
	}
}

// フィールド更新ハンドラ
func fieldUpdateHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var field Field
		if err := db.First(&field, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "フィールドが見つかりません"})
			return
		}

		var req struct {
			Name        *string `json:"name"`
			Description *string `json:"description"`
			Width       *int    `json:"width"`
			Height      *int    `json:"height"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です"})
			return
		}

		// フィールドを更新
		if req.Name != nil {
			field.Name = *req.Name
		}
		if req.Description != nil {
			field.Description = *req.Description
		}
		if req.Width != nil && *req.Width > 0 {
			field.Width = *req.Width
		}
		if req.Height != nil && *req.Height > 0 {
			field.Height = *req.Height
		}

		if err := db.Save(&field).Error; err != nil {
			c.JSON(500, gin.H{"error": "フィールド更新に失敗しました"})
			return
		}

		c.JSON(200, gin.H{"result": "ok", "field": field})
	}
}
