package main

import (
	"gorm.io/gorm"
)

type Node struct {
	ID            uint         `gorm:"primaryKey" json:"id"`
	Name          string       `json:"name"`
	Latitude      float64      `json:"latitude"`
	Longitude     float64      `json:"longitude"`
	Congestion    int          `json:"congestion"`                
	TouristSpotID *uint        `json:"tourist_spot_id"`        // 関連する観光地ID（1つのみ、nullable）
	TouristSpot   *TouristSpot `gorm:"foreignKey:TouristSpotID" json:"tourist_spot,omitempty"` // 関連する観光地
}

// GORMのAutoMigrateで利用可能
func MigrateNode(db *gorm.DB) error {
	return db.AutoMigrate(&Node{})
}
