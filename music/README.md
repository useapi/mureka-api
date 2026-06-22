# Song generation — Mureka API batch generation (Node.js)

Batch-generate full songs with **Mureka's models** through the [Mureka API](https://useapi.net/docs/api-mureka-v1) by [useapi.net](https://useapi.net), driving your own [Mureka](https://www.mureka.ai) account.

`mureka.mjs` reads prompts from `prompts.json`, submits each one to [`POST /music/create`](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create) in **async** mode (`async: true`), polls [`GET /jobs/{jobid}`](https://useapi.net/docs/api-mureka-v1/get-mureka-jobs-jobid) until each job is `completed`, and downloads every generated MP3. Each generation returns **two songs** (version `1` and `2`), so a single prompt yields two `.mp3` files.

## Prerequisites

- [Node.js](https://nodejs.org) v21 or newer (no dependencies to install — uses built-in `fetch`)
- A useapi.net [API token](https://useapi.net/docs/start-here/setup-useapi)
- A connected [Mureka account](https://useapi.net/docs/start-here/setup-mureka)

## Usage

```bash
node ./mureka.mjs <API_TOKEN> [ACCOUNT] [PROMPTS_FILE]
```

`ACCOUNT` is optional — pass your Mureka **account id** or its **Google email** only when more than one account is configured; with a single account it is auto-selected. `PROMPTS_FILE` defaults to `prompts.json`.

If a `mureka_results.txt` file from a previous run is present, the script offers to resume — polling those jobs and downloading their audio — before submitting anything new. Errors are appended to `mureka_errors.txt`.

## Prompts

`prompts.json` is an array of prompt objects:

- `prompt` — **required** text that guides the AI-written lyrics, style, mood, and theme (max 3000 characters).
- `model` — optional. Supported values: `V9` (default), `V8`, `O2`, `V7.6`. When omitted, the API applies its own default (currently `V9`). The API also still accepts older aliases (`V7.5`, `V7`, `O1`, `V6`) that map to current engines — add any you want to use to `SUPPORTED_MODELS` in `mureka.mjs`.

Every supported parameter is documented on [POST /music/create](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create).

## Beyond this example

- **Bring your own lyrics / title** — use [`POST /music/create-advanced`](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-advanced) (it returns the same job shape, polled and downloaded the same way).
- **Instrumental tracks** — [`POST /music/create-instrumental`](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-instrumental).
- **Extend / regenerate** a song — [`POST /music/extend`](https://useapi.net/docs/api-mureka-v1/post-mureka-music-extend), [`POST /music/regenerate`](https://useapi.net/docs/api-mureka-v1/post-mureka-music-regenerate).
- **Stems / license ZIP** — the `mp3_url` downloaded here is the finished track; [`POST /music/download`](https://useapi.net/docs/api-mureka-v1/post-mureka-music-download) returns the separated **stems** (`type: "stem"`) or the **license** (`type: "license"`) as a ZIP.
- **Multi-speaker speech / voice cloning** — [`POST /speech`](https://useapi.net/docs/api-mureka-v1/post-mureka-speech).

---

Support: [Discord](https://discord.gg/w28uK3cnmF) · [Telegram](https://t.me/use_api) · [YouTube](https://www.youtube.com/@midjourneyapi)
