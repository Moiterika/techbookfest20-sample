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
	txTypeId, _ := strconv.Atoi(r.FormValue("transactionTypeId"))
	itemId, _ := strconv.Atoi(r.FormValue("itemId"))
	unitPrice, _ := strconv.Atoi(r.FormValue("unitPrice"))
	quantity, _ := strconv.Atoi(r.FormValue("quantity"))
	if quantity < 1 {
		quantity = 1
	}
	return 作成Input取引{
		Date:              r.FormValue("date"),
		TransactionTypeId: txTypeId,
		ItemId:            itemId,
		UnitPrice:         unitPrice,
		Quantity:          quantity,
		Amount:            unitPrice * quantity,
	}
}

func Parse更新Form取引(r *http.Request, id int) 更新Input取引 {
	txTypeId, _ := strconv.Atoi(r.FormValue("transactionTypeId"))
	itemId, _ := strconv.Atoi(r.FormValue("itemId"))
	unitPrice, _ := strconv.Atoi(r.FormValue("unitPrice"))
	quantity, _ := strconv.Atoi(r.FormValue("quantity"))
	if quantity < 1 {
		quantity = 1
	}
	return 更新Input取引{
		ID:                id,
		Date:              r.FormValue("date"),
		TransactionTypeId: txTypeId,
		ItemId:            itemId,
		UnitPrice:         unitPrice,
		Quantity:          quantity,
		Amount:            unitPrice * quantity,
	}
}
