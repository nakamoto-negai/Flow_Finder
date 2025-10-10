package main

import (
	"time"
	"gorm.io/gorm"
)

type Node struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Name       string    `json:"name"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	Congestion int       `json:"congestion"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	// TouristSpotsは含めない（循環参照回避、データベース設計の改善）
}

// GORMのAutoMigrateで利用可能
func MigrateNode(db *gorm.DB) error {
	return db.AutoMigrate(&Node{})
}
