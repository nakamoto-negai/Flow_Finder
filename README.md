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


### お好みのIDEでローカル編集

```sh
#ステップ1：リポジトリをクローン

git clone <YOUR_GIT_URL>

#ステップ2：フロントエンドディレクトリへ移動

cd frontend

#ステップ3：Reactをビルドする

npm install

npm run build

#ステップ4：Dockerで開発サーバを起動

cd ..

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
# Flow_Finder

観光地の混雑緩和を図る移動支援アプリ

2つのUIで観光地におけるユーザーの移動を支援します

①チェックポイントからチェックポイントまでの道案内を行うUI

②チェックポイントに到達した際にそのチェックポイントに接続された次のチェックポイントまでのリストを表示するUI

この2つを交互に表示することでユーザーを目的地にまで導きます。②のUIにはそのリンクに進むと到達できる観光地とその詳細情報、混雑度が表示されます



