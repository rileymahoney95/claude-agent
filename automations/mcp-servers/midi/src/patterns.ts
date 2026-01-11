import type {
  NoteInput,
  ScaleType,
  ChordType,
  ArpeggioStyle,
  BassStyle,
  DrumStyle,
  ChordQuality,
} from "./types.js";
import {
  getScaleMidi,
  getChordMidi,
  noteToSemitone,
  midiToNoteName,
  getChordInversion,
} from "./music-theory.js";

// Roman numeral to scale degree and chord quality mapping
interface NumeralInfo {
  degree: number; // 0-indexed scale degree
  quality: ChordType;
  seventh?: ChordType; // Quality when using 7ths
}

// Major key numeral mappings
const MAJOR_NUMERALS: Record<string, NumeralInfo> = {
  I: { degree: 0, quality: "major", seventh: "major7" },
  ii: { degree: 1, quality: "minor", seventh: "minor7" },
  iii: { degree: 2, quality: "minor", seventh: "minor7" },
  IV: { degree: 3, quality: "major", seventh: "major7" },
  V: { degree: 4, quality: "major", seventh: "dominant7" },
  vi: { degree: 5, quality: "minor", seventh: "minor7" },
  "vii°": { degree: 6, quality: "diminished", seventh: "half_diminished7" },
  vii: { degree: 6, quality: "diminished", seventh: "half_diminished7" },
};

// Minor key numeral mappings (natural minor)
const MINOR_NUMERALS: Record<string, NumeralInfo> = {
  i: { degree: 0, quality: "minor", seventh: "minor7" },
  "ii°": { degree: 1, quality: "diminished", seventh: "half_diminished7" },
  ii: { degree: 1, quality: "diminished", seventh: "half_diminished7" },
  III: { degree: 2, quality: "major", seventh: "major7" },
  iv: { degree: 3, quality: "minor", seventh: "minor7" },
  v: { degree: 4, quality: "minor", seventh: "minor7" },
  V: { degree: 4, quality: "major", seventh: "dominant7" }, // Harmonic minor V
  VI: { degree: 5, quality: "major", seventh: "major7" },
  VII: { degree: 6, quality: "major", seventh: "dominant7" },
};

// General MIDI drum note numbers
export const DRUM_NOTES = {
  kick: 36,
  snare: 38,
  closedHiHat: 42,
  openHiHat: 46,
  crash: 49,
  ride: 51,
  lowTom: 45,
  midTom: 47,
  highTom: 50,
  clap: 39,
  rimshot: 37,
};

// Preset progressions
export const PRESET_PROGRESSIONS: Record<string, string> = {
  "pop": "I-V-vi-IV",
  "rock": "I-IV-V-I",
  "jazz": "ii-V-I",
  "fifties": "I-vi-IV-V",
  "blues": "I-I-I-I-IV-IV-I-I-V-IV-I-V",
};

/**
 * Parse a progression string into individual numerals
 */
function parseProgression(progression: string): string[] {
  return progression.split("-").map((n) => n.trim());
}

/**
 * Get chord root MIDI note from key and scale degree
 */
function getChordRootFromDegree(
  key: string,
  scale: ScaleType,
  degree: number,
  octave: number
): number {
  const scaleMidi = getScaleMidi(key, scale, octave);
  return scaleMidi[degree % scaleMidi.length];
}

/**
 * Generate chord progression as NoteInput array
 */
export function generateChordProgression(
  key: string,
  scale: ScaleType,
  progression: string,
  bars: number,
  octave: number = 4,
  chordQuality: ChordQuality = "triad",
  timeSignature: [number, number] = [4, 4]
): NoteInput[] {
  const numerals = parseProgression(progression);
  const beatsPerBar = timeSignature[0];
  const notes: NoteInput[] = [];

  // Determine if we're in a minor key
  const isMinor = scale.includes("minor");
  const numeralMap = isMinor ? MINOR_NUMERALS : MAJOR_NUMERALS;

  // Calculate how many bars each chord gets
  const chordsCount = numerals.length;
  const barsPerChord = Math.max(1, Math.floor(bars / chordsCount));

  let currentBeat = 0;

  for (let i = 0; i < bars; i++) {
    const numeralIndex = Math.floor(i / barsPerChord) % chordsCount;
    const numeral = numerals[numeralIndex];
    const info = numeralMap[numeral];

    if (!info) {
      console.warn(`Unknown numeral: ${numeral}, skipping`);
      currentBeat += beatsPerBar;
      continue;
    }

    // Get chord root from scale degree
    const rootMidi = getChordRootFromDegree(key, scale, info.degree, octave);
    const rootNote = midiToNoteName(rootMidi % 12 + octave * 12 + 12);
    const rootName = rootNote.replace(/\d+$/, "");

    // Get chord quality (triad or seventh)
    const quality = chordQuality === "seventh" && info.seventh ? info.seventh : info.quality;

    // Get chord MIDI notes
    const chordMidi = getChordMidi(rootName, quality, octave);

    // Add all notes of the chord as whole notes (duration = beats per bar)
    for (const pitch of chordMidi) {
      notes.push({
        pitch,
        time: currentBeat,
        duration: beatsPerBar,
        velocity: 80,
      });
    }

    currentBeat += beatsPerBar;
  }

  return notes;
}

/**
 * Generate arpeggio pattern as NoteInput array
 */
export function generateArpeggio(
  key: string,
  chordType: ChordType,
  style: ArpeggioStyle = "up",
  bars: number,
  octave: number = 4,
  timeSignature: [number, number] = [4, 4]
): NoteInput[] {
  const beatsPerBar = timeSignature[0];
  const totalBeats = bars * beatsPerBar;
  const notes: NoteInput[] = [];

  // Get chord notes
  const chordMidi = getChordMidi(key, chordType, octave);
  const chordLength = chordMidi.length;

  // Build arpeggio pattern based on style
  let pattern: number[] = [];

  switch (style) {
    case "up":
      pattern = [...chordMidi];
      break;
    case "down":
      pattern = [...chordMidi].reverse();
      break;
    case "up_down":
      pattern = [...chordMidi, ...chordMidi.slice(1, -1).reverse()];
      break;
    case "broken":
      // Alberti-style: root, top, middle, top (for triads)
      if (chordLength >= 3) {
        pattern = [chordMidi[0], chordMidi[2], chordMidi[1], chordMidi[2]];
      } else {
        pattern = [...chordMidi];
      }
      break;
  }

  // 8th notes by default (2 per beat)
  const noteDuration = 0.5;
  const notesPerBeat = 2;

  let currentBeat = 0;
  let patternIndex = 0;

  while (currentBeat < totalBeats) {
    const pitch = pattern[patternIndex % pattern.length];
    notes.push({
      pitch,
      time: currentBeat,
      duration: noteDuration,
      velocity: 90,
    });

    currentBeat += noteDuration;
    patternIndex++;
  }

  return notes;
}

/**
 * Generate bassline as NoteInput array
 */
export function generateBassline(
  key: string,
  scale: ScaleType,
  style: BassStyle = "root",
  bars: number,
  progression?: string,
  octave: number = 2,
  timeSignature: [number, number] = [4, 4]
): NoteInput[] {
  const beatsPerBar = timeSignature[0];
  const notes: NoteInput[] = [];

  // Get scale for the key
  const scaleMidi = getScaleMidi(key, scale, octave);
  const rootNote = scaleMidi[0];
  const fifthNote = scaleMidi[4]; // 5th degree

  // If progression provided, follow chord roots
  if (progression) {
    const numerals = parseProgression(progression);
    const isMinor = scale.includes("minor");
    const numeralMap = isMinor ? MINOR_NUMERALS : MAJOR_NUMERALS;
    const chordsCount = numerals.length;
    const barsPerChord = Math.max(1, Math.floor(bars / chordsCount));

    let currentBeat = 0;

    for (let i = 0; i < bars; i++) {
      const numeralIndex = Math.floor(i / barsPerChord) % chordsCount;
      const numeral = numerals[numeralIndex];
      const info = numeralMap[numeral];

      if (!info) {
        currentBeat += beatsPerBar;
        continue;
      }

      const chordRoot = scaleMidi[info.degree % scaleMidi.length];
      const chordFifth = scaleMidi[(info.degree + 4) % scaleMidi.length]; // Approximate 5th

      // Generate bass pattern for this bar
      const barNotes = generateBassBar(chordRoot, chordFifth, style, beatsPerBar, currentBeat);
      notes.push(...barNotes);

      currentBeat += beatsPerBar;
    }
  } else {
    // No progression - use key root with scale patterns
    let currentBeat = 0;

    for (let i = 0; i < bars; i++) {
      const barNotes = generateBassBar(rootNote, fifthNote, style, beatsPerBar, currentBeat);
      notes.push(...barNotes);
      currentBeat += beatsPerBar;
    }
  }

  return notes;
}

/**
 * Generate one bar of bassline
 */
function generateBassBar(
  root: number,
  fifth: number,
  style: BassStyle,
  beatsPerBar: number,
  startBeat: number
): NoteInput[] {
  const notes: NoteInput[] = [];

  switch (style) {
    case "root":
      // Quarter notes on each beat
      for (let beat = 0; beat < beatsPerBar; beat++) {
        notes.push({
          pitch: root,
          time: startBeat + beat,
          duration: 1,
          velocity: 100,
        });
      }
      break;

    case "root_fifth":
      // Root, root, fifth, fifth (or adjusted for different time sigs)
      const pattern = beatsPerBar >= 4
        ? [root, root, fifth, fifth]
        : [root, fifth];
      for (let beat = 0; beat < beatsPerBar; beat++) {
        notes.push({
          pitch: pattern[beat % pattern.length],
          time: startBeat + beat,
          duration: 1,
          velocity: 100,
        });
      }
      break;

    case "walking":
      // Walking bass: root, chromatic approach notes
      // Simple version: root, passing tone, passing tone, approach to next
      const walkingPattern = [
        root,
        root + 2,  // Major 2nd up
        fifth - 1, // Half step below 5th
        fifth,     // 5th
      ];
      for (let beat = 0; beat < beatsPerBar; beat++) {
        notes.push({
          pitch: walkingPattern[beat % walkingPattern.length],
          time: startBeat + beat,
          duration: 1,
          velocity: 95,
        });
      }
      break;
  }

  return notes;
}

/**
 * Generate drum pattern as NoteInput array
 */
export function generateDrumPattern(
  style: DrumStyle = "rock",
  bars: number,
  timeSignature: [number, number] = [4, 4]
): NoteInput[] {
  const beatsPerBar = timeSignature[0];
  const notes: NoteInput[] = [];

  for (let bar = 0; bar < bars; bar++) {
    const barStart = bar * beatsPerBar;
    const barNotes = generateDrumBar(style, beatsPerBar, barStart);
    notes.push(...barNotes);
  }

  return notes;
}

/**
 * Generate one bar of drums
 */
function generateDrumBar(
  style: DrumStyle,
  beatsPerBar: number,
  startBeat: number
): NoteInput[] {
  const notes: NoteInput[] = [];
  const { kick, snare, closedHiHat, openHiHat, ride } = DRUM_NOTES;

  switch (style) {
    case "rock":
      // Kick on 1, 3; snare on 2, 4; hi-hat on 8ths
      for (let beat = 0; beat < beatsPerBar; beat++) {
        // Hi-hat on every 8th note
        notes.push({
          pitch: closedHiHat,
          time: startBeat + beat,
          duration: 0.5,
          velocity: 80,
        });
        notes.push({
          pitch: closedHiHat,
          time: startBeat + beat + 0.5,
          duration: 0.5,
          velocity: 70,
        });

        // Kick on 1, 3
        if (beat === 0 || beat === 2) {
          notes.push({
            pitch: kick,
            time: startBeat + beat,
            duration: 0.5,
            velocity: 100,
          });
        }

        // Snare on 2, 4
        if (beat === 1 || beat === 3) {
          notes.push({
            pitch: snare,
            time: startBeat + beat,
            duration: 0.5,
            velocity: 100,
          });
        }
      }
      break;

    case "electronic":
      // Four-on-the-floor kick, offbeat hi-hats
      for (let beat = 0; beat < beatsPerBar; beat++) {
        // Kick on every beat
        notes.push({
          pitch: kick,
          time: startBeat + beat,
          duration: 0.25,
          velocity: 110,
        });

        // Hi-hat on offbeats (8th notes between beats)
        notes.push({
          pitch: closedHiHat,
          time: startBeat + beat + 0.5,
          duration: 0.25,
          velocity: 85,
        });

        // Snare/clap on 2, 4
        if (beat === 1 || beat === 3) {
          notes.push({
            pitch: snare,
            time: startBeat + beat,
            duration: 0.25,
            velocity: 100,
          });
        }
      }
      break;

    case "jazz":
      // Ride cymbal pattern with kick/snare comping
      for (let beat = 0; beat < beatsPerBar; beat++) {
        // Ride on every beat
        notes.push({
          pitch: ride,
          time: startBeat + beat,
          duration: 0.5,
          velocity: 75,
        });

        // Swing feel: ride on the "and" of beats 1 and 3
        if (beat === 0 || beat === 2) {
          notes.push({
            pitch: ride,
            time: startBeat + beat + 0.66, // Swung 8th
            duration: 0.34,
            velocity: 65,
          });
        }

        // Light kick on 1
        if (beat === 0) {
          notes.push({
            pitch: kick,
            time: startBeat + beat,
            duration: 0.5,
            velocity: 70,
          });
        }

        // Hi-hat foot on 2, 4
        if (beat === 1 || beat === 3) {
          notes.push({
            pitch: closedHiHat,
            time: startBeat + beat,
            duration: 0.25,
            velocity: 60,
          });
        }
      }
      break;
  }

  return notes;
}
