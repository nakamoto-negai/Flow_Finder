package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// 環境変数からDB接続情報を取得
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", dbHost, dbPort, dbUser, dbPassword, dbName)
	var db *gorm.DB
	var err error
	maxRetries := 30
	for i := 0; i < maxRetries; i++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			break
		}
		fmt.Printf("DB接続リトライ中... (%d/%d): %v\n", i+1, maxRetries, err)
		time.Sleep(3 * time.Second)
	}
	if err != nil {
		panic(fmt.Sprintf("GORM DB接続失敗: %v", err))
	}

	// GORMでテーブル自動作成（User, Node, Link, Image, UserLog, TouristSpot）
	if err := db.AutoMigrate(&User{}, &Node{}, &Link{}, &Image{}, &UserLog{}, &TouristSpot{}); err != nil {
		panic(fmt.Sprintf("AutoMigrate失敗: %v", err))
	}

	// Redis接続情報
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "redis:6379"
	}
	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})
	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		panic(fmt.Sprintf("Redis接続失敗: %v", err))
	}

	r := gin.Default()
	
	// APIアクセスログミドルウェアを追加
	r.Use(APILoggingMiddleware(db))
	
	// CORSミドルウェア追加
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "X-User-Id", "X-Session-Id", "Authorization"},
		AllowCredentials: true,
	}))

	// アップロード画像の静的配信 (開発用)
	r.Static("/uploads", "uploads")

	// ログ関連APIを登録
	RegisterLogRoutes(r, db)

	// /upload API登録
	RegisterUploadRoute(r)

	// ユーザーAPIルーティングを別ファイルに分離（観光地APIも含む）
	RegisterUserRoutes(r, db, redisClient)

	// LinkListPage用: リンクと到達先観光地情報のAPI
	r.GET("/api/links/with-destinations", func(c *gin.Context) {
		var links []Link
		if err := db.Preload("FromNode").Preload("ToNode").Find(&links).Error; err != nil {
			c.JSON(500, gin.H{"error": "リンクデータ取得エラー"})
			return
		}

		var enrichedLinks []gin.H
		for _, link := range links {
			// 到達先ノード（ToNode）に関連する観光地を取得
			var toNodeTouristSpots []TouristSpot
			db.Where("node_id = ?", link.ToNodeID).Find(&toNodeTouristSpots)
			
			// 到達先ノードが観光地と関連付けられているかチェック
			var relatedTouristSpot *TouristSpot
			db.Where("id = ?", link.ToNode.TouristSpotID).First(&relatedTouristSpot)

			// リンク情報を構築
			linkInfo := gin.H{
				"id":          link.ID,
				"from_node":   link.FromNode.Name,
				"to_node":     link.ToNode.Name,
				"distance":    link.Distance,
				"label":       fmt.Sprintf("%s → %s (%.1fkm)", link.FromNode.Name, link.ToNode.Name, link.Distance/1000),
			}

			// 到達先の観光地情報を追加
			var destinations []gin.H
			
			// 1. ToNodeがメインノードになっている観光地
			for _, spot := range toNodeTouristSpots {
				destinations = append(destinations, gin.H{
					"id":             spot.ID,
					"name":           spot.Name,
					"category":       spot.Category,
					"current_count":  spot.CurrentCount,
					"max_capacity":   spot.MaxCapacity,
					"congestion_ratio": float64(spot.CurrentCount) / float64(spot.MaxCapacity) * 100,
					"is_open":        spot.IsOpen,
					"type":           "main_destination", // メイン目的地
				})
			}

			// 2. ToNodeが関連ノードとして設定されている観光地
			if relatedTouristSpot != nil && relatedTouristSpot.ID != 0 {
				destinations = append(destinations, gin.H{
					"id":             relatedTouristSpot.ID,
					"name":           relatedTouristSpot.Name,
					"category":       relatedTouristSpot.Category,
					"current_count":  relatedTouristSpot.CurrentCount,
					"max_capacity":   relatedTouristSpot.MaxCapacity,
					"congestion_ratio": float64(relatedTouristSpot.CurrentCount) / float64(relatedTouristSpot.MaxCapacity) * 100,
					"is_open":        relatedTouristSpot.IsOpen,
					"type":           "related_destination", // 関連目的地
				})
			}

			linkInfo["destinations"] = destinations
			linkInfo["has_tourist_destinations"] = len(destinations) > 0

			// 観光地情報を含むラベルの生成
			if len(destinations) > 0 {
				var destNames []string
				for _, dest := range destinations {
					destNames = append(destNames, dest["name"].(string))
				}
				linkInfo["enhanced_label"] = fmt.Sprintf("%s → %s (%.1fkm) 🏛️ %s", 
					link.FromNode.Name, link.ToNode.Name, link.Distance/1000, 
					fmt.Sprintf("観光地: %s", destNames[0]))
			} else {
				linkInfo["enhanced_label"] = linkInfo["label"]
			}

			enrichedLinks = append(enrichedLinks, linkInfo)
		}

		c.JSON(200, gin.H{
			"links": enrichedLinks,
			"total": len(enrichedLinks),
		})
	})

	r.Run() // デフォルトでlocalhost:8080
}

// ランダムなトークンを生成
func GenerateToken(n int) (string, error) {
	b := make([]byte, n)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// Redisにトークンを保存
func SaveTokenToRedis(ctx context.Context, client *redis.Client, userID uint, token string, ttl time.Duration) error {
	return client.Set(ctx, fmt.Sprintf("auth_token:%d", userID), token, ttl).Err()
}
