package main

import (
	"time"
)

// 観光地カテゴリモデル
type TouristSpotCategory struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"not null;unique" json:"name"`    // カテゴリ名（神社・寺院、公園・自然など）
	Description  string    `json:"description"`                    // カテゴリの説明
	Icon         string    `json:"icon"`                           // アイコン（絵文字など）
	Color        string    `json:"color"`                          // カテゴリの表示色（HEXコード）
	DisplayOrder int       `gorm:"default:0" json:"display_order"` // 表示順序
	IsActive     bool      `gorm:"default:true" json:"is_active"`  // アクティブフラグ
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
