# MCP Server Setup in Claude Code

MCP (Model Context Protocol) servers extend Claude Code with custom tools.

## Adding MCP Servers

### CLI Method

```bash
# Stdio transport (local process)
claude mcp add --transport stdio <name> -- <command>

# HTTP transport (remote server)
claude mcp add --transport http <name> <url>

# With scope
claude mcp add --scope project --transport stdio <name> -- <command>
```

### Configuration Scopes

| Scope | Flag | Storage | Shared |
|-------|------|---------|--------|
| local (default) | none | `~/.claude.json` | No |
| project | `--scope project` | `.mcp.json` in project | Yes (git) |
| user | `--scope user` | `~/.claude.json` | No |

## Configuration File Format

Create `.mcp.json` in project root:

```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "/path/to/venv/bin/python",
      "args": ["/path/to/server.py"]
    }
  }
}
```

### Environment Variables

```json
{
  "mcpServers": {
    "my-server": {
      "type": "stdio",
      "command": "python",
      "args": ["server.py"],
      "env": {
        "API_KEY": "${MY_API_KEY}",
        "TIMEOUT": "${TIMEOUT:-30}"
      }
    }
  }
}
```

## Management Commands

```bash
claude mcp list              # List all servers
claude mcp get <name>        # Get server details
claude mcp remove <name>     # Remove a server
```

## Verification

After configuring, restart Claude Code and run `/mcp` to verify the server loaded.

## Common Patterns

### Python with Virtual Environment

```json
{
  "mcpServers": {
    "my-tool": {
      "type": "stdio",
      "command": "/path/to/project/venv/bin/python",
      "args": ["/path/to/project/server.py"]
    }
  }
}
```

### NPX Package

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "~/allowed-path"]
    }
  }
}
```
