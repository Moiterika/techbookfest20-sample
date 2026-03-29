# syntax=docker/dockerfile:1
# check=error=true

# ARG GO_VERSION=1.26-alpine@sha256:2389ebfa5b7f43eeafbd6be0c3700cc46690ef842ad962f6c5bd6be49ed82039
ARG GO_VERSION=1.26@sha256:595c7847cff97c9a9e76f015083c481d26078f961c9c8dca3923132f51fe12f1

### ----------------- ###
### Development image ###
### ----------------- ###
FROM golang:${GO_VERSION} AS dev

# インストール時にキャッシュを残さないための設定
ENV MSG_PREF="no-cache"

# 必要なパッケージのインストール（astro language server用にnodejsとnpmもインストールする）
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    git \
    bash \
    sudo \
    build-essential \
    curl \
    unzip \
    coreutils \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Bunのインストール
RUN curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/ \
    && ln -s /usr/local/bin/bun /usr/local/bin/bunx \
    && rm -rf /root/.bun

# --- ユーザー設定セクション ---
ARG USERNAME=zeduser
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m -s /bin/bash $USERNAME \
    && echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Goのモジュールキャッシュなどを非rootユーザーが書き込めるように権限調整
RUN mkdir -p /go/pkg/mod && chown -R $USER_UID:$USER_GID /go

# コンテナ起動時のデフォルトユーザーを指定
USER $USERNAME

# Bunでclaude-codeをグローバルインストールし、PATHを通す
RUN bun install -g @anthropic-ai/claude-code
ENV PATH="/home/${USERNAME}/.bun/bin:${PATH}"

# ワークスペースディレクトリ（マウントポイント）を指定
WORKDIR /workspace

### ---------------- ###
### Build image      ###
### ---------------- ###
FROM golang:${GO_VERSION} AS build

WORKDIR /app

# 依存関係のダウンロードとビルド
# bind mountsとcacheを活用してビルドを高速化＆レイヤーをきれいに保つ
RUN --mount=type=cache,target=/go/pkg/mod/,sharing=locked \
    --mount=type=bind,source=goth/go.sum,target=go.sum \
    --mount=type=bind,source=goth/go.mod,target=go.mod \
    go mod download -x || true

# アプリケーションのビルド
# -s ldflagsのみで十分（Go 1.22以降）
RUN --mount=type=cache,target=/go/pkg/mod/ \
    --mount=type=bind,source=goth,target=. \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s" -trimpath -o /bin/server .

### ---------------- ###
### Production image ###
### ---------------- ###
# digest付きのdistrolessイメージを使用
FROM gcr.io/distroless/static-debian13:nonroot@sha256:b5b9fd04c8dcf72a173183c0b7dee47e053e002246b308a59f3441db7b8b9cc4 AS final

# ビルドしたバイナリをコピー
COPY --from=build /bin/server /bin/server

WORKDIR /app

# 非rootユーザーでの実行
USER nonroot:nonroot

EXPOSE 8080

ENTRYPOINT ["/bin/server"]
