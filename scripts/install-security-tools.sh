#!/usr/bin/env bash
set -euo pipefail

TOOL_DIR="${1:?security tool directory is required}"
mkdir -p "$TOOL_DIR"

download_and_verify() {
  local url="$1"
  local checksum="$2"
  local archive="$3"

  curl --fail --location --silent --show-error --output "$archive" "$url"
  printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check
}

download_and_verify \
  https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz \
  551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb \
  "$TOOL_DIR/gitleaks.tar.gz"
tar -xzf "$TOOL_DIR/gitleaks.tar.gz" -C "$TOOL_DIR" gitleaks

download_and_verify \
  https://github.com/zizmorcore/zizmor/releases/download/v1.29.0/zizmor-x86_64-unknown-linux-gnu.tar.gz \
  dd96df044a6e8538d5f423790f453bdd03d49e5b2bcc38214acc41a2f1297839 \
  "$TOOL_DIR/zizmor.tar.gz"
tar -xzf "$TOOL_DIR/zizmor.tar.gz" -C "$TOOL_DIR" zizmor

download_and_verify \
  https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz \
  8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8 \
  "$TOOL_DIR/actionlint.tar.gz"
tar -xzf "$TOOL_DIR/actionlint.tar.gz" -C "$TOOL_DIR" actionlint
