import pkg from "@tonejs/midi";
const { Midi } = pkg;
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { resolvePitch } from "../music-theory.js";
import type { GenerateMidiInput } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "..", "output");

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate a MIDI file from the input specification
 */
export async function generateMidi(input: unknown) {
  try {
    const args = input as GenerateMidiInput;
    const { name, tempo = 120, timeSignature = [4, 4], tracks } = args;

    if (!name || typeof name !== "string") {
      throw new Error("name is required and must be a string");
    }

    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      throw new Error("tracks is required and must be a non-empty array");
    }

    const midi = new Midi();
    midi.header.setTempo(tempo);
    midi.header.timeSignatures.push({
      ticks: 0,
      timeSignature: timeSignature,
      measures: 0,
    });

    let totalNotes = 0;

    for (const trackInput of tracks) {
      if (!trackInput.name || !trackInput.notes) {
        throw new Error("Each track must have a name and notes array");
      }

      const track = midi.addTrack();
      track.name = trackInput.name;
      if (trackInput.channel !== undefined) {
        track.channel = trackInput.channel;
      }

      for (const note of trackInput.notes) {
        if (note.pitch === undefined || note.time === undefined || note.duration === undefined) {
          throw new Error("Each note must have pitch, time, and duration");
        }

        const midiNote = resolvePitch(note.pitch);
        const timeInSeconds = note.time * (60 / tempo); // Convert beats to seconds
        const durationInSeconds = note.duration * (60 / tempo);
        const velocity = (note.velocity ?? 100) / 127; // Normalize to 0-1

        track.addNote({
          midi: midiNote,
          time: timeInSeconds,
          duration: durationInSeconds,
          velocity: velocity,
        });

        totalNotes++;
      }
    }

    // Write the MIDI file
    const filename = name.endsWith(".mid") ? name : `${name}.mid`;
    const filepath = join(OUTPUT_DIR, filename);
    const midiBuffer = Buffer.from(midi.toArray());
    writeFileSync(filepath, midiBuffer);

    return {
      content: [
        {
          type: "text",
          text:
            `Generated MIDI file: ${filename}\n` +
            `Path: ${filepath}\n` +
            `Tempo: ${tempo} BPM\n` +
            `Time Signature: ${timeSignature[0]}/${timeSignature[1]}\n` +
            `Tracks: ${tracks.length}\n` +
            `Total notes: ${totalNotes}`,
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error generating MIDI: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
