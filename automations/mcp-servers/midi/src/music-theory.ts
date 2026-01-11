import type {
  NoteName,
  Accidental,
  NoteWithAccidental,
  NoteWithOctave,
  ScaleType,
  ChordType,
  IntervalName,
  KeySignature,
} from "./types.js";

// Note to semitone mapping (C = 0)
export const NOTE_TO_SEMITONE: Record<NoteName, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

// Semitone to note mapping (sharps)
export const SEMITONE_TO_NOTE_SHARP: NoteWithAccidental[] = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

// Semitone to note mapping (flats)
export const SEMITONE_TO_NOTE_FLAT: NoteWithAccidental[] = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

// Scale formulas (intervals in semitones from root)
export const SCALE_FORMULAS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  whole_tone: [0, 2, 4, 6, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

// Chord formulas (intervals in semitones from root)
export const CHORD_FORMULAS: Record<ChordType, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  dominant7: [0, 4, 7, 10],
  diminished7: [0, 3, 6, 9],
  half_diminished7: [0, 3, 6, 10],
  augmented7: [0, 4, 8, 10],
  major9: [0, 4, 7, 11, 14],
  minor9: [0, 3, 7, 10, 14],
  dominant9: [0, 4, 7, 10, 14],
  add9: [0, 4, 7, 14],
  add11: [0, 4, 7, 17],
  "6": [0, 4, 7, 9],
  minor6: [0, 3, 7, 9],
};

// Chord symbol suffixes
export const CHORD_SYMBOLS: Record<ChordType, string> = {
  major: "",
  minor: "m",
  diminished: "dim",
  augmented: "aug",
  sus2: "sus2",
  sus4: "sus4",
  major7: "maj7",
  minor7: "m7",
  dominant7: "7",
  diminished7: "dim7",
  half_diminished7: "m7b5",
  augmented7: "aug7",
  major9: "maj9",
  minor9: "m9",
  dominant9: "9",
  add9: "add9",
  add11: "add11",
  "6": "6",
  minor6: "m6",
};

// Interval names mapped to semitones
export const INTERVAL_SEMITONES: Record<IntervalName, number> = {
  unison: 0,
  minor2: 1,
  major2: 2,
  minor3: 3,
  major3: 4,
  perfect4: 5,
  tritone: 6,
  perfect5: 7,
  minor6: 8,
  major6: 9,
  minor7: 10,
  major7: 11,
  octave: 12,
};

// Key signatures (sharps/flats count, positive = sharps, negative = flats)
export const KEY_SIGNATURES: Record<string, number> = {
  // Major keys
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  "F#": 6,
  Gb: -6,
  Db: -5,
  Ab: -4,
  Eb: -3,
  Bb: -2,
  F: -1,
  // Minor keys
  Am: 0,
  Em: 1,
  Bm: 2,
  "F#m": 3,
  "C#m": 4,
  "G#m": 5,
  "D#m": 6,
  Ebm: -6,
  Bbm: -5,
  Fm: -4,
  Cm: -3,
  Gm: -2,
  Dm: -1,
};

// Order of sharps and flats
export const SHARP_ORDER: NoteName[] = ["F", "C", "G", "D", "A", "E", "B"];
export const FLAT_ORDER: NoteName[] = ["B", "E", "A", "D", "G", "C", "F"];

/**
 * Parse a note name (e.g., "C#", "Bb", "D") into its components
 */
export function parseNote(note: string): {
  name: NoteName;
  accidental: Accidental;
} {
  const match = note.match(/^([A-G])([#b]?)$/i);
  if (!match) {
    throw new Error(`Invalid note: ${note}. Use format like C, C#, Bb.`);
  }
  return {
    name: match[1].toUpperCase() as NoteName,
    accidental: (match[2] || "") as Accidental,
  };
}

/**
 * Parse a note with octave (e.g., "C4", "D#5") into components
 */
export function parseNoteWithOctave(note: string): {
  name: NoteName;
  accidental: Accidental;
  octave: number;
} {
  const match = note.match(/^([A-G])([#b]?)(-?\d+)$/i);
  if (!match) {
    throw new Error(`Invalid note: ${note}. Use format like C4, D#5, Bb3.`);
  }
  return {
    name: match[1].toUpperCase() as NoteName,
    accidental: (match[2] || "") as Accidental,
    octave: parseInt(match[3]),
  };
}

/**
 * Convert note name (with optional accidental) to semitone (0-11, C=0)
 */
export function noteToSemitone(note: string | NoteWithAccidental): number {
  const { name, accidental } = parseNote(note);
  let semitone = NOTE_TO_SEMITONE[name];

  if (accidental === "#") semitone += 1;
  else if (accidental === "b") semitone -= 1;

  return ((semitone % 12) + 12) % 12; // Normalize to 0-11
}

/**
 * Convert note with octave to MIDI number
 * C4 = 60 (middle C), C-1 = 0
 */
export function noteNameToMidi(note: string): number {
  const { name, accidental, octave } = parseNoteWithOctave(note);
  let semitone = NOTE_TO_SEMITONE[name];

  if (accidental === "#") semitone += 1;
  else if (accidental === "b") semitone -= 1;

  return semitone + (octave + 1) * 12;
}

/**
 * Convert MIDI number to note name with octave
 */
export function midiToNoteName(
  midi: number,
  preferFlats: boolean = false
): NoteWithOctave {
  const octave = Math.floor(midi / 12) - 1;
  const semitone = midi % 12;
  const noteArray = preferFlats ? SEMITONE_TO_NOTE_FLAT : SEMITONE_TO_NOTE_SHARP;
  return `${noteArray[semitone]}${octave}` as NoteWithOctave;
}

/**
 * Convert semitone (0-11) to note name without octave
 */
export function semitoneToNoteName(
  semitone: number,
  preferFlats: boolean = false
): NoteWithAccidental {
  const normalized = ((semitone % 12) + 12) % 12;
  return preferFlats
    ? SEMITONE_TO_NOTE_FLAT[normalized]
    : SEMITONE_TO_NOTE_SHARP[normalized];
}

/**
 * Resolve pitch to MIDI number (accepts number or note string)
 */
export function resolvePitch(pitch: number | string): number {
  if (typeof pitch === "number") return pitch;
  return noteNameToMidi(pitch);
}

/**
 * Get scale notes as an array of note names (without octave)
 */
export function getScaleNotes(
  root: string,
  scaleType: ScaleType,
  preferFlats?: boolean
): NoteWithAccidental[] {
  const formula = SCALE_FORMULAS[scaleType];
  if (!formula) {
    throw new Error(`Unknown scale type: ${scaleType}`);
  }

  const rootSemitone = noteToSemitone(root);
  const useFlats = preferFlats ?? root.includes("b");

  return formula.map((interval) =>
    semitoneToNoteName((rootSemitone + interval) % 12, useFlats)
  );
}

/**
 * Get scale as MIDI numbers starting from a specific octave
 */
export function getScaleMidi(
  root: string,
  scaleType: ScaleType,
  octave: number = 4
): number[] {
  const formula = SCALE_FORMULAS[scaleType];
  if (!formula) {
    throw new Error(`Unknown scale type: ${scaleType}`);
  }

  const { name, accidental } = parseNote(root);
  const rootMidi = noteNameToMidi(`${name}${accidental}${octave}`);

  return formula.map((interval) => rootMidi + interval);
}

/**
 * Get scale with multiple octaves
 */
export function getScaleMidiExtended(
  root: string,
  scaleType: ScaleType,
  startOctave: number = 4,
  octaveCount: number = 1
): number[] {
  const singleOctave = getScaleMidi(root, scaleType, startOctave);
  const result: number[] = [];

  for (let o = 0; o < octaveCount; o++) {
    for (const note of singleOctave) {
      result.push(note + o * 12);
    }
  }

  return result;
}

/**
 * Get all available scale types
 */
export function getAvailableScaleTypes(): ScaleType[] {
  return Object.keys(SCALE_FORMULAS) as ScaleType[];
}

/**
 * Get chord notes as an array of note names (without octave)
 */
export function getChordNotes(
  root: string,
  chordType: ChordType,
  preferFlats?: boolean
): NoteWithAccidental[] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula) {
    throw new Error(`Unknown chord type: ${chordType}`);
  }

  const rootSemitone = noteToSemitone(root);
  const useFlats = preferFlats ?? root.includes("b");

  return formula.map((interval) =>
    semitoneToNoteName((rootSemitone + interval) % 12, useFlats)
  );
}

/**
 * Get chord as MIDI numbers starting from a specific octave
 */
export function getChordMidi(
  root: string,
  chordType: ChordType,
  octave: number = 4
): number[] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula) {
    throw new Error(`Unknown chord type: ${chordType}`);
  }

  const { name, accidental } = parseNote(root);
  const rootMidi = noteNameToMidi(`${name}${accidental}${octave}`);

  return formula.map((interval) => rootMidi + interval);
}

/**
 * Get chord symbol (e.g., "Cm7", "Gmaj7", "Fdim")
 */
export function getChordSymbol(root: string, chordType: ChordType): string {
  const { name, accidental } = parseNote(root);
  return `${name}${accidental}${CHORD_SYMBOLS[chordType]}`;
}

/**
 * Get all available chord types
 */
export function getAvailableChordTypes(): ChordType[] {
  return Object.keys(CHORD_FORMULAS) as ChordType[];
}

/**
 * Get chord inversion (reorder notes, shift lower notes up an octave)
 */
export function getChordInversion(
  midiNotes: number[],
  inversion: number
): number[] {
  if (inversion === 0) return [...midiNotes];

  const result = [...midiNotes];
  const inv = inversion % midiNotes.length;

  for (let i = 0; i < inv; i++) {
    const lowest = result.shift()!;
    result.push(lowest + 12);
  }

  return result;
}

/**
 * Calculate interval between two notes in semitones
 */
export function getInterval(from: string | number, to: string | number): number {
  const fromMidi = typeof from === "number" ? from : resolvePitch(from);
  const toMidi = typeof to === "number" ? to : resolvePitch(to);
  return toMidi - fromMidi;
}

/**
 * Get interval name from semitones
 */
export function getIntervalName(semitones: number): IntervalName {
  const normalized = ((semitones % 12) + 12) % 12;
  const entries = Object.entries(INTERVAL_SEMITONES);
  const found = entries.find(([, s]) => s === normalized);
  return found ? (found[0] as IntervalName) : "unison";
}

/**
 * Transpose a note by a given interval (in semitones)
 */
export function transpose(note: string | number, semitones: number): number {
  const midi = typeof note === "number" ? note : resolvePitch(note);
  return midi + semitones;
}

/**
 * Transpose a note by interval name
 */
export function transposeByInterval(
  note: string | number,
  interval: IntervalName,
  direction: "up" | "down" = "up"
): number {
  const semitones = INTERVAL_SEMITONES[interval];
  return transpose(note, direction === "up" ? semitones : -semitones);
}

/**
 * Get all intervals available
 */
export function getAvailableIntervals(): IntervalName[] {
  return Object.keys(INTERVAL_SEMITONES) as IntervalName[];
}

/**
 * Get key signature information for a given key
 */
export function getKeyInfo(
  key: string,
  mode: "major" | "minor" = "major"
): KeySignature {
  const { name, accidental } = parseNote(key);
  const keyStr = mode === "minor" ? `${name}${accidental}m` : `${name}${accidental}`;

  const sigValue = KEY_SIGNATURES[keyStr];
  if (sigValue === undefined) {
    throw new Error(
      `Unknown key: ${keyStr}. Valid keys include C, G, D, Am, Em, etc.`
    );
  }

  let sharps: NoteWithAccidental[] = [];
  let flats: NoteWithAccidental[] = [];

  if (sigValue > 0) {
    sharps = SHARP_ORDER.slice(0, sigValue).map(
      (n) => `${n}#` as NoteWithAccidental
    );
  } else if (sigValue < 0) {
    flats = FLAT_ORDER.slice(0, -sigValue).map(
      (n) => `${n}b` as NoteWithAccidental
    );
  }

  // Get scale notes for this key
  const scaleType: ScaleType = mode === "major" ? "major" : "natural_minor";
  const notes = getScaleNotes(key, scaleType, sigValue < 0);

  return {
    key: `${name}${accidental}` as NoteWithAccidental,
    mode,
    sharps,
    flats,
    notes,
  };
}

/**
 * Get the relative major/minor key
 */
export function getRelativeKey(
  key: string,
  mode: "major" | "minor"
): NoteWithAccidental {
  const semitone = noteToSemitone(key);
  const preferFlats = key.includes("b");

  if (mode === "minor") {
    // Relative minor is 3 semitones down from major
    return semitoneToNoteName((semitone + 9) % 12, preferFlats);
  } else {
    // Relative major is 3 semitones up from minor
    return semitoneToNoteName((semitone + 3) % 12, preferFlats);
  }
}
