#!/bin/bash
# Claude Code PostToolUse hook for Edit/Write operations
# Runs lint only for changed files

# Read JSON input from stdin
input=$(cat)

# Extract file path from tool_input (handles both file_path and filePath)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.filePath // empty' 2>/dev/null || echo "")

# Only run for TypeScript/JavaScript files in src/ directory
if [[ "$file_path" =~ src/.*\.(ts|js|json)$ ]]; then
  echo "[Hook] Running lint for $file_path" >&2

  # Lint the specific file with auto-fix
  cd "$CLAUDE_PROJECT_DIR"
  pnpm exec eslint "$file_path" --fix || true
fi

exit 0
