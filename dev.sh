#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> [aha] bun gen:all"
cd "$SCRIPT_DIR/aha" && bun gen:all

echo "==> [goth] go run ./cmd/web/main.go"
cd "$SCRIPT_DIR/goth" && go run ./cmd/web/main.go
