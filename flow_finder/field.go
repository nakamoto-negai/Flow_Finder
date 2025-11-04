package main

import (
	"time"

	"gorm.io/gorm"
)

// フィールド（マップ画像）モデル
type Field struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"not null" json:"name"`               // フィールド名
	Description string    `json:"description"`                        // 説明
	ImagePath   string    `gorm:"not null" json:"image_path"`         // 画像ファイルパス
	ImageURL    string    `json:"image_url"`                          // 画像URL（フロントエンド用）
	Width       int       `gorm:"not null;default:800" json:"width"`  // 画像幅（ピクセル）
	Height      int       `gorm:"not null;default:600" json:"height"` // 画像高（ピクセル）
	IsActive    bool      `gorm:"default:true" json:"is_active"`      // アクティブフラグ
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// GORMのAutoMigrateで利用可能
func MigrateField(db *gorm.DB) error {
	return db.AutoMigrate(&Field{})
}

// アクティブなフィールドを取得
func GetActiveField(db *gorm.DB) (*Field, error) {
	var field Field
	err := db.Where("is_active = ?", true).First(&field).Error
	if err != nil {
		return nil, err
	}
	return &field, nil
}

// フィールドをアクティブに設定（他のフィールドは非アクティブに）
func (f *Field) SetActive(db *gorm.DB) error {
	// 既存のアクティブフィールドを全て非アクティブにする
	if err := db.Model(&Field{}).Where("is_active = ?", true).Update("is_active", false).Error; err != nil {
		return err
	}

	// このフィールドをアクティブにする
	f.IsActive = true
	return db.Save(f).Error
}
