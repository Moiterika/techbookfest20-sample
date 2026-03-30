package features

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"strings"
	"time"
)

func Execute一覧SQL取引(ctx context.Context, db *sql.DB, input 一覧Input取引) (ListResult取引, error) {
	size := input.Size
	if size != 20 && size != 50 && size != 100 {
		size = 20
	}

	where := "WHERE 1=1"
	args := []any{}
	if input.Search != "" {
		where += " AND (date ILIKE $1)"
		args = append(args, "%"+input.Search+"%")
	}

	var total int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM transactions `+where, args...).Scan(&total); err != nil {
		return ListResult取引{}, err
	}

	totalPages := int(math.Max(1, math.Ceil(float64(total)/float64(size))))
	page := input.Page
	if page < 1 {
		page = 1
	}
	if page > totalPages {
		page = totalPages
	}

	offset := len(args)
	rows, err := db.QueryContext(ctx,
		fmt.Sprintf(`SELECT id, date, transaction_type_id, item_id, unit_price, quantity, amount, created_at, updated_at
		 FROM transactions %s ORDER BY id DESC LIMIT $%d OFFSET $%d`, where, offset+1, offset+2),
		append(args, size, (page-1)*size)...)
	if err != nil {
		return ListResult取引{}, err
	}
	defer rows.Close()

	var records []Response取引
	for rows.Next() {
		var r Row取引
		if err := rows.Scan(&r.Id, &r.Date, &r.TransactionTypeId, &r.ItemId, &r.UnitPrice, &r.Quantity, &r.Amount, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return ListResult取引{}, err
		}
		records = append(records, Response取引{Row取引: r})
	}
	if records == nil {
		records = []Response取引{}
	}

	return ListResult取引{Records: records, CurrentPage: page, TotalPages: totalPages, PageSize: size}, nil
}

func Execute登録SQL取引(ctx context.Context, db *sql.DB, input 作成Input取引) (Response取引, error) {
	now := time.Now()
	var r Row取引
	err := db.QueryRowContext(ctx,
		`INSERT INTO transactions (date, transaction_type_id, item_id, unit_price, quantity, amount, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id, date, transaction_type_id, item_id, unit_price, quantity, amount, created_at, updated_at`,
		input.Date, input.TransactionTypeId, input.ItemId, input.UnitPrice, input.Quantity, input.Amount, now, now,
	).Scan(&r.Id, &r.Date, &r.TransactionTypeId, &r.ItemId, &r.UnitPrice, &r.Quantity, &r.Amount, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return Response取引{}, err
	}
	return Response取引{Row取引: r}, nil
}

func Execute更新SQL取引(ctx context.Context, db *sql.DB, input 更新Input取引) (Response取引, error) {
	now := time.Now()
	_, err := db.ExecContext(ctx,
		`UPDATE transactions SET date=$1, transaction_type_id=$2, item_id=$3, unit_price=$4, quantity=$5, amount=$6, updated_at=$7 WHERE id=$8`,
		input.Date, input.TransactionTypeId, input.ItemId, input.UnitPrice, input.Quantity, input.Amount, now, input.ID)
	if err != nil {
		return Response取引{}, err
	}
	return GetByIDSQL取引(ctx, db, input.ID)
}

func Execute削除SQL取引(ctx context.Context, db *sql.DB, input 削除Input取引) error {
	_, err := db.ExecContext(ctx, `DELETE FROM transactions WHERE id=$1`, input.ID)
	return err
}

func Execute一括削除SQL取引(ctx context.Context, db *sql.DB, input 一括削除Input取引) error {
	if len(input.IDs) == 0 {
		return nil
	}
	ph := make([]string, len(input.IDs))
	args := make([]any, len(input.IDs))
	for i, id := range input.IDs {
		ph[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}
	_, err := db.ExecContext(ctx, fmt.Sprintf(`DELETE FROM transactions WHERE id IN (%s)`, strings.Join(ph, ",")), args...)
	return err
}

func GetByIDSQL取引(ctx context.Context, db *sql.DB, id int) (Response取引, error) {
	var r Row取引
	err := db.QueryRowContext(ctx,
		`SELECT id, date, transaction_type_id, item_id, unit_price, quantity, amount, created_at, updated_at FROM transactions WHERE id=$1`, id,
	).Scan(&r.Id, &r.Date, &r.TransactionTypeId, &r.ItemId, &r.UnitPrice, &r.Quantity, &r.Amount, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return Response取引{}, err
	}
	return Response取引{Row取引: r}, nil
}
