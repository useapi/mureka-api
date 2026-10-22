# Sing in your own voice with characters — Mureka API (Node.js and Python)

Upload a clip of your own voice and have [Mureka](https://www.mureka.ai) sing your lyrics with it, in any style you describe, through the [Mureka API](https://useapi.net/docs/api-mureka-v1?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) by [useapi.net](https://useapi.net/?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api). Use the voice once, or turn it into a **character**: a reusable singer you can call by id in every later song. useapi.net is a third-party API, not affiliated with Mureka or Kunlun Tech, and it runs on your Mureka website subscription.

Real requests and real outputs: **[Mureka: Scarlett Sings "This Is It" — Characters, Remix and Sheet Music](https://useapi.net/blog/261016?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api)**

`own-voice.mjs` (and its Python twin `own-voice.py`) follows the steps below: it uploads your voice with [`POST /files/vocal`](https://useapi.net/docs/api-mureka-v1/post-mureka-files-vocal?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api), then either sings with it straight away (option A) or makes a character first (option B), submits [`POST /music/create-advanced`](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-advanced?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) in async mode, polls [`GET /jobs/{jobid}`](https://useapi.net/docs/api-mureka-v1/get-mureka-jobs-jobid?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) and downloads every song. It also lists, hides, publishes and deletes your characters. Any failed call stops the script with its HTTP status and response body. A song is a paid action, so the script sends it once and never retries it.

## Hear it first

These are from the blog post above. A 55-second clip of one female voice became the character "Scarlett", which then sang new lyrics in a dark funk-pop style:

- [The source voice](https://demo.useapi.net/discord-cdn-proxy/?https://cdn.discordapp.com/attachments/1239264794394234985/1560853908170088530/scarlett-voice.mp3) (MP3, 0:55)
- ["This Is It", V9.5](https://demo.useapi.net/discord-cdn-proxy/?https://cdn.discordapp.com/attachments/1239264794394234985/1560853985685016586/this-is-it-v9-5.mp3) (MP3, 3:23)
- ["This Is It", O2](https://demo.useapi.net/discord-cdn-proxy/?https://cdn.discordapp.com/attachments/1239264794394234985/1560853932685660282/this-is-it-o2.mp3) (MP3, 3:21), the same call with `model: O2`
- [The remix, a slow torch ballad](https://demo.useapi.net/discord-cdn-proxy/?https://cdn.discordapp.com/attachments/1239264794394234985/1560853957423796244/this-is-it-remix-v9-5.mp3) (MP3, 3:29), made from the V9.5 take with [POST /music/remix](https://useapi.net/docs/api-mureka-v1/post-mureka-music-remix?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api)

The blog's cover also passed a 30-second reference track as `ref_id`, which this example leaves out (add it to the curl in step 3 if you want one). The same songs came back as sheet music too; the [`sheet-music/`](../sheet-music) example does that part.

<a href="https://demo.useapi.net/discord-cdn-proxy/?https://cdn.discordapp.com/attachments/1239264794394234985/1560853977640476712/this-is-it-v9-5-staff.pdf"><img src="https://demo.useapi.net/discord-cdn-proxy/?https://cdn.discordapp.com/attachments/1239264794394234985/1560853965330063512/this-is-it-v9-5-staff-page1.png" alt="This Is It, V9.5 take, sheet music page 1 of 4" width="340"></a>

## Prerequisites

- [Node.js](https://nodejs.org) v21 or newer **or** [Python](https://www.python.org) 3.x (neither has any dependencies to install)
- A useapi.net [API token](https://useapi.net/docs/start-here/setup-useapi?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api)
- A connected [Mureka account](https://useapi.net/docs/start-here/setup-mureka?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) on a Mureka Premier subscription ($30 a month, as of October 2026): singing in your own voice is a Premier feature. A plan without characters answers [POST /music/characters](https://useapi.net/docs/api-mureka-v1/post-mureka-music-characters?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) with `403` `low vip level (6335)`. The docs name no plan requirement for uploading a voice.
- An MP3 of your voice. About 30 seconds of clear singing works best for a character.

## Step by step with curl

The examples use `user:1234-…` for your API token. Add `account=<account>` (query) or an `account` field (body) when more than one Mureka account is configured.

### 1. Upload your voice

[POST /files/vocal](https://useapi.net/docs/api-mureka-v1/post-mureka-files-vocal?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) takes the raw MP3 (`Content-Type: audio/mpeg`) and a required `title`. The file stays private to your account: other Mureka users cannot see it.

```bash
curl --location 'https://api.useapi.net/v1/mureka/files/vocal/?title=scarlett' \
--header 'Authorization: Bearer user:1234-…' \
--header 'Content-Type: audio/mpeg' \
--data-binary '@scarlett-voice.mp3'
```

```json
{
    "id": 11223344,
    "title": "scarlett",
    "url": "https://<vocal download url>.mp3",
    "duration_milliseconds": 54308
}
```

The `id` is your `vocal_id`. Now pick option A or option B.

### 2A. Option A: one song in that voice

Pass `vocal_id` to [POST /music/create-advanced](https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-advanced?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) together with `desc` (the style) and your `lyrics`:

```bash
curl --location 'https://api.useapi.net/v1/mureka/music/create-advanced' \
--header 'Authorization: Bearer user:1234-…' \
--form 'model="V9.5"' \
--form 'title="This Is It"' \
--form 'vocal_id="11223344"' \
--form 'vocal_gender="female"' \
--form 'desc="dark minor-key funk pop, tight drums, slap bass, synth stabs, tense female vocal"' \
--form 'lyrics="[Verse]
Static on the line at the edge of the night
Every window'\''s dark but one burning light

[Chorus]
This is it, this is it
Every secret'\''s coming out"'
```

That is all option A needs. Skip to [Get the songs](#3-get-the-songs).

### 2B. Option B: a reusable character

[POST /music/characters](https://useapi.net/docs/api-mureka-v1/post-mureka-music-characters?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) turns the uploaded voice into a singer. It is free, takes under a second, and the character is ready right away. Characters are **public on mureka.ai** unless you send `private: true`.

```bash
curl --location 'https://api.useapi.net/v1/mureka/music/characters' \
--header 'Authorization: Bearer user:1234-…' \
--form 'vocal_id="11223344"' \
--form 'name="Scarlett"' \
--form 'bio="A smoky, intimate female voice."' \
--form 'tags="Female, Smoky"' \
--form 'private="true"'
```

```json
{
    "id": 55667788,
    "name": "Scarlett",
    "bio": "A smoky, intimate female voice.",
    "tags": ["Female", "Smoky"],
    "avatar": "https://static-cos.mureka.ai/cos-prod/mureka/static/img/<id>.jpg"
}
```

- `name` is required (up to 50 characters). `bio` (up to 1,000 characters), `tags` (up to 10; mureka.ai offers `Female`, `Male`, `Warm`, `Airy`, `Bright`, `Smoky`, `Soft`, `Powerful`, `Smooth`, `Whispery`) and `desc` (the character's default song description) are optional.
- Instead of `vocal_id` you can pass the `song_id` of a song you generated, to make a character from that song's singer. Send one or the other, not both.

Then sing with it: pass the `id` as `character_id`, with `desc` and your `lyrics`. Do not send `vocal_id` as well, because the character already has its voice.

```bash
curl --location 'https://api.useapi.net/v1/mureka/music/create-advanced' \
--header 'Authorization: Bearer user:1234-…' \
--form 'model="V9.5"' \
--form 'title="This Is It"' \
--form 'character_id="55667788"' \
--form 'vocal_gender="female"' \
--form 'desc="dark minor-key funk pop, tight drums, slap bass, synth stabs, tense female vocal"' \
--form 'lyrics="[Verse]
Static on the line at the edge of the night
Every window'\''s dark but one burning light

[Chorus]
This is it, this is it
Every secret'\''s coming out"'
```

Use the same `character_id` for every later song. That is the point of a character: one upload, then any lyrics in any style.

### 3. Get the songs

Without `async`, create-advanced waits and answers with the songs (each call returns two, occasionally three, and took about 90 seconds in the blog's run). Each song has a `song_id`, `title`, `duration_milliseconds` and an `mp3_url` to download. For long calls, add `async: true`: the answer is `201` with a `jobid`, and you poll it:

```bash
curl 'https://api.useapi.net/v1/mureka/jobs/<jobid>' \
--header 'Authorization: Bearer user:1234-…'
```

The job is final when `status` is `completed` (the songs are in `response.songs`) or `failed` (see `error`). Or send a `replyUrl` and get the result by webhook.

### 4. Manage your characters

List them, newest first, 20 per page, with [GET /music/characters](https://useapi.net/docs/api-mureka-v1/get-mureka-music-characters?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api). Pass the answer's `last_id` back as `last_id` for the next page. Characters you made on mureka.ai are listed too, and a private character has no `is_published` field.

```bash
curl 'https://api.useapi.net/v1/mureka/music/characters/' \
--header 'Authorization: Bearer user:1234-…'
```

Hide a character, or publish it on mureka.ai, with [POST /music/characters-publish](https://useapi.net/docs/api-mureka-v1/post-mureka-music-characters-publish?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) (`private: true` hides it, `false` publishes it). A private character sings the same as a public one.

```bash
curl --location 'https://api.useapi.net/v1/mureka/music/characters-publish' \
--header 'Authorization: Bearer user:1234-…' \
--header 'Content-Type: application/json' \
--data '{"character_id": 55667788, "private": true}'
```

```json
{
    "character_id": 55667788,
    "private": true
}
```

Delete one with [DELETE /music/characters](https://useapi.net/docs/api-mureka-v1/del-mureka-music-characters?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api). Songs you already made with it are kept, and so is the voice you uploaded.

```bash
curl --request DELETE 'https://api.useapi.net/v1/mureka/music/characters/?character_id=55667788' \
--header 'Authorization: Bearer user:1234-…'
```

## The script

```bash
node ./own-voice.mjs <API_TOKEN> <COMMAND> [ARGS] [--account ACCOUNT] [--song SONG_FILE]
# or, equivalently, with Python:
python3 ./own-voice.py <API_TOKEN> <COMMAND> [ARGS] [--account ACCOUNT] [--song SONG_FILE]
```

| Command | What it does |
|---|---|
| `voice <VOICE.mp3>` | Option A: upload the voice, then one song with `vocal_id` + `desc` + `lyrics` |
| `character <VOICE.mp3>` | Option B: upload the voice, create a character from it, then one song with `character_id` + `desc` + `lyrics` |
| `sing <CHARACTER_ID>` | One more song with a character you already have |
| `list` | List your characters (id, private or public, name, tags) |
| `publish <CHARACTER_ID> private` or `public` | Hide a character, or publish it on mureka.ai |
| `delete <CHARACTER_ID>` | Delete a character |

`voice` and `character` also take a `vocal_id` you already uploaded instead of a file, so the same clip is not uploaded twice. `--account` is your Mureka account id (or its email), only needed when more than one account is configured. Songs are saved as `output/<title>_v<version>.mp3`.

```bash
node ./own-voice.mjs <API_TOKEN> character ./my-voice.mp3
node ./own-voice.mjs <API_TOKEN> sing 55667788 --song another-song.json
node ./own-voice.mjs <API_TOKEN> list
```

### song.json

The song, and for `character` the character too. The one in this folder is the blog's "This Is It", with its full lyrics:

- `lyrics`, **required**, the words to sing (up to 5,000 characters). Tag sections with `[Verse]`, `[Chorus]`, `[Bridge]`.
- `desc`, the style: genres, moods and vocals, comma-separated (up to 1,000 characters). Valid values: [GET /music/moods-and-genres](https://useapi.net/docs/api-mureka-v1/get-mureka-music-moods-and-genres?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api).
- `title` (up to 50 characters), `model` (`V9.5` default, `V9`, `V8`, `O2`, `V7.6`, `V7.5`) and `vocal_gender` (`female` or `male`) are optional.
- `character` is used by the `character` command: `name` (required), `bio`, `tags`, `desc`, and `private`. This script makes characters private unless `private` is `false`, while the API itself defaults to public.

## Cost

- Uploading a voice and creating a character are free.
- A song costs the normal song price of the model, from your Mureka Premier Gold: 12 Mureka Gold per song on V9.5 (1.8 cents on Premier, as of October 2026) and 20 on O2, and each call returns two songs.
- Listing, publishing and deleting characters cost nothing.
- API access is a flat [useapi.net subscription](https://useapi.net/docs/subscription?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api), with no per-call charge from us.

## The same from an AI assistant

The hosted [Mureka MCP server](https://useapi.net/docs/api-mureka-v1/mcp?utm_source=github.com&utm_medium=referral&utm_campaign=mureka-api) gives Claude Code, Cursor, VS Code and other MCP clients the whole Mureka API, characters included, with nothing to install.

---

Support: [Discord](https://discord.gg/w28uK3cnmF) · [Telegram](https://t.me/use_api) · [YouTube](https://www.youtube.com/@useapi-net)
