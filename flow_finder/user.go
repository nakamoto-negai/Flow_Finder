package main

import "gorm.io/gorm"

// Userモデル
// 他ファイルから使うために大文字でエクスポート
// gorm.ModelにはID, CreatedAt, UpdatedAt, DeletedAtが含まれる
type User struct {
	gorm.Model
	Name string `json:"name"`
}

// デフォルトユーザーを作成（存在しない場合）
func CreateDefaultUserIfNotExists(db *gorm.DB) error {
	var existingUser User
	result := db.First(&existingUser, 1)

	// ユーザーが存在しない場合のみ作成
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			defaultUser := User{
				Name: "デフォルトユーザー",
			}
			defaultUser.ID = 1 // 明示的にID=1を設定

			if err := db.Create(&defaultUser).Error; err != nil {
				return err
			}
		} else {
			return result.Error
		}
	}

	return nil
}
