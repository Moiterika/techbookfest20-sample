package features

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"
)

func validateBomLines(lines []作成InputBomLines) error {
	// 製造行が少なくとも1行必要
	hasOutput := false
	for _, l := range lines {
		if l.Type == 2 {
			hasOutput = true
			break
		}
	}
	if !hasOutput {
		return errors.New("製造行が少なくとも1行必要です")
	}

	// 各行の品目・数量・単位は必須
	for _, l := range lines {
		if l.ItemId == 0 || strings.TrimSpace(l.Quantity) == "" || strings.TrimSpace(l.Unit) == "" {
			return errors.New("各行の品目・数量・単位は必須です")
		}
		// BOM版を指定する場合、BOMコードも必要
		if l.RefBomVersion != nil && *l.RefBomVersion != "" && (l.RefBomCode == nil || *l.RefBomCode == "") {
			return errors.New("BOM版を指定する場合、BOMコードも必要です")
		}
	}

	// 製造品目と投入品目に同じ品目は登録できない
	outputItemIds := map[int]bool{}
	for _, l := range lines {
		if l.Type == 2 {
			outputItemIds[l.ItemId] = true
		}
	}
	for _, l := range lines {
		if l.Type == 1 && outputItemIds[l.ItemId] {
			return errors.New("製造品目と投入品目に同じ品目は登録できません")
		}
	}

	return nil
}

func Validate登録BOM(_ context.Context, _ *sql.DB, input 作成InputBOMWithLines) error {
	return validateBomLines(input.LinesBomLines)
}

func Validate更新BOM(_ context.Context, _ *sql.DB, input 更新InputBOMWithLines) error {
	return validateBomLines(input.LinesBomLines)
}

func Parse作成FormBOM(r *http.Request) 作成InputBOMWithLines {
	lines := parseBomLines(r)
	return 作成InputBOMWithLines{
		作成InputBOM: 作成InputBOM{
			Code:    r.FormValue("code"),
			Version: r.FormValue("version"),
			Name:    r.FormValue("name"),
		},
		LinesBomLines: lines,
	}
}

func Parse更新FormBOM(r *http.Request, id int) 更新InputBOMWithLines {
	lines := parseBomLines(r)
	return 更新InputBOMWithLines{
		更新InputBOM: 更新InputBOM{
			ID:      id,
			Code:    r.FormValue("code"),
			Version: r.FormValue("version"),
			Name:    r.FormValue("name"),
		},
		LinesBomLines: lines,
	}
}

func parseBomLines(r *http.Request) []作成InputBomLines {
	types := r.Form["lineType"]
	itemIds := r.Form["lineItemId"]
	quantities := r.Form["lineQuantity"]
	units := r.Form["lineUnit"]
	refCodes := r.Form["lineRefBomCode"]
	refVersions := r.Form["lineRefBomVersion"]

	var lines []作成InputBomLines
	for i := range types {
		refCode := stringOrNil(safeIndex(refCodes, i))
		refVersion := stringOrNil(safeIndex(refVersions, i))
		lines = append(lines, 作成InputBomLines{
			Type:          parseInt(safeIndex(types, i)),
			ItemId:        parseInt(safeIndex(itemIds, i)),
			Quantity:      safeIndex(quantities, i),
			Unit:          safeIndex(units, i),
			RefBomCode:    refCode,
			RefBomVersion: refVersion,
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

// parseInt は文字列を int に変換���るヘルパー
func parseInt(s string) int {
	v, _ := strconv.Atoi(s)
	return v
}
