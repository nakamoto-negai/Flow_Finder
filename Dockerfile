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
EXPOSE 8080
CMD ["./app"]
