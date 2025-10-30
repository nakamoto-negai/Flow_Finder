package main

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ノード関連のルートを登録
func RegisterNodeRoutes(r *gin.Engine, db *gorm.DB) {
	// Node追加
	r.POST("/nodes", func(c *gin.Context) {
		var req struct {
			Name       string  `json:"name"`
			Latitude   float64 `json:"latitude"`
			Longitude  float64 `json:"longitude"`
			Congestion int     `json:"congestion"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "invalid request"})
			return
		}
		node := Node{
			Name:       req.Name,
			Latitude:   req.Latitude,
			Longitude:  req.Longitude,
			Congestion: req.Congestion,
		}
		if err := db.Create(&node).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB insert error"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "create", "nodes", fmt.Sprintf("%d", node.ID), c)
		
		c.JSON(200, gin.H{"result": "ok", "id": node.ID})
	})

	// Node一覧取得
	r.GET("/nodes", func(c *gin.Context) {
		var nodes []Node
		if err := db.Find(&nodes).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB select error"})
			return
		}
		c.JSON(200, nodes)
	})

	// Node詳細取得
	r.GET("/nodes/:id", func(c *gin.Context) {
		id := c.Param("id")
		var node Node
		if err := db.First(&node, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "ノードが見つかりません"})
			return
		}
		c.JSON(200, node)
	})

	// Node更新
	r.PUT("/nodes/:id", func(c *gin.Context) {
		id := c.Param("id")
		var node Node
		if err := db.First(&node, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "ノードが見つかりません"})
			return
		}
		
		var req struct {
			Name       *string  `json:"name"`
			Latitude   *float64 `json:"latitude"`
			Longitude  *float64 `json:"longitude"`
			Congestion *int     `json:"congestion"`
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です", "details": err.Error()})
			return
		}
		
		// フィールドを更新（ポインタがnilでない場合のみ）
		if req.Name != nil {
			node.Name = *req.Name
		}
		if req.Latitude != nil {
			node.Latitude = *req.Latitude
		}
		if req.Longitude != nil {
			node.Longitude = *req.Longitude
		}
		if req.Congestion != nil {
			node.Congestion = *req.Congestion
		}
		
		if err := db.Save(&node).Error; err != nil {
			c.JSON(500, gin.H{"error": "ノード更新に失敗しました"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "update", "nodes", id, c)
		
		c.JSON(200, gin.H{"result": "ok", "node": node})
	})

	// Node削除
	r.DELETE("/nodes/:id", func(c *gin.Context) {
		id := c.Param("id")
		
		// 削除前に関連するリンクをチェック
		var linkCount int64
		if err := db.Model(&Link{}).Where("from_node_id = ? OR to_node_id = ?", id, id).Count(&linkCount).Error; err != nil {
			c.JSON(500, gin.H{"error": "リンクのチェックに失敗しました"})
			return
		}
		
		if linkCount > 0 {
			c.JSON(400, gin.H{
				"error": "このノードは他のノードとリンクされているため削除できません",
				"link_count": linkCount,
				"message": "先に関連するリンクを削除してください",
			})
			return
		}
		
		if err := db.Delete(&Node{}, id).Error; err != nil {
			c.JSON(500, gin.H{"error": "ノード削除に失敗しました"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "delete", "nodes", id, c)
		
		c.JSON(200, gin.H{"result": "ok", "message": "ノードが削除されました"})
	})
}