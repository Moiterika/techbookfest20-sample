package features

import (
	"context"
	"database/sql"
	"net/http"
	"strconv"
)

func Validate登録取引区分(_ context.Context, _ *sql.DB, _ 作成Input取引区分) error {
	return nil
}

func Validate更新取引区分(_ context.Context, _ *sql.DB, _ 更新Input取引区分) error {
	return nil
}

func Parse作成Form取引区分(r *http.Request) 作成Input取引区分 {
	coefficient, _ := strconv.Atoi(r.FormValue("coefficient"))
	return 作成Input取引区分{
		Code:        r.FormValue("code"),
		Name:        r.FormValue("name"),
		Coefficient: coefficient,
	}
}

func Parse更新Form取引区分(r *http.Request, id int) 更新Input取引区分 {
	coefficient, _ := strconv.Atoi(r.FormValue("coefficient"))
	return 更新Input取引区分{
		ID:          id,
		Code:        r.FormValue("code"),
		Name:        r.FormValue("name"),
		Coefficient: coefficient,
	}
}
