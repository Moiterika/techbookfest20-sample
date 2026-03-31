// cmd/gen-dao/main.go — dao_config.json → _dao_gen.go を生成する
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
)

// ── JSON config 型定義 ──

type Config struct {
	Entities []Entity `json:"entities"`
}

type Entity struct {
	Name             string   `json:"name"`
	Table            string   `json:"table"`
	RowStruct        string   `json:"rowStruct"`
	ResponseStruct   string   `json:"responseStruct"`
	ListResultStruct string   `json:"listResultStruct"`
	CreateInput      string   `json:"createInput"`
	UpdateInput      string   `json:"updateInput"`
	DeleteInput      string   `json:"deleteInput"`
	BatchDeleteInput string   `json:"batchDeleteInput"`
	ListInput        string   `json:"listInput"`
	CreateWithLines  string   `json:"createWithLinesInput"`
	UpdateWithLines  string   `json:"updateWithLinesInput"`
	Fields           []Field  `json:"fields"`
	Search           *Search  `json:"search"`
	Filters          []Filter `json:"filters"`
	Child            *Child   `json:"child"`
	Detail           *Detail  `json:"detail"`
}

type Field struct {
	Go        string `json:"go"`
	DB        string `json:"db"`
	Type      string `json:"type"`
	InputType string `json:"inputType"`
	PK        bool   `json:"pk"`
	Auto      bool   `json:"auto"`
	Timestamp bool   `json:"timestamp"`
	Nullable  bool   `json:"nullable"`
}

type Search struct {
	InputField string   `json:"inputField"`
	Columns    []string `json:"columns"`
}

type Filter struct {
	InputField string `json:"inputField"`
	Column     string `json:"column"`
	Op         string `json:"op"`
}

type Child struct {
	Struct      string       `json:"struct"`
	Table       string       `json:"table"`
	ParentFK    string       `json:"parentFK"`
	ParentFKGo  string       `json:"parentFKGo"`
	LinesField  string       `json:"linesField"`
	InputStruct string       `json:"inputStruct"`
	Fields      []Field      `json:"fields"`
	InputFields []ChildInput `json:"inputFields"`
}

type ChildInput struct {
	Go       string `json:"go"`
	Type     string `json:"type"`
	Nullable bool   `json:"nullable"`
}

type Detail struct {
	ResponseStruct string        `json:"responseStruct"`
	Joins          []Join        `json:"joins"`
	Discriminator  Discriminator `json:"discriminator"`
}

type Join struct {
	Table     string      `json:"table"`
	Alias     string      `json:"alias"`
	ChildCol  string      `json:"childCol"`
	ParentCol string      `json:"parentCol"`
	Fields    []JoinField `json:"fields"`
}

type JoinField struct {
	Column string `json:"column"`
	As     string `json:"as"`
}

type Discriminator struct {
	Field  string  `json:"field"`
	Groups []Group `json:"groups"`
}

type Group struct {
	Value         int    `json:"value"`
	ResponseField string `json:"responseField"`
}

// ── helpers ──

func sqlQ(name string) string {
	for _, c := range name {
		if c > 127 || c == ' ' {
			return `"` + name + `"`
		}
	}
	if strings.ContainsAny(name, "ABCDEFGHIJKLMNOPQRSTUVWXYZ ") {
		return `"` + name + `"`
	}
	return name
}

// dataFields returns fields that are not PK/auto and not timestamps
func dataFields(fields []Field) []Field {
	var out []Field
	for _, f := range fields {
		if f.PK && f.Auto {
			continue
		}
		if f.Timestamp {
			continue
		}
		out = append(out, f)
	}
	return out
}

// allCols/allScan for SELECT *
func allCols(fields []Field) string {
	var cols []string
	for _, f := range fields {
		cols = append(cols, sqlQ(f.DB))
	}
	return strings.Join(cols, ", ")
}

func allScan(fields []Field, varName string) string {
	var args []string
	for _, f := range fields {
		args = append(args, "&"+varName+"."+f.Go)
	}
	return strings.Join(args, ", ")
}

// insertCols/insertPlaceholders/insertArgs for INSERT
func insertCols(fields []Field) string {
	df := dataFields(fields)
	var cols []string
	for _, f := range df {
		cols = append(cols, sqlQ(f.DB))
	}
	// + timestamps
	cols = append(cols, "created_at", "updated_at")
	return strings.Join(cols, ", ")
}

func insertPlaceholders(fields []Field) string {
	df := dataFields(fields)
	n := len(df) + 2 // +2 for timestamps
	var ph []string
	for i := 1; i <= n; i++ {
		ph = append(ph, fmt.Sprintf("$%d", i))
	}
	return strings.Join(ph, ", ")
}

func insertArgs(fields []Field, inputVar string) string {
	df := dataFields(fields)
	var args []string
	for _, f := range df {
		if f.Nullable {
			args = append(args, fmt.Sprintf("toNullString(%s.%s)", inputVar, f.Go))
		} else {
			args = append(args, fmt.Sprintf("%s.%s", inputVar, f.Go))
		}
	}
	args = append(args, "now", "now")
	return strings.Join(args, ", ")
}

// updateSetClauses for UPDATE SET
func updateSetClauses(fields []Field) string {
	df := dataFields(fields)
	var parts []string
	idx := 1
	for _, f := range df {
		parts = append(parts, fmt.Sprintf("%s=$%d", sqlQ(f.DB), idx))
		idx++
	}
	parts = append(parts, fmt.Sprintf("updated_at=$%d", idx))
	return strings.Join(parts, ", ")
}

func updateArgs(fields []Field, inputVar string) string {
	df := dataFields(fields)
	var args []string
	for _, f := range df {
		if f.Nullable {
			args = append(args, fmt.Sprintf("toNullString(%s.%s)", inputVar, f.Go))
		} else {
			args = append(args, fmt.Sprintf("%s.%s", inputVar, f.Go))
		}
	}
	args = append(args, "now")
	return strings.Join(args, ", ")
}

func updateArgCount(fields []Field) int {
	return len(dataFields(fields)) + 1 // +1 for updated_at
}

func repeatIdx(n int) string {
	parts := make([]string, n)
	for i := range parts {
		parts[i] = "idx"
	}
	return strings.Join(parts, ", ")
}

// ── メイン ──

func main() {
	configPath := "internal/features/dao_config.json"
	if len(os.Args) > 1 {
		configPath = os.Args[1]
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		log.Fatalf("config読み込み失敗: %v", err)
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		log.Fatalf("config parse失敗: %v", err)
	}

	for _, e := range cfg.Entities {
		var sb strings.Builder
		genHeader(&sb)
		genList(&sb, e)
		if e.Child != nil {
			genCreateWithLines(&sb, e)
			genUpdateWithLines(&sb, e)
		} else {
			genCreate(&sb, e)
			genUpdate(&sb, e)
		}
		genDelete(&sb, e)
		genBatchDelete(&sb, e)
		genGetByID(&sb, e)
		if e.Detail != nil {
			genDetail(&sb, e)
		}

		outPath := fmt.Sprintf("internal/features/%s_dao_gen.go", e.Name)
		if err := os.WriteFile(outPath, []byte(sb.String()), 0644); err != nil {
			log.Fatalf("%s 書き込み失敗: %v", outPath, err)
		}
		fmt.Printf("generated %s\n", outPath)
	}
}

// ── ヘッダー ──

func genHeader(sb *strings.Builder) {
	sb.WriteString("// Code generated by gen-dao. DO NOT EDIT.\n")
	sb.WriteString("package features\n\n")
	sb.WriteString("import (\n")
	sb.WriteString("\t\"context\"\n")
	sb.WriteString("\t\"database/sql\"\n")
	sb.WriteString("\t\"fmt\"\n")
	sb.WriteString("\t\"math\"\n")
	sb.WriteString("\t\"strings\"\n")
	sb.WriteString("\t\"time\"\n")
	sb.WriteString(")\n\n")
	sb.WriteString("var (\n")
	sb.WriteString("\t_ = fmt.Sprintf\n")
	sb.WriteString("\t_ = strings.Join\n")
	sb.WriteString("\t_ = time.Now\n")
	sb.WriteString("\t_ = math.Max\n")
	sb.WriteString("\t_ sql.NullString\n")
	sb.WriteString(")\n\n")
}

// ── 一覧 (List) ──

func genList(sb *strings.Builder, e Entity) {
	JP := e.Name
	table := sqlQ(e.Table)
	selectList := allCols(e.Fields)
	scanList := allScan(e.Fields, "r")

	sb.WriteString(fmt.Sprintf("func Execute一覧SQL%s(ctx context.Context, db *sql.DB, input %s) (%s, error) {\n", JP, e.ListInput, e.ListResultStruct))
	sb.WriteString("\tsize := input.Size\n")
	sb.WriteString("\tif size != 20 && size != 50 && size != 100 {\n\t\tsize = 20\n\t}\n\n")
	sb.WriteString("\twhere := \"WHERE 1=1\"\n")
	sb.WriteString("\targs := []any{}\n")

	if e.Search != nil && len(e.Search.Columns) > 0 {
		sb.WriteString(fmt.Sprintf("\tif input.%s != \"\" {\n", e.Search.InputField))
		sb.WriteString(fmt.Sprintf("\t\targs = append(args, \"%%\"+input.%s+\"%%\")\n", e.Search.InputField))
		var clauses []string
		for _, col := range e.Search.Columns {
			clauses = append(clauses, fmt.Sprintf(`%s ILIKE $%%d`, sqlQ(col)))
		}
		sb.WriteString("\t\tidx := len(args)\n")
		joined := strings.Join(clauses, " OR ")
		sb.WriteString(fmt.Sprintf("\t\twhere += fmt.Sprintf(` AND (%s)`, %s)\n", joined, repeatIdx(len(e.Search.Columns))))
		sb.WriteString("\t}\n")
	}

	for _, f := range e.Filters {
		sb.WriteString(fmt.Sprintf("\tif input.%s != \"\" {\n", f.InputField))
		switch f.Op {
		case "ilike":
			sb.WriteString(fmt.Sprintf("\t\targs = append(args, \"%%\"+input.%s+\"%%\")\n", f.InputField))
			sb.WriteString(fmt.Sprintf("\t\twhere += fmt.Sprintf(` AND %s ILIKE $%%d`, len(args))\n", sqlQ(f.Column)))
		case "eq":
			sb.WriteString(fmt.Sprintf("\t\targs = append(args, input.%s)\n", f.InputField))
			sb.WriteString(fmt.Sprintf("\t\twhere += fmt.Sprintf(` AND %s = $%%d`, len(args))\n", sqlQ(f.Column)))
		case "gte":
			sb.WriteString(fmt.Sprintf("\t\targs = append(args, input.%s)\n", f.InputField))
			sb.WriteString(fmt.Sprintf("\t\twhere += fmt.Sprintf(` AND %s >= $%%d`, len(args))\n", sqlQ(f.Column)))
		case "lte":
			sb.WriteString(fmt.Sprintf("\t\targs = append(args, input.%s)\n", f.InputField))
			sb.WriteString(fmt.Sprintf("\t\twhere += fmt.Sprintf(` AND %s <= $%%d`, len(args))\n", sqlQ(f.Column)))
		}
		sb.WriteString("\t}\n")
	}

	sb.WriteString("\n\tvar total int\n")
	sb.WriteString(fmt.Sprintf("\tif err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM %s `+where, args...).Scan(&total); err != nil {\n", table))
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n\n", e.ListResultStruct))

	sb.WriteString("\ttotalPages := int(math.Max(1, math.Ceil(float64(total)/float64(size))))\n")
	sb.WriteString("\tpage := input.Page\n")
	sb.WriteString("\tif page < 1 { page = 1 }\n")
	sb.WriteString("\tif page > totalPages { page = totalPages }\n\n")

	sb.WriteString("\toffset := len(args)\n")
	sb.WriteString("\trows, err := db.QueryContext(ctx,\n")
	sb.WriteString(fmt.Sprintf("\t\tfmt.Sprintf(`SELECT %s FROM %s %%s ORDER BY id DESC LIMIT $%%d OFFSET $%%d`, where, offset+1, offset+2),\n", selectList, table))
	sb.WriteString("\t\tappend(args, size, (page-1)*size)...)\n")
	sb.WriteString("\tif err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n", e.ListResultStruct))
	sb.WriteString("\tdefer rows.Close()\n\n")

	sb.WriteString(fmt.Sprintf("\tvar records []%s\n", e.ResponseStruct))
	sb.WriteString("\tfor rows.Next() {\n")
	sb.WriteString(fmt.Sprintf("\t\tvar r %s\n", e.RowStruct))
	sb.WriteString(fmt.Sprintf("\t\tif err := rows.Scan(%s); err != nil {\n", scanList))
	sb.WriteString(fmt.Sprintf("\t\t\treturn %s{}, err\n\t\t}\n", e.ListResultStruct))
	sb.WriteString(fmt.Sprintf("\t\trecords = append(records, %s{%s: r})\n", e.ResponseStruct, e.RowStruct))
	sb.WriteString("\t}\n")
	sb.WriteString(fmt.Sprintf("\tif records == nil { records = []%s{} }\n\n", e.ResponseStruct))
	sb.WriteString(fmt.Sprintf("\treturn %s{Records: records, CurrentPage: page, TotalPages: totalPages, PageSize: size}, nil\n", e.ListResultStruct))
	sb.WriteString("}\n\n")
}

// ── 登録 (Create) ──

func genCreate(sb *strings.Builder, e Entity) {
	JP := e.Name
	table := sqlQ(e.Table)

	sb.WriteString(fmt.Sprintf("func Execute登録SQL%s(ctx context.Context, db *sql.DB, input %s) (%s, error) {\n", JP, e.CreateInput, e.ResponseStruct))
	sb.WriteString("\tnow := time.Now()\n")
	sb.WriteString(fmt.Sprintf("\tvar r %s\n", e.RowStruct))
	sb.WriteString(fmt.Sprintf("\terr := db.QueryRowContext(ctx,\n"))
	sb.WriteString(fmt.Sprintf("\t\t`INSERT INTO %s (%s) VALUES (%s) RETURNING %s`,\n",
		table, insertCols(e.Fields), insertPlaceholders(e.Fields), allCols(e.Fields)))
	sb.WriteString(fmt.Sprintf("\t\t%s,\n", insertArgs(e.Fields, "input")))
	sb.WriteString(fmt.Sprintf("\t).Scan(%s)\n", allScan(e.Fields, "r")))
	sb.WriteString("\tif err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n", e.ResponseStruct))
	sb.WriteString(fmt.Sprintf("\treturn %s{%s: r}, nil\n", e.ResponseStruct, e.RowStruct))
	sb.WriteString("}\n\n")
}

// ── 更新 (Update) ──

func genUpdate(sb *strings.Builder, e Entity) {
	JP := e.Name
	table := sqlQ(e.Table)
	idIdx := updateArgCount(e.Fields) + 1

	sb.WriteString(fmt.Sprintf("func Execute更新SQL%s(ctx context.Context, db *sql.DB, input %s) (%s, error) {\n", JP, e.UpdateInput, e.ResponseStruct))
	sb.WriteString("\tnow := time.Now()\n")
	sb.WriteString(fmt.Sprintf("\t_, err := db.ExecContext(ctx,\n"))
	sb.WriteString(fmt.Sprintf("\t\t`UPDATE %s SET %s WHERE id=$%d`,\n", table, updateSetClauses(e.Fields), idIdx))
	sb.WriteString(fmt.Sprintf("\t\t%s, input.ID)\n", updateArgs(e.Fields, "input")))
	sb.WriteString("\tif err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n", e.ResponseStruct))
	sb.WriteString(fmt.Sprintf("\treturn GetByIDSQL%s(ctx, db, input.ID)\n", JP))
	sb.WriteString("}\n\n")
}

// ── 登録 with Lines (Header-Body) ──

func genCreateWithLines(sb *strings.Builder, e Entity) {
	JP := e.Name
	ch := e.Child
	table := sqlQ(e.Table)
	childTable := sqlQ(ch.Table)

	sb.WriteString(fmt.Sprintf("func Execute登録SQL%s(ctx context.Context, db *sql.DB, input %s) (%s, error) {\n", JP, e.CreateWithLines, e.ResponseStruct))
	sb.WriteString("\tnow := time.Now()\n")
	sb.WriteString("\ttx, err := db.BeginTx(ctx, nil)\n")
	sb.WriteString("\tif err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n", e.ResponseStruct))
	sb.WriteString("\tdefer tx.Rollback()\n\n")

	// Insert parent with RETURNING
	sb.WriteString(fmt.Sprintf("\tvar r %s\n", e.RowStruct))
	sb.WriteString(fmt.Sprintf("\terr = tx.QueryRowContext(ctx,\n"))
	sb.WriteString(fmt.Sprintf("\t\t`INSERT INTO %s (%s) VALUES (%s) RETURNING %s`,\n",
		table, insertCols(e.Fields), insertPlaceholders(e.Fields), allCols(e.Fields)))
	sb.WriteString(fmt.Sprintf("\t\t%s,\n", insertArgs(e.Fields, "input")))
	sb.WriteString(fmt.Sprintf("\t).Scan(%s)\n", allScan(e.Fields, "r")))
	sb.WriteString("\tif err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n\n", e.ResponseStruct))

	// Insert child lines
	childDF := dataFields(ch.Fields)
	// remove parent FK from dataFields for child insert since we set it manually
	var childInsertFields []Field
	for _, f := range childDF {
		if f.Go == ch.ParentFKGo {
			continue
		}
		childInsertFields = append(childInsertFields, f)
	}

	// Build child INSERT columns: parentFK + childInsertFields + timestamps
	var childCols []string
	childCols = append(childCols, sqlQ(ch.ParentFK))
	for _, f := range childInsertFields {
		childCols = append(childCols, sqlQ(f.DB))
	}
	childCols = append(childCols, "created_at", "updated_at")
	childColStr := strings.Join(childCols, ", ")

	nChild := len(childCols)
	var childPH []string
	for i := 1; i <= nChild; i++ {
		childPH = append(childPH, fmt.Sprintf("$%d", i))
	}
	childPHStr := strings.Join(childPH, ", ")

	sb.WriteString(fmt.Sprintf("\tfor _, l := range input.%s {\n", ch.LinesField))
	sb.WriteString(fmt.Sprintf("\t\t_, err = tx.ExecContext(ctx,\n"))
	sb.WriteString(fmt.Sprintf("\t\t\t`INSERT INTO %s (%s) VALUES (%s)`,\n", childTable, childColStr, childPHStr))

	// Build child args
	var childArgs []string
	childArgs = append(childArgs, "r.Id")
	for _, cf := range childInsertFields {
		// Map from input fields
		matched := false
		for _, ci := range ch.InputFields {
			if ci.Go == cf.Go {
				if ci.Nullable {
					childArgs = append(childArgs, fmt.Sprintf("toNullString(l.%s)", cf.Go))
				} else {
					childArgs = append(childArgs, fmt.Sprintf("l.%s", cf.Go))
				}
				matched = true
				break
			}
		}
		if !matched {
			childArgs = append(childArgs, fmt.Sprintf("l.%s", cf.Go))
		}
	}
	childArgs = append(childArgs, "now", "now")
	sb.WriteString(fmt.Sprintf("\t\t\t%s)\n", strings.Join(childArgs, ", ")))

	sb.WriteString("\t\tif err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\t\treturn %s{}, err\n\t\t}\n", e.ResponseStruct))
	sb.WriteString("\t}\n\n")

	sb.WriteString("\tif err := tx.Commit(); err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n", e.ResponseStruct))
	sb.WriteString(fmt.Sprintf("\treturn %s{%s: r}, nil\n", e.ResponseStruct, e.RowStruct))
	sb.WriteString("}\n\n")
}

// ── 更新 with Lines (Header-Body) ──

func genUpdateWithLines(sb *strings.Builder, e Entity) {
	JP := e.Name
	ch := e.Child
	table := sqlQ(e.Table)
	childTable := sqlQ(ch.Table)
	childFK := sqlQ(ch.ParentFK)
	idIdx := updateArgCount(e.Fields) + 1

	sb.WriteString(fmt.Sprintf("func Execute更新SQL%s(ctx context.Context, db *sql.DB, input %s) (%s, error) {\n", JP, e.UpdateWithLines, e.ResponseStruct))
	sb.WriteString("\tnow := time.Now()\n")
	sb.WriteString("\ttx, err := db.BeginTx(ctx, nil)\n")
	sb.WriteString("\tif err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n", e.ResponseStruct))
	sb.WriteString("\tdefer tx.Rollback()\n\n")

	// Update parent
	sb.WriteString(fmt.Sprintf("\t_, err = tx.ExecContext(ctx,\n"))
	sb.WriteString(fmt.Sprintf("\t\t`UPDATE %s SET %s WHERE id=$%d`,\n", table, updateSetClauses(e.Fields), idIdx))
	sb.WriteString(fmt.Sprintf("\t\t%s, input.ID)\n", updateArgs(e.Fields, "input")))
	sb.WriteString("\tif err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n\n", e.ResponseStruct))

	// Delete old child lines
	sb.WriteString(fmt.Sprintf("\t_, err = tx.ExecContext(ctx, `DELETE FROM %s WHERE %s=$1`, input.ID)\n", childTable, childFK))
	sb.WriteString("\tif err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n\n", e.ResponseStruct))

	// Re-insert child lines (same logic as create)
	childDF := dataFields(ch.Fields)
	var childInsertFields []Field
	for _, f := range childDF {
		if f.Go == ch.ParentFKGo {
			continue
		}
		childInsertFields = append(childInsertFields, f)
	}

	var childCols []string
	childCols = append(childCols, sqlQ(ch.ParentFK))
	for _, f := range childInsertFields {
		childCols = append(childCols, sqlQ(f.DB))
	}
	childCols = append(childCols, "created_at", "updated_at")
	childColStr := strings.Join(childCols, ", ")

	nChild := len(childCols)
	var childPH []string
	for i := 1; i <= nChild; i++ {
		childPH = append(childPH, fmt.Sprintf("$%d", i))
	}
	childPHStr := strings.Join(childPH, ", ")

	sb.WriteString(fmt.Sprintf("\tfor _, l := range input.%s {\n", ch.LinesField))
	sb.WriteString(fmt.Sprintf("\t\t_, err = tx.ExecContext(ctx,\n"))
	sb.WriteString(fmt.Sprintf("\t\t\t`INSERT INTO %s (%s) VALUES (%s)`,\n", childTable, childColStr, childPHStr))

	var childArgs []string
	childArgs = append(childArgs, "input.ID")
	for _, cf := range childInsertFields {
		matched := false
		for _, ci := range ch.InputFields {
			if ci.Go == cf.Go {
				if ci.Nullable {
					childArgs = append(childArgs, fmt.Sprintf("toNullString(l.%s)", cf.Go))
				} else {
					childArgs = append(childArgs, fmt.Sprintf("l.%s", cf.Go))
				}
				matched = true
				break
			}
		}
		if !matched {
			childArgs = append(childArgs, fmt.Sprintf("l.%s", cf.Go))
		}
	}
	childArgs = append(childArgs, "now", "now")
	sb.WriteString(fmt.Sprintf("\t\t\t%s)\n", strings.Join(childArgs, ", ")))

	sb.WriteString("\t\tif err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\t\treturn %s{}, err\n\t\t}\n", e.ResponseStruct))
	sb.WriteString("\t}\n\n")

	sb.WriteString("\tif err := tx.Commit(); err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n", e.ResponseStruct))
	sb.WriteString(fmt.Sprintf("\treturn GetByIDSQL%s(ctx, db, input.ID)\n", JP))
	sb.WriteString("}\n\n")
}

// ── 削除 (Delete) ──

func genDelete(sb *strings.Builder, e Entity) {
	JP := e.Name
	table := sqlQ(e.Table)
	sb.WriteString(fmt.Sprintf("func Execute削除SQL%s(ctx context.Context, db *sql.DB, input %s) error {\n", JP, e.DeleteInput))
	sb.WriteString(fmt.Sprintf("\t_, err := db.ExecContext(ctx, `DELETE FROM %s WHERE id=$1`, input.ID)\n", table))
	sb.WriteString("\treturn err\n")
	sb.WriteString("}\n\n")
}

// ── 一括削除 (Batch Delete) ──

func genBatchDelete(sb *strings.Builder, e Entity) {
	JP := e.Name
	table := sqlQ(e.Table)

	sb.WriteString(fmt.Sprintf("func Execute一括削除SQL%s(ctx context.Context, db *sql.DB, input %s) error {\n", JP, e.BatchDeleteInput))
	sb.WriteString("\tif len(input.IDs) == 0 {\n\t\treturn nil\n\t}\n")
	sb.WriteString("\tph := make([]string, len(input.IDs))\n")
	sb.WriteString("\targs := make([]any, len(input.IDs))\n")
	sb.WriteString("\tfor i, id := range input.IDs {\n")
	sb.WriteString("\t\tph[i] = fmt.Sprintf(\"$%d\", i+1)\n")
	sb.WriteString("\t\targs[i] = id\n")
	sb.WriteString("\t}\n")
	sb.WriteString(fmt.Sprintf("\t_, err := db.ExecContext(ctx, fmt.Sprintf(`DELETE FROM %s WHERE id IN (%%s)`, strings.Join(ph, \",\")), args...)\n", table))
	sb.WriteString("\treturn err\n")
	sb.WriteString("}\n\n")
}

// ── GetByID ──

func genGetByID(sb *strings.Builder, e Entity) {
	JP := e.Name
	table := sqlQ(e.Table)

	sb.WriteString(fmt.Sprintf("func GetByIDSQL%s(ctx context.Context, db *sql.DB, id int) (%s, error) {\n", JP, e.ResponseStruct))
	sb.WriteString(fmt.Sprintf("\tvar r %s\n", e.RowStruct))
	sb.WriteString(fmt.Sprintf("\terr := db.QueryRowContext(ctx,\n"))
	sb.WriteString(fmt.Sprintf("\t\t`SELECT %s FROM %s WHERE id=$1`, id,\n", allCols(e.Fields), table))
	sb.WriteString(fmt.Sprintf("\t).Scan(%s)\n", allScan(e.Fields, "r")))
	sb.WriteString("\tif err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n", e.ResponseStruct))
	sb.WriteString(fmt.Sprintf("\treturn %s{%s: r}, nil\n", e.ResponseStruct, e.RowStruct))
	sb.WriteString("}\n\n")
}

// ── Detail (BOM詳細) ──

func genDetail(sb *strings.Builder, e Entity) {
	JP := e.Name
	d := e.Detail
	ch := e.Child

	sb.WriteString(fmt.Sprintf("func GetByID%s詳細SQL(ctx context.Context, db *sql.DB, id int) (%s, error) {\n", JP, d.ResponseStruct))
	sb.WriteString(fmt.Sprintf("\tbom, err := GetByIDSQL%s(ctx, db, id)\n", JP))
	sb.WriteString("\tif err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n\n", d.ResponseStruct))

	var selCols []string
	for _, f := range ch.Fields {
		selCols = append(selCols, "bl."+sqlQ(f.DB))
	}
	for _, j := range d.Joins {
		for _, jf := range j.Fields {
			selCols = append(selCols, fmt.Sprintf("COALESCE(%s.%s,'')", j.Alias, sqlQ(jf.Column)))
		}
	}
	selectList := strings.Join(selCols, ", ")

	var joinClauses []string
	for _, j := range d.Joins {
		joinClauses = append(joinClauses,
			fmt.Sprintf("LEFT JOIN %s %s ON bl.%s = %s.%s",
				sqlQ(j.Table), j.Alias, sqlQ(j.ChildCol), j.Alias, sqlQ(j.ParentCol)))
	}
	joinSQL := strings.Join(joinClauses, " ")

	childTable := sqlQ(ch.Table)
	childFK := sqlQ(ch.ParentFK)

	sb.WriteString("\trows, err := db.QueryContext(ctx,\n")
	sb.WriteString(fmt.Sprintf("\t\t`SELECT %s FROM %s bl %s WHERE bl.%s=$1 ORDER BY bl.id`, id)\n",
		selectList, childTable, joinSQL, childFK))
	sb.WriteString("\tif err != nil {\n")
	sb.WriteString(fmt.Sprintf("\t\treturn %s{}, err\n\t}\n", d.ResponseStruct))
	sb.WriteString("\tdefer rows.Close()\n\n")

	var scanArgs []string
	for _, f := range ch.Fields {
		scanArgs = append(scanArgs, "&l."+f.Go)
	}
	for _, j := range d.Joins {
		for _, jf := range j.Fields {
			scanArgs = append(scanArgs, "&l."+jf.As)
		}
	}
	scanList := strings.Join(scanArgs, ", ")

	for _, g := range d.Discriminator.Groups {
		sb.WriteString(fmt.Sprintf("\tvar %s []%s\n", g.ResponseField, ch.Struct))
	}

	sb.WriteString("\tfor rows.Next() {\n")
	sb.WriteString(fmt.Sprintf("\t\tvar l %s\n", ch.Struct))
	sb.WriteString(fmt.Sprintf("\t\tif err := rows.Scan(%s); err != nil {\n", scanList))
	sb.WriteString(fmt.Sprintf("\t\t\treturn %s{}, err\n\t\t}\n", d.ResponseStruct))
	sb.WriteString(fmt.Sprintf("\t\tswitch l.%s {\n", d.Discriminator.Field))
	for _, g := range d.Discriminator.Groups {
		sb.WriteString(fmt.Sprintf("\t\tcase %d:\n", g.Value))
		sb.WriteString(fmt.Sprintf("\t\t\t%s = append(%s, l)\n", g.ResponseField, g.ResponseField))
	}
	sb.WriteString("\t\t}\n")
	sb.WriteString("\t}\n\n")

	sb.WriteString(fmt.Sprintf("\treturn %s{\n", d.ResponseStruct))
	sb.WriteString(fmt.Sprintf("\t\t%s: bom.%s,\n", e.RowStruct, e.RowStruct))
	for _, g := range d.Discriminator.Groups {
		sb.WriteString(fmt.Sprintf("\t\t%s: %s,\n", g.ResponseField, g.ResponseField))
	}
	sb.WriteString("\t}, nil\n")
	sb.WriteString("}\n\n")
}
