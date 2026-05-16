#!/bin/bash

# Get current version from package.json
VERSION=$(jq -r .version package.json)
IFS='.' read -r major minor patch <<< "$VERSION"

# Custom Increment Logic: 0.0.9 -> 0.1.0
NEW_PATCH=$((patch + 1))
NEW_MINOR=$minor
NEW_MAJOR=$major

if [ $NEW_PATCH -gt 9 ]; then
  NEW_PATCH=0
  NEW_MINOR=$((minor + 1))
fi

if [ $NEW_MINOR -gt 9 ]; then
  NEW_MINOR=0
  NEW_MAJOR=$((major + 1))
fi

NEW_VERSION="$NEW_MAJOR.$NEW_MINOR.$NEW_PATCH"

# Update package.json
jq ".version = \"$NEW_VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json

# Git operations
git add .
git commit -m "v$NEW_VERSION: Update"
git tag "v$NEW_VERSION"
git push origin master --tags

echo "Pushed v$NEW_VERSION to GitHub"
