## 渡されるカラムのtypeごとに表示する部品を変えることは可能ですか。たとえば、ItemCodeの場合はhtmxでDB値をオートコンプリートするテキストボックスで、ItemNameの場合はItemCodeで選択した品目名にしたいです。

**もちろん可能です！** そして、その要件が出てきたということは、実務レベルの非常に実践的なフェーズに入っていますね。

汎用CRUDコンポーネントの中で「特定のドメイン固有のUI（オートコンプリートなど）」を扱う場合、`Column`の`type`を拡張し、**Astroのコンポーネント内で条件分岐（SwitchやIf）を行って専用の入力部品をレンダリングする**のが定石です。

今回は一覧画面（Table）ではなく、新規登録や編集の**「フォーム画面（GenericForm）」**での実装を想定して、HTMXを使った「ItemCodeからItemNameを自動補完する」連動UIの作り方を解説します。

### 1. Column型の拡張

まず、標準の `text` や `number` に加えて、独自の型（`itemCode`, `itemName`）を定義できるようにします。

```typescript
// src/components/GenericForm.astro (または先ほどの GenericCrud.astro)
export interface Column {
  key: string;
  label: string;
  // カスタムタイプを追加
  type?: 'text' | 'number' | 'date' | 'itemCode' | 'itemName'; 
}
```

### 2. Astroコンポーネントでの条件分岐（動的レンダリング）

フォームを描画する際の `map` ループの中で、`col.type` によって出力するHTML（またはコンポーネント）を切り替えます。

```astro
---
// src/components/GenericForm.astro
import { type Column } from './types';

interface Props {
  columns: Column[];
  actionUrl: string;
}
const { columns, actionUrl } = Astro.props;
---

<form hx-post={actionUrl} hx-target="#modal-content" class="space-y-4">
  {columns.map(col => (
    <div>
      <label class="block text-sm font-medium mb-1">{col.label}</label>
      
      {/* typeによるレンダリングの分岐 */}
      {col.type === 'itemCode' ? (
        // 💡 ItemCode用: 入力されるとHTMXでサーバーに問い合わせる
        <input 
          type="text" 
          name={col.key} 
          class="border p-2 w-full"
          placeholder="品目コードを入力..."
          hx-get="/api/items/resolve-name" 
          hx-trigger="keyup changed delay:500ms" 
          hx-target="#wrapper-itemName" 
          hx-swap="innerHTML"
        />
        
      ) : col.type === 'itemName' ? (
        // 💡 ItemName用: サーバーからのレスポンスでここが書き換わる
        <div id="wrapper-itemName">
          <input 
            type="text" 
            name={col.key} 
            readonly 
            class="border p-2 w-full bg-gray-100 text-gray-500"
            placeholder="コードを入力すると自動入力されます" 
          />
        </div>
        
      ) : (
        // デフォルト（通常のテキスト等）
        <input 
          type={col.type === 'number' ? 'number' : 'text'} 
          name={col.key} 
          class="border p-2 w-full" 
        />
      )}
    </div>
  ))}
  
  <div class="mt-6 flex justify-end">
    <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">保存</button>
  </div>
</form>
```

### 3. HTMXによる連動（エンドポイント側の実装）

ユーザーが `ItemCode` に文字を打ち込んで500ミリ秒待つと、HTMXが `/api/items/resolve-name?itemCode=入力値` へGETリクエストを送ります。

AstroのAPIエンドポイント（将来のGoのHandler）は、JSONではなく**「ItemNameの入力欄のHTML断片」**を返します。

```typescript
// src/pages/api/items/resolve-name.ts
import type { APIRoute } from "astro";
// import { itemRepository } from "..." 

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("itemCode"); // 上記の例だと key 名が飛んでくる想定

  // DBから品目を検索（モック）
  let itemName = "";
  if (code === "A001") {
    itemName = "高級キーボード";
  } else if (code) {
    itemName = "見つかりません";
  }

  // HTMXの hx-target="#wrapper-itemName" の中身を書き換えるHTMLを返す
  const html = `
    <input 
      type="text" 
      name="itemName" 
      value="${itemName}" 
      readonly 
      class="border p-2 w-full ${itemName === '見つかりません' ? 'bg-red-100' : 'bg-gray-100'}"
    />
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
};
```

---

### さらに美しくするためのTips：コンポーネントの切り出し

分岐が多くなって `GenericForm.astro` が肥大化してきたら、分岐の中身を別のAstroコンポーネントに切り出すとスッキリします。

```astro
{col.type === 'itemCode' && <ItemCodeInput name={col.key} />}
{col.type === 'itemName' && <ItemNameDisplay name={col.key} />}
{col.type === 'text' && <TextInput name={col.key} />}
```

### GoTH (Go + Templ) への移植性

この「型を見てレンダリングするコンポーネントを切り替える」というアプローチは、GoのTemplでも**全く同じ概念（`switch`文）**で実装できます。

```go
// Go + Templ の未来の姿
templ GenericForm(columns []Column, actionUrl string) {
    <form hx-post={ actionUrl } hx-target="#modal-content">
        for _, col := range columns {
            <div>
                <label>{ col.Label }</label>
                switch col.Type {
                    case "itemCode":
                        @ItemCodeInput(col.Key)
                    case "itemName":
                        @ItemNameDisplay(col.Key)
                    default:
                        @DefaultInput(col.Key, col.Type)
                }
            </div>
        }
        <button type="submit">保存</button>
    </form>
}
```

このように、Astro側で「ドメイン固有のUIは型名（type）で制御し、実体はHTMXの通信で解決する」というルールを敷いておけば、フロントに複雑なJavaScript（AlpineやVanilla JSによる手動のDOM操作・イベントリスナー等）を書く必要がなくなります。

「コンポーネントの抽象化」と「HTMXによるHypermediaな状態更新」が綺麗に噛み合う、非常に美しい設計だと思います！他に「こういう複雑なUIパターンはどう汎用化する？」といったケースはありますか？
