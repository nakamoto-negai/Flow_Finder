package main

import (
	"time"
	"gorm.io/gorm"
)

// UserLogモデル - ユーザーの利用ログを記録
type UserLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    *uint     `json:"user_id"`              // ユーザーID (nullの場合は未認証ユーザー)
	SessionID string    `json:"session_id"`           // セッションID
	LogType   string    `json:"log_type"`             // ログの種類 (page_view, action, api_call, error)
	Category  string    `json:"category"`             // カテゴリ (auth, navigation, interaction, etc.)
	Action    string    `json:"action"`               // 具体的なアクション名
	Path      string    `json:"path"`                 // ページパスやAPIエンドポイント
	Method    string    `json:"method,omitempty"`     // HTTPメソッド (API呼び出しの場合)
	UserAgent string    `json:"user_agent,omitempty"` // ユーザーエージェント
	IPAddress string    `json:"ip_address,omitempty"` // IPアドレス
	Referrer  string    `json:"referrer,omitempty"`   // 参照元URL
	Duration  int64     `json:"duration,omitempty"`   // 滞在時間やレスポンス時間 (ミリ秒)
	Data      string    `json:"data,omitempty"`       // 追加データ (JSON形式)
	Error     string    `json:"error,omitempty"`      // エラー情報
	CreatedAt time.Time `json:"created_at"`
}

// マイグレーション用
func MigrateUserLog(db *gorm.DB) error {
	return db.AutoMigrate(&UserLog{})
}

// ログ種別の定数
const (
	LogTypePageView = "page_view"  // ページ表示
	LogTypeAction   = "action"     // ユーザーアクション
	LogTypeAPICall  = "api_call"   // API呼び出し
	LogTypeError    = "error"      // エラー
)

// カテゴリの定数
const (
	CategoryAuth        = "auth"        // 認証関連
	CategoryNavigation  = "navigation"  // ページ遷移
	CategoryInteraction = "interaction" // ユーザーとの相互作用
	CategorySystem      = "system"      // システム関連
	CategoryMap         = "map"         // 地図関連
	CategoryUpload      = "upload"      // ファイルアップロード
	CategoryData        = "data"        // データベース操作
)

// アクション名の定数
const (
	ActionLogin         = "login"
	ActionLogout        = "logout"
	ActionPageView      = "page_view"
	ActionNodeSelect    = "node_select"
	ActionLinkView      = "link_view"
	ActionLinkMove      = "link_move"
	ActionImageView     = "image_view"
	ActionMapInteract   = "map_interact"
	ActionFormSubmit    = "form_submit"
	ActionAPIRequest    = "api_request"
	ActionError         = "error"
	ActionCreate        = "create"       // データ作成
	ActionUpdate        = "update"       // データ更新
	ActionDelete        = "delete"       // データ削除
)