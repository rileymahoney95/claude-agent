import { getKeyInfo, getRelativeKey } from "../music-theory.js";
import type { KeySignature, NoteWithAccidental } from "../types.js";

interface GetKeyInfoInput {
  key: string;
  mode?: "major" | "minor";
  includeRelative?: boolean;
}

interface KeyInfoResult extends KeySignature {
  relativeKey?: NoteWithAccidental;
}

export async function getKeyInfoTool(input: unknown) {
  try {
    const args = input as GetKeyInfoInput;
    const { key, mode = "major", includeRelative = true } = args;

    if (!key) throw new Error("key is required");

    const keyInfo = getKeyInfo(key, mode);

    const result: KeyInfoResult = { ...keyInfo };

    if (includeRelative) {
      result.relativeKey = getRelativeKey(
        key,
        mode === "major" ? "minor" : "major"
      );
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
}

export const getKeyInfoSchema = {
  name: "get_key_info",
  description:
    "Get key signature information including sharps/flats and scale notes.",
  inputSchema: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: 'Key root note (e.g., "C", "G", "Bb", "F#")',
      },
      mode: {
        type: "string",
        enum: ["major", "minor"],
        description: 'Key mode (default: "major")',
      },
      includeRelative: {
        type: "boolean",
        description: "Include relative major/minor key (default: true)",
      },
    },
    required: ["key"],
  },
};
