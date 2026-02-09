package main

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// ノード関連のルートを登録
func RegisterNodeRoutes(r *gin.Engine, db *gorm.DB, redisClient *redis.Client) {
	// Node追加（管理者専用）
	r.POST("/nodes", AdminRequired(db, redisClient), func(c *gin.Context) {
		var req struct {
			Name       string  `json:"name"`
			X          float64 `json:"x"`
			Y          float64 `json:"y"`
			Congestion int     `json:"congestion"`
			Tourist    bool    `json:"tourist"`
			FieldID    *uint   `json:"field_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "invalid request"})
			return
		}
		node := Node{
			Name:       req.Name,
			X:          req.X,
			Y:          req.Y,
			Congestion: req.Congestion,
			Tourist:    req.Tourist,
			FieldID:    req.FieldID,
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

	// Node更新（管理者専用）
	r.PUT("/nodes/:id", AdminRequired(db, redisClient), func(c *gin.Context) {
		id := c.Param("id")
		var node Node
		if err := db.First(&node, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "ノードが見つかりません"})
			return
		}

		var req struct {
			Name       *string  `json:"name"`
			X          *float64 `json:"x"`
			Y          *float64 `json:"y"`
			Congestion *int     `json:"congestion"`
			Tourist    *bool    `json:"tourist"`
			FieldID    *uint    `json:"field_id"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です", "details": err.Error()})
			return
		}

		// フィールドを更新（ポインタがnilでない場合のみ）
		if req.Name != nil {
			node.Name = *req.Name
		}
		if req.X != nil {
			node.X = *req.X
		}
		if req.Y != nil {
			node.Y = *req.Y
		}
		if req.Congestion != nil {
			node.Congestion = *req.Congestion
		}
		if req.Tourist != nil {
			node.Tourist = *req.Tourist
		}
		if req.FieldID != nil {
			node.FieldID = req.FieldID
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

	// Node削除（管理者専用）
	r.DELETE("/nodes/:id", AdminRequired(db, redisClient), func(c *gin.Context) {
		id := c.Param("id")

		// 削除前に関連するリンクをチェック
		var linkCount int64
		if err := db.Model(&Link{}).Where("from_node_id = ? OR to_node_id = ?", id, id).Count(&linkCount).Error; err != nil {
			c.JSON(500, gin.H{"error": "リンクのチェックに失敗しました"})
			return
		}

		if linkCount > 0 {
			c.JSON(400, gin.H{
				"error":      "このノードは他のノードとリンクされているため削除できません",
				"link_count": linkCount,
				"message":    "先に関連するリンクを削除してください",
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

	// ノードに紐づく画像一覧を取得
	r.GET("/nodes/:id/images", getNodeImagesHandler(db))

	// ノード画像をアップロード（管理者専用）
	r.POST("/nodes/:id/images", AdminRequired(db, redisClient), uploadNodeImageHandler(db))

	// ノード画像を削除（管理者専用）
	r.DELETE("/node-images/:id", AdminRequired(db, redisClient), deleteNodeImageHandler(db))
}
