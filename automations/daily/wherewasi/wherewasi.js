#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PROJECTS_PATH = path.join(REPO_ROOT, 'links', 'projects');
const MAX_DEPTH = 4;
const RECENT_DAYS = 7;
const MAX_COMMITS = 5;
const MAX_TODOS = 10;

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

// Run a git command in a directory, return stdout or null on error
function git(cwd, args) {
  try {
    return execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

// Find all git repositories recursively
function findGitRepos(baseDir, depth = 0) {
  if (depth > MAX_DEPTH) return [];

  const repos = [];
  let entries;

  try {
    entries = fs.readdirSync(baseDir, { withFileTypes: true });
  } catch {
    return repos;
  }

  // Check if this directory is a git repo
  const hasGit = entries.some(e => e.name === '.git' && e.isDirectory());
  if (hasGit) {
    repos.push(baseDir);
    return repos; // Don't recurse into git repos (skip submodules)
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    const subPath = path.join(baseDir, entry.name);
    repos.push(...findGitRepos(subPath, depth + 1));
  }

  return repos;
}

// Get uncommitted changes
function getUncommittedChanges(repoPath) {
  const status = git(repoPath, 'status --porcelain');
  if (!status) return { files: [], staged: 0, modified: 0, untracked: 0 };

  const files = status.split('\n').filter(Boolean);
  let staged = 0, modified = 0, untracked = 0;

  for (const line of files) {
    const index = line[0];
    const worktree = line[1];

    if (index !== ' ' && index !== '?') staged++;
    if (worktree === 'M' || worktree === 'D') modified++;
    if (index === '?') untracked++;
  }

  return { files, staged, modified, untracked };
}

// Get stash count
function getStashCount(repoPath) {
  const stashes = git(repoPath, 'stash list');
  if (!stashes) return 0;
  return stashes.split('\n').filter(Boolean).length;
}

// Get recent commits
function getRecentCommits(repoPath) {
  const log = git(repoPath, `log --oneline --since="${RECENT_DAYS} days ago" -n ${MAX_COMMITS} --format="%h %ar - %s"`);
  if (!log) return [];
  return log.split('\n').filter(Boolean);
}

// Check if repo has any recent activity (commits in last N days)
function hasRecentActivity(repoPath) {
  const lastCommit = git(repoPath, 'log -1 --format="%ct"');
  if (!lastCommit) return false;

  const commitTime = parseInt(lastCommit, 10) * 1000;
  const cutoff = Date.now() - (RECENT_DAYS * 24 * 60 * 60 * 1000);
  return commitTime > cutoff;
}

// Find TODOs in the repo
function findTodos(repoPath) {
  const result = { todoFile: null, todoFileLines: 0, inlineComments: [] };

  // Check for TODO.md
  for (const name of ['TODO.md', 'todo.md']) {
    const todoPath = path.join(repoPath, name);
    try {
      const content = fs.readFileSync(todoPath, 'utf8');
      result.todoFile = name;
      result.todoFileLines = content.split('\n').filter(l => l.trim()).length;
      break;
    } catch {
      // File doesn't exist
    }
  }

  // Git grep for TODO: and FIXME: comments
  const grepResult = git(repoPath, 'grep -n -E "TODO:|FIXME:" -- "*.js" "*.ts" "*.jsx" "*.tsx" "*.py" "*.go" "*.rs" "*.rb" "*.java" "*.c" "*.cpp" "*.h" "*.cs" "*.swift" "*.kt" "*.sh" "*.md"');
  if (grepResult) {
    result.inlineComments = grepResult
      .split('\n')
      .filter(Boolean)
      .slice(0, MAX_TODOS)
      .map(line => {
        // Truncate long lines
        if (line.length > 80) return line.slice(0, 77) + '...';
        return line;
      });
  }

  return result;
}

// Gather all info for a repo
async function analyzeRepo(repoPath) {
  const name = path.basename(repoPath);
  const uncommitted = getUncommittedChanges(repoPath);
  const stashCount = getStashCount(repoPath);
  const recentCommits = getRecentCommits(repoPath);
  const todos = findTodos(repoPath);
  const recentActivity = hasRecentActivity(repoPath);

  const hasChanges = uncommitted.files.length > 0 || stashCount > 0;
  const shouldShow = hasChanges || recentActivity;

  return {
    name,
    path: repoPath,
    uncommitted,
    stashCount,
    recentCommits,
    todos,
    hasChanges,
    recentActivity,
    shouldShow,
  };
}

// Format output for a single repo
function formatRepo(repo) {
  const lines = [];
  const c = colors;

  // Header
  lines.push(`${c.cyan}${'━'.repeat(60)}${c.reset}`);
  lines.push(`${c.bold}${c.cyan}📁 ${repo.name}${c.reset}`);
  lines.push(`${c.dim}   ${repo.path}${c.reset}`);
  lines.push(`${c.cyan}${'━'.repeat(60)}${c.reset}`);
  lines.push('');

  // Uncommitted changes
  if (repo.uncommitted.files.length > 0 || repo.stashCount > 0) {
    lines.push(`${c.yellow}${c.bold}📝 Uncommitted Changes${c.reset}`);
    for (const file of repo.uncommitted.files.slice(0, 15)) {
      const status = file.slice(0, 2);
      const filename = file.slice(3);
      let color = c.reset;
      if (status.includes('M')) color = c.yellow;
      if (status.includes('A')) color = c.green;
      if (status.includes('D')) color = c.red;
      if (status.includes('?')) color = c.dim;
      lines.push(`   ${color}${status} ${filename}${c.reset}`);
    }
    if (repo.uncommitted.files.length > 15) {
      lines.push(`   ${c.dim}... and ${repo.uncommitted.files.length - 15} more${c.reset}`);
    }
    if (repo.stashCount > 0) {
      lines.push(`   ${c.magenta}🗃️  ${repo.stashCount} stashed change${repo.stashCount > 1 ? 's' : ''}${c.reset}`);
    }
    lines.push('');
  }

  // Recent commits
  if (repo.recentCommits.length > 0) {
    lines.push(`${c.green}${c.bold}📜 Recent Commits${c.reset}`);
    for (const commit of repo.recentCommits) {
      lines.push(`   ${c.dim}${commit}${c.reset}`);
    }
    lines.push('');
  }

  // TODOs
  const hasTodos = repo.todos.todoFile || repo.todos.inlineComments.length > 0;
  if (hasTodos) {
    lines.push(`${c.magenta}${c.bold}📌 TODOs${c.reset}`);
    if (repo.todos.todoFile) {
      lines.push(`   ${c.green}✓ ${repo.todos.todoFile}${c.reset} ${c.dim}(${repo.todos.todoFileLines} lines)${c.reset}`);
    }
    for (const comment of repo.todos.inlineComments) {
      lines.push(`   ${c.dim}${comment}${c.reset}`);
    }
    lines.push('');
  }

  // If nothing to show, indicate clean state
  if (!repo.uncommitted.files.length && !repo.stashCount && !repo.recentCommits.length && !hasTodos) {
    lines.push(`${c.dim}   No uncommitted changes, recent commits, or TODOs${c.reset}`);
    lines.push('');
  }

  return lines.join('\n');
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const showAll = args.includes('--all');
  const jsonOutput = args.includes('--json');

  // Custom path override
  let projectsPath = PROJECTS_PATH;
  const pathIndex = args.indexOf('--path');
  if (pathIndex !== -1 && args[pathIndex + 1]) {
    projectsPath = path.resolve(args[pathIndex + 1]);
  }

  // Resolve symlink
  let resolvedPath;
  try {
    resolvedPath = fs.realpathSync(projectsPath);
  } catch {
    console.error(`Error: Cannot access ${projectsPath}`);
    process.exit(1);
  }

  if (!jsonOutput) {
    console.log(`${colors.bold}🔍 Scanning ${resolvedPath}...${colors.reset}\n`);
  }

  // Find all repos
  const repos = findGitRepos(resolvedPath);

  if (repos.length === 0) {
    console.log('No git repositories found.');
    return;
  }

  // Analyze all repos in parallel
  const results = await Promise.all(repos.map(analyzeRepo));

  // Filter and sort
  const filtered = showAll ? results : results.filter(r => r.shouldShow);
  filtered.sort((a, b) => {
    // Dirty repos first, then by name
    if (a.hasChanges && !b.hasChanges) return -1;
    if (!a.hasChanges && b.hasChanges) return 1;
    return a.name.localeCompare(b.name);
  });

  if (jsonOutput) {
    console.log(JSON.stringify(filtered, null, 2));
    return;
  }

  // Output
  if (filtered.length === 0) {
    console.log('All repositories are clean with no recent activity.');
    console.log(`${colors.dim}Use --all to show all repos${colors.reset}`);
    return;
  }

  for (const repo of filtered) {
    console.log(formatRepo(repo));
  }

  // Summary
  const dirtyCount = filtered.filter(r => r.hasChanges).length;
  const activeCount = filtered.filter(r => r.recentActivity && !r.hasChanges).length;

  console.log(`${colors.bold}━━━ Summary ━━━${colors.reset}`);
  console.log(`${colors.cyan}📊 ${filtered.length} project${filtered.length !== 1 ? 's' : ''} shown${colors.reset}`);
  if (dirtyCount > 0) {
    console.log(`${colors.yellow}   ${dirtyCount} with uncommitted changes${colors.reset}`);
  }
  if (activeCount > 0) {
    console.log(`${colors.green}   ${activeCount} with recent activity${colors.reset}`);
  }
  if (!showAll && results.length > filtered.length) {
    console.log(`${colors.dim}   ${results.length - filtered.length} inactive clean repos hidden (use --all)${colors.reset}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
