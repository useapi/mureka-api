# Mureka API examples (useapi.net)

Runnable Node.js examples for the [Mureka API](https://useapi.net/docs/api-mureka-v1) by [useapi.net](https://useapi.net) — a **Suno / Udio alternative**. Drive your own [Mureka](https://www.mureka.ai) account over a simple REST API: generate full songs from lyrics, descriptions, or musical styles with **SkyMusic** — `V9` (default), plus `V8` / `O2` / `V7.6` — alongside **instrumental** tracks, **extend**, **vocal cloning**, **motif (melody) seeding**, and **multi-speaker speech** with voice cloning. No per-call metering — it runs your own Mureka subscription.

Each example reads a list of prompts from `prompts.json`, submits them through the useapi.net Mureka API, polls each job until it is final, and downloads every result — so you can queue a batch and come back to the winners.

| Example | What it does | Docs |
|---|---|---|
| [`music/`](./music) | Batch-generate **songs** from text prompts — AI-written lyrics, style, and mood, with **SkyMusic** model selection | [POST /music/create](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create) |

## Quick start

You need [Node.js](https://nodejs.org) v21 or newer (no dependencies to install), a useapi.net [API token](https://useapi.net/docs/start-here/setup-useapi), and a connected [Mureka account](https://useapi.net/docs/start-here/setup-mureka) (one [$15/month subscription](https://useapi.net/docs/subscription) covers every useapi.net API):

```bash
git clone https://github.com/useapi/mureka-api.git
cd mureka-api/music
node ./mureka.mjs <API_TOKEN>
```

`API_TOKEN` is your useapi.net token. The optional second argument is your Mureka account id (or its Google email) — only needed when you have more than one account configured; with a single account it is auto-selected. Edit `prompts.json` in each folder to queue your own prompts. Every supported parameter is documented on the [POST /music/create](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create) endpoint page.

## About useapi.net

[useapi.net](https://useapi.net) is an experimental REST API for AI services. The Mureka API drives your own [Mureka](https://www.mureka.ai) account, so you spend your plan's credits at consumer rates instead of metered developer-API pricing. See the [model matrix](https://useapi.net/model-matrix) and pricing on the [API overview](https://useapi.net/docs/api-mureka-v1).

Visit our [Discord Server](https://discord.gg/w28uK3cnmF) or [Telegram Channel](https://t.me/use_api) for any support questions and concerns.

We regularly post guides and tutorials on the [YouTube Channel](https://www.youtube.com/@midjourneyapi).
