package features

import (
	"context"
	"database/sql"
	"net/http"
	"strconv"
)

func Validate登録取引(_ context.Context, _ *sql.DB, _ 作成Input取引) error {
	return nil
}

func Validate更新取引(_ context.Context, _ *sql.DB, _ 更新Input取引) error {
	return nil
}

func Parse作成Form取引(r *http.Request) 作成Input取引 {
	txTypeId, _ := strconv.Atoi(r.FormValue("取引区分ID"))
	itemId, _ := strconv.Atoi(r.FormValue("品目ID"))
	unitPrice, _ := strconv.Atoi(r.FormValue("単価"))
	quantity, _ := strconv.Atoi(r.FormValue("数量"))
	if quantity < 1 {
		quantity = 1
	}
	return 作成Input取引{
		日付:      r.FormValue("日付"),
		取引区分ID: txTypeId,
		品目ID:    itemId,
		単価:      unitPrice,
		数量:      quantity,
		金額:      unitPrice * quantity,
	}
}

func Parse更新Form取引(r *http.Request, id int) 更新Input取引 {
	txTypeId, _ := strconv.Atoi(r.FormValue("取引区分ID"))
	itemId, _ := strconv.Atoi(r.FormValue("品目ID"))
	unitPrice, _ := strconv.Atoi(r.FormValue("単価"))
	quantity, _ := strconv.Atoi(r.FormValue("数量"))
	if quantity < 1 {
		quantity = 1
	}
	return 更新Input取引{
		ID:        id,
		日付:      r.FormValue("日付"),
		取引区分ID: txTypeId,
		品目ID:    itemId,
		単価:      unitPrice,
		数量:      quantity,
		金額:      unitPrice * quantity,
	}
}
