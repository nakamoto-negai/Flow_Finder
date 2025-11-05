package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Ginのモード設定（環境変数で制御）
	ginMode := os.Getenv("GIN_MODE")
	if ginMode == "" {
		ginMode = "debug" // デフォルトはdebugモード
	}
	gin.SetMode(ginMode)

	if ginMode == gin.ReleaseMode {
		fmt.Println("Ginリリースモードで起動中...")
	} else {
		fmt.Println("Ginデバッグモードで起動中...")
	}

	// 環境変数からDB接続情報を取得
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", dbHost, dbPort, dbUser, dbPassword, dbName)
	var db *gorm.DB
	var err error
	maxRetries := 120

	fmt.Printf("データベース接続を開始します: %s:%s\n", dbHost, dbPort)

	for i := 0; i < maxRetries; i++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			fmt.Println("✅ データベース接続成功")
			break
		}

		// 接続試行の詳細な情報をログ出力
		fmt.Printf("🔄 DB接続リトライ中... (%d/%d)\n", i+1, maxRetries)
		fmt.Printf("   エラー詳細: %v\n", err)

		// 指数バックオフ + 最大5秒の待機時間
		sleepDuration := time.Duration(2+i/10) * time.Second
		if sleepDuration > 5*time.Second {
			sleepDuration = 5 * time.Second
		}

		fmt.Printf("   %v秒後に再試行します...\n", sleepDuration.Seconds())
		time.Sleep(sleepDuration)
	}
	if err != nil {
		panic(fmt.Sprintf("GORM DB接続失敗: %v", err))
	}

	// GORMでテーブル自動作成（外部キー制約の依存関係順序: Field → Node → Link → Image → 独立テーブル）
	if err := db.AutoMigrate(&Field{}, &User{}, &Node{}, &Link{}, &Image{}, &UserLog{}, &TouristSpot{}, &UserFavoriteTouristSpot{}); err != nil {
		panic(fmt.Sprintf("AutoMigrate失敗: %v", err))
	}

	// お気に入りテーブルの複合インデックスを作成
	if err := MigrateUserFavoriteTouristSpot(db); err != nil {
		panic(fmt.Sprintf("UserFavoriteTouristSpot migration failed: %v", err))
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

	// ルーティングをセットアップ
	SetupRoutes(r, db, redisClient)

	// ログ関連APIを登録
	RegisterLogRoutes(r, db)

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
	// トークンをキーとして、ユーザーIDを値として保存
	return client.Set(ctx, fmt.Sprintf("auth_token:%s", token), fmt.Sprintf("%d", userID), ttl).Err()
}
