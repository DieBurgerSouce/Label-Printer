#!/bin/bash
cd /app/data/labels
for dir in $(ls -t | head -100); do
  if grep -q '"articleNumber":"8116"' "$dir/metadata.json" 2>/dev/null; then
    echo "Found: $dir"
    cat "$dir/label.json"
    exit 0
  fi
done
echo "Not found in recent 100 labels"
