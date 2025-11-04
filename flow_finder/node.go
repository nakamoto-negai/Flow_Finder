package main

import (
	"time"

	"gorm.io/gorm"
)

type Node struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Name       string    `json:"name"`
	X          float64   `json:"x"` // 画像上のX座標
	Y          float64   `json:"y"` // 画像上のY座標
	Congestion int       `json:"congestion"`
	Tourist    bool      `json:"tourist"`                                                              // 観光地フラグ
	FieldID    *uint     `gorm:"index;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"field_id"` // 所属フィールド
	Field      *Field    `gorm:"foreignKey:FieldID;references:ID" json:"field,omitempty"`              // フィールドとのリレーション
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	// TouristSpotsは含めない（循環参照回避、データベース設計の改善）
}

// GORMのAutoMigrateで利用可能
func MigrateNode(db *gorm.DB) error {
	return db.AutoMigrate(&Node{})
}
