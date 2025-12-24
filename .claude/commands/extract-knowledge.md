---
allowed-tools: Read, Write, Glob, Grep
description: Analyze conversation context and extract reusable knowledge for the knowledge base. Use after completing tasks that produced useful patterns, solutions, or reference material.
---

# Extract Knowledge to Knowledge Base

Review the current conversation and identify information worth preserving in `knowledge/` for future agent sessions.

## What to Extract

**Guides (`knowledge/guides/`)** - How-to documentation:
- Step-by-step procedures that worked
- Troubleshooting steps for problems solved
- Integration patterns with external services
- Configuration approaches

**Templates (`knowledge/templates/`)** - Reusable starting points:
- Code templates that can be adapted
- Configuration file templates
- Script boilerplates

## Extraction Criteria

Extract information that is:
- **Reusable** - Applicable beyond this specific conversation
- **Non-obvious** - Not easily found in official docs
- **Tested** - Actually worked in this session
- **Stable** - Unlikely to change frequently

Do NOT extract:
- One-off fixes specific to a single issue
- Information already in CLAUDE.md
- Sensitive data (API keys, credentials, personal info)
- Temporary workarounds

## Output Format

For each piece of extractable knowledge:

1. **Category**: guide or template
2. **Filename**: descriptive-name.md
3. **Content**: Concise, actionable content

Keep all knowledge entries:
- Under 100 lines when possible
- Focused on one topic
- Written for an agent with no prior context
- Including practical examples

## Organization

Feel free to improve the `knowledge/` structure:
- Create new subdirectories if a topic area is emerging (e.g., `knowledge/guides/apis/`)
- Consolidate related small files into a single comprehensive guide
- Reorganize or rename files if it improves discoverability
- Remove outdated or redundant content

Prioritize clean, logical organization over preserving existing structure.

## Action

After identifying extractable knowledge:
1. List what you found and proposed filenames
2. Suggest any organizational improvements (new subdirs, consolidations, etc.)
3. Ask user to confirm which items to save and any structural changes
4. Write approved items and apply organizational changes
