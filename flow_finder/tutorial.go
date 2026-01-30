package main

import (
	"time"

	"gorm.io/gorm"
)

// チュートリアル（説明画像）モデル: アプリの説明用チュートリアル画像を管理
type Tutorial struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Title       string    `gorm:"not null" json:"title"`             // チュートリアルのタイトル
	Description string    `json:"description"`                       // 説明文
	ImagePath   string    `gorm:"not null" json:"image_path"`        // 画像ファイルパス
	FileName    string    `json:"file_name"`                         // 保存時のファイル名
	FileHash    string    `json:"file_hash"`                         // ファイルハッシュ（重複チェック用）
	MimeType    string    `json:"mime_type"`                         // MIMEタイプ
	Order       int       `gorm:"default:0" json:"order"`            // 表示順
	IsActive    bool      `gorm:"default:true" json:"is_active"`     // 有効フラグ
	Category    string    `gorm:"default:'general'" json:"category"` // チュートリアルのカテゴリ（node, link, field など）
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	URL         string    `gorm:"-" json:"url"` // チュートリアル画像URL（動的生成、DBには保存しない）
}

// マイグレーション用
func MigrateTutorial(db *gorm.DB) error {
	return db.AutoMigrate(&Tutorial{})
}

// アクティブなチュートリアルを全て取得
func GetActiveTutorials(db *gorm.DB) ([]Tutorial, error) {
	var tutorials []Tutorial
	err := db.Where("is_active = ?", true).Order("\"order\" ASC").Find(&tutorials).Error
	return tutorials, err
}

// カテゴリ別にアクティブなチュートリアルを取得
func GetTutorialsByCategory(db *gorm.DB, category string) ([]Tutorial, error) {
	var tutorials []Tutorial
	err := db.Where("is_active = ? AND category = ?", true, category).Order("\"order\" ASC").Find(&tutorials).Error
	return tutorials, err
}

// チュートリアルを有効化
func (t *Tutorial) Activate(db *gorm.DB) error {
	t.IsActive = true
	return db.Save(t).Error
}

// チュートリアルを無効化
func (t *Tutorial) Deactivate(db *gorm.DB) error {
	t.IsActive = false
	return db.Save(t).Error
}

// 表示順を更新
func (t *Tutorial) UpdateOrder(db *gorm.DB, newOrder int) error {
	t.Order = newOrder
	return db.Save(t).Error
}
