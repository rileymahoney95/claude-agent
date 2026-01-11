import type {
  GeneratePatternInput,
  NoteInput,
  ScaleType,
  ChordType,
  ArpeggioStyle,
  BassStyle,
  DrumStyle,
  ChordQuality,
} from "../types.js";
import {
  generateChordProgression,
  generateArpeggio,
  generateBassline,
  generateDrumPattern,
} from "../patterns.js";
import { generateMidi } from "./generate-midi.js";

/**
 * Generate a musical pattern and output as MIDI
 */
export async function generatePattern(input: unknown) {
  try {
    const args = input as GeneratePatternInput;
    const {
      name,
      tempo = 120,
      timeSignature = [4, 4],
      type,
      key,
      scale = "major",
      bars,
      octave,
      progression,
      chordQuality = "triad",
      chordType = "major",
      arpeggioStyle = "up",
      bassStyle = "root",
      drumStyle = "rock",
    } = args;

    // Validate required fields
    if (!name || typeof name !== "string") {
      throw new Error("name is required and must be a string");
    }
    if (!type) {
      throw new Error("type is required (chord_progression, arpeggio, bassline, or drums)");
    }
    if (!bars || bars < 1) {
      throw new Error("bars is required and must be at least 1");
    }
    if (type !== "drums" && !key) {
      throw new Error("key is required for non-drum patterns");
    }

    let notes: NoteInput[] = [];
    let trackName: string;

    switch (type) {
      case "chord_progression":
        if (!progression) {
          throw new Error("progression is required for chord_progression type (e.g., 'I-IV-V-I')");
        }
        notes = generateChordProgression(
          key,
          scale as ScaleType,
          progression,
          bars,
          octave ?? 4,
          chordQuality as ChordQuality,
          timeSignature as [number, number]
        );
        trackName = "Chords";
        break;

      case "arpeggio":
        notes = generateArpeggio(
          key,
          chordType as ChordType,
          arpeggioStyle as ArpeggioStyle,
          bars,
          octave ?? 4,
          timeSignature as [number, number]
        );
        trackName = "Arpeggio";
        break;

      case "bassline":
        notes = generateBassline(
          key,
          scale as ScaleType,
          bassStyle as BassStyle,
          bars,
          progression,
          octave ?? 2,
          timeSignature as [number, number]
        );
        trackName = "Bass";
        break;

      case "drums":
        notes = generateDrumPattern(
          drumStyle as DrumStyle,
          bars,
          timeSignature as [number, number]
        );
        trackName = "Drums";
        break;

      default:
        throw new Error(`Unknown pattern type: ${type}`);
    }

    // Build the MIDI input and delegate to generateMidi
    const midiInput = {
      name,
      tempo,
      timeSignature,
      tracks: [
        {
          name: trackName,
          notes,
          ...(type === "drums" ? { channel: 9 } : {}), // Channel 10 (0-indexed as 9) for drums
        },
      ],
    };

    return generateMidi(midiInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error generating pattern: ${message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * MCP tool schema for generate_pattern
 */
export const generatePatternSchema = {
  name: "generate_pattern",
  description:
    "Generate musical patterns (chord progressions, arpeggios, basslines, drums) and output as MIDI. Higher-level than generate_midi.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Output filename (without .mid extension)",
      },
      tempo: {
        type: "number",
        description: "Tempo in BPM (default: 120)",
      },
      timeSignature: {
        type: "array",
        items: { type: "number" },
        description: "Time signature as [numerator, denominator] (default: [4, 4])",
      },
      type: {
        type: "string",
        enum: ["chord_progression", "arpeggio", "bassline", "drums"],
        description: "Type of pattern to generate",
      },
      key: {
        type: "string",
        description: "Root note (e.g., 'C', 'F#', 'Bb'). Required except for drums.",
      },
      scale: {
        type: "string",
        enum: [
          "major",
          "natural_minor",
          "harmonic_minor",
          "melodic_minor",
          "dorian",
          "phrygian",
          "lydian",
          "mixolydian",
          "locrian",
          "pentatonic_major",
          "pentatonic_minor",
          "blues",
        ],
        description: "Scale type (default: major)",
      },
      bars: {
        type: "number",
        description: "Number of bars to generate",
      },
      octave: {
        type: "number",
        description: "Base octave (default: 4 for chords/arpeggios, 2 for bass)",
      },
      progression: {
        type: "string",
        description:
          "Chord progression in Roman numerals (e.g., 'I-IV-V-I', 'ii-V-I'). Required for chord_progression, optional for bassline.",
      },
      chordQuality: {
        type: "string",
        enum: ["triad", "seventh"],
        description: "Chord voicing: triad (default) or seventh chords",
      },
      chordType: {
        type: "string",
        enum: [
          "major",
          "minor",
          "diminished",
          "augmented",
          "major7",
          "minor7",
          "dominant7",
          "sus2",
          "sus4",
        ],
        description: "Chord type for arpeggio patterns (default: major)",
      },
      arpeggioStyle: {
        type: "string",
        enum: ["up", "down", "up_down", "broken"],
        description: "Arpeggio pattern style (default: up)",
      },
      bassStyle: {
        type: "string",
        enum: ["root", "root_fifth", "walking"],
        description: "Bassline pattern style (default: root)",
      },
      drumStyle: {
        type: "string",
        enum: ["rock", "jazz", "electronic"],
        description: "Drum pattern style (default: rock)",
      },
    },
    required: ["name", "type", "bars"],
  },
};
