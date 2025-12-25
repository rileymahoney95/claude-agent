# Git Commit

Generate a concise but detailed commit message based on the current changes.

## Instructions

1. **Examine staged changes** using `git diff --cached` (or all changes with `git diff HEAD` if nothing is staged)

2. **Analyze the changes** to understand:

   - What files were modified, added, or deleted
   - The nature of the changes (feature, fix, refactor, docs, style, test, chore)
   - The scope/area of the codebase affected

3. **Generate a commit message** following conventional commit format:

   ```
   <type>(<scope>): <subject>

   <body>
   ```

   - **Type**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`
   - **Scope**: Optional, the area of codebase (e.g., `api`, `auth`, `ui`)
   - **Subject**: Imperative mood, no period, under 50 chars (e.g., "add user authentication")
   - **Body**: Optional, explain what and why (not how), wrap at 72 chars

4. **Present the commit message** and ask if I want to:
   - Use it as-is
   - Modify it
   - Stage additional files first

## Guidelines

- Be specific but concise - capture the essence of what changed
- Group related changes logically
- If changes span multiple concerns, suggest splitting into separate commits
- For breaking changes, include `BREAKING CHANGE:` in the body
- Reference issue numbers if mentioned in the context (e.g., `fixes #123`)

## Examples

Good commit messages:

- `feat(auth): add OAuth2 login with Google provider`
- `fix(api): handle null response from external service`
- `refactor(utils): extract date formatting into helper module`
- `docs(readme): add installation instructions for Windows`
