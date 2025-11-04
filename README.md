# Flow Finder

観光地管理システム - ユーザーが気になる観光地を管理できるWebアプリケーション

## 🚀 機能

### 🗺️ **マップ機能**
- インタラクティブな地図表示
- ノード（地点）とリンク（経路）の管理
- 経路探索（ダイクストラ法）

### 🏛️ **観光地管理**
- 観光地の作成・編集・削除
- 画像アップロード機能
- 混雑状況の管理
- 営業時間・入場料などの詳細情報

### 💖 **お気に入り機能**
- 観光地をお気に入りに追加/削除
- 優先度設定（5段階）
- 訪問状況管理（未訪問/訪問予定/訪問済み）
- 個人メモ機能
- 統計情報表示

### ⚙️ **管理機能**
- フィールド（背景画像）管理
- ノード管理
- リンク管理
- 画像管理
- ログ表示

## 🛠️ 技術スタック

### バックエンド
- **Go** - メインプログラミング言語
- **Gin** - Webフレームワーク
- **GORM** - ORM
- **PostgreSQL** - データベース
- **Redis** - セッション管理

### フロントエンド
- **React** - UIライブラリ
- **TypeScript** - 型安全性
- **Vite** - ビルドツール

### インフラ
- **Docker** - コンテナ化
- **Docker Compose** - オーケストレーション

## 🚀 起動方法

### 開発環境（デバッグモード）

```bash
# リポジトリをクローン
git clone https://github.com/nakamoto-negai/Flow_Finder.git
cd Flow_Finder

# 開発環境で起動（Ginデバッグモード）
docker-compose up --build
```

### 本番環境（リリースモード）

```bash
# 本番環境で起動（Ginリリースモード）
docker-compose -f docker-compose.prod.yml up --build -d
```

## 📱 アクセス方法

起動後、以下のURLにアクセスしてください：

- **メインアプリ**: http://localhost:5173
- **API**: http://localhost:8080
- **管理画面**: http://localhost:5173/admin
- **お気に入り**: http://localhost:5173/favorites
- **経路探索**: http://localhost:5173/dijkstra

## 🔧 環境変数

### 開発環境
```bash
GIN_MODE=debug
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=postgres
REDIS_ADDR=redis:6379
```

### 本番環境
```bash
GIN_MODE=release
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=postgres
REDIS_ADDR=redis:6379
```

## 📊 API エンドポイント

### 認証
- `POST /login` - ログイン
- `POST /logout` - ログアウト

### ユーザー
- `GET /users` - ユーザー一覧
- `POST /users` - ユーザー作成

### 観光地
- `GET /tourist-spots` - 観光地一覧
- `POST /tourist-spots` - 観光地作成
- `PUT /tourist-spots/:id` - 観光地更新
- `DELETE /tourist-spots/:id` - 観光地削除

### お気に入り
- `GET /favorites/tourist-spots` - お気に入り一覧
- `POST /favorites/tourist-spots` - お気に入り追加
- `DELETE /favorites/tourist-spots/:id` - お気に入り削除
- `PUT /favorites/tourist-spots/:id` - お気に入り更新
- `GET /favorites/stats` - 統計情報

### その他
- `GET /nodes` - ノード一覧
- `GET /links` - リンク一覧
- `POST /dijkstra` - 経路探索
- `GET /fields` - フィールド一覧

## 🗂️ プロジェクト構造

```
Flow_Finder/
├── flow_finder/           # バックエンド（Go）
│   ├── main.go
│   ├── user.go
│   ├── tourist_spot.go
│   ├── user_favorite_tourist_spot.go
│   ├── user_favorite_handler.go
│   └── ...
├── frontend/              # フロントエンド（React）
│   ├── src/
│   │   ├── App.tsx
│   │   ├── FavoriteTouristSpots.tsx
│   │   ├── TouristSpotManager.tsx
│   │   └── ...
│   └── Dockerfile
├── docker-compose.yml     # 開発環境用
├── docker-compose.prod.yml # 本番環境用
└── README.md
```

## 🔄 開発フロー

1. **環境セットアップ**
   ```bash
   docker-compose up --build
   ```

2. **データベースマイグレーション**
   - 自動実行（GORM AutoMigrate）

3. **開発**
   - バックエンド: `flow_finder/`ディレクトリで開発
   - フロントエンド: `frontend/src/`ディレクトリで開発

4. **デプロイ**
   ```bash
   docker-compose -f docker-compose.prod.yml up --build -d
   ```

## 🐛 トラブルシューティング

### ポートが使用中の場合
```bash
# コンテナを停止
docker-compose down

# 使用中のポートを確認
netstat -ano | findstr :5173
netstat -ano | findstr :8080
```

### データベース接続エラー
```bash
# データベースコンテナの状態確認
docker-compose ps

# ログ確認
docker-compose logs db
```

### フロントエンドビルドエラー
```bash
# フロントエンドコンテナのログ確認
docker-compose logs frontend
```

## 📝 ライセンス

MIT License

## 🤝 コントリビューション

プルリクエストやイシューの報告を歓迎します。

## 📧 お問い合わせ

何かご質問がありましたら、GitHubのIssueでお知らせください。