package features

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"strings"
	"time"
)

func Execute一覧SQL取引区分(ctx context.Context, db *sql.DB, input 一覧Input取引区分) (ListResult取引区分, error) {
	size := input.Size
	if size != 20 && size != 50 && size != 100 {
		size = 20
	}

	where := "WHERE 1=1"
	args := []any{}
	if input.Search != "" {
		where += " AND (code ILIKE $1 OR name ILIKE $1)"
		args = append(args, "%"+input.Search+"%")
	}

	var total int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM transaction_types `+where, args...).Scan(&total); err != nil {
		return ListResult取引区分{}, err
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
		fmt.Sprintf(`SELECT id, code, name, coefficient, created_at, updated_at FROM transaction_types %s ORDER BY id DESC LIMIT $%d OFFSET $%d`, where, offset+1, offset+2),
		append(args, size, (page-1)*size)...)
	if err != nil {
		return ListResult取引区分{}, err
	}
	defer rows.Close()

	var records []Response取引区分
	for rows.Next() {
		var r Row取引区分
		if err := rows.Scan(&r.Id, &r.Code, &r.Name, &r.Coefficient, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return ListResult取引区分{}, err
		}
		records = append(records, Response取引区分{Row取引区分: r})
	}
	if records == nil {
		records = []Response取引区分{}
	}

	return ListResult取引区分{Records: records, CurrentPage: page, TotalPages: totalPages, PageSize: size}, nil
}

func Execute登録SQL取引区分(ctx context.Context, db *sql.DB, input 作成Input取引区分) (Response取引区分, error) {
	now := time.Now()
	var r Row取引区分
	err := db.QueryRowContext(ctx,
		`INSERT INTO transaction_types (code, name, coefficient, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, code, name, coefficient, created_at, updated_at`,
		input.Code, input.Name, input.Coefficient, now, now,
	).Scan(&r.Id, &r.Code, &r.Name, &r.Coefficient, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return Response取引区分{}, err
	}
	return Response取引区分{Row取引区分: r}, nil
}

func Execute更新SQL取引区分(ctx context.Context, db *sql.DB, input 更新Input取引区分) (Response取引区分, error) {
	now := time.Now()
	_, err := db.ExecContext(ctx,
		`UPDATE transaction_types SET code=$1, name=$2, coefficient=$3, updated_at=$4 WHERE id=$5`,
		input.Code, input.Name, input.Coefficient, now, input.ID)
	if err != nil {
		return Response取引区分{}, err
	}
	return GetByIDSQL取引区分(ctx, db, input.ID)
}

func Execute削除SQL取引区分(ctx context.Context, db *sql.DB, input 削除Input取引区分) error {
	_, err := db.ExecContext(ctx, `DELETE FROM transaction_types WHERE id=$1`, input.ID)
	return err
}

func Execute一括削除SQL取引区分(ctx context.Context, db *sql.DB, input 一括削除Input取引区分) error {
	if len(input.IDs) == 0 {
		return nil
	}
	ph := make([]string, len(input.IDs))
	args := make([]any, len(input.IDs))
	for i, id := range input.IDs {
		ph[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}
	_, err := db.ExecContext(ctx, fmt.Sprintf(`DELETE FROM transaction_types WHERE id IN (%s)`, strings.Join(ph, ",")), args...)
	return err
}

func GetByIDSQL取引区分(ctx context.Context, db *sql.DB, id int) (Response取引区分, error) {
	var r Row取引区分
	err := db.QueryRowContext(ctx,
		`SELECT id, code, name, coefficient, created_at, updated_at FROM transaction_types WHERE id=$1`, id,
	).Scan(&r.Id, &r.Code, &r.Name, &r.Coefficient, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return Response取引区分{}, err
	}
	return Response取引区分{Row取引区分: r}, nil
}
