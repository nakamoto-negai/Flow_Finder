package main

import (
	"time"
	"gorm.io/gorm"
)

// 画像モデル: アップロードされた画像情報を管理
type Image struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	OriginalName string    `json:"original_name"` // 元のファイル名
	FileName     string    `json:"file_name"`     // 保存時のファイル名
	FilePath     string    `json:"file_path"`     // ファイルパス
	FileSize     int64     `json:"file_size"`     // ファイルサイズ（バイト）
	FileHash     string    `json:"file_hash"`     // ファイルハッシュ（重複チェック用）
	MimeType     string    `json:"mime_type"`     // MIMEタイプ
	UploadedAt   time.Time `json:"uploaded_at"`   // アップロード日時
	URL          string    `gorm:"-" json:"url"`  // 画像URL（動的生成、DBには保存しない）
	
	// リンクとの関連（オプション）
	LinkID *uint `json:"link_id,omitempty"` // 対応するリンクID（nullable）
	Order  int   `json:"order"`             // 表示順

	// GORMリレーション
	Link *Link `gorm:"foreignKey:LinkID"`
}

// マイグレーション用
func MigrateImage(db *gorm.DB) error {
	return db.AutoMigrate(&Image{})
}
