# Mureka API examples (useapi.net)

Runnable Node.js and Python examples for the [Mureka API](https://useapi.net/docs/api-mureka-v1) by [useapi.net](https://useapi.net/?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) — a **Suno / Udio alternative**. Drive your own [Mureka](https://www.mureka.ai) account over a simple REST API: generate full songs from lyrics, descriptions, or musical styles with **Mureka's models** — `V9.5` (default), `V9`, the flagship `O2`, plus `V8` and `V7.6` — alongside **instrumental** tracks, **extend**, **vocal cloning**, **motif (melody) seeding**, and **multi-speaker speech** with voice cloning. No per-call metering — it runs your own Mureka subscription.

Each example ships JavaScript and Python implementations (`.mjs` and `.py`, no dependencies) that read a list of prompts from `prompts.json`, submit them through the useapi.net Mureka API, poll each job until it is final, and download every result — so you can queue a batch and come back to the winners.

The [`sheet-music/`](./sheet-music) example is a single call instead: give it a song, a YouTube link or an MP3 and it saves the score's MusicXML and PDFs.

The [`own-voice/`](./own-voice) example sings your lyrics in your own voice: upload a clip once, use it directly or turn it into a reusable character, then manage your characters.

| Example | What it does | Docs |
|---|---|---|
| [`music/`](./music) | Batch-generate **songs** from text prompts — AI-written lyrics, style, and mood, with **Mureka** model selection | [POST /music/create](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create) |
| [`lyrics-song/`](./lyrics-song) | Turn **your own lyrics** into songs, steered by genres, moods and vocal gender | [POST /music/create-advanced](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-advanced?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) |
| [`instrumental/`](./instrumental) | Batch-generate **instrumental** tracks (no vocals) from a description | [POST /music/create-instrumental](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-instrumental?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) |
| [`sheet-music/`](./sheet-music) | Turn a Mureka song, a **YouTube link** or a local **MP3** into **sheet music**: MusicXML, staff PDF and numbered-notation PDF (October 18, 2026) | [POST /music/score](https://useapi.net/docs/api-mureka-v1/post-mureka-music-score?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) · [tutorial](https://useapi.net/docs/articles/mureka-sheet-music?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) |
| [`own-voice/`](./own-voice) | Sing **your own lyrics in your own voice**: upload a voice clip, use it once or make a reusable **character** (free), then list, publish and delete characters (October 18, 2026) | [POST /music/characters](https://useapi.net/docs/api-mureka-v1/post-mureka-music-characters?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) · [example post](https://useapi.net/blog/261016?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) |

Walkthrough of the three song examples with `curl`: [How to Generate AI Music with the Mureka API (Suno / Udio Alternative)](https://useapi.net/docs/articles/mureka-bash?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api).

## Quick start

You need [Node.js](https://nodejs.org) v21 or newer **or** [Python](https://www.python.org) 3.x (neither has any dependencies to install), a useapi.net [API token](https://useapi.net/docs/start-here/setup-useapi?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api), and a connected [Mureka account](https://useapi.net/docs/start-here/setup-mureka) (one [$15/month subscription](https://useapi.net/docs/subscription?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) covers every useapi.net API):

```bash
git clone https://github.com/useapi/mureka-api.git
cd mureka-api/music
node ./mureka.mjs <API_TOKEN>
# or, equivalently, with Python:
python3 ./mureka.py <API_TOKEN>
```

`API_TOKEN` is your useapi.net token. The optional second argument is your Mureka account id (or its email) — only needed when you have more than one account configured; with a single account it is auto-selected. Edit `prompts.json` in each folder to queue your own prompts. Every supported parameter is documented on the [POST /music/create](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create) endpoint page.

## MCP server

useapi.net also runs a hosted [Model Context Protocol](https://modelcontextprotocol.io) server for Mureka, so an AI assistant such as Claude Code, Cursor or VS Code Copilot can use it on your own account. It has 40 tools: songs from a prompt or your lyrics (style, voice, character, reference track or melody), instrumentals and lyrics, extend, section edits and remix, stems with MIDI and DAW sessions, sheet music (MusicXML and PDF), characters that make your own voice a reusable singer, uploads, YouTube import, and speech with voice cloning. Nothing to install or run locally.

- Endpoint: `https://api.useapi.net/v1/mureka/mcp`
- Transport: Streamable HTTP
- Authorization: your useapi.net API token in the `Authorization: Bearer …` header, and an account connected with the [Mureka setup](https://useapi.net/docs/start-here/setup-mureka?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api)
- Listed in the official MCP Registry as `net.useapi/mureka`

Claude Code:

```bash
claude mcp add --transport http useapi-mureka https://api.useapi.net/v1/mureka/mcp --header "Authorization: Bearer YOUR_API_TOKEN"
```

Cursor, VS Code, Windsurf and the full tool list: [Mureka MCP server docs](https://useapi.net/docs/api-mureka-v1/mcp?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api). useapi.net is a third-party API, not affiliated with Mureka or Kunlun Tech.

## Use with Claude Code

This repo is also a Claude Code plugin marketplace. The plugin adds the hosted Mureka MCP server, and reads your token from the `USEAPI_TOKEN` environment variable, so set it before you start Claude Code:

```bash
export USEAPI_TOKEN=user:12345-...      # your useapi.net API token
```

Then, inside Claude Code:

```
/plugin marketplace add useapi/mureka-api
/plugin install mureka@useapi-mureka
```

On Claude Code 2.1.275 or later, `/plugin install mureka --marketplace useapi/mureka-api` does both in one step. Run `/mcp` to check that `useapi-mureka` is connected.

## Use with Gemini CLI

This repo is also a Gemini CLI extension with the same MCP server:

```bash
gemini extensions install https://github.com/useapi/mureka-api
```

The install asks for your useapi.net API token and keeps it in the system keychain. Change it later with `gemini extensions config useapi-mureka`, and check the connection with `gemini mcp list`.

## Common questions

<!-- Official API figures in these answers, verified 2026-10-18: https://platform.mureka.ai/pricing (V9 / V8 / O2 4.5 cents a song), per the comparison table on useapi.net/docs/api-mureka-v1. -->

- **Does Mureka have an API?** Yes, and this repo uses the useapi.net Mureka API, a third-party REST API that drives your own Mureka website account, so you generate at website plan prices of about 1.35 to 1.8 cents a song, against 15 cents a song on V9.5 and 4.5 cents on V9, V8 and O2 through Mureka's [official developer API](https://platform.mureka.ai/pricing) (as of October 2026). Mureka sells the official API as prepaid top-ups consumed per call, from $1,000 (5 concurrent requests) up to $30,000 (150 concurrent), valid for 12 months, with extra charges for lyrics generation and stem export.
- **Where do I get an API key / token?** You call this API with a useapi.net [API token](https://useapi.net/docs/start-here/setup-useapi?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) and connect your Mureka account once through the [Mureka setup](https://useapi.net/docs/start-here/setup-mureka?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api): a dedicated account's email and password (the API logs in again by itself when Mureka ends the session), or session tokens copied from your browser. You don't need a key from Mureka's developer platform.
- **How much does it cost?** A flat [$15/month](https://useapi.net/docs/subscription?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) to useapi.net, which covers every useapi.net API, plus your Mureka web plan: Pro at $9/month (up to 500 songs, about 1.8¢ each) or Premier at $27/month (up to 2,000 songs, about 1.35¢ each), against about 4.5¢ a song on Mureka's official API (as of October 2026). V9.5, V9 and O2 use more credits per song, so real counts run lower. Lyrics generation and stem downloads are free on the web plan. See the [pricing comparison](https://useapi.net/docs/articles/mureka-bash?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api#pricing).
- **Which models can I use?** `V9.5` (default), `V9`, the flagship `O2`, `V8` and `V7.6`. Older names (`V7.5`, `V7`, `O1`, `V6`) still work and redirect to current engines. Every generation returns two complete songs (occasionally three) as MP3, up to about 5 minutes long.
- **Is it a Suno / Udio alternative?** Yes. Like Suno and Udio, Mureka writes and sings a full song with vocals from one text prompt, and it also takes your own lyrics, makes instrumentals, extends songs and clones voices for speech.
- **How many songs at once, and how many accounts?** Each Mureka account runs up to 10 generations at the same time. Each useapi.net subscription covers 3 Mureka accounts, and each extra $10/month subscription adds 3 more.
- More answers: [Mureka API questions](https://useapi.net/docs/articles/mureka-bash?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api#frequently-asked-questions).

## About useapi.net

[useapi.net](https://useapi.net/?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) is an experimental REST API for AI services. The Mureka API drives your own [Mureka](https://www.mureka.ai) account, so you spend your plan's credits at consumer rates instead of metered developer-API pricing. See the [model matrix](https://useapi.net/model-matrix?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) and pricing on the [API overview](https://useapi.net/docs/api-mureka-v1).

Visit our [Discord Server](https://discord.gg/w28uK3cnmF) or [Telegram Channel](https://t.me/use_api) for any support questions and concerns.

We regularly post guides and tutorials on the [YouTube Channel](https://www.youtube.com/@useapi-net).

## License

The example code in this repository is released under the [MIT License](./LICENSE). It covers the example scripts only, not the useapi.net service or API.
