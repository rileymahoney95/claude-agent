import {
  getScaleNotes,
  getScaleMidi,
  getScaleMidiExtended,
  getAvailableScaleTypes,
  parseNote,
} from "../music-theory.js";
import type { ScaleType, ScaleResult, NoteWithAccidental } from "../types.js";

interface GetScaleInput {
  root: string;
  type: ScaleType;
  octave?: number;
  octaveCount?: number;
}

export async function getScale(input: unknown) {
  try {
    const args = input as GetScaleInput;
    const { root, type, octave = 4, octaveCount = 1 } = args;

    if (!root) throw new Error("root is required");
    if (!type) throw new Error("type is required");

    // Validate scale type
    const validTypes = getAvailableScaleTypes();
    if (!validTypes.includes(type)) {
      throw new Error(
        `Invalid scale type: ${type}. Valid types: ${validTypes.join(", ")}`
      );
    }

    const { name, accidental } = parseNote(root);
    const normalizedRoot = `${name}${accidental}` as NoteWithAccidental;

    const notes = getScaleNotes(normalizedRoot, type);
    const midiNumbers =
      octaveCount > 1
        ? getScaleMidiExtended(normalizedRoot, type, octave, octaveCount)
        : getScaleMidi(normalizedRoot, type, octave);

    const result: ScaleResult = {
      root: normalizedRoot,
      type,
      notes,
      midiNumbers,
      octave,
    };

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

export const getScaleSchema = {
  name: "get_scale",
  description:
    "Get notes for a musical scale. Returns note names and MIDI numbers.",
  inputSchema: {
    type: "object",
    properties: {
      root: {
        type: "string",
        description: 'Root note of the scale (e.g., "C", "F#", "Bb")',
      },
      type: {
        type: "string",
        enum: [
          "major",
          "natural_minor",
          "harmonic_minor",
          "melodic_minor",
          "pentatonic_major",
          "pentatonic_minor",
          "blues",
          "dorian",
          "phrygian",
          "lydian",
          "mixolydian",
          "locrian",
          "whole_tone",
          "chromatic",
        ],
        description: "Type of scale to generate",
      },
      octave: {
        type: "number",
        description: "Starting octave for MIDI numbers (default: 4, middle C octave)",
      },
      octaveCount: {
        type: "number",
        description: "Number of octaves to generate (default: 1)",
      },
    },
    required: ["root", "type"],
  },
};
