# techbookfest20-sample

Docker / Dev Container 利用メモです。

## Dev Container の `command` について

`.devcontainer/compose.yaml` の `app` サービスでは、次の設定を使っています。

`command: sleep infinity`

これは **アプリを起動するためのコマンドではなく、開発用コンテナを生かし続けるための待機コマンド** です。

### なぜ必要か

`air`を入れてないので。

Dev Container では、VS Code が接続する先のコンテナが起動し続けている必要があります。  
Go アプリの本体を `command` にしてしまうと、アプリが終了した時点でコンテナも止まります。

そのため、

- コンテナ自体は待機させておく
- VS Code / Zed から中に入る
- 必要に応じて `go run` や `air` などを手動実行する

という形にしています。

### 補足

もし開発中に自動起動したいなら、将来的には例えば次のような形にもできます。

- `command: ["air"]`

---

## `target: dev` の意味

`.devcontainer/compose.yaml` では次のように指定しています。

`target: dev`

これは、`Dockerfile` のマルチステージビルドのうち **`dev` ステージを最終成果物として使う** という意味です。

つまり Dev Container 起動時は、以下のステージだけを使います。

- `dev`

使われないステージ:

- `build`
- `final`

### ポイント

`Dockerfile` に `dev`, `build`, `final` が並んでいても、  
`target: dev` を指定してビルドした場合、**開発コンテナとして使われるイメージは `dev` ステージの内容** になります。

---

## 本番ビルド方法

本番用イメージを作るときは、`final` ステージを target にしてビルドします。

### 本番イメージをビルド

```/dev/null/README.md#L1-3
docker build --target final -t techbookfest20-sample:prod .
```

### 本番イメージを実行

```/dev/null/README.md#L1-3
docker run --rm -p 4321:4321 techbookfest20-sample:prod
```

---

## 開発用イメージを手動でビルドしたい場合

Dev Container / Compose を使わず、手元で `dev` ステージだけをビルドしたい場合:

```/dev/null/README.md#L1-3
docker build --target dev -t techbookfest20-sample:dev .
```

---

## Compose で開発環境を起動

`.devcontainer/compose.yaml` を使って起動する場合:

```/dev/null/README.md#L1-3
docker compose -f .devcontainer/compose.yaml up --build
```

バックグラウンド起動:

```/dev/null/README.md#L1-3
docker compose -f .devcontainer/compose.yaml up --build -d
```

停止:

```/dev/null/README.md#L1-3
docker compose -f .devcontainer/compose.yaml down
```

ボリュームも削除:

```/dev/null/README.md#L1-3
docker compose -f .devcontainer/compose.yaml down -v
```

---

## `.dockerignore` の役割について

このリポジトリのルートには `.dockerignore` があります。

`.dockerignore` は、**Docker build 時にビルドコンテキストへ含めないファイル・ディレクトリを指定するためのファイル** です。

### 何に効くか

例えば今回の `.devcontainer/compose.yaml` では、`app` サービスの build context は `..` です。  
つまり `.devcontainer` から見た親ディレクトリ、すなわち **プロジェクトルート** がビルドコンテキストになります。

そのため、ルートにある `.dockerignore` は次のような場面で有効です。

- `docker build ...`
- `docker compose build`
- `docker compose up --build`

### 何が嬉しいか

`.dockerignore` を置くことで、例えば次のような不要ファイルをビルド時に送らずに済みます。

- `.git`
- `.vscode`
- `node_modules`
- ローカルの成果物
- テスト生成物
- 開発補助用ディレクトリ

その結果、

- ビルドコンテキストが軽くなる
- ビルドが速くなりやすい
- 不要ファイルがイメージに紛れ込みにくい

というメリットがあります。

### 注意点

`.dockerignore` は **Docker build には効きますが、Compose の bind mount には効きません**。

例えば `app` サービスでは、次の volume 設定があります。

`../:/workspace:cached`

これはホストのディレクトリをそのままコンテナへマウントする設定です。  
このときは `.dockerignore` では除外されず、ホスト側のファイルがそのまま `/workspace` に見えます。

つまり整理すると:

- `.dockerignore`  
  Docker イメージを **ビルドするとき** に効く
- `volumes` / bind mount  
  コンテナへ **直接見せるとき** なので `.dockerignore` は効かない

### このリポジトリでの位置づけ

今回の構成では `.dockerignore` は有効です。  
ただし主な役割は **本番ビルドや開発用イメージのビルド時の軽量化・整理** であり、  
Dev Container 内の `/workspace` に何が見えるかを制御するものではありません。

---

## `volumes` と `WORKDIR` / `/app` のズレについて

結論から言うと、**少しズレていますが、直ちに壊れるわけではありません**。  
ただし、意図が分かりづらいので揃えたほうがよいです。

### 現在の状態

`compose.yaml` の `app` サービスでは、ホストのプロジェクトを次にマウントしています。

```/dev/null/README.md#L1-3
../:/workspace:cached
```

一方、`Dockerfile` では:

- `dev` ステージ: `WORKDIR /workspace`
- `build` ステージ: `WORKDIR /app`
- `final` ステージ: `WORKDIR /app`

### どう解釈すればいいか

これは用途が違います。

- `dev` ステージ  
  Dev Container 用。ホストのソースコードを `/workspace` にマウントして作業する。
- `build` ステージ  
  本番ビルド用。BuildKit の bind mount を使って、その場でソースを読んで `/app` でビルドする。
- `final` ステージ  
  実行専用。完成したバイナリだけ持つ。

なので、**開発時の `/workspace` と本番ビルド時の `/app` は別用途** と考えれば成立します。

### ただし気になる点

`build` ステージでこのようになっています。

```/dev/null/README.md#L1-3
RUN --mount=type=bind,target=. \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s" -trimpath -o /bin/server .
```

ここでは `WORKDIR /app` の上にソースを bind mount しているため、ビルド時には `/app` にソースが見えます。  
これは `dev` の `/workspace` と概念が分かれているだけで、動作上は問題ありません。

### おすすめ

読みやすさ優先なら、次のどちらかに寄せるとよいです。

#### パターンA: 開発だけ `/workspace`、本番は `/app` のままにする
- 今のままでもOK
- 「Dev Container 用パス」と「本番ビルド用パス」は別、と README に明記する

#### パターンB: すべて `/workspace` に寄せる
- `build` ステージの `WORKDIR` も `/workspace`
- `final` ステージの `WORKDIR` も必要なら `/workspace` へ統一

ただし `final` は実行専用なので、`WORKDIR /app` のままでも特に問題ありません。  
一番大事なのは **開発者が見た時に混乱しないこと** です。

---

## 現状の理解まとめ

- Dev Container の `command` は、コンテナを起動し続けるための待機コマンド
- `target: dev` なら、Dev Container では `Dockerfile` の `dev` ステージが使われる
- 本番ビルド時は `docker build --target final ...` を使う
- `.dockerignore` は Docker build 時に有効だが、bind mount には効かない
- `/workspace` と `/app` は用途が違うので即NGではないが、やや分かりにくい

---

## おすすめの今後の整理方針

この構成なら、次の整理が自然です。

1. Dev Container は `/workspace` を使う
2. 本番ビルドは `final` ターゲットで作る
3. README に開発用・本番用コマンドを残す
4. 必要なら今後 `build` ステージの `WORKDIR` を `/workspace` に寄せる

必要なら次に、
- `Dockerfile` の `/app` と `/workspace` を整理した版
- `compose.yaml` の `healthcheck` 追加
- `devcontainer.json` のポート設定見直し

までまとめてやると、かなり分かりやすくなります。
