package main

import (
	"time"

	"gorm.io/gorm"
)

// ノード画像モデル: ノードに関連付けられた画像情報を管理
type NodeImage struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	OriginalName string    `json:"original_name"` // 元のファイル名
	FileName     string    `json:"file_name"`     // 保存時のファイル名
	FilePath     string    `json:"file_path"`     // ファイルパス
	FileSize     int64     `json:"file_size"`     // ファイルサイズ（バイト）
	FileHash     string    `json:"file_hash"`     // ファイルハッシュ（重複チェック用）
	MimeType     string    `json:"mime_type"`     // MIMEタイプ
	UploadedAt   time.Time `json:"uploaded_at"`   // アップロード日時
	URL          string    `gorm:"-" json:"url"`  // 画像URL（動的生成、DBには保存しない）

	// ノードとの関連
	NodeID uint `gorm:"not null;index" json:"node_id"` // 対応するノードID（必須）
	Order  int  `json:"order"`                         // 表示順

	// GORMリレーション
	Node *Node `gorm:"foreignKey:NodeID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// マイグレーション用
func MigrateNodeImage(db *gorm.DB) error {
	return db.AutoMigrate(&NodeImage{})
}
