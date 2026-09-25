# Cutscenes play muted with a separate Web Audio soundtrack

A Cutscene is triggered by walking over a Chest, which is not a user gesture, and players may be using a keyboard or gamepad, which cannot reliably unlock audible video (the Phaser keyboard events are queued, and the gamepad is not an activation-triggering input). Every Cutscene video is therefore loaded with `noAudio: true` and plays muted, which is exempt from autoplay blocking. Its soundtrack is a separate audio file in the Theme's pack, played through the Sound Manager when the video emits `playing`. The Sound Manager's Web Audio context is already unlocked by the menu click. The Chest Reveal pause before the clip exists for pacing, not to unlock playback.

## Considered Options

- **Audible video started inside a pointer handler.** Rejected because it breaks with keyboard or gamepad input and on WebKit, where `scene.launch` runs `play()` on the next frame, outside the gesture.
- **Audible video, falling back to a "Tap to play" overlay when `locked` fires.** Rejected because it adds a second code path and an extra interaction that appears unpredictably.

## Consequences

- Every clip's audio has to be exported as its own file (`.ogg` + `.m4a`).
- Audio can drift slightly out of sync with the video. That is acceptable for clips of 8 s or less.
- Never call `setMute(false)` on a Cutscene video, because iOS pauses a video that is un-muted without a gesture.
