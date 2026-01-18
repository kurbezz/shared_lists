#!/usr/bin/env bash
set -euo pipefail

echo "Installing git hooks (sets core.hooksPath to .githooks)..."

git config core.hooksPath .githooks

echo "Done. To undo: git config --unset core.hooksPath"