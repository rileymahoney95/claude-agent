// Note representation types
export type NoteName = "C" | "D" | "E" | "F" | "G" | "A" | "B";
export type Accidental = "#" | "b" | "";
export type NoteWithAccidental = `${NoteName}${Accidental}`;
export type NoteWithOctave = `${NoteName}${Accidental}${number}`;

// Scale types
export type ScaleType =
  | "major"
  | "natural_minor"
  | "harmonic_minor"
  | "melodic_minor"
  | "pentatonic_major"
  | "pentatonic_minor"
  | "blues"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "locrian"
  | "whole_tone"
  | "chromatic";

// Chord types
export type ChordType =
  | "major"
  | "minor"
  | "diminished"
  | "augmented"
  | "sus2"
  | "sus4"
  | "major7"
  | "minor7"
  | "dominant7"
  | "diminished7"
  | "half_diminished7"
  | "augmented7"
  | "major9"
  | "minor9"
  | "dominant9"
  | "add9"
  | "add11"
  | "6"
  | "minor6";

// Interval names (in semitones)
export type IntervalName =
  | "unison"
  | "minor2"
  | "major2"
  | "minor3"
  | "major3"
  | "perfect4"
  | "tritone"
  | "perfect5"
  | "minor6"
  | "major6"
  | "minor7"
  | "major7"
  | "octave";

// Key signature info
export interface KeySignature {
  key: NoteWithAccidental;
  mode: "major" | "minor";
  sharps: NoteWithAccidental[];
  flats: NoteWithAccidental[];
  notes: NoteWithAccidental[];
}

// Scale result
export interface ScaleResult {
  root: NoteWithAccidental;
  type: ScaleType;
  notes: NoteWithAccidental[];
  midiNumbers: number[];
  octave?: number;
}

// Chord result
export interface ChordResult {
  root: NoteWithAccidental;
  type: ChordType;
  symbol: string;
  notes: NoteWithAccidental[];
  midiNumbers: number[];
  octave?: number;
}

// Shared note input interface (used in generate-midi.ts)
export interface NoteInput {
  pitch: number | string;
  time: number;
  duration: number;
  velocity?: number;
}

export interface TrackInput {
  name: string;
  notes: NoteInput[];
  channel?: number; // 0-15, use 9 for drums (MIDI channel 10)
}

export interface GenerateMidiInput {
  name: string;
  tempo?: number;
  timeSignature?: [number, number];
  tracks: TrackInput[];
}

// Pattern generation types
export type PatternType = "chord_progression" | "arpeggio" | "bassline" | "drums";
export type ArpeggioStyle = "up" | "down" | "up_down" | "broken";
export type BassStyle = "root" | "root_fifth" | "walking";
export type DrumStyle = "rock" | "jazz" | "electronic";
export type ChordQuality = "triad" | "seventh";

export interface GeneratePatternInput {
  name: string;
  tempo?: number;
  timeSignature?: [number, number];
  type: PatternType;
  key: string;
  scale?: ScaleType;
  bars: number;
  octave?: number;

  // Type-specific options
  progression?: string;
  chordQuality?: ChordQuality;
  chordType?: ChordType;
  arpeggioStyle?: ArpeggioStyle;
  bassStyle?: BassStyle;
  drumStyle?: DrumStyle;
}
