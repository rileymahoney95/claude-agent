---
description: Analyze and clean up all CLAUDE.md files in the repo for better hygiene
allowed-tools: Bash(find:*), Bash(cat:*), Bash(wc:*)
---

# CLAUDE.md Cleanup Command

Analyze all CLAUDE.md documentation files in this repository and improve them for better Claude Code hygiene.

## Context

Current CLAUDE.md files in the repo:
!`find . -name "CLAUDE.md" -o -name "CLAUDE.local.md" -o -path "*/.claude/settings.md" 2>/dev/null | grep -v node_modules | grep -v .git | head -20`

Project manifest (for context):
!`cat package.json 2>/dev/null | head -50 || cat Cargo.toml 2>/dev/null | head -50 || cat pyproject.toml 2>/dev/null | head -50 || echo "No manifest found"`

## Your Task

For each CLAUDE.md file found, analyze and improve it following these principles:

### What Makes a Good CLAUDE.md

1. **Concise & Actionable** - Brief instructions that are directly useful, not essays
2. **Project-Specific** - Only information unique to THIS project, not generic advice
3. **Up-to-Date** - No outdated versions, deprecated APIs, or stale TODOs
4. **Well-Structured** - Clear hierarchy (`#` for main sections, `##` for sub)
5. **No Redundancy** - Don't repeat what's obvious from package.json or standard practices

### Common Issues to Fix

- **Verbose explanations** → Convert to bullet points or remove entirely
- **Generic advice** (e.g., "use meaningful variable names") → Remove
- **Outdated references** (old versions, deprecated patterns) → Update or remove
- **Poor organization** → Restructure with clear sections
- **Duplicate information** → Consolidate
- **Stale TODOs** marked as done → Clean up
- **Instructions that contradict each other** → Resolve
- **Obvious information** (how to run `npm install`) → Remove

### Recommended Sections (keep brief)

```markdown
# Project Name

One sentence description.

## Commands

- `npm run dev` - Start dev server
- `npm test` - Run tests

## Architecture

- `/src/api` - API routes
- `/src/db` - Database models

## Patterns

- Use X pattern for Y
- Prefer A over B

## Gotchas

- Thing that's not obvious
- Common mistake to avoid
```

## Process

1. Read each CLAUDE.md file found
2. Identify issues (verbosity, outdated info, poor structure, etc.)
3. Present a summary of issues found
4. Propose the improved content
5. Ask for confirmation before writing changes
6. Update the files

If `$ARGUMENTS` is provided, focus only on that specific file or directory.

Target: $ARGUMENTS

Start by reading the CLAUDE.md files and presenting your analysis.