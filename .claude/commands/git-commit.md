---
allowed-tools: Bash, Read, Glob, Grep
description: Analyze local git changes and create a concise, comprehensive commit message. Use when ready to commit staged changes.
---

# Git Commit Message Generator

Analyze the current git repository state and create an appropriate commit message.

## Steps

1. **Gather git state** - Run these commands to understand current changes:
   - `git status` - See staged, unstaged, and untracked files
   - `git diff --cached` - View staged changes (what will be committed)
   - `git diff` - View unstaged changes (for context)
   - `git log --oneline -5` - See recent commit style for consistency

2. **Analyze the changes** - Understand what was modified:
   - What files were added, modified, or deleted?
   - What is the nature of the changes (feature, fix, refactor, docs, etc.)?
   - Are there related changes that form a cohesive unit?

3. **Generate commit message** - Follow these guidelines:
   - **First line**: Imperative mood, max 50 chars, no period (e.g., "Add user authentication endpoint")
   - **Body** (if needed): Explain *why*, not *what* - the diff shows what
   - Use conventional commit prefixes when appropriate: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`

4. **Present options** - Show the user:
   - The proposed commit message
   - A summary of what's being committed
   - Ask for confirmation or modifications

5. **Execute commit** - If user approves:
   - Stage any requested files if needed (`git add`)
   - Run `git commit` with the message
   - Show the result

## Commit Message Style

Prefer concise messages that capture the essence:
- Good: `feat: add dark mode toggle to settings`
- Good: `fix: prevent crash when user has no profile`
- Bad: `Updated files` (too vague)
- Bad: `Fixed the bug in the thing` (unclear)

For multi-file changes, focus on the overall purpose rather than listing every file.

## Safety

- Never commit files containing secrets (.env, credentials, keys)
- Warn if committing large binary files
- Confirm before committing if there are also unstaged changes
