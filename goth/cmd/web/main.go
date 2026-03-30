package main

import (
	"database/sql"
	"fmt"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"

	goth "aha-goth"
	"aha-goth/internal/web"

	_ "github.com/lib/pq"
)

func init() {
	// コンテナ環境で /etc/mime.types が不完全な場合に備えて明示的に登録
	mime.AddExtensionType(".css", "text/css; charset=utf-8")
	mime.AddExtensionType(".js", "application/javascript")
	mime.AddExtensionType(".json", "application/json")
	mime.AddExtensionType(".svg", "image/svg+xml")
}

func main() {
	host := envOrDefault("DB_HOST", "db")
	port := envOrDefault("DB_PORT", "5432")
	dbname := envOrDefault("DB_NAME", "devdb")
	user := envOrDefault("DB_USER", "postgres")
	password := envOrDefault("DB_PASSWORD", "password")

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()

	// Static files (embed.FS から配信 — 作業ディレクトリに依存しない)
	staticSub, _ := fs.Sub(goth.StaticFS, "static")
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServer(http.FS(staticSub))))

	// ルーティング登録 (router.go に集約)
	web.RegisterRoutes(mux, db)

	addr := ":" + envOrDefault("APP_PORT", "3000")
	log.Printf("Server starting on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func envOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
