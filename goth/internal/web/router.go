package web

import (
	"net/http"

	"aha-goth/internal/features"
	"github.com/go-gorp/gorp/v3"
)

// RegisterRoutes は全 feature のルートを登録する
func RegisterRoutes(mux *http.ServeMux, db *gorp.DbMap) {
	// ── ページ ──
	mux.HandleFunc("GET /{$}", handleHome)

	// ── API + ページ（feature ごとに RegisterRoutes で登録） ──
	品目 := features.NewHandler品目(db)
	品目.RegisterRoutes品目(mux)
	// 品目タイプアヘッド（複数featureから共有）
	mux.HandleFunc("GET /api/品目/search", 品目.HandleTypeaheadSearch)
	mux.HandleFunc("GET /api/品目/typeahead", 品目.HandleTypeahead)

	取引区分 := features.NewHandler取引区分(db)
	取引区分.RegisterRoutes取引区分(mux)

	取引 := features.NewHandler取引(db)
	取引.RegisterRoutes取引(mux)

	bom := features.NewHandlerBOM(db)
	bom.RegisterRoutesBOM(mux)
}

func handleHome(w http.ResponseWriter, r *http.Request) {
	HomePage().Render(r.Context(), w)
}
