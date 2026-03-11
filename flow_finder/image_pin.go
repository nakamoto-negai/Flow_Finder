package main

import (
	"time"
)

// ImagePin: NodeImage上の指定座標にLinkへのピンを配置するモデル
type ImagePin struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	NodeImageID uint       `gorm:"not null;index" json:"node_image_id"` // 対応するNodeImageID
	LinkID      uint       `gorm:"not null;index" json:"link_id"`       // 対応するLinkID
	X           float64    `json:"x"`                                   // 画像上のX座標（%: 0-100）
	Y           float64    `json:"y"`                                   // 画像上のY座標（%: 0-100）
	Label       string     `json:"label"`                               // 任意ラベル

	// GORMリレーション
	NodeImage *NodeImage `gorm:"foreignKey:NodeImageID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"node_image,omitempty"`
	Link      *Link      `gorm:"foreignKey:LinkID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"link,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
