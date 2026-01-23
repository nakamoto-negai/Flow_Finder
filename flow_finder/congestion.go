package main

import (
	"time"

	"gorm.io/gorm"
)

// 混雑記録モデル
type CongestionRecord struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	TouristSpotID uint      `gorm:"index;not null" json:"tourist_spot_id"`
	Level         int       `gorm:"not null" json:"level"` // 0-3
	RecordedAt    time.Time `gorm:"not null" json:"recorded_at"`
	Note          string    `json:"note"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// マイグレーション用
func MigrateCongestionRecord(db *gorm.DB) error {
	return db.AutoMigrate(&CongestionRecord{})
}

// 追加
func AddCongestionRecord(db *gorm.DB, spotID uint, level int, recordedAt time.Time, note string) (*CongestionRecord, error) {
	rec := &CongestionRecord{
		TouristSpotID: spotID,
		Level:         level,
		RecordedAt:    recordedAt,
		Note:          note,
	}
	if err := db.Create(rec).Error; err != nil {
		return nil, err
	}
	return rec, nil
}

// 指定観光地の混雑記録を取得（最新N件）
func GetCongestionRecords(db *gorm.DB, spotID uint, limit int) ([]CongestionRecord, error) {
	var recs []CongestionRecord
	if err := db.Where("tourist_spot_id = ?", spotID).Order("recorded_at DESC").Limit(limit).Find(&recs).Error; err != nil {
		return nil, err
	}
	return recs, nil
}
