# Knowledge Base

Documentation and templates for building automation scripts and integrations.

## Directory Structure

```
knowledge/
├── guides/                    # How-to documentation
│   ├── cli-design-patterns.md     # Best practices for CLI tools
│   ├── markets.md                 # Markets automation guide
│   └── mcp/                       # MCP-specific guides
│       ├── setup.md                   # MCP server configuration
│       └── subprocess-pattern.md      # Subprocess-based MCP architecture
└── templates/                 # Reusable code templates
    └── python/                    # Python templates
        ├── cli-with-json.md           # CLI with JSON output mode
        └── mcp-subprocess-server.md   # MCP server using subprocess
```

## Guides

### CLI Design Patterns
Comprehensive best practices for building robust CLI tools:
- Dual output modes (human-readable and JSON)
- File locking for concurrent access
- Fuzzy matching with disambiguation
- Natural language date parsing
- Validation and error handling
- Colorized terminal output

**See:** `guides/cli-design-patterns.md`

### MCP Server Setup
How to configure MCP servers in Claude Code:
- CLI and configuration file methods
- Configuration scopes (local/project/user)
- Environment variables
- Management commands
- Common patterns

**See:** `guides/mcp/setup.md`

### MCP Subprocess Pattern
Architecture pattern for MCP servers that wrap CLI tools:
- Separation of concerns (CLI vs MCP)
- Subprocess-based communication
- JSON protocol between layers
- Error handling strategies
- Performance considerations

**See:** `guides/mcp/subprocess-pattern.md`

### Markets Automation
Financial market tracker automation:
- Configuration and usage
- Data sources
- Output formatting

**See:** `guides/markets.md`

## Templates

### Python CLI with JSON Output
Minimal template for CLI tools with dual output modes:
- Basic structure with argparse
- JSON and human-readable output
- File locking and atomic writes
- Validation patterns
- Testing approaches

**See:** `templates/python/cli-with-json.md`

### MCP Server Using Subprocess
Template for MCP servers that call existing CLIs:
- FastMCP server structure
- Subprocess calling pattern
- Error handling and logging
- Configuration examples
- Testing strategies

**See:** `templates/python/mcp-subprocess-server.md`

## Usage

### For Guides
Guides provide context, rationale, and comprehensive patterns. Use when you need to understand:
- Why a pattern exists
- When to use it (and when not to)
- Trade-offs and alternatives
- Common pitfalls

### For Templates
Templates provide starting points for new code. Use when you need to:
- Bootstrap a new CLI tool
- Create an MCP server
- Follow established patterns
- Save setup time

## Contributing Knowledge

When adding to the knowledge base:

1. **Guides** should be:
   - Based on actual working implementations
   - Include rationale and trade-offs
   - Cover common pitfalls
   - Provide real examples

2. **Templates** should be:
   - Minimal but complete
   - Well-commented
   - Easy to customize
   - Include setup instructions

3. **Organization**:
   - Use subdirectories for topic areas
   - Keep related content together
   - Update this README when adding content
