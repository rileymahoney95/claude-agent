# Building MCP Servers with TypeScript

## Quick Setup

```bash
mkdir my-mcp && cd my-mcp
npm init -y
npm install @modelcontextprotocol/sdk
npm install -D typescript @types/node
```

**package.json** - add:
```json
{
  "type": "module",
  "main": "dist/index.js",
  "scripts": { "build": "tsc" }
}
```

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

## Server Skeleton

```typescript
// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "my-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "my_tool",
    description: "Does something",
    inputSchema: { type: "object", properties: { arg: { type: "string" } }, required: ["arg"] }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "my_tool") {
    return { content: [{ type: "text", text: "Result" }] };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

await server.connect(new StdioServerTransport());
```

## Returning Files

Return binary files as base64-encoded embedded resources:

```typescript
return {
  content: [
    { type: "text", text: "Generated file.pdf" },
    {
      type: "resource",
      resource: {
        uri: `file://${filepath}`,
        mimeType: "application/pdf",
        blob: buffer.toString("base64")
      }
    }
  ]
};
```

## CommonJS Package Fix

Some npm packages (like `@tonejs/midi`) are CommonJS. Fix the import:

```typescript
// Wrong (ESM named import from CJS):
import { Midi } from "@tonejs/midi";

// Correct:
import pkg from "@tonejs/midi";
const { Midi } = pkg;
```

## Registration

**Claude Code** (`.mcp.json`):
```json
{
  "mcpServers": {
    "my-server": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

Restart Claude after registration.
