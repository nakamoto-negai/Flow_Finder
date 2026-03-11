package main

import (
	"crypto/md5"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ノードに紐づく画像一覧を取得
func getNodeImagesHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nodeIDStr := c.Param("id")
		nodeID, err := strconv.Atoi(nodeIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "無効なノードIDです"})
			return
		}

		var images []NodeImage
		if err := db.Where("node_id = ?", nodeID).Order("\"order\" ASC, id ASC").Find(&images).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "画像の取得に失敗しました"})
			return
		}

		// 画像URLを動的に生成
		for i := range images {
			images[i].URL = fmt.Sprintf("/uploads/nodes/%s", images[i].FileName)
		}

		c.JSON(http.StatusOK, images)
	}
}

// ノード画像をアップロード
func uploadNodeImageHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nodeIDStr := c.Param("id")
		nodeID, err := strconv.Atoi(nodeIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "無効なノードIDです"})
			return
		}

		// ノードが存在するか確認
		var node Node
		if err := db.First(&node, nodeID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "ノードが見つかりません"})
			return
		}

		// ファイルを取得
		file, err := c.FormFile("image")
		if err != nil {
			// "file"フィールドも試行
			file, err = c.FormFile("file")
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "画像ファイルが見つかりません"})
				return
			}
		}

		// 画像を保存（uploads/nodes/ディレクトリに保存）
		uploadDir := "./uploads/nodes"

		// ディレクトリが存在しない場合は作成
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("ディレクトリ作成エラー: %v", err)})
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
		fileHash := fmt.Sprintf("%x", hash.Sum(nil))

		// ユニークなファイル名を生成
		timestamp := time.Now().Unix()
		ext := filepath.Ext(file.Filename)
		savedFileName := fmt.Sprintf("%d_%s%s", timestamp, fileHash[:8], ext)
		filePath := filepath.Join(uploadDir, savedFileName)

		// ファイルを保存
		if err := c.SaveUploadedFile(file, filePath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("ファイル保存エラー: %v", err)})
			return
		}

		// NodeImageレコードを作成
		nodeImage := NodeImage{
			NodeID:       uint(nodeID),
			OriginalName: file.Filename,
			FileName:     savedFileName,
			FilePath:     filePath,
			FileSize:     file.Size,
			FileHash:     fileHash,
			MimeType:     file.Header.Get("Content-Type"),
			Order:        0, // デフォルト順序
		}

		if err := db.Create(&nodeImage).Error; err != nil {
			// データベース保存に失敗した場合、ファイルを削除
			os.Remove(filePath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "データベース保存エラー"})
			return
		}

		// URLを動的生成
		nodeImage.URL = fmt.Sprintf("/uploads/nodes/%s", nodeImage.FileName)

		c.JSON(http.StatusOK, gin.H{
			"message": "画像をアップロードしました",
			"image":   nodeImage,
		})
	}
}

// ノード画像を削除
func deleteNodeImageHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		imageIDStr := c.Param("id")
		imageID, err := strconv.Atoi(imageIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "無効な画像IDです"})
			return
		}

		var nodeImage NodeImage
		if err := db.First(&nodeImage, imageID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "画像が見つかりません"})
			return
		}

		// データベースから削除
		if err := db.Delete(&nodeImage).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "削除に失敗しました"})
			return
		}

		// ファイルも削除（オプション）
		// os.Remove(nodeImage.FilePath)

		c.JSON(http.StatusOK, gin.H{"message": "画像を削除しました"})
	}
}
