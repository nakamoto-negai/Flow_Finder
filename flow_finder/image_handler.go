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
	"gorm.io/gorm"
)

// 画像関連のルートを登録
func RegisterImageRoutes(r *gin.Engine, db *gorm.DB) {
	// 画像アップロード
	r.POST("/upload", imageUploadHandler(db))

	// 画像一覧取得
	r.GET("/images", imageListHandler(db))

	// 画像削除
	r.DELETE("/images/:id", imageDeleteHandler(db))

	// 画像ファイル配信
	r.Static("/uploads", "./uploads")
}

// 画像アップロードハンドラ
func imageUploadHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("=== 画像アップロード開始 ===")
		log.Printf("Content-Type: %s", c.GetHeader("Content-Type"))
		log.Printf("Form data keys available:")
		if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
			log.Printf("ParseMultipartForm エラー: %v", err)
		} else {
			for key := range c.Request.MultipartForm.Value {
				log.Printf("  Value key: %s", key)
			}
			for key := range c.Request.MultipartForm.File {
				log.Printf("  File key: %s", key)
			}
		}

		// ファイルを取得（"file"または"image"フィールドから）
		file, err := c.FormFile("file")
		if err != nil {
			// "image"フィールドも試行
			file, err = c.FormFile("image")
			if err != nil {
				log.Printf("ファイル取得エラー (both 'file' and 'image'): %v", err)
				c.JSON(400, gin.H{"error": "ファイルが選択されていません"})
				return
			}
		}

		log.Printf("取得したファイル: %s, サイズ: %d", file.Filename, file.Size)

		// ファイルサイズチェック（10MB制限）
		if file.Size > 10*1024*1024 {
			c.JSON(400, gin.H{"error": "ファイルサイズが大きすぎます（10MB以下にしてください）"})
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
			c.JSON(400, gin.H{"error": "サポートされていないファイル形式です"})
			return
		}

		// uploadsディレクトリを作成
		uploadDir := "./uploads"
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			log.Printf("ディレクトリ作成エラー: %v", err)
			c.JSON(500, gin.H{"error": "アップロードディレクトリの作成に失敗しました"})
			return
		}

		// ファイル内容を読み取ってハッシュを計算
		src, err := file.Open()
		if err != nil {
			c.JSON(500, gin.H{"error": "ファイルの読み取りに失敗しました"})
			return
		}
		defer src.Close()

		hash := md5.New()
		if _, err := io.Copy(hash, src); err != nil {
			c.JSON(500, gin.H{"error": "ファイルハッシュの計算に失敗しました"})
			return
		}
		hashString := fmt.Sprintf("%x", hash.Sum(nil))

		// 重複チェック
		var existingImage Image
		if err := db.Where("file_hash = ?", hashString).First(&existingImage).Error; err == nil {
			c.JSON(200, gin.H{
				"result":  "exists",
				"message": "同じファイルが既にアップロードされています",
				"image":   existingImage,
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
			c.JSON(500, gin.H{"error": "ファイルの保存に失敗しました"})
			return
		}

		// データベースに画像情報を保存
		image := Image{
			OriginalName: file.Filename,
			FileName:     filename,
			FilePath:     filePath,
			FileSize:     file.Size,
			FileHash:     hashString,
			MimeType:     file.Header.Get("Content-Type"),
			UploadedAt:   time.Now(),
			Order:        1, // デフォルト値
		}

		// オプションのフィールドを設定
		if linkIdStr := c.PostForm("link_id"); linkIdStr != "" {
			log.Printf("link_id パラメータ: %s", linkIdStr)
			if linkId, err := strconv.ParseUint(linkIdStr, 10, 32); err == nil {
				linkIdUint := uint(linkId)
				image.LinkID = &linkIdUint
			}
		}

		if orderStr := c.PostForm("order"); orderStr != "" {
			log.Printf("order パラメータ: %s", orderStr)
			if order, err := strconv.Atoi(orderStr); err == nil {
				image.Order = order
			}
		}

		if err := db.Create(&image).Error; err != nil {
			// データベース保存に失敗した場合、ファイルを削除
			os.Remove(filePath)
			log.Printf("データベース保存エラー: %v", err)
			c.JSON(500, gin.H{"error": "画像情報の保存に失敗しました"})
			return
		}

		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "create", "images", strconv.Itoa(int(image.ID)), c)

		log.Printf("画像アップロード成功: %s", filename)
		// アップロード成功
		c.JSON(201, gin.H{
			"result":    "ok",
			"message":   "ファイルが正常にアップロードされました",
			"image":     image,
			"url":       fmt.Sprintf("/uploads/%s", filename),
			"image_url": fmt.Sprintf("/uploads/%s", filename),
		})
	}
}

// 画像一覧取得ハンドラ
func imageListHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var images []Image
		query := db.Model(&Image{})

		// ページネーション
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 20
		}
		offset := (page - 1) * limit

		// 検索フィルタ
		if search := c.Query("search"); search != "" {
			query = query.Where("original_name LIKE ?", "%"+search+"%")
		}

		// ファイルタイプフィルタ
		if mimeType := c.Query("mime_type"); mimeType != "" {
			query = query.Where("mime_type LIKE ?", mimeType+"%")
		}

		// 日付範囲フィルタ
		if from := c.Query("from"); from != "" {
			if fromTime, err := time.Parse("2006-01-02", from); err == nil {
				query = query.Where("uploaded_at >= ?", fromTime)
			}
		}
		if to := c.Query("to"); to != "" {
			if toTime, err := time.Parse("2006-01-02", to); err == nil {
				toTime = toTime.Add(24 * time.Hour) // 日付の終わりまで
				query = query.Where("uploaded_at <= ?", toTime)
			}
		}

		// 総数を取得
		var total int64
		query.Count(&total)

		// データを取得
		if err := query.Order("uploaded_at DESC").Limit(limit).Offset(offset).Find(&images).Error; err != nil {
			c.JSON(500, gin.H{"error": "画像一覧の取得に失敗しました"})
			return
		}

		// レスポンスに画像URLを追加
		for i := range images {
			images[i].URL = fmt.Sprintf("/uploads/%s", images[i].FileName)
		}

		// シンプルな配列形式で返す（ImageManagerとの互換性のため）
		c.JSON(200, images)
	}
}

// 画像削除ハンドラ
func imageDeleteHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var image Image
		if err := db.First(&image, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "画像が見つかりません"})
			return
		}

		// ファイルを削除
		if err := os.Remove(image.FilePath); err != nil {
			log.Printf("ファイル削除エラー: %v", err)
			// ファイル削除に失敗してもデータベースからは削除する
		}

		// データベースから削除
		if err := db.Delete(&image).Error; err != nil {
			c.JSON(500, gin.H{"error": "画像の削除に失敗しました"})
			return
		}

		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "delete", "images", id, c)

		c.JSON(200, gin.H{
			"result":  "ok",
			"message": "画像が正常に削除されました",
		})
	}
}

// ファイル情報取得のヘルパー関数
func getFileInfo(filePath string) (map[string]interface{}, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return nil, err
	}

	// ファイルの先頭を読んでMIMEタイプを検出
	buffer := make([]byte, 512)
	_, err = file.Read(buffer)
	if err != nil && err != io.EOF {
		return nil, err
	}

	mimeType := http.DetectContentType(buffer)

	return map[string]interface{}{
		"size":      stat.Size(),
		"mime_type": mimeType,
		"modified":  stat.ModTime(),
	}, nil
}
