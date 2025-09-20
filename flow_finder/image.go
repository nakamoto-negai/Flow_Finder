package main

import "gorm.io/gorm"

// 画像モデル: 順番(order)と対応するリンク(LinkID)を持つ
type Image struct {
	ID     uint   `gorm:"primaryKey" json:"id"`
	LinkID uint   `json:"link_id"` // 対応するリンクID
	Order  int    `json:"order"`   // 表示順
	URL    string `json:"url"`     // 画像URL

	// GORMリレーション
	Link Link `gorm:"foreignKey:LinkID"`
}

// マイグレーション用
func MigrateImage(db *gorm.DB) error {
	return db.AutoMigrate(&Image{})
}
