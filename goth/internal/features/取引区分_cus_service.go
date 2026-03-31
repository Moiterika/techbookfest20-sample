package features

import (
	"context"
	"net/http"
	"strconv"

	"github.com/go-gorp/gorp/v3"
)

func Validate登録取引区分(_ context.Context, _ *gorp.DbMap, _ 作成Input取引区分) error {
	return nil
}

func Validate更新取引区分(_ context.Context, _ *gorp.DbMap, _ 更新Input取引区分) error {
	return nil
}

func Parse作成Form取引区分(r *http.Request) 作成Input取引区分 {
	coefficient, _ := strconv.Atoi(r.FormValue("係数"))
	return 作成Input取引区分{
		コード: r.FormValue("コード"),
		名称:  r.FormValue("名称"),
		係数:  coefficient,
	}
}

func Parse更新Form取引区分(r *http.Request, id int) 更新Input取引区分 {
	coefficient, _ := strconv.Atoi(r.FormValue("係数"))
	return 更新Input取引区分{
		ID:  id,
		コード: r.FormValue("コード"),
		名称:  r.FormValue("名称"),
		係数:  coefficient,
	}
}
