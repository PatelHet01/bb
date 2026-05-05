#!/bin/bash

echo "🚀 Starting Autopush Watcher..."
echo "Checking for file changes every 10 seconds..."

while true; do
  if [[ $(git status --porcelain) ]]; then
    echo ""
    echo "📦 Changes detected! Triggering push.sh..."
    ./push.sh "Auto-push: $(date +'%H:%M:%S')"
    echo "✅ Push complete. Resuming watch..."
  fi
  sleep 10
done
