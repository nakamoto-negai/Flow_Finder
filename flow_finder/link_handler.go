package main

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// リンク関連のルートを登録
func RegisterLinkRoutes(r *gin.Engine, db *gorm.DB) {
	// Link追加
	r.POST("/links", func(c *gin.Context) {
		var req struct {
			FromNodeID uint    `json:"from_node_id"`
			ToNodeID   uint    `json:"to_node_id"`
			Distance   float64 `json:"distance"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "invalid request"})
			return
		}
		link := Link{
			FromNodeID: req.FromNodeID,
			ToNodeID:   req.ToNodeID,
			Distance:   req.Distance,
			Weight:     req.Distance, // デフォルトで距離と同じ
			IsDirected: false,        // デフォルトで双方向
		}
		if err := db.Create(&link).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB insert error"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "create", "links", fmt.Sprintf("%d", link.ID), c)
		
		c.JSON(200, gin.H{"result": "ok", "id": link.ID})
	})

	// Link一覧取得
	r.GET("/links", func(c *gin.Context) {
		var links []Link
		if err := db.Find(&links).Error; err != nil {
			c.JSON(500, gin.H{"error": "DB select error"})
			return
		}
		c.JSON(200, links)
	})

	// Link詳細取得
	r.GET("/links/:id", func(c *gin.Context) {
		id := c.Param("id")
		var link Link
		if err := db.First(&link, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "リンクが見つかりません"})
			return
		}
		
		// ノード名も含めて返す
		var fromNode, toNode Node
		db.First(&fromNode, link.FromNodeID)
		db.First(&toNode, link.ToNodeID)
		
		c.JSON(200, gin.H{
			"id":             link.ID,
			"from_node_id":   link.FromNodeID,
			"to_node_id":     link.ToNodeID,
			"from_node_name": fromNode.Name,
			"to_node_name":   toNode.Name,
			"distance":       link.Distance,
		})
	})

	// Link更新
	r.PUT("/links/:id", func(c *gin.Context) {
		id := c.Param("id")
		var link Link
		if err := db.First(&link, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "リンクが見つかりません"})
			return
		}
		
		var req struct {
			FromNodeID *uint     `json:"from_node_id"`
			ToNodeID   *uint     `json:"to_node_id"`
			Distance   *float64  `json:"distance"`
			Weight     *float64  `json:"weight"`
			IsDirected *bool     `json:"is_directed"`
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "リクエストが無効です", "details": err.Error()})
			return
		}
		
		// フィールドを更新（ポインタがnilでない場合のみ）
		if req.FromNodeID != nil {
			// ノードの存在確認
			var fromNode Node
			if err := db.First(&fromNode, *req.FromNodeID).Error; err != nil {
				c.JSON(400, gin.H{"error": "指定された出発ノードが存在しません"})
				return
			}
			link.FromNodeID = *req.FromNodeID
		}
		if req.ToNodeID != nil {
			// ノードの存在確認
			var toNode Node
			if err := db.First(&toNode, *req.ToNodeID).Error; err != nil {
				c.JSON(400, gin.H{"error": "指定された到着ノードが存在しません"})
				return
			}
			link.ToNodeID = *req.ToNodeID
		}
		if req.Distance != nil {
			if *req.Distance <= 0 {
				c.JSON(400, gin.H{"error": "距離は正の値である必要があります"})
				return
			}
			link.Distance = *req.Distance
			// 距離が更新された場合、重みも同時に更新（明示的に指定されていない場合）
			if req.Weight == nil {
				link.Weight = *req.Distance
			}
		}
		if req.Weight != nil {
			if *req.Weight <= 0 {
				c.JSON(400, gin.H{"error": "重みは正の値である必要があります"})
				return
			}
			link.Weight = *req.Weight
		}
		if req.IsDirected != nil {
			link.IsDirected = *req.IsDirected
		}
		
		if err := db.Save(&link).Error; err != nil {
			c.JSON(500, gin.H{"error": "リンク更新に失敗しました"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "update", "links", id, c)
		
		c.JSON(200, gin.H{"result": "ok", "link": link})
	})

	// Link削除
	r.DELETE("/links/:id", func(c *gin.Context) {
		id := c.Param("id")
		
		if err := db.Delete(&Link{}, id).Error; err != nil {
			c.JSON(500, gin.H{"error": "リンク削除に失敗しました"})
			return
		}
		
		// データベース操作ログを記録
		var userID *uint = nil
		sessionID := c.GetHeader("X-Session-Id")
		if sessionID == "" {
			sessionID = generateHandlerSessionID()
		}
		LogDatabaseOperation(db, userID, sessionID, "delete", "links", id, c)
		
		c.JSON(200, gin.H{"result": "ok", "message": "リンクが削除されました"})
	})
}