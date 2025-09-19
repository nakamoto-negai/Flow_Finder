package main

import "gorm.io/gorm"

type Link struct {
	ID         uint    `gorm:"primaryKey" json:"id"`
	FromNodeID uint    `json:"from_node_id"` // 出発点ノードID
	ToNodeID   uint    `json:"to_node_id"`   // 終着点ノードID
	Distance   float64 `json:"distance"`     // 距離（メートル等）

	// GORMのリレーション
	FromNode Node `gorm:"foreignKey:FromNodeID"`
	ToNode   Node `gorm:"foreignKey:ToNodeID"`
}

// マイグレーション用
func MigrateLink(db *gorm.DB) error {
	return db.AutoMigrate(&Link{})
}
