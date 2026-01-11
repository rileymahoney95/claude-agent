import {
  getChordNotes,
  getChordMidi,
  getChordSymbol,
  getChordInversion,
  getAvailableChordTypes,
  parseNote,
} from "../music-theory.js";
import type { ChordType, ChordResult, NoteWithAccidental } from "../types.js";

interface GetChordInput {
  root: string;
  type: ChordType;
  octave?: number;
  inversion?: number;
}

export async function getChord(input: unknown) {
  try {
    const args = input as GetChordInput;
    const { root, type, octave = 4, inversion = 0 } = args;

    if (!root) throw new Error("root is required");
    if (!type) throw new Error("type is required");

    const validTypes = getAvailableChordTypes();
    if (!validTypes.includes(type)) {
      throw new Error(
        `Invalid chord type: ${type}. Valid types: ${validTypes.join(", ")}`
      );
    }

    const { name, accidental } = parseNote(root);
    const normalizedRoot = `${name}${accidental}` as NoteWithAccidental;

    const notes = getChordNotes(normalizedRoot, type);
    let midiNumbers = getChordMidi(normalizedRoot, type, octave);

    if (inversion > 0) {
      midiNumbers = getChordInversion(midiNumbers, inversion);
    }

    const result: ChordResult = {
      root: normalizedRoot,
      type,
      symbol: getChordSymbol(normalizedRoot, type),
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

export const getChordSchema = {
  name: "get_chord",
  description:
    "Get notes for a chord. Returns chord symbol, note names, and MIDI numbers.",
  inputSchema: {
    type: "object",
    properties: {
      root: {
        type: "string",
        description: 'Root note of the chord (e.g., "C", "F#", "Bb")',
      },
      type: {
        type: "string",
        enum: [
          "major",
          "minor",
          "diminished",
          "augmented",
          "sus2",
          "sus4",
          "major7",
          "minor7",
          "dominant7",
          "diminished7",
          "half_diminished7",
          "augmented7",
          "major9",
          "minor9",
          "dominant9",
          "add9",
          "add11",
          "6",
          "minor6",
        ],
        description: "Type of chord to generate",
      },
      octave: {
        type: "number",
        description: "Starting octave for MIDI numbers (default: 4)",
      },
      inversion: {
        type: "number",
        description:
          "Chord inversion (0 = root position, 1 = first inversion, etc.)",
      },
    },
    required: ["root", "type"],
  },
};
