/**
 * crud.js — CRUD テーブル共通クライアントサイドロジック
 *
 * - select-all チェックボックス制御
 * - 選択コピー (bulk copy)
 * - 選択削除 (bulk delete)
 * - ダウンロード (export)
 * - htmx swap 後の select-all リセット
 */

// ── select-all チェックボックス ──
document.addEventListener("change", function (e) {
  var target = e.target;
  if (!target.classList || !target.classList.contains("crud-select-all")) return;

  var bodyId = target.dataset.bodyId;
  if (!bodyId) return;
  var tbody = document.getElementById(bodyId);
  if (!tbody) return;

  var boxes = tbody.querySelectorAll('input[name="rowSelect"]');
  for (var i = 0; i < boxes.length; i++) {
    boxes[i].checked = target.checked;
  }
});

// htmx swap 後に select-all を解除
document.addEventListener("htmx:afterSwap", function (e) {
  var target = e.target;
  var table = target.closest ? target.closest("table") : null;
  if (!table) return;
  var selectAll = table.querySelector(".crud-select-all");
  if (selectAll) selectAll.checked = false;
});

// ── 選択コピー ──
document.addEventListener("click", function (e) {
  var btn = e.target.closest ? e.target.closest("[data-bulk-copy]") : null;
  if (!btn) return;

  var bodyTargetId = btn.dataset.bodyTarget;
  var tbody = document.getElementById(bodyTargetId);
  if (!tbody) return;

  var table = tbody.closest("table");
  if (!table) return;

  // 操作列のインデックスを特定（除外用）
  var thCells = Array.from(table.querySelectorAll("thead th"));
  var actionIdx = -1;
  for (var i = 0; i < thCells.length; i++) {
    if ((thCells[i].textContent || "").trim() === "操作") {
      actionIdx = i;
      break;
    }
  }
  // チェックボックス列（先頭）も除外
  var skipIndices = {};
  skipIndices[0] = true;
  if (actionIdx >= 0) skipIndices[actionIdx] = true;

  var headers = [];
  for (var i = 0; i < thCells.length; i++) {
    if (!skipIndices[i]) headers.push((thCells[i].textContent || "").trim());
  }

  var checked = tbody.querySelectorAll('input[name="rowSelect"]:checked');
  if (checked.length === 0) return;

  if (!confirm(checked.length + " 件の行をクリップボードにコピーしますか？")) return;

  var rows = [];
  for (var j = 0; j < checked.length; j++) {
    var tr = checked[j].closest("tr");
    if (!tr) continue;
    var cells = tr.querySelectorAll("td");
    var row = [];
    for (var k = 0; k < cells.length; k++) {
      if (!skipIndices[k]) row.push((cells[k].textContent || "").trim());
    }
    rows.push(row);
  }

  var lines = [headers.join("\t")];
  for (var r = 0; r < rows.length; r++) {
    lines.push(rows[r].join("\t"));
  }
  navigator.clipboard.writeText(lines.join("\n"));
});

// ── 選択削除 ──
document.addEventListener("click", function (e) {
  var btn = e.target.closest ? e.target.closest("[data-bulk-delete]") : null;
  if (!btn) return;

  var baseUrl = btn.dataset.bulkDelete;
  var bodyTargetId = btn.dataset.bodyTarget;
  var tbody = document.getElementById(bodyTargetId);
  if (!tbody) return;

  var checked = tbody.querySelectorAll('input[name="rowSelect"]:checked');
  if (checked.length === 0) {
    alert("削除する項目を選択してください");
    return;
  }

  var ids = [];
  for (var i = 0; i < checked.length; i++) {
    ids.push(checked[i].value);
  }
  if (!confirm(ids.length + " 件の項目を削除しますか？")) return;

  // Go ハンドラは r.Form["ids[]"] を期待するので FormData で送信
  var formData = new URLSearchParams();
  for (var i = 0; i < ids.length; i++) {
    formData.append("ids[]", ids[i]);
  }

  fetch(baseUrl, {
    method: "DELETE",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  }).then(function (res) {
    if (res.ok) {
      for (var i = 0; i < checked.length; i++) {
        var tr = checked[i].closest("tr");
        if (tr) tr.remove();
      }
      var table = tbody.closest("table");
      var selectAll = table ? table.querySelector(".crud-select-all") : null;
      if (selectAll) selectAll.checked = false;
    }
  });
});

// ── ダウンロード (export) ──
window.__crudExport = function (baseUrl, format, searchContainerId) {
  var params = new URLSearchParams({ format: format });
  if (searchContainerId) {
    var container = document.getElementById(searchContainerId);
    if (container) {
      var inputs = container.querySelectorAll("input[name], select[name]");
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].value) params.set(inputs[i].name, inputs[i].value);
      }
    }
  }
  window.location.href = baseUrl + "/export?" + params.toString();
};
