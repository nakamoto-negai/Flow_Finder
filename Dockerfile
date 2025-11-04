# Go用WebアプリのDockerfile
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY flow_finder/go.* ./flow_finder/
WORKDIR /app/flow_finder
RUN go mod download
COPY flow_finder/. .
RUN go mod tidy && go build -o app

# 実行用の軽量イメージ
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/flow_finder/app .
RUN apk add --no-cache ca-certificates
EXPOSE 8080
CMD ["./app"]
