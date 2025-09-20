package main

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
)

// /upload 画像アップロードAPI
func RegisterUploadRoute(r *gin.Engine) {
	r.POST("/upload", func(c *gin.Context) {
		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ファイルがありません"})
			return
		}
		dir := "uploads"
		if err := os.MkdirAll(dir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ディレクトリ作成失敗"})
			return
		}
		filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(file.Filename))
		path := filepath.Join(dir, filename)
		if err := c.SaveUploadedFile(file, path); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失敗"})
			return
		}
		url := fmt.Sprintf("/uploads/%s", filename)
		c.JSON(http.StatusOK, gin.H{"url": url})
	})
}
