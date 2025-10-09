package main

import (
	"time"
	"gorm.io/gorm"
)

// 観光地モデル
type TouristSpot struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Name          string    `gorm:"not null" json:"name"`                             // 観光地名
	Description   string    `json:"description"`                                      // 説明
	Category      string    `json:"category"`                                         // カテゴリ（神社、公園、博物館など）
	MaxCapacity   int       `gorm:"not null;default:0" json:"max_capacity"`           // 許容人数
	CurrentCount  int       `gorm:"default:0" json:"current_count"`                   // 現在の人数
	IsOpen        bool      `gorm:"default:true" json:"is_open"`                      // 営業中かどうか
	OpeningTime   string    `json:"opening_time"`                                     // 開場時間 (例: "09:00")
	ClosingTime   string    `json:"closing_time"`                                     // 閉場時間 (例: "18:00")
	EntryFee      int       `json:"entry_fee"`                                        // 入場料（円）
	Website       string    `json:"website"`                                          // 公式サイト
	PhoneNumber   string    `json:"phone_number"`                                     // 電話番号
	ImageURL      string    `json:"image_url"`                                        // 画像URL
	Rating        float32   `gorm:"default:0.0" json:"rating"`                        // 評価（0.0-5.0）
	ReviewCount   int       `gorm:"default:0" json:"review_count"`                    // レビュー数
	LastUpdated   time.Time `gorm:"autoUpdateTime" json:"last_updated"`               // 最終更新日時
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// 混雑状況を計算するメソッド
func (ts *TouristSpot) GetCongestionLevel() string {
	if ts.MaxCapacity == 0 {
		return "不明"
	}
	
	ratio := float64(ts.CurrentCount) / float64(ts.MaxCapacity)
	
	switch {
	case ratio >= 1.0:
		return "満員"
	case ratio >= 0.8:
		return "非常に混雑"
	case ratio >= 0.6:
		return "混雑"
	case ratio >= 0.4:
		return "普通"
	case ratio >= 0.2:
		return "少し空いている"
	default:
		return "空いている"
	}
}

// 混雑率を取得するメソッド（パーセンテージ）
func (ts *TouristSpot) GetCongestionRatio() float64 {
	if ts.MaxCapacity == 0 {
		return 0.0
	}
	return float64(ts.CurrentCount) / float64(ts.MaxCapacity) * 100
}

// 営業中かどうかを確認するメソッド
func (ts *TouristSpot) IsCurrentlyOpen() bool {
	if !ts.IsOpen {
		return false
	}
	
	if ts.OpeningTime == "" || ts.ClosingTime == "" {
		return ts.IsOpen
	}
	
	now := time.Now()
	currentTime := now.Format("15:04")
	
	return currentTime >= ts.OpeningTime && currentTime <= ts.ClosingTime
}

// 人数を増加させるメソッド
func (ts *TouristSpot) AddVisitors(count int) bool {
	if ts.CurrentCount+count > ts.MaxCapacity {
		return false // 許容人数を超える場合は追加不可
	}
	ts.CurrentCount += count
	return true
}

// 人数を減少させるメソッド
func (ts *TouristSpot) RemoveVisitors(count int) {
	ts.CurrentCount -= count
	if ts.CurrentCount < 0 {
		ts.CurrentCount = 0
	}
}

// データベースマイグレーション
func MigrateTouristSpot(db *gorm.DB) error {
	return db.AutoMigrate(&TouristSpot{})
}