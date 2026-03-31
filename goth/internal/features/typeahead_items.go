package features

import (
	"context"
	"database/sql"
	"fmt"
	"html"
	"net/http"
	"strconv"
	"strings"
)

// TypeaheadItem は品目検索候補
type TypeaheadItem struct {
	ID    int
	Code  string
	Name  string
	Price int
}

// SearchItems は品目をコード・名前で検索する
func SearchItems(ctx context.Context, db *sql.DB, q string, limit int) ([]TypeaheadItem, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := db.QueryContext(ctx,
		`SELECT id, "コード", "名称", "単価" FROM "品目" WHERE "コード" ILIKE $1 OR "名称" ILIKE $1 ORDER BY "コード" LIMIT $2`,
		"%"+q+"%", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []TypeaheadItem
	for rows.Next() {
		var it TypeaheadItem
		if err := rows.Scan(&it.ID, &it.Code, &it.Name, &it.Price); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, nil
}

// GetItemByID は品目をIDで取得する
func GetItemByID(ctx context.Context, db *sql.DB, id int) (TypeaheadItem, error) {
	var it TypeaheadItem
	err := db.QueryRowContext(ctx,
		`SELECT id, "コード", "名称", "単価" FROM "品目" WHERE id=$1`, id,
	).Scan(&it.ID, &it.Code, &it.Name, &it.Price)
	return it, err
}

// HandleTypeaheadSearch は品目検索候補リストHTMLを返す
// GET /api/品目/search?q=...
func (h *Handler品目) HandleTypeaheadSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	noResult := `px-3 py-2 text-sm text-outline`
	if q == "" {
		fmt.Fprintf(w, `<li class="%s">検索語を入力してください</li>`, noResult)
		return
	}

	items, err := SearchItems(r.Context(), h.DB, q, 10)
	if err != nil {
		fmt.Fprintf(w, `<li class="%s">検索エラー</li>`, noResult)
		return
	}
	if len(items) == 0 {
		fmt.Fprintf(w, `<li class="%s">該当する品目がありません</li>`, noResult)
		return
	}

	dropdownItem := `px-3 py-2 text-sm cursor-pointer hover:bg-surface-container-low`
	for _, it := range items {
		fmt.Fprintf(w,
			`<li class="%s" hx-get="/api/品目/typeahead?action=select&amp;itemId=%d" hx-target="closest [data-typeahead]" hx-swap="innerHTML"><strong>%s</strong> %s</li>`,
			dropdownItem, it.ID, html.EscapeString(it.Code), html.EscapeString(it.Name))
	}
}

// HandleTypeahead は品目選択・クリアを処理する
// GET /api/品目/typeahead?action=select|clear&itemId=...
func (h *Handler品目) HandleTypeahead(w http.ResponseWriter, r *http.Request) {
	action := r.URL.Query().Get("action")
	taName := r.URL.Query().Get("taName")
	if taName == "" {
		taName = "品目ID"
	}
	taCompact := r.URL.Query().Get("taCompact") == "true"
	taHideNameLabel := r.URL.Query().Get("taHideNameLabel") == "true"
	taLookupId := r.URL.Query().Get("taLookupId")

	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	if action == "select" {
		itemId, _ := strconv.Atoi(r.URL.Query().Get("itemId"))
		if itemId == 0 {
			http.Error(w, "itemId is required", http.StatusBadRequest)
			return
		}

		item, err := GetItemByID(r.Context(), h.DB, itemId)
		if err != nil {
			http.Error(w, "item not found", http.StatusNotFound)
			return
		}

		RenderTypeaheadBadge(taName, item, taHideNameLabel).Render(r.Context(), w)

		if taLookupId != "" {
			fmt.Fprintf(w, `<span id="%s" hx-swap-oob="true">%s</span>`,
				html.EscapeString(taLookupId), html.EscapeString(item.Name))
		}
		return
	}

	// action == "clear"
	RenderTypeaheadSearch(taName, taCompact).Render(r.Context(), w)

	if taLookupId != "" {
		fmt.Fprintf(w, `<span id="%s" hx-swap-oob="true"></span>`,
			html.EscapeString(taLookupId))
	}
}
