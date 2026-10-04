# Press clip media notes

How `node design/render.js demo` makes `public/press/demo.mp4` and `demo-vertical.mp4` (20 s, same edit and sound),
and how to put a different music track under them.

## The edit (seconds)

Hook 0 to 1.2 (a tick per word) · question from 1.2 · tap on the answer 3.9 · tap on 100% 5.9 · reveal 6.17 ·
BLUFF stamp lands 6.43 · end screen 9.87 · end card 17.2 to 20. Every cut is a 0.3 s dissolve.

## Sound

- Effects, on the edit's frames (`CUT` and `WORDS` in `render.js`, synthesised in `soundtrack.js`):
  - each hook word and each tap: the game's own tick from `public/sound.js` (square wave, 1800 Hz, 30 ms, gain 0.03,
    the same 12 ms exponential envelope);
  - the BLUFF stamp: a low thud (70 to 42 Hz) and a paper slap (noise band-passed at 1.6 kHz);
  - the −300: the game's own wrong-at-100% sound (triangle, 196 to 98 Hz over 0.7 s), which it plays at the reveal;
  - the end card: three rising notes of the game's fanfare (C5, E5, G5, triangle).
- Music: a bed synthesised in `soundtrack.js` (100 BPM: soft kick, hats, a driven sine bass pulse, a low D / E-flat
  drone, a noise riser while the stake is chosen, a dead stop at the reveal, one low hit on the end card). It was
  checked by measurement only (timing, loudness, peaks), not by ear; replace it if it does not hold up.
- Mix: the music brought to −20 LUFS and ducked 4 dB under the effects (10 ms down, 250 ms back up); the whole at
  −16 LUFS integrated, true peak −1.5 dBTP (two-pass loudnorm, linear); AAC 192 kb/s, 48 kHz stereo. The GIF is silent.

## Using another track

```
node design/render.js demo http://127.0.0.1:8788 --music path/to/track.wav
```

The file (any format ffmpeg reads) replaces the synthesised bed: its opening 20 s, faded out over the last 1.2 s,
brought to −20 LUFS and ducked under the effects like the bed. Prompt for a music generator, instrumental, at least
20 s:

> Minimal, tense, modern instrumental bed for a 20-second product video. 100 BPM, 4/4, D minor. Light, dry percussion
> only: a soft muted kick on every beat, quiet closed hi-hats on the off-beats that thicken into sixteenths from 0:04.
> Underneath, a low drone (D and E-flat, a semitone apart, felt more than heard) and a short, slightly saturated sub
> bass pulse on eighth notes, ducking under the kick. A filtered noise riser builds from 0:04 to 0:06, then everything
> stops dead at 0:06.2; one second of silence; the drone returns alone; at 0:10 the beat comes back, a little brighter,
> until 0:17; at 0:17.2 one deep hit and a 2.5-second decay to silence. No vocals, no melody, no synth leads, no crash
> cymbals, no trailer hits. Clean, spacious, quietly confident.
