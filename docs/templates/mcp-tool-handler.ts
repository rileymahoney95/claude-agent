// MCP Tool Handler Template
// Copy this pattern when adding new tools to an existing MCP server

// 1. Define input interface
interface MyToolInput {
  requiredParam: string;
  optionalParam?: number;
}

// 2. Implement async handler
export async function myTool(input: unknown) {
  try {
    const args = input as MyToolInput;
    const { requiredParam, optionalParam = 10 } = args;

    if (!requiredParam) throw new Error("requiredParam is required");

    // Tool logic here
    const result = { data: requiredParam, count: optionalParam };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
}

// 3. Export schema for registration
export const myToolSchema = {
  name: "my_tool",
  description: "Brief description of what this tool does.",
  inputSchema: {
    type: "object",
    properties: {
      requiredParam: {
        type: "string",
        description: "What this parameter controls",
      },
      optionalParam: {
        type: "number",
        description: "Optional setting (default: 10)",
      },
    },
    required: ["requiredParam"],
  },
};

// 4. In index.ts, add:
// import { myTool, myToolSchema } from "./tools/my-tool.js";
//
// ListToolsRequestSchema handler: add myToolSchema to tools array
// CallToolRequestSchema handler: add case "my_tool": return myTool(args);
