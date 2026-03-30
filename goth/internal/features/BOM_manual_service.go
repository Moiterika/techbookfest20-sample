package features

import (
	"context"
	"database/sql"
	"net/http"
	"strconv"
)

func Validate登録BOM(_ context.Context, _ *sql.DB, _ 作成InputBOM) error {
	return nil
}

func Validate更新BOM(_ context.Context, _ *sql.DB, _ 更新InputBOM) error {
	return nil
}

func Parse作成FormBOM(r *http.Request) 作成InputBOM {
	return 作成InputBOM{
		Code:    r.FormValue("code"),
		Version: r.FormValue("version"),
		Name:    r.FormValue("name"),
	}
}

func Parse更新FormBOM(r *http.Request, id int) 更新InputBOM {
	return 更新InputBOM{
		ID:      id,
		Code:    r.FormValue("code"),
		Version: r.FormValue("version"),
		Name:    r.FormValue("name"),
	}
}

// parseInt は文字列を int に変換���るヘルパー
func parseInt(s string) int {
	v, _ := strconv.Atoi(s)
	return v
}
