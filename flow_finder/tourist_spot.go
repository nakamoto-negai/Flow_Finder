package main

import (
	"fmt"
	"math"
	"time"

	"gorm.io/gorm"
)

// 観光地モデル
type TouristSpot struct {
	ID              uint                 `gorm:"primaryKey" json:"id"`
	Name            string               `gorm:"not null" json:"name"`                                                        // 観光地名
	Description     string               `json:"description"`                                                                 // 説明
	Category        string               `json:"category"`                                                                    // 旧カテゴリ（後方互換性のため残す）
	CategoryID      *uint                `gorm:"index;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"category_id"`     // カテゴリID（外部キー）
	TouristCategory *TouristSpotCategory `gorm:"foreignKey:CategoryID;references:ID" json:"tourist_category,omitempty"`       // カテゴリとのリレーション
	NodeID          *uint                `gorm:"index;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"nearest_node_id"` // 最寄りノードID（外部キー）
	Node            *Node                `gorm:"foreignKey:NodeID;references:ID" json:"-"`                                    // ノードとのリレーション（JSONには含めない）
	DistanceToNode  float64              `json:"distance_to_nearest_node"`                                                    // 最寄りノードまでの距離（ピクセル）
	X               float64              `json:"x"`                                                                           // X座標
	Y               float64              `json:"y"`                                                                           // Y座標
	MaxCapacity     int                  `gorm:"not null;default:0" json:"max_capacity"`                                      // 許容人数
	CurrentCount    int                  `gorm:"default:0" json:"current_count"`                                              // 現在の人数
	WaitTime        int                  `gorm:"default:0" json:"wait_time"`                                                  // 待ち時間（分）
	IsOpen          bool                 `gorm:"default:true" json:"is_open"`                                                 // 営業中かどうか
	OpeningTime     string               `json:"opening_time"`                                                                // 開場時間 (例: "09:00")
	ClosingTime     string               `json:"closing_time"`                                                                // 閉場時間 (例: "18:00")
	EntryFee        int                  `json:"entry_fee"`                                                                   // 入場料（円）
	Website         string               `json:"website"`                                                                     // 公式サイト
	PhoneNumber     string               `json:"phone_number"`                                                                // 電話番号
	ImageURL        string               `json:"image_url"`                                                                   // 画像URL
	RewardURL       string               `json:"reward_url"`                                                                  // 特典ページURL
	Rating          float32              `gorm:"default:0.0" json:"rating"`                                                   // 評価（0.0-5.0）
	ReviewCount     int                  `gorm:"default:0" json:"review_count"`                                               // レビュー数
	LastUpdated     time.Time            `gorm:"autoUpdateTime" json:"last_updated"`                                          // 最終更新日時
	CreatedAt       time.Time            `json:"created_at"`
	UpdatedAt       time.Time            `json:"updated_at"`
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

// 来場者数を増加させる
func (ts *TouristSpot) IncrementVisitors(count int) error {
	if ts.CurrentCount+count > ts.MaxCapacity {
		return fmt.Errorf("許容人数を超過します（現在: %d, 増加: %d, 最大: %d）", ts.CurrentCount, count, ts.MaxCapacity)
	}
	ts.CurrentCount += count
	return nil
}

// 来場者数を減少させる
func (ts *TouristSpot) DecrementVisitors(count int) error {
	if ts.CurrentCount-count < 0 {
		return fmt.Errorf("現在の人数を下回ることはできません（現在: %d, 減少: %d）", ts.CurrentCount, count)
	}
	ts.CurrentCount -= count
	return nil
}

// データベースマイグレーション
func MigrateTouristSpot(db *gorm.DB) error {
	return db.AutoMigrate(&TouristSpot{})
}

// 観光地から最も近いノードを見つける関数
func (ts *TouristSpot) FindNearestNode(db *gorm.DB) (uint, error) {
	var nodes []Node
	if err := db.Find(&nodes).Error; err != nil {
		return 0, err
	}

	if len(nodes) == 0 {
		return 0, gorm.ErrRecordNotFound
	}

	var nearestNodeID uint
	minDistance := math.MaxFloat64

	for _, node := range nodes {
		// ハーバーサイン公式を使用して距離を計算
		distance := calculateDistance(ts.X, ts.Y, node.X, node.Y)
		if distance < minDistance {
			minDistance = distance
			nearestNodeID = node.ID
		}
	}

	return nearestNodeID, nil
}

// ユークリッド距離を使用して2点間の距離を計算（ピクセル単位）
func calculateDistance(x1, y1, x2, y2 float64) float64 {
	dx := x2 - x1
	dy := y2 - y1
	return math.Sqrt(dx*dx + dy*dy)
}
