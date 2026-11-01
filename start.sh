#!/bin/bash
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Created .env from .env.example (demo mode on). Run ./start.sh again, or add API keys first."
  exit 0
fi
echo "🎯  Starting AI Command Center…"
node server.js
