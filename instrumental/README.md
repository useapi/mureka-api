# Instrumental tracks — Mureka API batch generation (Node.js and Python)

Batch-generate **instrumental** music (no vocals, no lyrics) with **Mureka's models** through the [Mureka API](https://useapi.net/docs/api-mureka-v1?utm_source=github&utm_medium=referral&utm_campaign=mureka-api) by [useapi.net](https://useapi.net/?utm_source=github&utm_medium=referral&utm_campaign=mureka-api), driving your own [Mureka](https://www.mureka.ai) account.

📖 Full walkthrough: **[How to Generate AI Music with the Mureka API — Write your own lyrics, or force an instrumental](https://useapi.net/docs/articles/mureka-bash?utm_source=github&utm_medium=referral&utm_campaign=mureka-api#write-your-own-lyrics-or-force-an-instrumental)**

`instrumental.mjs` (and its Python twin `instrumental.py`) reads prompts from `prompts.json`, submits each one to [`POST /music/create-instrumental`](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-instrumental?utm_source=github&utm_medium=referral&utm_campaign=mureka-api) in **async** mode, polls [`GET /jobs/{jobid}`](https://useapi.net/docs/api-mureka-v1/get-mureka-jobs-jobid?utm_source=github&utm_medium=referral&utm_campaign=mureka-api) until each job is `completed`, and downloads every generated MP3. Each generation returns **two tracks** (occasionally a third).

## Prerequisites

- [Node.js](https://nodejs.org) v21 or newer **or** [Python](https://www.python.org) 3.x (neither has any dependencies to install)
- A useapi.net [API token](https://useapi.net/docs/start-here/setup-useapi?utm_source=github&utm_medium=referral&utm_campaign=mureka-api)
- A connected [Mureka account](https://useapi.net/docs/start-here/setup-mureka?utm_source=github&utm_medium=referral&utm_campaign=mureka-api)

## Usage

```bash
node ./instrumental.mjs <API_TOKEN> [ACCOUNT] [PROMPTS_FILE]
# or, equivalently, with Python:
python3 ./instrumental.py <API_TOKEN> [ACCOUNT] [PROMPTS_FILE]
```

`ACCOUNT` is optional: pass your Mureka **account id** (or its email) only when more than one account is configured. `PROMPTS_FILE` defaults to `prompts.json`. An `instrumental_results.txt` left by an interrupted run is offered for resume; errors go to `instrumental_errors.txt`.

## Prompts

`prompts.json` is an array of objects:

- `prompt` — describes the music: genre, instruments, mood, tempo (max 1,000 characters).
- `title` — optional song title (max 50 characters).
- `model` — optional: `V9.5` (default), `V9`, `V8`, `O2`, `V7.6`, `V7.5`.

Reference tracks (`ref_id`) and melody motifs are documented on [POST /music/create-instrumental](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-instrumental?utm_source=github&utm_medium=referral&utm_campaign=mureka-api).

---

Support: [Discord](https://discord.gg/w28uK3cnmF) · [Telegram](https://t.me/use_api) · [YouTube](https://www.youtube.com/@useapi-net)
