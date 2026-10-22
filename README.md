# Mureka API examples (useapi.net)

Runnable Node.js and Python examples for the [Mureka API](https://useapi.net/docs/api-mureka-v1?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) by [useapi.net](https://useapi.net/?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) , a Suno and Udio alternative. It uses your [Mureka subscription](https://www.mureka.ai/subscribe): Free, Pro $10 or Premier $30 a month (as of October 2026). Over a simple REST API it makes full songs from your lyrics or a description with Mureka V9.5 (the default), V9, V8, O2, V7.6 and V7.5-all, plus instrumentals, extends, remixes, melody seeding, stems, sheet music and multi-speaker speech, and on Mureka Premier it sings in your own voice. Everything runs on your subscription's monthly Mureka Gold, with no Mureka developer account and no prepaid developer balance.

Each example ships JavaScript and Python implementations (`.mjs` and `.py`, no dependencies) that read a list of prompts from `prompts.json`, submit them through the useapi.net Mureka API, poll each job until it is final, and download every result — so you can queue a batch and come back to the winners.

The [`sheet-music/`](./sheet-music) example is a single call instead: give it a song, a YouTube link or an MP3 and it saves the score's MusicXML and PDFs.

The [`own-voice/`](./own-voice) example sings your lyrics in your own voice: upload a clip once, use it directly or turn it into a reusable character, then manage your characters.

| Example | What it does | Docs |
|---|---|---|
| [`music/`](./music) | Batch-generate **songs** from text prompts — AI-written lyrics, style, and mood, with **Mureka** model selection | [POST /music/create](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) |
| [`lyrics-song/`](./lyrics-song) | Turn **your own lyrics** into songs, steered by genres, moods and vocal gender | [POST /music/create-advanced](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-advanced?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) |
| [`instrumental/`](./instrumental) | Batch-generate **instrumental** tracks (no vocals) from a description | [POST /music/create-instrumental](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-instrumental?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) |
| [`sheet-music/`](./sheet-music) | Turn a Mureka song, a **YouTube link** or a local **MP3** into **sheet music**: MusicXML, staff PDF and numbered-notation PDF (October 18, 2026) | [POST /music/score](https://useapi.net/docs/api-mureka-v1/post-mureka-music-score?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) · [tutorial](https://useapi.net/docs/articles/mureka-sheet-music?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) |
| [`own-voice/`](./own-voice) | Sing **your own lyrics in your own voice**: upload a voice clip, use it once or make a reusable **character** (free), then list, publish and delete characters (October 18, 2026) | [POST /music/characters](https://useapi.net/docs/api-mureka-v1/post-mureka-music-characters?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) · [example post](https://useapi.net/blog/261016?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) |

Walkthrough of the three song examples with `curl`: [How to Generate AI Music with the Mureka API (Suno / Udio Alternative)](https://useapi.net/docs/articles/mureka-bash?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api).

Articles:

- [Suno API Alternative: Mureka, Lyria 3.5, TemPolor and MiniMax](https://useapi.net/docs/articles/suno-api-alternative?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api)
- [How to Turn a Song or YouTube Link into Sheet Music with the Mureka API](https://useapi.net/docs/articles/mureka-sheet-music?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api)
- [Mureka API Music Samples](https://useapi.net/docs/articles/mureka-music-samples?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api)
- [How to Generate AI Music with the Mureka API (Suno / Udio Alternative)](https://useapi.net/docs/articles/mureka-bash?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api)
- [AI Music APIs Compared: Mureka vs MiniMax vs ElevenLabs vs Lyria 3 Pro](https://useapi.net/docs/articles/ai-music-api-comparison?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api)
- [Four AI Music APIs on the Same Six Briefs: TemPolor v4.8, MiniMax Music-3.0, Lyria 3.5 and Mureka V9.5](https://useapi.net/docs/articles/ai-music-flagships-compared?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api)

## Quick start

You need [Node.js](https://nodejs.org) v21 or newer **or** [Python](https://www.python.org) 3.x (neither has any dependencies to install), a useapi.net [API token](https://useapi.net/docs/start-here/setup-useapi?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api), and a connected [Mureka account](https://useapi.net/docs/start-here/setup-mureka?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) (one [$15/month subscription](https://useapi.net/docs/subscription?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) covers every useapi.net API):

```bash
git clone https://github.com/useapi/mureka-api.git
cd mureka-api/music
node ./mureka.mjs <API_TOKEN>
# or, equivalently, with Python:
python3 ./mureka.py <API_TOKEN>
```

`API_TOKEN` is your useapi.net token. The optional second argument is your Mureka account id (or its email) — only needed when you have more than one account configured; with a single account it is auto-selected. Edit `prompts.json` in each folder to queue your own prompts. Every supported parameter is documented on the [POST /music/create](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) endpoint page.

## MCP server

useapi.net also runs a hosted [Model Context Protocol](https://modelcontextprotocol.io) server for Mureka, so an AI assistant such as Claude Code, Cursor or VS Code Copilot can use it with your Mureka subscription. It has 40 tools: songs from a prompt or your lyrics (style, voice, character, reference track or melody), instrumentals and lyrics, extend, section edits and remix, stems with MIDI and DAW sessions, sheet music (MusicXML and PDF), characters that make your own voice a reusable singer, uploads, YouTube import, and speech with voice cloning. Nothing to install or run locally.

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

<!-- Figures from useapi.net/docs/api-mureka-v1 (October 2026): Pro $10/month, Premier $30/month, a V9.5, V9 or V8 song is 12 Gold = 2.4 cents on Pro and 1.8 on Premier, O2 20 Gold = 4 and 3 cents, 10 generations (20 songs) at once per account, own voice as the singer Premier only. Official, per that page (verified live 2026-10-18/20): https://platform.mureka.ai/pricing (lyrics-to-song V9.5 $0.15, prompt-to-song V9.5 $0.50, V9 / V8 / O2 $0.045, prepaid top-up from $1,000 with 5 requests at once, $5 per voice). -->

- **Is there a Mureka API?** Yes, through useapi.net: it runs on your Mureka website subscription, the free plan included, where Mureka's [official API](https://platform.mureka.ai/pricing) starts with a prepaid top-up of $1,000 (as of October 2026). The useapi.net Mureka API covers songs on V9.5, V9, V8, O2, V7.6 and V7.5-all, your own voice as the singer on Mureka Premier, remixes, stems, sheet music and speech, and this repo's examples call it.
- **Is there a Mureka API key?** Through useapi.net you need no Mureka platform key and no $1,000 top-up: you call the API with a useapi.net [API token](https://useapi.net/docs/start-here/setup-useapi?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) and connect your Mureka subscription once through the [Mureka setup](https://useapi.net/docs/start-here/setup-mureka?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api), with a dedicated account's email and password (the API logs in again by itself when Mureka ends the session) or session tokens copied from your browser.
- **How much does the Mureka API cost?** Through useapi.net, a V9.5 song costs 1.8 cents on a Mureka Premier subscription ($30/month) or 2.4 cents on Pro ($10/month), against 15 cents from your lyrics or 50 cents from a prompt on the official Mureka API. A V9 or V8 song costs the same and an O2 song 3 cents on Premier or 4 on Pro, against 4.5 cents (as of October 2026). Lyrics generation is free. See the [pricing table](https://useapi.net/docs/api-mureka-v1?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api).
- **Is Mureka a Suno API alternative?** Yes, and through useapi.net you can call it today: like Suno and Udio, Mureka writes and sings a full song with vocals from one text prompt, and the useapi.net Mureka API also takes your own lyrics, sings in your own voice on Mureka Premier, makes instrumentals, extends songs, splits stems and turns songs into sheet music. See the [Suno API alternative](https://useapi.net/docs/articles/suno-api-alternative?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) comparison.
- **How many songs at once, and how many accounts?** Through useapi.net each Mureka account runs up to 10 generations (20 songs) at once, against 5 requests at once on the official API's $1,000 top-up (as of October 2026). Each useapi.net subscription covers 3 Mureka accounts, and each extra $10/month subscription adds 3 more.
- More answers: [Mureka API questions](https://useapi.net/docs/articles/mureka-bash?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api#frequently-asked-questions).

## About useapi.net

[useapi.net](https://useapi.net/?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) is a third-party REST API for AI websites. The Mureka API runs on your [Mureka subscription](https://www.mureka.ai/subscribe), so you spend its Gold at website-plan rates instead of prepaid developer-API pricing. See the [model matrix](https://useapi.net/model-matrix?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) and pricing on the [API overview](https://useapi.net/docs/api-mureka-v1?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api).

Visit our [Discord Server](https://discord.gg/w28uK3cnmF) or [Telegram Channel](https://t.me/use_api) for any support questions and concerns.

We regularly post guides and tutorials on the [YouTube Channel](https://www.youtube.com/@useapi-net).

## License

The example code in this repository is released under the [MIT License](./LICENSE). It covers the example scripts only, not the useapi.net service or API.
