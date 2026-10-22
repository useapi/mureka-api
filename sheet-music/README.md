# Sheet music from a song, a YouTube link or an MP3 — Mureka API (Node.js and Python)

Turn a song into sheet music with one call to the [Mureka API](https://useapi.net/docs/api-mureka-v1?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) by [useapi.net](https://useapi.net/?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api): send one of your [Mureka](https://www.mureka.ai) songs, a YouTube link or a local MP3, and get back a zip with a MusicXML file, a staff-notation PDF and a numbered-notation PDF of the melody, chords and lyrics. useapi.net is a third-party API, not affiliated with Mureka or Kunlun Tech, and it runs on your Mureka website subscription.

Full walkthrough: **[How to Turn a Song or YouTube Link into Sheet Music with the Mureka API](https://useapi.net/docs/articles/mureka-sheet-music?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api)**

`sheet-music.mjs` (and its Python twin `sheet-music.py`) calls [`POST /music/score`](https://useapi.net/docs/api-mureka-v1/post-mureka-music-score?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api), which waits for the result (about 5 to 15 seconds, no job to poll), then downloads the zip, unzips it into `output/<title>/` and prints the file list. Before that:

- a **local MP3** is uploaded with [`POST /files/vocal`](https://useapi.net/docs/api-mureka-v1/post-mureka-files-vocal?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api), which keeps it private to your account;
- a **YouTube link** is checked with the free [`GET /files/youtube`](https://useapi.net/docs/api-mureka-v1/get-mureka-files-youtube?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api), so a video outside the 10 seconds to 10 minutes range stops before any Gold is spent.

Any failed call stops the script with its HTTP status and response body. The score call is a paid action, so the script sends it once and never retries it.

## Prerequisites

- [Node.js](https://nodejs.org) v21 or newer **or** [Python](https://www.python.org) 3.x (neither has any dependencies to install)
- A useapi.net [API token](https://useapi.net/docs/start-here/setup-useapi?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api)
- A connected [Mureka account](https://useapi.net/docs/start-here/setup-mureka?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) with at least 10 Gold left

## Usage

```bash
node ./sheet-music.mjs <API_TOKEN> <SOURCE> [ACCOUNT] [TITLE]
# or, equivalently, with Python:
python3 ./sheet-music.py <API_TOKEN> <SOURCE> [ACCOUNT] [TITLE]
```

`SOURCE` is one of the three inputs below. `ACCOUNT` is optional: pass your Mureka **account id** (or its email) only when more than one account is configured, or `-` to skip it. A `song_id` already names its account. `TITLE` is optional, the name used for the files in the zip (up to 100 characters). It defaults to the video's title for a YouTube link and to the file name for an MP3, and a `song_id` always keeps the song's own title.

**One of your Mureka songs.** Find its `song_id` with [GET /music](https://useapi.net/docs/api-mureka-v1/get-mureka-music?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api). Each generation makes two songs, so pick the take you want:

```bash
node ./sheet-music.mjs <API_TOKEN> user:1234-mureka:12345678901234-song:33445566
```

**A YouTube link.** The length is checked first, then the API fetches the audio itself:

```bash
node ./sheet-music.mjs <API_TOKEN> "https://www.youtube.com/watch?v=VIDEO_ID" - "My Song"
```

**A local MP3.** It is uploaded privately with POST /files/vocal, then scored:

```bash
node ./sheet-music.mjs <API_TOKEN> ./my-demo.mp3
```

A `https://static-cos.mureka.ai/…` link of a file you already uploaded works as `SOURCE` too. Output from a real run on a 2:11 song:

```
Calling POST /music/score (10 Mureka Gold) …
Score ready in 7.1 seconds: "Favorite Mug"
Downloading https://static-cos.mureka.ai/cos-prod/skm/music-staff/20261018/….zip

Saved output/Favorite Mug.zip and unzipped 3 files into output/Favorite Mug/
  Favorite Mug_staff.musicxml                         138,510 bytes
  Favorite Mug_staff.pdf                               74,647 bytes
  Favorite Mug_numbered_notation.pdf                   61,368 bytes
```

## What's in the zip

- `<title>_staff.musicxml`, a MusicXML 4.0 score with a `Vocal` part (the melody with the lyrics under the notes) and a `Chords` part. It opens in [MuseScore](https://musescore.org), Sibelius, Finale, Dorico and most other notation software.
- `<title>_staff.pdf`, the same score in staff notation, ready to print.
- `<title>_numbered_notation.pdf`, the melody in numbered notation (jianpu), with the chords above and the lyrics below.

The lyrics are transcribed from the recording, so read them against your own. Mureka recommends a solo song with clear vocals, a steady tempo and a consistent rhythm. Songs with tempo changes or frequent rhythm changes are not supported well.

## Cost and limits

- 10 Mureka Gold per score (1.5 cents on Mureka Premier, 2 cents on Pro, as of October 2026), from your Mureka subscription. Not enough Gold answers `412`. Scoring the same YouTube link again returned the earlier zip without a second charge in our tests.
- The audio must be 10 seconds to 10 minutes long.
- API access is a flat [useapi.net subscription](https://useapi.net/docs/subscription?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api), with no per-call charge from us.

## The same from an AI assistant

The hosted [Mureka MCP server](https://useapi.net/docs/api-mureka-v1/mcp?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) gives Claude Code, Cursor, VS Code and other MCP clients the whole Mureka API, sheet music included, with nothing to install. Ask "Turn this YouTube video into sheet music" and the assistant calls `mureka_get_sheet_music` for you.

---

Support: [Discord](https://discord.gg/w28uK3cnmF) · [Telegram](https://t.me/use_api) · [YouTube](https://www.youtube.com/@useapi-net)
