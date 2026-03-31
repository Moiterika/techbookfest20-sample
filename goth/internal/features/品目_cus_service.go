package features

import (
	"context"
	"net/http"
	"strconv"

	"database/sql"
)

func Validate登録品目(_ context.Context, _ *sql.DB, _ 作成Input品目) error {
	return nil
}

func Validate更新品目(_ context.Context, _ *sql.DB, _ 更新Input品目) error {
	return nil
}

func Parse作成Form品目(r *http.Request) 作成Input品目 {
	price, _ := strconv.Atoi(r.FormValue("単価"))
	cat := r.FormValue("カテゴリ")
	bc := r.FormValue("バーコード")
	return 作成Input品目{
		コード:   r.FormValue("コード"),
		名称:    r.FormValue("名称"),
		カテゴリ:  nilIfEmpty(cat),
		単価:    price,
		バーコード: nilIfEmpty(bc),
	}
}

func Parse更新Form品目(r *http.Request, id int) 更新Input品目 {
	price, _ := strconv.Atoi(r.FormValue("単価"))
	cat := r.FormValue("カテゴリ")
	bc := r.FormValue("バーコード")
	return 更新Input品目{
		ID:    id,
		コード:   r.FormValue("コード"),
		名称:    r.FormValue("名称"),
		カテゴリ:  nilIfEmpty(cat),
		単価:    price,
		バーコード: nilIfEmpty(bc),
	}
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
