package features

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"strings"
	"time"
)

func Execute一覧SQLBOM(ctx context.Context, db *sql.DB, input 一覧InputBOM) (ListResultBOM, error) {
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
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM boms `+where, args...).Scan(&total); err != nil {
		return ListResultBOM{}, err
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
		fmt.Sprintf(`SELECT id, code, version, name, created_at, updated_at FROM boms %s ORDER BY id DESC LIMIT $%d OFFSET $%d`, where, offset+1, offset+2),
		append(args, size, (page-1)*size)...)
	if err != nil {
		return ListResultBOM{}, err
	}
	defer rows.Close()

	var records []ResponseBOM
	for rows.Next() {
		var r RowBOM
		if err := rows.Scan(&r.Id, &r.Code, &r.Version, &r.Name, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return ListResultBOM{}, err
		}
		records = append(records, ResponseBOM{RowBOM: r})
	}
	if records == nil {
		records = []ResponseBOM{}
	}

	return ListResultBOM{Records: records, CurrentPage: page, TotalPages: totalPages, PageSize: size}, nil
}

func Execute登録SQLBOM(ctx context.Context, db *sql.DB, input 作成InputBOM) (ResponseBOM, error) {
	now := time.Now()
	var r RowBOM
	err := db.QueryRowContext(ctx,
		`INSERT INTO boms (code, version, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, code, version, name, created_at, updated_at`,
		input.Code, input.Version, input.Name, now, now,
	).Scan(&r.Id, &r.Code, &r.Version, &r.Name, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return ResponseBOM{}, err
	}
	return ResponseBOM{RowBOM: r}, nil
}

func Execute更新SQLBOM(ctx context.Context, db *sql.DB, input 更新InputBOM) (ResponseBOM, error) {
	now := time.Now()
	_, err := db.ExecContext(ctx,
		`UPDATE boms SET code=$1, version=$2, name=$3, updated_at=$4 WHERE id=$5`,
		input.Code, input.Version, input.Name, now, input.ID)
	if err != nil {
		return ResponseBOM{}, err
	}
	return GetByIDSQLBOM(ctx, db, input.ID)
}

func Execute削除SQLBOM(ctx context.Context, db *sql.DB, input 削除InputBOM) error {
	_, err := db.ExecContext(ctx, `DELETE FROM boms WHERE id=$1`, input.ID)
	return err
}

func Execute一括削除SQLBOM(ctx context.Context, db *sql.DB, input 一括削除InputBOM) error {
	if len(input.IDs) == 0 {
		return nil
	}
	ph := make([]string, len(input.IDs))
	args := make([]any, len(input.IDs))
	for i, id := range input.IDs {
		ph[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}
	_, err := db.ExecContext(ctx, fmt.Sprintf(`DELETE FROM boms WHERE id IN (%s)`, strings.Join(ph, ",")), args...)
	return err
}

func GetByIDSQLBOM(ctx context.Context, db *sql.DB, id int) (ResponseBOM, error) {
	var r RowBOM
	err := db.QueryRowContext(ctx,
		`SELECT id, code, version, name, created_at, updated_at FROM boms WHERE id=$1`, id,
	).Scan(&r.Id, &r.Code, &r.Version, &r.Name, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return ResponseBOM{}, err
	}
	return ResponseBOM{RowBOM: r}, nil
}
