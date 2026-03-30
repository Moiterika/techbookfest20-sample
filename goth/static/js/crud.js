/**
 * crud.js — CRUD テーブル共通クライアントサイドロジック
 *
 * - select-all チェックボックス制御
 * - 選択削除 (bulk delete)
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

  fetch(baseUrl, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: ids }),
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
