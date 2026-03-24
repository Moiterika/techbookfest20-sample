# AHA/GoTHスタックでのnpm資産（フロントエンドライブラリ）の利用方法

Astroの `client:load` や `client:visible` のようなディレクティブが使えない環境（純粋なHTML + HTMX + Alpine.js の構成や、GoTHスタックへ移行した場合）において、ReactやVueなどのクライアントサイドでリアクティブに動くnpmのUIコンポーネント資産を活用するための3つのアプローチをまとめます。

---

## アプローチ1：Web Components（カスタム要素）でラップする（推奨）

npmの資産（Reactライブラリ等）を標準のWeb Components（Custom Elements）としてラップして利用する方法です。
HTML側からはただのHTMLタグとして扱えるため、HTMXやAlpine.js、素のJavaScriptとの相性が最も良く、AHA/GoTHスタックにおいて推奨されるアプローチです。

### 実装例（Reactのバーコードライブラリ `react-barcode` をラップする例）

**1. ラッパーコンポーネントの作成 (`src/components/ReactBarcodeWrapper.tsx`)**

```tsx
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import Barcode from 'react-barcode';

class ReactBarcodeWrapper extends HTMLElement {
  private mountPoint: HTMLDivElement;
  private root: Root;

  constructor() {
    super();
    this.mountPoint = document.createElement('div');
    this.appendChild(this.mountPoint);
    this.root = createRoot(this.mountPoint);
  }

  connectedCallback() {
    this.render();
  }

  // 監視する属性を指定
  static get observedAttributes() {
    return ['value'];
  }

  // 属性が変更されたら再レンダリング
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    const value = this.getAttribute('value') || '';
    if (value.trim() !== '') {
      this.root.render(<Barcode value={value} />);
    } else {
      this.root.render(<div style={{ color: '#999' }}>No barcode value</div>);
    }
  }
}

// カスタム要素として登録
if (!customElements.get('react-barcode')) {
  customElements.define('react-barcode', ReactBarcodeWrapper);
}
```

**2. HTML (Astro / Templ) 側での利用 (`src/components/items/ItemForm.astro`)**

Alpine.jsを使って入力値とカスタム要素の属性（`value`）を連動させます。

```html
<script>
  // ラッパーを読み込む（ビルドツールでバンドルさせる）
  import "../ReactBarcodeWrapper.tsx";
</script>

<!-- Alpine.jsで状態管理 -->
<div x-data="{ barcodeVal: '' }">
  <label>
    バーコード入力:
    <!-- x-modelで入力値をバインド -->
    <input name="barcode" type="text" x-model="barcodeVal" />
  </label>
  
  <div style="margin-top: 10px;">
    <!-- x-bind でカスタム要素の value 属性に値を渡す -->
    <react-barcode x-bind:value="barcodeVal"></react-barcode>
  </div>
</div>
```

---

## アプローチ2：Vanilla JS / Alpine.jsからマウント用の関数を呼ぶ

Reactなどのルートをマウントする処理をグローバル関数（`window` オブジェクトのメソッドなど）として露出させ、HTML側からAlpine.jsや素のJSのイベントリスナーを使って直接呼び出す方法です。

**フロントエンド側 (バンドルするJS):**
```typescript
import { createRoot } from 'react-dom/client';
import Barcode from 'react-barcode';

window.renderBarcode = (elementId, value) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (!el._root) el._root = createRoot(el);
    el._root.render(<Barcode value={value} />);
};
```

**HTML側:**
```html
<script src="/static/bundle.js" defer></script>

<div x-data="{ text: '' }">
    <input 
        type="text" 
        x-model="text" 
        x-effect="window.renderBarcode('barcode-container', text)"
    />
    <div id="barcode-container"></div>
</div>
```

---

## アプローチ3：サーバーサイドで生成する（Hypermedia-Drivenなアプローチ）

GoTHスタックの本来の思想に基づき、クライアント側でのJavaScriptライブラリの実行を諦め、サーバーサイドでHTMLや画像を生成してHTMXで部分更新する方法です。

npmの資産を利用するという目的からは外れますが、JSの依存を減らすという観点ではアーキテクチャに最も沿っています。

**HTML側 (HTMXを利用):**
```html
<!-- ユーザーが入力して500ms経過したら、サーバーにHTMXでリクエスト -->
<input 
    type="text" 
    name="barcode_text"
    hx-get="/api/barcode" 
    hx-trigger="keyup changed delay:500ms" 
    hx-target="#barcode-container"
/>
<div id="barcode-container">
    <!-- ここにサーバーから返された <img> タグなどのHTML断片が差し込まれる -->
</div>
```

**サーバー側:**
リクエストを受け取ったサーバー（Goなど）のライブラリ（`boombuler/barcode` 等）でバーコード画像を生成し、`<img src="data:image/png;base64,...">` などのHTML文字列をレスポンスとして返却します。