package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ChangeHistory モデル: データベースの変更履歴を記録
// どのテーブル・レコードが・誰によって・どのように変更されたかを保存
// 例: 作成・更新・削除操作の履歴

type ChangeHistory struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	TableName string         `json:"table_name"` // 変更対象テーブル名
	RecordID  string         `json:"record_id"`  // 変更対象レコードID
	UserID    *uint          `json:"user_id"`    // 操作したユーザーID（null可）
	Operation string         `json:"operation"`  // 操作種別: create/update/delete
	Before    string         `json:"before"`     // 変更前データ(JSON)
	After     string         `json:"after"`      // 変更後データ(JSON)
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// マイグレーション用
func MigrateChangeHistory(db *gorm.DB) error {
	return db.AutoMigrate(&ChangeHistory{})
}

// 変更履歴を記録するヘルパー関数
func RecordChangeHistory(db *gorm.DB, tableName string, recordID string, userID *uint, operation string, before interface{}, after interface{}) {
	beforeJSON := ""
	afterJSON := ""

	if before != nil {
		if b, err := json.Marshal(before); err == nil {
			beforeJSON = string(b)
		}
	}

	if after != nil {
		if a, err := json.Marshal(after); err == nil {
			afterJSON = string(a)
		}
	}

	history := ChangeHistory{
		TableName: tableName,
		RecordID:  recordID,
		UserID:    userID,
		Operation: operation,
		Before:    beforeJSON,
		After:     afterJSON,
	}

	// バックグラウンドで非同期保存
	go func() {
		if err := db.Create(&history).Error; err != nil {
			fmt.Printf("変更履歴保存エラー: %v\n", err)
		}
	}()
}

// 変更履歴取得用のAPIエンドポイントを登録
func RegisterChangeHistoryRoutes(r *gin.Engine, db *gorm.DB) {
	// 変更履歴一覧取得
	r.GET("/api/change-history", func(c *gin.Context) {
		var histories []ChangeHistory
		query := db.Model(&ChangeHistory{})

		// フィルタリング
		if tableName := c.Query("table_name"); tableName != "" {
			query = query.Where("table_name = ?", tableName)
		}
		if recordID := c.Query("record_id"); recordID != "" {
			query = query.Where("record_id = ?", recordID)
		}
		if userID := c.Query("user_id"); userID != "" {
			query = query.Where("user_id = ?", userID)
		}
		if operation := c.Query("operation"); operation != "" {
			query = query.Where("operation = ?", operation)
		}

		// ページネーション
		page := 1
		limit := 50
		if p := c.Query("page"); p != "" {
			fmt.Sscanf(p, "%d", &page)
		}
		if l := c.Query("limit"); l != "" {
			fmt.Sscanf(l, "%d", &limit)
		}
		offset := (page - 1) * limit

		var total int64
		query.Session(&gorm.Session{}).Count(&total)

		if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&histories).Error; err != nil {
			c.JSON(500, gin.H{"error": "failed to fetch change history"})
			return
		}

		c.JSON(200, gin.H{
			"histories": histories,
			"total":     total,
			"page":      page,
			"limit":     limit,
		})
	})

	// CSV エクスポート
	r.GET("/api/change-history/export", func(c *gin.Context) {
		var histories []ChangeHistory
		query := db.Model(&ChangeHistory{})

		if tableName := c.Query("table_name"); tableName != "" {
			query = query.Where("table_name = ?", tableName)
		}
		if recordID := c.Query("record_id"); recordID != "" {
			query = query.Where("record_id = ?", recordID)
		}
		if userID := c.Query("user_id"); userID != "" {
			query = query.Where("user_id = ?", userID)
		}
		if operation := c.Query("operation"); operation != "" {
			query = query.Where("operation = ?", operation)
		}

		if err := query.Order("created_at DESC").Find(&histories).Error; err != nil {
			c.JSON(500, gin.H{"error": "failed to fetch change history"})
			return
		}

		filename := fmt.Sprintf("change_history_%s.csv", time.Now().Format("20060102_150405"))
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

		// UTF-8 BOM (Excel対応)
		c.Writer.Write([]byte("\xef\xbb\xbf"))

		w := csv.NewWriter(c.Writer)
		w.Write([]string{"ID", "テーブル名", "レコードID", "ユーザーID", "操作", "変更前", "変更後", "日時"})

		for _, h := range histories {
			userIDStr := ""
			if h.UserID != nil {
				userIDStr = fmt.Sprintf("%d", *h.UserID)
			}
			w.Write([]string{
				fmt.Sprintf("%d", h.ID),
				h.TableName,
				h.RecordID,
				userIDStr,
				h.Operation,
				h.Before,
				h.After,
				h.CreatedAt.Format("2006-01-02 15:04:05"),
			})
		}
		w.Flush()
	})

	// 統計情報取得
	r.GET("/api/change-history/stats", func(c *gin.Context) {
		type Stats struct {
			TotalChanges int64 `json:"total_changes"`
			Creates      int64 `json:"creates"`
			Updates      int64 `json:"updates"`
			Deletes      int64 `json:"deletes"`
			UniqueUsers  int64 `json:"unique_users"`
			UniqueTables int64 `json:"unique_tables"`
		}

		var stats Stats
		db.Model(&ChangeHistory{}).Count(&stats.TotalChanges)
		db.Model(&ChangeHistory{}).Where("operation = ?", "create").Count(&stats.Creates)
		db.Model(&ChangeHistory{}).Where("operation = ?", "update").Count(&stats.Updates)
		db.Model(&ChangeHistory{}).Where("operation = ?", "delete").Count(&stats.Deletes)
		db.Model(&ChangeHistory{}).Distinct("user_id").Where("user_id IS NOT NULL").Count(&stats.UniqueUsers)
		db.Model(&ChangeHistory{}).Distinct("table_name").Count(&stats.UniqueTables)

		c.JSON(200, stats)
	})
}
