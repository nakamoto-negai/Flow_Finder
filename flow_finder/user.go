package main

import "gorm.io/gorm"

// Userモデル
// 他ファイルから使うために大文字でエクスポート
// gorm.ModelにはID, CreatedAt, UpdatedAt, DeletedAtが含まれる
 type User struct {
    gorm.Model
    Name string `json:"name"`
}
