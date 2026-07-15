# English Pronunciation Helper

영어 끊어 읽기 & 발음 교정 도우미 — A single-page web app for Korean learners of English. Read a passage one chunk at a time, listen to a native-speed model, speak it back, and get a word-by-word match score.

**Live demo:** https://ragingwind.github.io/pronunciation_helper/

The entire app is one static `index.html` — no build step, no server, no dependencies to install.

## Features

- **Chunk mode / Full mode** — practise a sentence one breath group at a time, or the whole sentence at once.
- **Listen** — speaks the current chunk or sentence with the Web Speech API at 0.85× rate, preferring an `en-US` voice.
- **Speak & score** — records you, transcribes, and highlights each target word as matched or missed. The score is the ratio of matched words (≥80% green, ≥55% amber, below that red).
- **Dual speech engine with automatic fallback** — uses the browser's online `SpeechRecognition` by default, and switches to an on-device Whisper model when the network is blocked or the API is unavailable. A badge always shows which engine is active.
- **Pronunciation tips** — per-chunk notes on linking, stress, and tricky consonants, written in Korean.
- **Verb dictionary** — verbs in the current sentence are looked up in a built-in table and shown with base form, IPA, meaning, and an example sentence.
- **Bring your own passage** — paste any English text in the editor at the top and it becomes the new practice set.

## Speech engines

| | Online engine | Local engine |
|---|---|---|
| Backend | Web Speech API (`SpeechRecognition`) | Whisper `Xenova/whisper-tiny.en` via Transformers.js |
| Network | Required | Only for the first model download (~30s, then cached) |
| Audio path | Handled by the browser | `MediaRecorder` → `AudioContext` @16kHz → mono PCM |

The app starts on the online engine. It switches to the local engine automatically when `SpeechRecognition` is missing from the browser, or when recognition fails with a `network` error — which is what typically happens behind a corporate firewall or VPN. Once switched, the model is preloaded in the background with a progress bar, so the next evaluation runs entirely on-device.

## Using the passage editor

Open **연습 문장 및 해석 업데이트** at the top and paste text in either format:

**English only** — text is split into sentences at `.` `!` `?`, and each sentence is translated automatically:

```
These days, / almost every student / has a smartphone.
Some people say / phones are helpful, / but others think / they cause many problems.
```

**English + Korean pairs** — odd lines English, even lines your own translation:

```
These days, / almost every student / has a smartphone.
요즘에는, / 거의 모든 학생들은 / 스마트폰을 가지고 있습니다. (요즘에는 거의 모든 학생들이 스마트폰을 가지고 있습니다.)
```

Rules the parser follows:

- `/` marks a chunk boundary. Without any `/`, a sentence is chunked automatically at roughly four words.
- In a translation line, text in trailing parentheses is shown as the natural translation (의역); everything before it is the literal, chunk-aligned translation (직독직해).
- Korean anywhere in the input switches the parser to line-by-line mode; whether it treats lines as pairs depends on the second line being Korean.
- When no translation is supplied, each chunk and the full sentence are translated separately so the literal/natural split still works.

## Running locally

`index.html` has no build step, but it must be served over `http://` or `https://` — the microphone and the ES module import do not work from a `file://` URL.

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploying to GitHub Pages

The app is served straight from the repository root:

1. Push `index.html` to `main`.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Pick **`main`** and folder **`/ (root)`**, then Save.

Pages serves over HTTPS, which the microphone APIs require.

## Requirements & limitations

- **Chrome is recommended.** `SpeechRecognition` is a Chromium API; other browsers fall back to the local Whisper engine (Safari/Firefox users get the on-device path only).
- **Scoring is lexical, not phonetic.** It compares the transcript to the target text word by word after stripping punctuation and lowercasing, so it catches wrong or dropped words but cannot grade accent, stress, or intonation. A homophone counts as correct.
- **Auto-translation uses an unofficial endpoint** (`translate.googleapis.com/translate_a/single`). It is undocumented, rate-limited, and may fail without notice — supply your own translations if this matters.
- **The verb dictionary is a fixed table** of roughly 100 common verbs matched by surface form. Verbs outside it are silently skipped, and the card hides when nothing matches.
- **Third-party CDNs** (jsDelivr, Google Fonts, cdnjs) must be reachable for the local engine, fonts, and icons.

## Project structure

Everything lives in `index.html`:

| Section | Contents |
|---|---|
| `<style>` | Theme variables and layout (dark glassmorphism, 800px column) |
| `<body>` | Notice banner, model loader, passage editor, practice card, feedback panel |
| `<script type="module">` | Transformers.js import, Whisper loading, engine switching |
| `<script>` | Verb DB, default passage, rendering, TTS, recording, scoring, parser |

State is a handful of variables — `practiceData`, `currentIndex`, `activeChunkIndex`, `practiceMode` — and `renderSentence()` redraws from them.
