import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { generateMidi } from "./tools/generate-midi.js";
import { getScale, getScaleSchema } from "./tools/get-scale.js";
import { getChord, getChordSchema } from "./tools/get-chord.js";
import { getKeyInfoTool, getKeyInfoSchema } from "./tools/get-key-info.js";
import { generatePattern, generatePatternSchema } from "./tools/generate-pattern.js";

const server = new Server(
  { name: "midi-generator", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_midi",
      description: "Generate a MIDI file from note specifications. Accepts note names (C4, D#5, Bb3) or MIDI numbers (60, 64, 67). Times and durations are in beats.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Output filename (without .mid extension)"
          },
          tempo: {
            type: "number",
            description: "Tempo in BPM (default: 120)"
          },
          timeSignature: {
            type: "array",
            items: { type: "number" },
            description: "Time signature as [numerator, denominator], e.g., [4, 4] or [3, 4]"
          },
          tracks: {
            type: "array",
            description: "Array of tracks, each containing notes",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Track name (e.g., 'Piano', 'Bass')"
                },
                notes: {
                  type: "array",
                  description: "Array of notes in this track",
                  items: {
                    type: "object",
                    properties: {
                      pitch: {
                        oneOf: [
                          { type: "number" },
                          { type: "string" }
                        ],
                        description: "Note pitch as MIDI number (60) or note name (C4, D#5, Bb3)"
                      },
                      time: {
                        type: "number",
                        description: "Start time in beats (0 = beginning)"
                      },
                      duration: {
                        type: "number",
                        description: "Duration in beats (1 = quarter note at tempo)"
                      },
                      velocity: {
                        type: "number",
                        description: "Note velocity 0-127 (default: 100)"
                      }
                    },
                    required: ["pitch", "time", "duration"]
                  }
                }
              },
              required: ["name", "notes"]
            }
          }
        },
        required: ["name", "tracks"]
      }
    },
    getScaleSchema,
    getChordSchema,
    getKeyInfoSchema,
    generatePatternSchema
  ]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "generate_midi":
      return generateMidi(request.params.arguments);
    case "get_scale":
      return getScale(request.params.arguments);
    case "get_chord":
      return getChord(request.params.arguments);
    case "get_key_info":
      return getKeyInfoTool(request.params.arguments);
    case "generate_pattern":
      return generatePattern(request.params.arguments);
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
