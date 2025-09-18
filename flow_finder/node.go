package main

import (
	"gorm.io/gorm"
)

type Node struct {
	ID         uint    `gorm:"primaryKey" json:"id"`
	Name       string  `json:"name"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
	Congestion int     `json:"congestion"` // 混雑度（例: 0=空いてる, 1=普通, 2=混雑）
	Tourist    bool    `json:"tourist"`    // 観光地フラグ
}

// GORMのAutoMigrateで利用可能
func MigrateNode(db *gorm.DB) error {
	return db.AutoMigrate(&Node{})
}
