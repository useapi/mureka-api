/*

Script version 1.0, October 18, 2026

Script to turn a song into sheet music with the Mureka API v1 by useapi.net.
The source is one of your Mureka songs (song_id), a YouTube link, or a local MP3 file.
Uses POST /music/score, downloads the returned zip (MusicXML, staff PDF, numbered-notation PDF)
and unzips it into an output folder.
For more details visit https://useapi.net/docs/api-mureka-v1/post-mureka-music-score
Tutorial: https://useapi.net/docs/articles/mureka-sheet-music

Each score costs 10 Mureka Gold from your Mureka account.

Installation Instructions:
==========================

You need Node.js v21 or newer installed to run this script. Download and install Node.js from:

- Windows, macOS, Linux: https://nodejs.org/

After installation, verify by running the following command in a terminal:

   node -v

Running the Script:
===================

Usage: node sheet-music.mjs <API_TOKEN> <SOURCE> [ACCOUNT] [TITLE]

Replace API_TOKEN with your actual useapi.net API token, see https://useapi.net/docs/start-here/setup-useapi
SOURCE is one of:
  - a Mureka song_id, e.g. user:1234-mureka:12345678901234-song:33445566 (from GET /music)
  - a YouTube link, e.g. https://www.youtube.com/watch?v=VIDEO_ID
    (its length is checked first with the free GET /files/youtube)
  - a local .mp3 file, e.g. ./my-demo.mp3
    (uploaded privately with POST /files/vocal, then scored)
  - the url of a file you already uploaded (https://static-cos.mureka.ai/…)
ACCOUNT is optional — your Mureka account id or its email, see https://useapi.net/docs/start-here/setup-mureka
  It is only required when more than one Mureka account is configured and SOURCE is not a song_id.
  Pass - to skip it when you want to set TITLE.
TITLE is optional — the name used for the files in the zip when SOURCE is not a song_id (max 100 characters).

The zip is saved as output/<title>.zip and unzipped into output/<title>/ in the current folder.

Example:
--------

node sheet-music.mjs user:1234-abcdefhijklmnopqrstuv user:1234-mureka:12345678901234-song:33445566

Changelog:
==========

- October 18, 2026: Initial release.

*/

import fs from 'fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

// Constants
const OUTPUT_DIR = 'output';
const MIN_DURATION = 10 * 1000;      // in milliseconds — the score endpoint takes 10 seconds…
const MAX_DURATION = 10 * 60 * 1000; // …to 10 minutes of audio

const urlAccounts = 'https://api.useapi.net/v1/mureka/accounts';
const urlYoutube = 'https://api.useapi.net/v1/mureka/files/youtube/';
const urlFilesVocal = 'https://api.useapi.net/v1/mureka/files/vocal/';
const urlScore = 'https://api.useapi.net/v1/mureka/music/score';

// Print the failed call's HTTP status and body, then stop.
function fail(what, status, body) {
    console.error(`ERROR: ${what} failed with HTTP ${status}`);
    if (body) console.error(body);
    process.exit(1);
}

// Call the API and return the parsed JSON body. Any non-2xx answer stops the script.
async function api(what, url, options = {}) {
    const response = await fetch(url, options);
    const body = await response.text();
    if (!response.ok) fail(what, response.status, body);
    try {
        return JSON.parse(body);
    } catch {
        fail(what, response.status, `Response is not JSON: ${body}`);
    }
}

// Resolve the Mureka account to use: by id or email when provided, otherwise the
// single configured account. Returns the numeric account id string sent to the API.
async function resolveAccount(apiToken, accountArg) {
    const accounts = await api('GET /accounts', urlAccounts, {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${apiToken}` }
    });
    const accountList = Object.values(accounts);

    console.info(`Configured Mureka API accounts (${accountList.length}):`, accountList.map(a => a.account).join(', '));

    if (accountList.length <= 0) {
        console.error(`ERROR: No configured Mureka accounts found. Please refer to https://useapi.net/docs/start-here/setup-mureka`);
        process.exit(1);
    }

    let matched;

    if (accountArg) {
        // Match by Mureka account id or by the account's email.
        matched = accountList.find(a => a.account === accountArg || a.email === accountArg);
        if (!matched) {
            console.error(`ERROR: Account "${accountArg}" not found. Please refer to https://useapi.net/docs/start-here/setup-mureka`);
            process.exit(1);
        }
    } else if (accountList.length === 1) {
        matched = accountList[0];
    } else {
        console.error(`ERROR: ${accountList.length} accounts configured — pass the account id or email as the third argument.`);
        process.exit(1);
    }

    if (matched.error) {
        console.error(`ERROR: Account ${matched.account} has a pending error: ${matched.error}. Re-add it at https://useapi.net/docs/api-mureka-v1/post-mureka-accounts`);
        process.exit(1);
    }

    return matched.account;
}

// Work out which kind of SOURCE was given.
async function sourceKind(source) {
    if (/^user:\d+-mureka:\d+-song:\d+$/.test(source)) return 'song';
    if (/^https?:\/\/([a-z0-9-]+\.)?(youtube\.com|youtu\.be)\//i.test(source)) return 'youtube';
    if (/^https?:\/\//i.test(source)) return 'url';
    try {
        const stat = await fs.stat(source);
        if (stat.isFile()) {
            if (path.extname(source).toLowerCase() !== '.mp3') {
                console.error(`ERROR: Only .mp3 files can be uploaded (POST /files/vocal takes audio/mpeg).`);
                process.exit(1);
            }
            return 'file';
        }
    } catch {
        // not a local file
    }
    console.error(`ERROR: SOURCE "${source}" is not a song_id, a link, or an existing local file.`);
    process.exit(1);
}

// Free length check of a YouTube link with GET /files/youtube (duration is in milliseconds).
async function checkYoutube(apiToken, account, url) {
    const query = new URLSearchParams({ account, url });
    const { name, duration } = await api('GET /files/youtube', `${urlYoutube}?${query}`, {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${apiToken}` }
    });

    console.info(`YouTube soundtrack: "${name}", ${formatDuration(duration)}`);

    if (typeof duration === 'number' && (duration < MIN_DURATION || duration > MAX_DURATION)) {
        console.error(`ERROR: The audio must be 10 seconds to 10 minutes long (this one is ${formatDuration(duration)}). Trim it and pass the MP3 instead.`);
        process.exit(1);
    }
}

// Upload a local MP3 privately with POST /files/vocal and return its url.
async function uploadMp3(apiToken, account, file, title) {
    const vocalTitle = title || path.basename(file, path.extname(file));
    const query = new URLSearchParams({ account, title: vocalTitle });

    console.info(`Uploading ${file} with POST /files/vocal (private to your account) …`);

    const { url, duration_milliseconds } = await api('POST /files/vocal', `${urlFilesVocal}?${query}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'audio/mpeg',
            'Authorization': `Bearer ${apiToken}`
        },
        body: await fs.readFile(file)
    });

    if (!url) {
        console.error(`ERROR: POST /files/vocal returned no url.`);
        process.exit(1);
    }

    console.info(`Uploaded, ${formatDuration(duration_milliseconds)}: ${url}`);

    if (typeof duration_milliseconds === 'number' && (duration_milliseconds < MIN_DURATION || duration_milliseconds > MAX_DURATION))
        console.warn(`WARNING: The audio must be 10 seconds to 10 minutes long (this one is ${formatDuration(duration_milliseconds)}). The score call will likely fail.`);

    return url;
}

// POST /music/score. The call waits for the result (about 5 to 15 seconds) and is a paid action
// (10 Mureka Gold), so it is sent once and never retried.
async function score(apiToken, body) {
    console.info(`Calling POST /music/score (10 Mureka Gold) …`);
    const started = Date.now();

    const result = await api('POST /music/score', urlScore, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify(body)
    });

    console.info(`Score ready in ${((Date.now() - started) / 1000).toFixed(1)} seconds: "${result.title}"`);

    if (!result.url) {
        console.error(`ERROR: POST /music/score returned no url.`, JSON.stringify(result));
        process.exit(1);
    }

    return result;
}

// Minimal zip reader (standard library only): reads the central directory and
// extracts stored and deflated entries. Only the file name is kept, so nothing
// is written outside the output folder.
function unzip(buffer) {
    const EOCD = 0x06054b50, CEN = 0x02014b50, LOC = 0x04034b50;

    let eocd = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i--)
        if (buffer.readUInt32LE(i) === EOCD) { eocd = i; break; }
    if (eocd < 0) throw new Error('Not a zip file (end of central directory not found)');

    const count = buffer.readUInt16LE(eocd + 10);
    let p = buffer.readUInt32LE(eocd + 16);
    const files = [];

    for (let n = 0; n < count; n++) {
        if (buffer.readUInt32LE(p) !== CEN) throw new Error('Corrupt zip central directory');
        const method = buffer.readUInt16LE(p + 10);
        const compressedSize = buffer.readUInt32LE(p + 20);
        const nameLength = buffer.readUInt16LE(p + 28);
        const extraLength = buffer.readUInt16LE(p + 30);
        const commentLength = buffer.readUInt16LE(p + 32);
        const localOffset = buffer.readUInt32LE(p + 42);
        const name = buffer.toString('utf8', p + 46, p + 46 + nameLength);
        p += 46 + nameLength + extraLength + commentLength;

        if (name.endsWith('/')) continue; // directory entry

        if (buffer.readUInt32LE(localOffset) !== LOC) throw new Error(`Corrupt zip entry ${name}`);
        const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
        const data = buffer.subarray(dataStart, dataStart + compressedSize);

        let content;
        if (method === 0) content = data;
        else if (method === 8) content = zlib.inflateRawSync(data);
        else throw new Error(`Unsupported zip compression method ${method} for ${name}`);

        files.push({ name: path.basename(name.replace(/\\/g, '/')), content });
    }

    return files;
}

// Download the zip, save it, and unzip it into output/<title>/.
async function downloadAndUnzip(url, title) {
    const safeTitle = (title || 'score').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || 'score';
    const outDir = path.join(OUTPUT_DIR, safeTitle);
    const zipFile = path.join(OUTPUT_DIR, `${safeTitle}.zip`);

    console.info(`Downloading ${url}`);
    const response = await fetch(url);
    if (!response.ok) fail('Zip download', response.status, await response.text());
    const buffer = Buffer.from(await response.arrayBuffer());

    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(zipFile, buffer);

    const files = unzip(buffer);
    for (const { name, content } of files)
        await fs.writeFile(path.join(outDir, name), content);

    console.info(`\nSaved ${zipFile} and unzipped ${files.length} files into ${outDir}${path.sep}`);
    for (const { name, content } of files)
        console.info(`  ${name.padEnd(48)} ${content.length.toLocaleString('en-US').padStart(10)} bytes`);
}

function formatDuration(ms) {
    if (typeof ms !== 'number') return 'unknown length';
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Main function
async function main() {
    const [apiToken, source, accountArgRaw, title] = process.argv.slice(2);
    const accountArg = accountArgRaw === '-' ? undefined : accountArgRaw;

    if (!apiToken || !source) {
        console.error('Usage: node sheet-music.mjs <API_TOKEN> <SOURCE> [ACCOUNT] [TITLE]');
        console.error('SOURCE: a Mureka song_id, a YouTube link, or a local .mp3 file');
        process.exit(1);
    }

    if (title && title.length > 100) {
        console.error('ERROR: TITLE exceeds 100 characters.');
        process.exit(1);
    }

    console.info('Script v1.0');
    console.info('Node version is: ' + process.version);

    try {
        const kind = await sourceKind(source);
        let body;

        if (kind === 'song') {
            // A song_id already names its account, and the zip always uses the song's own title.
            if (title) console.warn('WARNING: TITLE is ignored for a song_id, the song keeps its own title.');
            body = { song_id: source };
        } else {
            const account = await resolveAccount(apiToken, accountArg);
            console.info(`Using Mureka account ${account}`);

            let url = source;
            if (kind === 'youtube')
                await checkYoutube(apiToken, account, source);
            else if (kind === 'file')
                url = await uploadMp3(apiToken, account, source, title);

            body = { account, url, title };
        }

        const result = await score(apiToken, body);
        await downloadAndUnzip(result.url, result.title || title);
    } catch (error) {
        console.error('ERROR:', error.stack || error);
        process.exit(1);
    }
}

main();
