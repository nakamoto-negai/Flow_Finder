package main

import (
	"crypto/md5"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// チュートリアル関連のルートを登録
func RegisterTutorialRoutes(r *gin.Engine, db *gorm.DB, redisClient *redis.Client) {
	// チュートリアル一覧取得（公開）
	r.GET("/tutorials", getTutorialsHandler(db))

	// カテゴリ別チュートリアル取得（公開）
	r.GET("/tutorials/category/:category", getTutorialsByCategoryHandler(db))

	// チュートリアルアップロード（管理者専用）
	r.POST("/tutorials/upload", AdminRequired(db, redisClient), uploadTutorialHandler(db))

	// チュートリアル更新（管理者専用）
	r.PUT("/tutorials/:id", AdminRequired(db, redisClient), updateTutorialHandler(db))

	// チュートリアル削除（管理者専用）
	r.DELETE("/tutorials/:id", AdminRequired(db, redisClient), deleteTutorialHandler(db))

	// チュートリアルの表示順を更新（管理者専用）
	r.PUT("/tutorials/:id/order", AdminRequired(db, redisClient), updateTutorialOrderHandler(db))
}

// チュートリアル一覧取得ハンドラ
func getTutorialsHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tutorials, err := GetActiveTutorials(db)
		if err != nil {
			log.Printf("チュートリアル一覧取得エラー: %v", err)
			c.JSON(500, gin.H{"error": "チュートリアルの取得に失敗しました"})
			return
		}

		// URLを動的に設定
		for i := range tutorials {
			tutorials[i].URL = fmt.Sprintf("/uploads/tutorials/%s", tutorials[i].FileName)
		}

		c.JSON(200, tutorials)
	}
}

// カテゴリ別チュートリアル取得ハンドラ
func getTutorialsByCategoryHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		category := c.Param("category")

		tutorials, err := GetTutorialsByCategory(db, category)
		if err != nil {
			log.Printf("カテゴリ別チュートリアル取得エラー: %v", err)
			c.JSON(500, gin.H{"error": "チュートリアルの取得に失敗しました"})
			return
		}

		// URLを動的に設定
		for i := range tutorials {
			tutorials[i].URL = fmt.Sprintf("/uploads/tutorials/%s", tutorials[i].FileName)
		}

		c.JSON(200, tutorials)
	}
}

// チュートリアルアップロードハンドラ
func uploadTutorialHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("=== チュートリアルアップロード開始 ===")

		// ファイルを取得
		file, err := c.FormFile("file")
		if err != nil {
			log.Printf("ファイル取得エラー: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "ファイルが選択されていません"})
			return
		}

		// ファイルサイズチェック（10MB制限）
		if file.Size > 10*1024*1024 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ファイルサイズが大きすぎます（10MB以下にしてください）"})
			return
		}

		// ファイル拡張子チェック
		ext := strings.ToLower(filepath.Ext(file.Filename))
		allowedExts := []string{".jpg", ".jpeg", ".png", ".gif", ".webp"}
		isAllowed := false
		for _, allowedExt := range allowedExts {
			if ext == allowedExt {
				isAllowed = true
				break
			}
		}
		if !isAllowed {
			log.Printf("許可されていない拡張子: %s", ext)
			c.JSON(http.StatusBadRequest, gin.H{"error": "サポートされていないファイル形式です"})
			return
		}

		// uploadsディレクトリを作成
		uploadDir := "./uploads/tutorials"
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			log.Printf("ディレクトリ作成エラー: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "アップロードディレクトリの作成に失敗しました"})
			return
		}

		// ファイル内容を読み取ってハッシュを計算
		src, err := file.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ファイルの読み取りに失敗しました"})
			return
		}
		defer src.Close()

		hash := md5.New()
		if _, err := io.Copy(hash, src); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ファイルハッシュの計算に失敗しました"})
			return
		}
		hashString := fmt.Sprintf("%x", hash.Sum(nil))

		// 重複チェック
		var existingTutorial Tutorial
		if err := db.Where("file_hash = ?", hashString).First(&existingTutorial).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{
				"result":   "exists",
				"message":  "同じファイルが既にアップロードされています",
				"tutorial": existingTutorial,
			})
			return
		}

		// ユニークなファイル名を生成
		timestamp := time.Now().Unix()
		filename := fmt.Sprintf("%d_%s%s", timestamp, hashString[:8], ext)
		filePath := filepath.Join(uploadDir, filename)

		// ファイルを保存
		if err := c.SaveUploadedFile(file, filePath); err != nil {
			log.Printf("ファイル保存エラー: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ファイルの保存に失敗しました"})
			return
		}

		// フォームデータから情報を取得
		title := c.PostForm("title")
		if title == "" {
			title = file.Filename
		}
		description := c.PostForm("description")
		category := c.PostForm("category")
		if category == "" {
			category = "general"
		}

		// 表示順を取得
		order := 0
		if orderStr := c.PostForm("order"); orderStr != "" {
			if parsedOrder, err := strconv.Atoi(orderStr); err == nil {
				order = parsedOrder
			}
		}

		// チュートリアルをデータベースに保存
		tutorial := Tutorial{
			Title:       title,
			Description: description,
			ImagePath:   filePath,
			FileName:    filename,
			FileHash:    hashString,
			MimeType:    file.Header.Get("Content-Type"),
			Order:       order,
			IsActive:    true,
			Category:    category,
		}

		if err := db.Create(&tutorial).Error; err != nil {
			log.Printf("チュートリアル保存エラー: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "チュートリアルの保存に失敗しました"})
			return
		}

		tutorial.URL = fmt.Sprintf("/uploads/tutorials/%s", tutorial.FileName)

		log.Printf("チュートリアルアップロード成功: ID=%d, Title=%s", tutorial.ID, tutorial.Title)
		c.JSON(http.StatusOK, gin.H{
			"message":  "チュートリアルがアップロードされました",
			"tutorial": tutorial,
		})
	}
}

// チュートリアル更新ハンドラ
func updateTutorialHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var tutorial Tutorial
		if err := db.First(&tutorial, id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "チュートリアルが見つかりません"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "チュートリアルの取得に失敗しました"})
			}
			return
		}

		// 更新する項目
		if title := c.PostForm("title"); title != "" {
			tutorial.Title = title
		}
		if description := c.PostForm("description"); description != "" {
			tutorial.Description = description
		}
		if category := c.PostForm("category"); category != "" {
			tutorial.Category = category
		}
		if orderStr := c.PostForm("order"); orderStr != "" {
			if order, err := strconv.Atoi(orderStr); err == nil {
				tutorial.Order = order
			}
		}

		// is_activeの更新
		if isActiveStr := c.PostForm("is_active"); isActiveStr != "" {
			tutorial.IsActive = isActiveStr == "true"
		}

		if err := db.Save(&tutorial).Error; err != nil {
			log.Printf("チュートリアル更新エラー: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "チュートリアルの更新に失敗しました"})
			return
		}

		tutorial.URL = fmt.Sprintf("/uploads/tutorials/%s", tutorial.FileName)

		log.Printf("チュートリアル更新成功: ID=%d", tutorial.ID)
		c.JSON(http.StatusOK, gin.H{
			"message":  "チュートリアルが更新されました",
			"tutorial": tutorial,
		})
	}
}

// チュートリアル削除ハンドラ
func deleteTutorialHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var tutorial Tutorial
		if err := db.First(&tutorial, id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "チュートリアルが見つかりません"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "チュートリアルの取得に失敗しました"})
			}
			return
		}

		// ファイルを削除
		if err := os.Remove(tutorial.ImagePath); err != nil {
			log.Printf("ファイル削除エラー: %v", err)
			// ファイル削除エラーでも続行
		}

		// DBから削除
		if err := db.Delete(&tutorial).Error; err != nil {
			log.Printf("チュートリアル削除エラー: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "チュートリアルの削除に失敗しました"})
			return
		}

		log.Printf("チュートリアル削除成功: ID=%d", tutorial.ID)
		c.JSON(http.StatusOK, gin.H{
			"message": "チュートリアルが削除されました",
		})
	}
}

// チュートリアルの表示順を更新するハンドラ
func updateTutorialOrderHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var req struct {
			Order int `json:"order" binding:"required"`
		}

		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエスト"})
			return
		}

		var tutorial Tutorial
		if err := db.First(&tutorial, id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "チュートリアルが見つかりません"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "チュートリアルの取得に失敗しました"})
			}
			return
		}

		if err := tutorial.UpdateOrder(db, req.Order); err != nil {
			log.Printf("表示順更新エラー: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "表示順の更新に失敗しました"})
			return
		}

		tutorial.URL = fmt.Sprintf("/uploads/tutorials/%s", tutorial.FileName)

		log.Printf("チュートリアル表示順更新成功: ID=%d, Order=%d", tutorial.ID, req.Order)
		c.JSON(http.StatusOK, gin.H{
			"message":  "表示順が更新されました",
			"tutorial": tutorial,
		})
	}
}
