package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// セッションIDを生成する関数
func generateLoggerSessionID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// ログ記録のヘルパー関数
func LogUserActivity(db *gorm.DB, log UserLog) {
	// バックグラウンドでログを保存（非同期）
	go func() {
		if err := db.Create(&log).Error; err != nil {
			fmt.Printf("ログ保存エラー: %v\n", err)
		}
	}()
}

// データベース操作のログを記録する関数
func LogDatabaseOperation(db *gorm.DB, userID *uint, sessionID, operation, table, recordID string, c *gin.Context) {
	// データを構造化されたJSONとして保存
	dataMap := map[string]string{
		"operation": operation,
		"table":     table,
		"record_id": recordID,
	}
	dataJSON, _ := json.Marshal(dataMap)
	
	log := UserLog{
		UserID:    userID,
		SessionID: sessionID,
		LogType:   LogTypeAction,
		Category:  CategoryData,
		Action:    ActionCreate, // デフォルトは作成操作
		Path:      c.Request.URL.Path,
		Method:    c.Request.Method,
		UserAgent: c.Request.UserAgent(),
		IPAddress: c.ClientIP(),
		Data:      string(dataJSON),
	}
	
	// 操作タイプに応じてアクションを設定
	switch operation {
	case "create":
		log.Action = ActionCreate
	case "update":
		log.Action = ActionUpdate
	case "delete":
		log.Action = ActionDelete
	default:
		log.Action = ActionCreate
	}
	
	LogUserActivity(db, log)
}

// APIアクセスログを記録するミドルウェア
func APILoggingMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// ログ関連のAPIエンドポイントは記録しない（無限ループを防ぐため）
		if strings.HasPrefix(c.Request.URL.Path, "/api/logs") {
			c.Next()
			return
		}
		
		// 静的ファイルのリクエストもスキップ
		if strings.HasPrefix(c.Request.URL.Path, "/uploads") || 
		   strings.HasPrefix(c.Request.URL.Path, "/static") ||
		   strings.HasPrefix(c.Request.URL.Path, "/favicon") {
			c.Next()
			return
		}
		
		start := time.Now()
		
		// リクエスト処理を実行
		c.Next()
		
		// レスポンス時間を計算
		duration := time.Since(start).Milliseconds()
		
		// エラーがある場合のみログ記録（成功したAPIコールは記録しない）
		if c.Writer.Status() >= 400 {
			// ユーザーIDを取得（認証ミドルウェア通過後の場合）
			var userID *uint = nil
			if userIdStr := c.GetHeader("X-User-Id"); userIdStr != "" {
				if id, err := strconv.Atoi(userIdStr); err == nil && id > 0 {
					userId := uint(id)
					userID = &userId
				}
			}
			
			// セッションIDを取得または生成
			sessionID := c.GetHeader("X-Session-Id")
			if sessionID == "" {
				sessionID = generateLoggerSessionID()
			}
			
			// エラーログのみ記録
			log := UserLog{
				UserID:    userID,
				SessionID: sessionID,
				LogType:   LogTypeError,
				Category:  CategorySystem,
				Action:    ActionError,
				Path:      c.Request.URL.Path,
				Method:    c.Request.Method,
				UserAgent: c.Request.UserAgent(),
				IPAddress: c.ClientIP(),
				Duration:  duration,
				Error:     fmt.Sprintf("HTTP %d", c.Writer.Status()),
			}
			
			// ログを保存
			LogUserActivity(db, log)
		}
	}
}

// ログ記録用のAPIエンドポイントを登録
func RegisterLogRoutes(r *gin.Engine, db *gorm.DB) {
	// フロントエンドからのログ送信エンドポイント
	r.POST("/api/logs", func(c *gin.Context) {
		var req struct {
			UserID    uint   `json:"user_id"`
			SessionID string `json:"session_id"`
			LogType   string `json:"log_type"`
			Category  string `json:"category"`
			Action    string `json:"action"`
			Path      string `json:"path"`
			Duration  int64  `json:"duration"`
			Data      string `json:"data"`
			Referrer  string `json:"referrer"`
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "invalid request"})
			return
		}
		
		// セッションIDが空の場合は生成
		if req.SessionID == "" {
			req.SessionID = generateLoggerSessionID()
		}
		
		// ユーザーIDをポインター型に変換
		var userID *uint = nil
		if req.UserID > 0 {
			userID = &req.UserID
		}
		
		log := UserLog{
			UserID:    userID,
			SessionID: req.SessionID,
			LogType:   req.LogType,
			Category:  req.Category,
			Action:    req.Action,
			Path:      req.Path,
			UserAgent: c.Request.UserAgent(),
			IPAddress: c.ClientIP(),
			Duration:  req.Duration,
			Data:      req.Data,
			Referrer:  req.Referrer,
		}
		
		if err := db.Create(&log).Error; err != nil {
			c.JSON(500, gin.H{"error": "failed to save log"})
			return
		}
		
		c.JSON(200, gin.H{"result": "ok", "session_id": req.SessionID})
	})
	
	// ログ一覧取得（管理者向け）
	r.GET("/api/logs", func(c *gin.Context) {
		var logs []UserLog
		query := db.Model(&UserLog{})
		
		// クエリパラメータでフィルタリング
		if userID := c.Query("user_id"); userID != "" {
			query = query.Where("user_id = ?", userID)
		}
		if logType := c.Query("log_type"); logType != "" {
			query = query.Where("log_type = ?", logType)
		}
		if category := c.Query("category"); category != "" {
			query = query.Where("category = ?", category)
		}
		if dateFrom := c.Query("date_from"); dateFrom != "" {
			query = query.Where("created_at >= ?", dateFrom)
		}
		if dateTo := c.Query("date_to"); dateTo != "" {
			query = query.Where("created_at <= ?", dateTo)
		}
		
		// ページネーション
		page := 1
		limit := 100
		if p := c.Query("page"); p != "" {
			if pageNum, err := strconv.Atoi(p); err == nil && pageNum > 0 {
				page = pageNum
			}
		}
		if l := c.Query("limit"); l != "" {
			if limitNum, err := strconv.Atoi(l); err == nil && limitNum > 0 && limitNum <= 1000 {
				limit = limitNum
			}
		}
		
		offset := (page - 1) * limit
		
		if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&logs).Error; err != nil {
			c.JSON(500, gin.H{"error": "failed to fetch logs"})
			return
		}
		
		// 総件数を取得
		var total int64
		db.Model(&UserLog{}).Count(&total)
		
		c.JSON(200, gin.H{
			"logs":  logs,
			"page":  page,
			"limit": limit,
			"total": total,
		})
	})
	
	// ログ統計情報取得（管理者向け）
	r.GET("/api/logs/stats", func(c *gin.Context) {
		var stats struct {
			TotalLogs       int64 `json:"total_logs"`
			UniqueUsers     int64 `json:"unique_users"`
			UniqueSessions  int64 `json:"unique_sessions"`
			PageViews       int64 `json:"page_views"`
			Actions         int64 `json:"actions"`
			APIRequests     int64 `json:"api_requests"`
			Errors          int64 `json:"errors"`
		}
		
		// 基本統計
		db.Model(&UserLog{}).Count(&stats.TotalLogs)
		db.Model(&UserLog{}).Distinct("user_id").Where("user_id IS NOT NULL").Count(&stats.UniqueUsers)
		db.Model(&UserLog{}).Distinct("session_id").Count(&stats.UniqueSessions)
		
		// ログタイプ別統計
		db.Model(&UserLog{}).Where("log_type = ?", LogTypePageView).Count(&stats.PageViews)
		db.Model(&UserLog{}).Where("log_type = ?", LogTypeAction).Count(&stats.Actions)
		db.Model(&UserLog{}).Where("log_type = ?", LogTypeAPICall).Count(&stats.APIRequests)
		db.Model(&UserLog{}).Where("log_type = ?", LogTypeError).Count(&stats.Errors)
		
		c.JSON(200, stats)
	})
	
	// 人気ページランキング
	r.GET("/api/logs/popular-pages", func(c *gin.Context) {
		type PopularPage struct {
			Path  string `json:"path"`
			Count int64  `json:"count"`
		}
		
		var pages []PopularPage
		if err := db.Model(&UserLog{}).
			Select("path, COUNT(*) as count").
			Where("log_type = ?", LogTypePageView).
			Group("path").
			Order("count DESC").
			Limit(10).
			Scan(&pages).Error; err != nil {
			c.JSON(500, gin.H{"error": "failed to fetch popular pages"})
			return
		}
		
		c.JSON(200, pages)
	})
	
	// ユーザーアクティビティのタイムライン
	r.GET("/api/logs/timeline", func(c *gin.Context) {
		userID := c.Query("user_id")
		sessionID := c.Query("session_id")
		
		if userID == "" && sessionID == "" {
			c.JSON(400, gin.H{"error": "user_id or session_id required"})
			return
		}
		
		var logs []UserLog
		query := db.Model(&UserLog{})
		
		if userID != "" {
			query = query.Where("user_id = ?", userID)
		}
		if sessionID != "" {
			query = query.Where("session_id = ?", sessionID)
		}
		
		if err := query.Order("created_at ASC").Find(&logs).Error; err != nil {
			c.JSON(500, gin.H{"error": "failed to fetch timeline"})
			return
		}
		
		c.JSON(200, logs)
	})
}