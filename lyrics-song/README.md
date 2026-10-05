# Songs from your own lyrics — Mureka API batch generation (Node.js and Python)

Turn **your own lyrics** into finished songs with **Mureka's models** through the [Mureka API](https://useapi.net/docs/api-mureka-v1?utm_source=github&utm_medium=referral&utm_campaign=mureka-api) by [useapi.net](https://useapi.net/?utm_source=github&utm_medium=referral&utm_campaign=mureka-api), driving your own [Mureka](https://www.mureka.ai) account. The model sings your exact words; you steer the style with genres, moods and a vocal gender.

📖 Full walkthrough: **[How to Generate AI Music with the Mureka API — Write your own lyrics, or force an instrumental](https://useapi.net/docs/articles/mureka-bash?utm_source=github&utm_medium=referral&utm_campaign=mureka-api#write-your-own-lyrics-or-force-an-instrumental)**

`lyrics-song.mjs` (and its Python twin `lyrics-song.py`) reads entries from `prompts.json`, submits each one to [`POST /music/create-advanced`](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-advanced?utm_source=github&utm_medium=referral&utm_campaign=mureka-api) in **async** mode, polls [`GET /jobs/{jobid}`](https://useapi.net/docs/api-mureka-v1/get-mureka-jobs-jobid?utm_source=github&utm_medium=referral&utm_campaign=mureka-api) until each job is `completed`, and downloads every generated MP3. Each generation returns **two songs** (occasionally a third).

## Prerequisites

- [Node.js](https://nodejs.org) v21 or newer **or** [Python](https://www.python.org) 3.x (neither has any dependencies to install)
- A useapi.net [API token](https://useapi.net/docs/start-here/setup-useapi?utm_source=github&utm_medium=referral&utm_campaign=mureka-api)
- A connected [Mureka account](https://useapi.net/docs/start-here/setup-mureka?utm_source=github&utm_medium=referral&utm_campaign=mureka-api)

## Usage

```bash
node ./lyrics-song.mjs <API_TOKEN> [ACCOUNT] [PROMPTS_FILE]
# or, equivalently, with Python:
python3 ./lyrics-song.py <API_TOKEN> [ACCOUNT] [PROMPTS_FILE]
```

`ACCOUNT` is optional: pass your Mureka **account id** (or its email) only when more than one account is configured. `PROMPTS_FILE` defaults to `prompts.json`. A `lyrics-song_results.txt` left by an interrupted run is offered for resume; errors go to `lyrics-song_errors.txt`.

## Prompts

`prompts.json` is an array of objects:

- `lyrics` — **required**, the words to sing (max 5,000 characters). Tag sections with `[Verse]`, `[Chorus]`, `[Bridge]`.
- `title` — optional song title (max 50 characters).
- `desc` — optional comma-separated genres, moods and vocals, e.g. `indie pop, upbeat, female vocal` (max 1,000 characters). Valid values: [GET /music/moods-and-genres](https://useapi.net/docs/api-mureka-v1/get-mureka-music-moods-and-genres?utm_source=github&utm_medium=referral&utm_campaign=mureka-api).
- `vocal_gender` — optional, `female` or `male`.
- `model` — optional: `V9.5` (default), `V9`, `V8`, `O2`, `V7.6`, `V7.5`.

Custom vocals (`vocal_id`), reference tracks (`ref_id`) and melody motifs (`motif_id`) need an uploaded file id; see [POST /music/create-advanced](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-advanced?utm_source=github&utm_medium=referral&utm_campaign=mureka-api). To lengthen a result, pass its `song_id` to [POST /music/extend](https://useapi.net/docs/api-mureka-v1/post-mureka-music-extend?utm_source=github&utm_medium=referral&utm_campaign=mureka-api).

---

Support: [Discord](https://discord.gg/w28uK3cnmF) · [Telegram](https://t.me/use_api) · [YouTube](https://www.youtube.com/@useapi-net)
