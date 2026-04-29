#!/bin/bash
# Vercel Ignored Build Step (runs from frontend/ root)
# Exit 0 = skip build. Exit 1 = proceed with build.

COMMIT_MSG=$(git log -1 --pretty=%B)

if echo "$COMMIT_MSG" | grep -qF "[skip vercel]"; then
  echo "Skipping: [skip vercel] tag found"
  exit 0
fi

if git diff HEAD^ HEAD --name-only | grep -qE \
  '^frontend/(src/|public/|index\.html|vite\.config\.|package\.json|bun\.lock|vercel\.json)'; then
  echo "Building: app code changed"
  exit 1
fi

echo "Skipping: no app code changed"
exit 0
