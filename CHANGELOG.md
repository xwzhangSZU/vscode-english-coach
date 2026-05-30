# Say It Right Changelog

## [0.4.0] - 2026-05-30

- Extended the everyday-English prosody correction layer across Qwen, Gemini, MiniMax, and MiMo analysis so provider output is normalized before the stave is drawn.
- Added karaoke word-highlight: generated model audio can be ASR-aligned to stave words, highlighted during playback, and clicked for seek-to-word practice.
- Added macOS recording, A/B playback, comparison, learner-audio export, and word-level feedback for shadowing practice.
- Added ASR transcription, word-timing alignment, pronunciation feedback diff, ffmpeg argument, and manifest coverage tests.

## [0.3.4] - 2026-05-30

- Fixed MiniMax pronunciation analysis when the provider returns a schema echo, a loose word-analysis JSON shape, missing top-level IPA, or missing word syllables.
- Added an everyday-English prosody normalization layer so MiniMax/MiMo graphs reduce function words, stress content words, pick a natural nuclear focus, merge weak thought groups, and use habitual statement/question tones.
- Verified MiniMax and MiMo live analysis outputs produce graph-ready stress, reduced-word, IPA, nuclear-word, and intonation data.

## [0.3.3] - 2026-05-30

- Upgraded the pronunciation player from text-only stave marks to responsive SVG pitch-contour groups, with stress/reduced/nuclear dots, tone badges, connected-speech links, and per-word IPA.
- Fixed narrow-panel visual clipping so common thought groups remain readable in the VS Code webview instead of losing the nuclear word or tone badge off-screen.

## [0.3.2] - 2026-05-30

- Added visible provider, analysis model, speech model, and voice selectors to the pronunciation player.
- Restored Xiaomi MiMo in the default Coach provider switcher.
- Aligned MiniMax analysis/TTS and MiMo Token Plan analysis/TTS request shapes with official docs.
- Added runtime and unit coverage for MiniMax/MiMo provider, model, and voice selection.

## [0.3.1] - 2026-05-30

- Restored Marketplace publishing under `Xianwei-Zhang.vscode-say-it-right`.
- Kept the Marketplace display name as `Say It Right` to avoid the server-side suspicious-content block.
- Removed optional chat participant, automatic clipboard watching, and host-side sidebar read-aloud paths from the packaged extension.

## [0.3.0] - 2026-05-30

- Rebranded the extension package to `vscode-say-it-right` with display name `Say It Right 英语发音教练`.
- Added a visible sidebar pronunciation entry point that opens the Say It Right player from the current sidebar text.
- Added provider-specific pronunciation analysis, TTS model, and voice settings for Qwen, MiniMax, MiMo, Gemini, and OpenAI.
- Updated pronunciation defaults for Qwen analysis, MiniMax speech, and Gemini speech.
- Removed expiring MiMo model ids from the active pronunciation catalog.
- Fixed synthesized-audio caching so changing the TTS model produces fresh cached audio.

## [0.2.2] - 2026-05-30

- Fixed Qwen JSON-mode pronunciation analysis by making the prosody prompt explicitly request JSON.
- Improved the pronunciation stave so intonation arrows align with the nuclear word.

## [0.2.0] - 2026-05-30

- Added the Say It Right pronunciation player for selected English text.
- Added sentence navigation, speed control, teacher-slow playback, AB repeat, shadowing loops, and audio export.
- Added local history and sidebar coach workflows.
