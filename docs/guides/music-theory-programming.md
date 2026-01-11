# Music Theory Programming Reference

Quick reference for programmatic music composition.

## Note-to-MIDI Conversion

```
MIDI Number = semitone + (octave + 1) × 12
```

| Note | Semitone |
|------|----------|
| C | 0 |
| D | 2 |
| E | 4 |
| F | 5 |
| G | 7 |
| A | 9 |
| B | 11 |

**Examples:** C4 = 0 + (4+1)×12 = 60, A4 = 9 + 5×12 = 69

## Scale Formulas (semitones from root)

| Scale | Intervals |
|-------|-----------|
| Major | 0, 2, 4, 5, 7, 9, 11 |
| Natural Minor | 0, 2, 3, 5, 7, 8, 10 |
| Harmonic Minor | 0, 2, 3, 5, 7, 8, 11 |
| Pentatonic Major | 0, 2, 4, 7, 9 |
| Pentatonic Minor | 0, 3, 5, 7, 10 |
| Blues | 0, 3, 5, 6, 7, 10 |
| Dorian | 0, 2, 3, 5, 7, 9, 10 |
| Mixolydian | 0, 2, 4, 5, 7, 9, 10 |

## Chord Formulas (semitones from root)

| Chord | Intervals |
|-------|-----------|
| Major | 0, 4, 7 |
| Minor | 0, 3, 7 |
| Dim | 0, 3, 6 |
| Aug | 0, 4, 8 |
| Sus2 | 0, 2, 7 |
| Sus4 | 0, 5, 7 |
| Maj7 | 0, 4, 7, 11 |
| Min7 | 0, 3, 7, 10 |
| Dom7 | 0, 4, 7, 10 |
| Dim7 | 0, 3, 6, 9 |

## Key Signatures

**Order of Sharps:** F C G D A E B
**Order of Flats:** B E A D G C F

| Key | Sharps/Flats |
|-----|--------------|
| C | 0 |
| G | 1♯ (F♯) |
| D | 2♯ (F♯ C♯) |
| F | 1♭ (B♭) |
| Bb | 2♭ (B♭ E♭) |

**Relative minor:** 3 semitones down from major (C major → A minor)
