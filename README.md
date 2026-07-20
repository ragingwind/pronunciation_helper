# English Pronunciation Helper

영어 끊어 읽기 & 발음 교정 도우미 — A single-page web app for Korean learners of English. Read a passage one chunk at a time, listen to a native-speed model, speak it back, and get a word-by-word match score.

**Live demo:** https://ragingwind.github.io/pronunciation_helper/

The app itself is one static `index.html`. Practice material lives in `articles.md`; an optional Node build step pre-translates it into `data/articles.json` for instant loading.

## Features

- **Article library** — pick a passage from `articles.md` (split into articles by `---`) and study it. Selecting an article loads its sentences into the practice flow.
- **Chunk mode / Full mode** — practise a sentence one breath group at a time, or the whole sentence at once.
- **Listen** — speaks the current chunk or sentence with the Web Speech API at 0.85× rate, preferring an `en-US` voice.
- **Speak & score** — records you, transcribes, and highlights each target word as matched or missed. The score is the ratio of matched words (≥80% green, ≥55% amber, below that red).
- **Dual speech engine with automatic fallback** — uses the browser's online `SpeechRecognition` by default, and switches to an on-device Whisper model when the network is blocked or the API is unavailable. A badge always shows which engine is active.
- **Pronunciation tips** — per-chunk notes on linking, stress, and tricky consonants, written in Korean.
- **Verb dictionary** — verbs in the current sentence are looked up in a built-in table and shown with base form, IPA, meaning, and an example sentence.

## Speech engines

| | Online engine | Local engine |
|---|---|---|
| Backend | Web Speech API (`SpeechRecognition`) | Whisper `Xenova/whisper-tiny.en` via Transformers.js |
| Network | Required | Only for the first model download (~30s, then cached) |
| Audio path | Handled by the browser | `MediaRecorder` → `AudioContext` @16kHz → mono PCM |

The app starts on the online engine. It switches to the local engine automatically when `SpeechRecognition` is missing from the browser, or when recognition fails with a `network` error — which is what typically happens behind a corporate firewall or VPN. Once switched, the model is preloaded in the background with a progress bar, so the next evaluation runs entirely on-device.

## Editing the content

All practice material lives in **`articles.md`**. Each article is one `# Title` heading followed by body paragraphs, and articles are separated by a `---` line:

```markdown
# Should We Stop Using Plastic Bags?

Plastic bags are everywhere in our lives. People use them at supermarkets...

---

# Should Students Use Smartphones at School?

These days, almost every student has a smartphone...
```

To change the library, just edit `articles.md` — add, remove, or reorder articles. Each article body is split into sentences at `.` `!` `?`, each sentence is chunked at roughly four words, and Korean translations (literal `/`-aligned plus a natural version in parentheses) are generated automatically.

## How the app loads content

On startup the app tries two sources, in order:

1. **`data/articles.json`** (preferred) — prebuilt by `npm run build`, with all translations baked in, so articles load instantly and no translation happens in the browser.
2. **`articles.md`** (fallback) — if no prebuilt JSON is present, the app fetches the Markdown and translates each article live the first time it's selected.

Either way the app fetches over HTTP, so it can't run from a `file://` URL — use the dev server below.

## Scripts

Requires Node 18+ (uses the built-in `fetch`); there are no npm dependencies to install.

| Command | What it does |
|---|---|
| `npm run dev` | Start a no-cache static server at `http://localhost:8000` and rebuild `data/articles.json` whenever `articles.md` changes. Override the port with `PORT=3000 npm run dev`. |
| `npm run build` | Read `articles.md`, translate every chunk and sentence, and write `data/articles.json`. |
| `npm run deploy` | Rebuild the data, then commit `articles.md` + `data/articles.json` and push so GitHub Pages republishes. |

Typical loop: `npm run dev`, edit `articles.md` (the app parses it live on refresh), then `npm run build` to bake translations and `npm run deploy` to publish.

## Deploying to GitHub Pages

The app is served straight from the repository root:

1. Push `index.html`, `articles.md`, and `data/articles.json` to `main` (or run `npm run deploy`).
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

| Path | Contents |
|---|---|
| `index.html` | The whole app — styles, markup, and two scripts (Whisper/engine module + main logic: verb DB, article loader, rendering, TTS, recording, scoring). |
| `articles.md` | Practice content — articles separated by `---`. Edit this to change what users study. |
| `data/articles.json` | Prebuilt practice data (generated; loaded by the app for instant startup). |
| `scripts/build.mjs` | Parses `articles.md` and writes `data/articles.json`, translating chunks and sentences. |
| `scripts/dev-server.mjs` | No-cache static server with auto-rebuild on `articles.md` changes. |
| `scripts/deploy.mjs` | Rebuilds data, then commits and pushes it. |

Inside `index.html`, app state is a handful of variables — `articlesData`, `currentArticleIndex`, `practiceData`, `currentIndex`, `activeChunkIndex`, `practiceMode` — and `renderSentence()` redraws from them.
