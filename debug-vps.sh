#!/bin/bash
# VPS診断スクリプト

echo "=== Flow Finder VPS診断 ==="
echo "実行日時: $(date)"
echo

echo "1. Dockerコンテナ状態:"
docker-compose ps
echo

echo "2. ポート確認:"
netstat -tlnp | grep -E "(8080|5173)"
echo

echo "3. ディスク使用量:"
df -h
echo

echo "4. メモリ使用量:"
free -m
echo

echo "5. アプリケーションログ (最新20行):"
docker-compose logs app --tail=20
echo

echo "6. 基本接続テスト:"
echo "Health check:"
curl -s http://localhost:8080/health || echo "❌ ヘルスチェック失敗"
echo

echo "Login test:"
curl -s -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"name":"admin"}' | head -c 200 || echo "❌ ログイン失敗"
echo

echo "7. アップロードディレクトリ:"
ls -la ./flow_finder/uploads/ 2>/dev/null || echo "❌ アップロードディレクトリなし"
echo

echo "8. Redis接続テスト:"
docker-compose exec -T redis redis-cli ping || echo "❌ Redis接続失敗"
echo

echo "9. データベース接続テスト:"
docker-compose exec -T db pg_isready -U postgres || echo "❌ DB接続失敗"
echo

echo "診断完了"