#!/bin/bash

# Increment version in package.json (patch version)
npm version patch --no-git-tag-version

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")

# Git operations
git add .
git commit -m "v$NEW_VERSION: Update"
git tag "v$NEW_VERSION"
git push origin master --tags

echo "Pushed v$NEW_VERSION to GitHub"
