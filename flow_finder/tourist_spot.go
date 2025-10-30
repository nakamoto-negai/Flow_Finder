package main

import (
	"fmt"
	"time"
	"math"
	"gorm.io/gorm"
)

// 観光地モデル
type TouristSpot struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Name          string    `gorm:"not null" json:"name"`                             // 観光地名
	Description   string    `json:"description"`                                      // 説明
	Category      string    `json:"category"`                                         // カテゴリ（神社、公園、博物館など）
	NodeID        *uint     `gorm:"index;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"nearest_node_id"`  // 最寄りノードID（外部キー）
	Node          *Node     `gorm:"foreignKey:NodeID;references:ID" json:"-"`                                    // ノードとのリレーション（JSONには含めない）
	DistanceToNode float64  `json:"distance_to_nearest_node"`                                                   // 最寄りノードまでの距離（メートル）
	Latitude      float64   `json:"latitude"`                                         // 緯度
	Longitude     float64   `json:"longitude"`                                        // 経度
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

// 来場者数を増加させる
func (ts *TouristSpot) IncrementVisitors(count int) error {
	if ts.CurrentCount + count > ts.MaxCapacity {
		return fmt.Errorf("許容人数を超過します（現在: %d, 増加: %d, 最大: %d）", ts.CurrentCount, count, ts.MaxCapacity)
	}
	ts.CurrentCount += count
	return nil
}

// 来場者数を減少させる
func (ts *TouristSpot) DecrementVisitors(count int) error {
	if ts.CurrentCount - count < 0 {
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
		distance := calculateDistance(ts.Latitude, ts.Longitude, node.Latitude, node.Longitude)
		if distance < minDistance {
			minDistance = distance
			nearestNodeID = node.ID
		}
	}

	return nearestNodeID, nil
}

// ハーバーサイン公式を使用して2点間の距離を計算（メートル単位）
func calculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371000 // 地球の半径（メートル）

	// ラジアンに変換
	lat1Rad := lat1 * math.Pi / 180
	lon1Rad := lon1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	lon2Rad := lon2 * math.Pi / 180

	deltaLat := lat2Rad - lat1Rad
	deltaLon := lon2Rad - lon1Rad

	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
		math.Sin(deltaLon/2)*math.Sin(deltaLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadius * c
}