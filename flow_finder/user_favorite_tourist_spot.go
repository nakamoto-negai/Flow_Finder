package main

import (
	"time"

	"gorm.io/gorm"
)

// ユーザーのお気に入り観光地を管理するモデル
type UserFavoriteTouristSpot struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	UserID         uint      `gorm:"not null;index" json:"user_id"`                                      // ユーザーID（外部キー）
	TouristSpotID  uint      `gorm:"not null;index" json:"tourist_spot_id"`                             // 観光地ID（外部キー）
	User           User      `gorm:"foreignKey:UserID;references:ID" json:"-"`                          // ユーザーとのリレーション
	TouristSpot    TouristSpot `gorm:"foreignKey:TouristSpotID;references:ID" json:"tourist_spot"`     // 観光地とのリレーション
	AddedAt        time.Time `gorm:"autoCreateTime" json:"added_at"`                                    // お気に入りに追加した日時
	Notes          string    `json:"notes"`                                                             // ユーザーのメモ（オプション）
	Priority       int       `gorm:"default:0" json:"priority"`                                         // 優先度（0-5、0が最低）
	VisitStatus    string    `gorm:"default:'未訪問'" json:"visit_status"`                              // 訪問状況（未訪問、訪問済み、訪問予定）
	VisitDate      *time.Time `json:"visit_date"`                                                      // 訪問予定日または訪問日
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// 複合ユニークインデックス（ユーザーID + 観光地ID）
// 同じユーザーが同じ観光地を重複してお気に入りに追加することを防ぐ
func (UserFavoriteTouristSpot) TableName() string {
	return "user_favorite_tourist_spots"
}

// データベースマイグレーション
func MigrateUserFavoriteTouristSpot(db *gorm.DB) error {
	err := db.AutoMigrate(&UserFavoriteTouristSpot{})
	if err != nil {
		return err
	}

	// 複合ユニークインデックスを作成
	return db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tourist_spot_unique 
		ON user_favorite_tourist_spots(user_id, tourist_spot_id)
	`).Error
}

// お気に入り観光地のレスポンス用構造体（詳細情報付き）
type FavoriteTouristSpotResponse struct {
	ID            uint        `json:"id"`
	UserID        uint        `json:"user_id"`
	TouristSpotID uint        `json:"tourist_spot_id"`
	TouristSpot   TouristSpot `json:"tourist_spot"`
	AddedAt       time.Time   `json:"added_at"`
	Notes         string      `json:"notes"`
	Priority      int         `json:"priority"`
	VisitStatus   string      `json:"visit_status"`
	VisitDate     *time.Time  `json:"visit_date"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}

// お気に入り観光地を取得（観光地詳細情報付き）
func GetUserFavoriteTouristSpots(db *gorm.DB, userID uint) ([]FavoriteTouristSpotResponse, error) {
	var favorites []UserFavoriteTouristSpot
	
	// 観光地情報も一緒に取得
	err := db.Preload("TouristSpot").Where("user_id = ?", userID).Order("priority DESC, added_at DESC").Find(&favorites).Error
	if err != nil {
		return nil, err
	}

	// レスポンス用構造体に変換
	var response []FavoriteTouristSpotResponse
	for _, fav := range favorites {
		response = append(response, FavoriteTouristSpotResponse{
			ID:            fav.ID,
			UserID:        fav.UserID,
			TouristSpotID: fav.TouristSpotID,
			TouristSpot:   fav.TouristSpot,
			AddedAt:       fav.AddedAt,
			Notes:         fav.Notes,
			Priority:      fav.Priority,
			VisitStatus:   fav.VisitStatus,
			VisitDate:     fav.VisitDate,
			CreatedAt:     fav.CreatedAt,
			UpdatedAt:     fav.UpdatedAt,
		})
	}

	return response, nil
}

// お気に入りに追加
func AddToFavorites(db *gorm.DB, userID, touristSpotID uint) (*UserFavoriteTouristSpot, error) {
	// 既にお気に入りに追加されているかチェック
	var existing UserFavoriteTouristSpot
	if err := db.Where("user_id = ? AND tourist_spot_id = ?", userID, touristSpotID).First(&existing).Error; err == nil {
		return nil, gorm.ErrDuplicatedKey
	}

	favorite := UserFavoriteTouristSpot{
		UserID:        userID,
		TouristSpotID: touristSpotID,
		VisitStatus:   "未訪問",
	}

	if err := db.Create(&favorite).Error; err != nil {
		return nil, err
	}

	return &favorite, nil
}

// お気に入りから削除
func RemoveFromFavorites(db *gorm.DB, userID, touristSpotID uint) error {
	return db.Where("user_id = ? AND tourist_spot_id = ?", userID, touristSpotID).Delete(&UserFavoriteTouristSpot{}).Error
}

// お気に入り状態をチェック
func IsFavorite(db *gorm.DB, userID, touristSpotID uint) (bool, error) {
	var count int64
	err := db.Model(&UserFavoriteTouristSpot{}).Where("user_id = ? AND tourist_spot_id = ?", userID, touristSpotID).Count(&count).Error
	return count > 0, err
}

// お気に入りの詳細を更新（メモ、優先度、訪問状況など）
func UpdateFavoriteDetails(db *gorm.DB, userID, touristSpotID uint, updates map[string]interface{}) error {
	return db.Model(&UserFavoriteTouristSpot{}).
		Where("user_id = ? AND tourist_spot_id = ?", userID, touristSpotID).
		Updates(updates).Error
}

// 優先度別にお気に入り観光地を取得
func GetFavoritesByPriority(db *gorm.DB, userID uint, priority int) ([]FavoriteTouristSpotResponse, error) {
	var favorites []UserFavoriteTouristSpot
	
	err := db.Preload("TouristSpot").Where("user_id = ? AND priority = ?", userID, priority).Order("added_at DESC").Find(&favorites).Error
	if err != nil {
		return nil, err
	}

	var response []FavoriteTouristSpotResponse
	for _, fav := range favorites {
		response = append(response, FavoriteTouristSpotResponse{
			ID:            fav.ID,
			UserID:        fav.UserID,
			TouristSpotID: fav.TouristSpotID,
			TouristSpot:   fav.TouristSpot,
			AddedAt:       fav.AddedAt,
			Notes:         fav.Notes,
			Priority:      fav.Priority,
			VisitStatus:   fav.VisitStatus,
			VisitDate:     fav.VisitDate,
			CreatedAt:     fav.CreatedAt,
			UpdatedAt:     fav.UpdatedAt,
		})
	}

	return response, nil
}

// 訪問状況別にお気に入り観光地を取得
func GetFavoritesByVisitStatus(db *gorm.DB, userID uint, visitStatus string) ([]FavoriteTouristSpotResponse, error) {
	var favorites []UserFavoriteTouristSpot
	
	err := db.Preload("TouristSpot").Where("user_id = ? AND visit_status = ?", userID, visitStatus).Order("added_at DESC").Find(&favorites).Error
	if err != nil {
		return nil, err
	}

	var response []FavoriteTouristSpotResponse
	for _, fav := range favorites {
		response = append(response, FavoriteTouristSpotResponse{
			ID:            fav.ID,
			UserID:        fav.UserID,
			TouristSpotID: fav.TouristSpotID,
			TouristSpot:   fav.TouristSpot,
			AddedAt:       fav.AddedAt,
			Notes:         fav.Notes,
			Priority:      fav.Priority,
			VisitStatus:   fav.VisitStatus,
			VisitDate:     fav.VisitDate,
			CreatedAt:     fav.CreatedAt,
			UpdatedAt:     fav.UpdatedAt,
		})
	}

	return response, nil
}