/*

Script version 1.0, October 18, 2026

Script to sing your own lyrics in your own voice with the Mureka API v1 by useapi.net.
Uploads a voice clip privately with POST /files/vocal, then either:
  - sings one song in that voice with POST /music/create-advanced (vocal_id + desc + lyrics), or
  - turns the voice into a reusable character with POST /music/characters (free)
    and sings with POST /music/create-advanced (character_id + desc + lyrics).
It also lists, publishes or hides, and deletes your characters.
For more details visit https://useapi.net/docs/api-mureka-v1/post-mureka-music-characters
Example with real outputs: https://useapi.net/blog/261016

Uploading a voice and creating a character are free. Each song call returns two songs
(occasionally three) at the normal song price of the model.
Singing in your own voice needs a Mureka Premier subscription.

Installation Instructions:
==========================

You need Node.js v21 or newer installed to run this script. Download and install Node.js from:

- Windows, macOS, Linux: https://nodejs.org/

After installation, verify by running the following command in a terminal:

   node -v

Running the Script:
===================

Usage: node own-voice.mjs <API_TOKEN> <COMMAND> [ARGS] [--account ACCOUNT] [--song SONG_FILE]

Replace API_TOKEN with your actual useapi.net API token, see https://useapi.net/docs/start-here/setup-useapi
COMMAND is one of:
  voice <VOICE.mp3 | VOCAL_ID>       Option A: one song in your voice (vocal_id + desc + lyrics)
  character <VOICE.mp3 | VOCAL_ID>   Option B: create a character from your voice, then one song with it
  sing <CHARACTER_ID>                one more song with a character you already have
  list                               list your characters
  publish <CHARACTER_ID> <private|public>
                                     hide a character or publish it on mureka.ai
  delete <CHARACTER_ID>              delete a character (its songs and the uploaded voice are kept)
--account is optional — your Mureka account id or its email, see https://useapi.net/docs/start-here/setup-mureka
  It is only required when more than one Mureka account is configured.
--song is optional — the song and character settings, song.json by default.

Songs are saved as output/<title>_v<version>.mp3 in the current folder.

Example:
--------

node own-voice.mjs user:1234-abcdefhijklmnopqrstuv character ./my-voice.mp3

Changelog:
==========

- October 18, 2026: Initial release.

*/

import fs from 'fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

// Constants
const OUTPUT_DIR = 'output';
const DEFAULT_SONG_FILE = 'song.json';
const SLEEP_POLL = 15 * 1000;        // in milliseconds — a song takes about 45 to 90 seconds
const MAX_POLL = 15 * 60 * 1000;     // in milliseconds — stop polling after 15 minutes
const SUPPORTED_MODELS = ['V9.5', 'V9', 'V8', 'O2', 'V7.6', 'V7.5'];

const urlAccounts = 'https://api.useapi.net/v1/mureka/accounts';
const urlFilesVocal = 'https://api.useapi.net/v1/mureka/files/vocal/';
const urlCharacters = 'https://api.useapi.net/v1/mureka/music/characters';
const urlCharactersPublish = 'https://api.useapi.net/v1/mureka/music/characters-publish';
const urlCreateAdvanced = 'https://api.useapi.net/v1/mureka/music/create-advanced';
const urlJobs = 'https://api.useapi.net/v1/mureka/jobs/';

const USAGE = `Usage: node own-voice.mjs <API_TOKEN> <COMMAND> [ARGS] [--account ACCOUNT] [--song SONG_FILE]
Commands:
  voice <VOICE.mp3 | VOCAL_ID>        one song in your voice
  character <VOICE.mp3 | VOCAL_ID>    create a character, then one song with it
  sing <CHARACTER_ID>                 one song with an existing character
  list                                list your characters
  publish <CHARACTER_ID> <private|public>
  delete <CHARACTER_ID>`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Print the failed call's HTTP status and body, then stop.
function fail(what, status, body) {
    console.error(`ERROR: ${what} failed with HTTP ${status}`);
    if (body) console.error(body);
    process.exit(1);
}

function stop(message) {
    console.error(`ERROR: ${message}`);
    process.exit(1);
}

// Call the API and return the parsed JSON body. Any non-2xx answer stops the script.
async function api(what, url, apiToken, { method = 'GET', json, body, contentType } = {}) {
    const headers = { 'Accept': 'application/json', 'Authorization': `Bearer ${apiToken}` };
    if (json !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(json);
    } else if (contentType) {
        headers['Content-Type'] = contentType;
    }

    const response = await fetch(url, { method, headers, body });
    const text = await response.text();
    if (!response.ok) fail(what, response.status, text);
    try {
        return text ? JSON.parse(text) : {};
    } catch {
        fail(what, response.status, `Response is not JSON: ${text}`);
    }
}

// Resolve the Mureka account to use: by id or email when provided, otherwise the
// single configured account. Returns the numeric account id string sent to the API.
async function resolveAccount(apiToken, accountArg) {
    const accounts = await api('GET /accounts', urlAccounts, apiToken);
    const accountList = Object.values(accounts);

    console.info(`Configured Mureka API accounts (${accountList.length}):`, accountList.map(a => a.account).join(', '));

    if (accountList.length <= 0)
        stop('No configured Mureka accounts found. Please refer to https://useapi.net/docs/start-here/setup-mureka');

    let matched;

    if (accountArg) {
        // Match by Mureka account id or by the account's email.
        matched = accountList.find(a => a.account === accountArg || a.email === accountArg);
        if (!matched)
            stop(`Account "${accountArg}" not found. Please refer to https://useapi.net/docs/start-here/setup-mureka`);
    } else if (accountList.length === 1) {
        matched = accountList[0];
    } else {
        stop(`${accountList.length} accounts configured — pass the account id or email with --account.`);
    }

    if (matched.error)
        stop(`Account ${matched.account} has a pending error: ${matched.error}. Re-add it at https://useapi.net/docs/api-mureka-v1/post-mureka-accounts`);

    console.info(`Using Mureka account ${matched.account}`);
    return matched.account;
}

// Read and check song.json: the song settings plus the character settings for option B.
async function readSong(songFile, needCharacter) {
    let song;
    try {
        song = JSON.parse(await fs.readFile(songFile, 'utf8'));
    } catch (error) {
        stop(`Cannot read ${songFile}: ${error.message}`);
    }

    const { lyrics, title, desc, model, vocal_gender, character } = song;
    const problems = [];

    if (!lyrics) problems.push('lyrics is required');
    if (lyrics && lyrics.length > 5000) problems.push('lyrics exceeds 5000 characters');
    if (title && title.length > 50) problems.push('title exceeds 50 characters');
    if (desc && desc.length > 1000) problems.push('desc exceeds 1000 characters');
    if (model && !SUPPORTED_MODELS.includes(model)) problems.push(`unknown model "${model}", supported: ${SUPPORTED_MODELS.join(', ')}`);
    if (vocal_gender && !['female', 'male'].includes(vocal_gender)) problems.push('vocal_gender must be female or male');

    if (needCharacter) {
        if (!character?.name) problems.push('character.name is required');
        if (character?.name && character.name.length > 50) problems.push('character.name exceeds 50 characters');
        if (character?.bio && character.bio.length > 1000) problems.push('character.bio exceeds 1000 characters');
        if (character?.desc && character.desc.length > 1000) problems.push('character.desc exceeds 1000 characters');
        if (Array.isArray(character?.tags) && character.tags.length > 10) problems.push('character.tags has more than 10 tags');
    }

    if (problems.length) stop(`${songFile}: ${problems.join('; ')}`);
    return song;
}

// POST /files/vocal: upload an MP3 voice clip, private to your account. Returns its id (vocal_id).
// A number instead of a file path is taken as a vocal_id you already uploaded.
async function uploadVoice(apiToken, account, voice, title) {
    if (/^\d+$/.test(voice)) {
        console.info(`Using vocal_id ${voice} (already uploaded)`);
        return voice;
    }

    if (path.extname(voice).toLowerCase() !== '.mp3')
        stop('Only .mp3 files can be uploaded (POST /files/vocal takes audio/mpeg).');

    let data;
    try {
        data = await fs.readFile(voice);
    } catch (error) {
        stop(`Cannot read ${voice}: ${error.message}`);
    }

    const vocalTitle = title || path.basename(voice, path.extname(voice));
    const query = new URLSearchParams({ account, title: vocalTitle });

    console.info(`Uploading ${voice} with POST /files/vocal (private to your account, free) …`);
    const result = await api('POST /files/vocal', `${urlFilesVocal}?${query}`, apiToken, {
        method: 'POST', body: data, contentType: 'audio/mpeg'
    });

    if (!result.id) stop(`POST /files/vocal returned no id: ${JSON.stringify(result)}`);
    console.info(`Uploaded "${result.title ?? vocalTitle}", ${formatDuration(result.duration_milliseconds)}, vocal_id ${result.id}`);
    return String(result.id);
}

// POST /music/characters: turn an uploaded voice into a reusable singer (free, ready at once).
async function createCharacter(apiToken, account, vocal_id, character) {
    const { name, bio, tags, desc } = character;
    const isPrivate = character.private !== false; // this script keeps characters private unless song.json says false

    console.info(`Creating character "${name}" with POST /music/characters (free, ${isPrivate ? 'private' : 'public on mureka.ai'}) …`);
    const result = await api('POST /music/characters', urlCharacters, apiToken, {
        method: 'POST',
        json: { account, vocal_id: Number(vocal_id), name, bio, tags, desc, private: isPrivate }
    });

    if (!result.id) stop(`POST /music/characters returned no id: ${JSON.stringify(result)}`);
    console.info(`Character "${result.name}" created, character_id ${result.id}`);
    return result.id;
}

// POST /music/create-advanced in async mode, then poll GET /jobs/<jobid> and download the songs.
// A song is a paid action, so the call is sent once and never retried.
async function createSong(apiToken, account, song, voice) {
    const { lyrics, title, desc, model, vocal_gender } = song;
    const body = { account, lyrics, title, desc, model, vocal_gender, ...voice, async: true };
    const using = voice.character_id ? `character_id ${voice.character_id}` : `vocal_id ${voice.vocal_id}`;

    console.info(`Calling POST /music/create-advanced (${model ?? 'V9.5'}, ${using}) …`);
    const created = await api('POST /music/create-advanced', urlCreateAdvanced, apiToken, { method: 'POST', json: body });

    const { jobid } = created;
    if (!jobid) stop(`POST /music/create-advanced returned no jobid: ${JSON.stringify(created)}`);
    console.info(`jobid ${jobid}`);

    // A 200 answer already carries the songs; a 201 answer is polled until the job is final.
    let songs = created.songs;
    const started = Date.now();

    while (!songs) {
        if (Date.now() - started > MAX_POLL) stop(`Job ${jobid} is still running after 15 minutes. Check it later with GET /jobs/${jobid}`);
        await sleep(SLEEP_POLL);

        const job = await api(`GET /jobs/${jobid}`, `${urlJobs}${encodeURIComponent(jobid)}`, apiToken);
        if (job.status === 'failed')
            stop(`Job ${jobid} failed: ${job.error ?? 'unknown error'}${job.errorDetails ? ` (${job.errorDetails})` : ''}`);
        if (job.status === 'completed') {
            songs = job.response?.songs ?? [];
            break;
        }
        console.info(`Job status ${job.status ?? 'created'}, waiting …`);
    }

    if (!songs.length) stop(`Job ${jobid} completed but returned no songs.`);
    console.info(`Done in ${Math.round((Date.now() - started) / 1000)} seconds, ${songs.length} songs:`);

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    for (let i = 0; i < songs.length; i++) {
        const s = songs[i];
        const safeTitle = (s.title || title || 'song').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || 'song';
        const file = path.join(OUTPUT_DIR, `${safeTitle}_v${s.version ?? i + 1}.mp3`);
        console.info(`  ${s.song_id}  ${formatDuration(s.duration_milliseconds)}  ${file}`);
        if (s.mp3_url) await download(s.mp3_url, file);
        else console.warn(`  WARNING: no mp3_url for ${s.song_id}`);
    }
}

async function download(url, file) {
    const response = await fetch(url);
    if (!response.ok) fail(`Download of ${url}`, response.status, await response.text());
    await fs.writeFile(file, Readable.fromWeb(response.body));
}

// GET /music/characters, 20 per page, newest first. Follows last_id to the end.
async function listCharacters(apiToken, account) {
    let last_id;
    let count = 0;

    for (let page = 0; page < 50; page++) {
        const query = new URLSearchParams({ account });
        if (last_id) query.set('last_id', String(last_id));

        const result = await api('GET /music/characters', `${urlCharacters}/?${query}`, apiToken);
        const list = result.list ?? [];

        for (const c of list) {
            count++;
            const visibility = c.is_published ? 'public' : 'private';
            const tags = Array.isArray(c.tags) && c.tags.length ? `  [${c.tags.join(', ')}]` : '';
            console.info(`${String(c.id).padEnd(18)} ${visibility.padEnd(8)} ${c.name}${tags}`);
        }

        if (list.length < 20 || !result.last_id || result.last_id === last_id) break;
        last_id = result.last_id;
    }

    console.info(count ? `${count} characters` : 'No characters on this account.');
}

// POST /music/characters-publish: private hides the character, public publishes it on mureka.ai.
async function publishCharacter(apiToken, account, character_id, visibility) {
    if (!['private', 'public'].includes(visibility)) stop('The last argument of publish must be private or public.');
    const result = await api('POST /music/characters-publish', urlCharactersPublish, apiToken, {
        method: 'POST',
        json: { account, character_id: Number(character_id), private: visibility === 'private' }
    });
    console.info(`Character ${result.character_id ?? character_id} is now ${result.private ? 'private' : 'public on mureka.ai'}`);
}

// DELETE /music/characters: songs made with it and the uploaded voice are kept.
async function deleteCharacter(apiToken, account, character_id) {
    const query = new URLSearchParams({ account, character_id: String(character_id) });
    await api('DELETE /music/characters', `${urlCharacters}/?${query}`, apiToken, { method: 'DELETE' });
    console.info(`Character ${character_id} deleted.`);
}

function formatDuration(ms) {
    if (typeof ms !== 'number') return 'unknown length';
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Split the arguments into positionals and the --account / --song options.
function parseArgs(argv) {
    const positional = [];
    const options = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--account' || argv[i] === '--song') {
            if (argv[i + 1] === undefined) stop(`${argv[i]} needs a value.`);
            options[argv[i].slice(2)] = argv[++i];
        } else {
            positional.push(argv[i]);
        }
    }
    return { positional, options };
}

function requireId(value, what) {
    if (!value || !/^\d+$/.test(value)) stop(`${what} must be a number.\n${USAGE}`);
    return value;
}

// Main function
async function main() {
    const { positional, options } = parseArgs(process.argv.slice(2));
    const [apiToken, command, arg1, arg2] = positional;
    const songFile = options.song || DEFAULT_SONG_FILE;

    if (!apiToken || !command) {
        console.error(USAGE);
        process.exit(1);
    }

    console.info('Script v1.0');
    console.info('Node version is: ' + process.version);

    try {
        switch (command) {
            case 'voice': {
                if (!arg1) stop(`voice needs an MP3 file or a vocal_id.\n${USAGE}`);
                const song = await readSong(songFile, false);
                const account = await resolveAccount(apiToken, options.account);
                const vocal_id = await uploadVoice(apiToken, account, arg1, song.character?.name);
                await createSong(apiToken, account, song, { vocal_id });
                break;
            }
            case 'character': {
                if (!arg1) stop(`character needs an MP3 file or a vocal_id.\n${USAGE}`);
                const song = await readSong(songFile, true);
                const account = await resolveAccount(apiToken, options.account);
                const vocal_id = await uploadVoice(apiToken, account, arg1, song.character.name);
                const character_id = await createCharacter(apiToken, account, vocal_id, song.character);
                await createSong(apiToken, account, song, { character_id: Number(character_id) });
                console.info(`Sing again with: node own-voice.mjs <API_TOKEN> sing ${character_id}`);
                break;
            }
            case 'sing': {
                const character_id = requireId(arg1, 'CHARACTER_ID');
                const song = await readSong(songFile, false);
                const account = await resolveAccount(apiToken, options.account);
                await createSong(apiToken, account, song, { character_id: Number(character_id) });
                break;
            }
            case 'list': {
                const account = await resolveAccount(apiToken, options.account);
                await listCharacters(apiToken, account);
                break;
            }
            case 'publish': {
                const character_id = requireId(arg1, 'CHARACTER_ID');
                const account = await resolveAccount(apiToken, options.account);
                await publishCharacter(apiToken, account, character_id, arg2);
                break;
            }
            case 'delete': {
                const character_id = requireId(arg1, 'CHARACTER_ID');
                const account = await resolveAccount(apiToken, options.account);
                await deleteCharacter(apiToken, account, character_id);
                break;
            }
            default:
                stop(`Unknown command "${command}".\n${USAGE}`);
        }
    } catch (error) {
        console.error('ERROR:', error.stack || error);
        process.exit(1);
    }
}

main();
