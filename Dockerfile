# Go用WebアプリのDockerfile
FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY flow_finder/go.* ./flow_finder/
WORKDIR /app/flow_finder
RUN go mod download
COPY flow_finder/. .
RUN go build -o app

# 実行用の軽量イメージ
FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/flow_finder/app .
# frontendのビルド成果物をコピー
COPY frontend/dist ./dist
# wait-for-postgres.shをコピー
COPY wait-for-postgres.sh ./wait-for-postgres.sh
RUN chmod +x ./wait-for-postgres.sh \
	&& apk add --no-cache postgresql-client
EXPOSE 8080
CMD ["./wait-for-postgres.sh", "db", "5432", "postgres", "postgres", "postgres", "./app"]
