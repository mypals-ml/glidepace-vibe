#!/bin/bash
# Helper script to run checks using the local Node.js path
# This ensures that type-checking and linting always use the correct environment.

NODE_BIN_DIR="/opt/homebrew/opt/node@22/bin"
export PATH="$NODE_BIN_DIR:$PATH"

if [ "$1" == "lint" ]; then
  npm run lint
else
  npm run type-check
fi
