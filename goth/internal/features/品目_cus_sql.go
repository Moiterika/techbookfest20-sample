package features

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"strings"
	"time"
)

func Execute一覧SQL品目(ctx context.Context, db *sql.DB, input 一覧Input品目) (ListResult品目, error) {
	size := input.Size
	if size != 20 && size != 50 && size != 100 {
		size = 20
	}

	where := "WHERE 1=1"
	args := []any{}
	if input.Q != "" {
		args = append(args, "%"+input.Q+"%")
		where += fmt.Sprintf(" AND (code ILIKE $%d OR name ILIKE $%d)", len(args), len(args))
	}
	if input.Category != "" {
		args = append(args, "%"+input.Category+"%")
		where += fmt.Sprintf(" AND category ILIKE $%d", len(args))
	}

	var total int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM items `+where, args...).Scan(&total); err != nil {
		return ListResult品目{}, err
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
		fmt.Sprintf(`SELECT id, code, name, category, price, barcode, created_at, updated_at FROM items %s ORDER BY id DESC LIMIT $%d OFFSET $%d`, where, offset+1, offset+2),
		append(args, size, (page-1)*size)...)
	if err != nil {
		return ListResult品目{}, err
	}
	defer rows.Close()

	var records []Response品目
	for rows.Next() {
		var r Row品目
		if err := rows.Scan(&r.Id, &r.Code, &r.Name, &r.Category, &r.Price, &r.Barcode, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return ListResult品目{}, err
		}
		records = append(records, Response品目{Row品目: r})
	}
	if records == nil {
		records = []Response品目{}
	}

	return ListResult品目{Records: records, CurrentPage: page, TotalPages: totalPages, PageSize: size}, nil
}

func Execute登録SQL品目(ctx context.Context, db *sql.DB, input 作成Input品目) (Response品目, error) {
	now := time.Now()
	cat := toNullString(input.Category)
	bc := toNullString(input.Barcode)

	var r Row品目
	err := db.QueryRowContext(ctx,
		`INSERT INTO items (code, name, category, price, barcode, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, code, name, category, price, barcode, created_at, updated_at`,
		input.Code, input.Name, cat, input.Price, bc, now, now,
	).Scan(&r.Id, &r.Code, &r.Name, &r.Category, &r.Price, &r.Barcode, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return Response品目{}, err
	}
	return Response品目{Row品目: r}, nil
}

func Execute更新SQL品目(ctx context.Context, db *sql.DB, input 更新Input品目) (Response品目, error) {
	now := time.Now()
	cat := toNullString(input.Category)
	bc := toNullString(input.Barcode)

	_, err := db.ExecContext(ctx,
		`UPDATE items SET code=$1, name=$2, category=$3, price=$4, barcode=$5, updated_at=$6 WHERE id=$7`,
		input.Code, input.Name, cat, input.Price, bc, now, input.ID)
	if err != nil {
		return Response品目{}, err
	}
	return GetByIDSQL品目(ctx, db, input.ID)
}

func Execute削除SQL品目(ctx context.Context, db *sql.DB, input 削除Input品目) error {
	_, err := db.ExecContext(ctx, `DELETE FROM items WHERE id=$1`, input.ID)
	return err
}

func Execute一括削除SQL品目(ctx context.Context, db *sql.DB, input 一括削除Input品目) error {
	if len(input.IDs) == 0 {
		return nil
	}
	ph := make([]string, len(input.IDs))
	args := make([]any, len(input.IDs))
	for i, id := range input.IDs {
		ph[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}
	_, err := db.ExecContext(ctx, fmt.Sprintf(`DELETE FROM items WHERE id IN (%s)`, strings.Join(ph, ",")), args...)
	return err
}

func GetByIDSQL品目(ctx context.Context, db *sql.DB, id int) (Response品目, error) {
	var r Row品目
	err := db.QueryRowContext(ctx,
		`SELECT id, code, name, category, price, barcode, created_at, updated_at FROM items WHERE id=$1`, id,
	).Scan(&r.Id, &r.Code, &r.Name, &r.Category, &r.Price, &r.Barcode, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return Response品目{}, err
	}
	return Response品目{Row品目: r}, nil
}

func toNullString(s *string) sql.NullString {
	if s == nil || *s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: *s, Valid: true}
}
