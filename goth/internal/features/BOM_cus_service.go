package features

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-gorp/gorp/v3"
)

func validateBomLines(lines []作成InputBOM明細) error {
	// 製造行が少なくとも1行必要
	hasOutput := false
	for _, l := range lines {
		if l.区分 == 2 {
			hasOutput = true
			break
		}
	}
	if !hasOutput {
		return errors.New("製造行が少なくとも1行必要です")
	}

	// 各行の品目・数量・単位は必須
	for _, l := range lines {
		if l.品目ID == 0 || strings.TrimSpace(l.数量) == "" || strings.TrimSpace(l.単位) == "" {
			return errors.New("各行の品目・数量・単位は必須です")
		}
		// BOM版を指定する場合、BOMコードも必要
		if l.参照BOM版 != nil && *l.参照BOM版 != "" && (l.参照BOMコード == nil || *l.参照BOMコード == "") {
			return errors.New("BOM版を指定する場合、BOMコードも必要です")
		}
	}

	// 製造品目と投入品目に同じ品目は登録できない
	outputItemIds := map[int]bool{}
	for _, l := range lines {
		if l.区分 == 2 {
			outputItemIds[l.品目ID] = true
		}
	}
	for _, l := range lines {
		if l.区分 == 1 && outputItemIds[l.品目ID] {
			return errors.New("製造品目と投入品目に同じ品目は登録できません")
		}
	}

	return nil
}

func Validate登録BOM(_ context.Context, _ *gorp.DbMap, input 作成InputBOMWithLines) error {
	return validateBomLines(input.LinesBOM明細)
}

func Validate更新BOM(_ context.Context, _ *gorp.DbMap, input 更新InputBOMWithLines) error {
	return validateBomLines(input.LinesBOM明細)
}

func Parse作成FormBOM(r *http.Request) 作成InputBOMWithLines {
	lines := parseBomLines(r)
	return 作成InputBOMWithLines{
		作成InputBOM: 作成InputBOM{
			コード: r.FormValue("コード"),
			版:    r.FormValue("版"),
			名称:  r.FormValue("名称"),
		},
		LinesBOM明細: lines,
	}
}

func Parse更新FormBOM(r *http.Request, id int) 更新InputBOMWithLines {
	lines := parseBomLines(r)
	return 更新InputBOMWithLines{
		更新InputBOM: 更新InputBOM{
			ID:  id,
			コード: r.FormValue("コード"),
			版:    r.FormValue("版"),
			名称:  r.FormValue("名称"),
		},
		LinesBOM明細: lines,
	}
}

func parseBomLines(r *http.Request) []作成InputBOM明細 {
	types := r.Form["line区分"]
	itemIds := r.Form["line品目ID"]
	quantities := r.Form["line数量"]
	units := r.Form["line単位"]
	refCodes := r.Form["line参照BOMコード"]
	refVersions := r.Form["line参照BOM版"]

	var lines []作成InputBOM明細
	for i := range types {
		refCode := stringOrNil(safeIndex(refCodes, i))
		refVersion := stringOrNil(safeIndex(refVersions, i))
		lines = append(lines, 作成InputBOM明細{
			区分:         parseInt(safeIndex(types, i)),
			品目ID:       parseInt(safeIndex(itemIds, i)),
			数量:         safeIndex(quantities, i),
			単位:         safeIndex(units, i),
			参照BOMコード: refCode,
			参照BOM版:    refVersion,
		})
	}
	return lines
}

func safeIndex(ss []string, i int) string {
	if i < len(ss) {
		return ss[i]
	}
	return ""
}

func stringOrNil(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

// parseInt は文字列を int に変換するヘルパー
func parseInt(s string) int {
	v, _ := strconv.Atoi(s)
	return v
}
