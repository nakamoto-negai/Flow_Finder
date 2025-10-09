package main

import (
	"gorm.io/gorm"
)

type Node struct {
	ID         uint    `gorm:"primaryKey" json:"id"`
	Name       string  `json:"name"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
	Congestion int     `json:"congestion"`
}

// GORMのAutoMigrateで利用可能
func MigrateNode(db *gorm.DB) error {
	return db.AutoMigrate(&Node{})
}
