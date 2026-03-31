package features

import (
	"context"
	"database/sql"
	"net/http"
	"strconv"
)

func Validate登録品目(_ context.Context, _ *sql.DB, _ 作成Input品目) error {
	return nil
}

func Validate更新品目(_ context.Context, _ *sql.DB, _ 更新Input品目) error {
	return nil
}

func Parse作成Form品目(r *http.Request) 作成Input品目 {
	price, _ := strconv.Atoi(r.FormValue("price"))
	cat := r.FormValue("category")
	bc := r.FormValue("barcode")
	return 作成Input品目{
		Code:     r.FormValue("code"),
		Name:     r.FormValue("name"),
		Category: nilIfEmpty(cat),
		Price:    price,
		Barcode:  nilIfEmpty(bc),
	}
}

func Parse更新Form品目(r *http.Request, id int) 更新Input品目 {
	price, _ := strconv.Atoi(r.FormValue("price"))
	cat := r.FormValue("category")
	bc := r.FormValue("barcode")
	return 更新Input品目{
		ID:       id,
		Code:     r.FormValue("code"),
		Name:     r.FormValue("name"),
		Category: nilIfEmpty(cat),
		Price:    price,
		Barcode:  nilIfEmpty(bc),
	}
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
