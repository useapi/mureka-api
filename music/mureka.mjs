/*

Script version 1.0, June 21, 2026

Script to batch-generate songs using prompts with the Mureka API v1 by useapi.net 🚀
Uses POST /music/create in asynchronous (fire-and-forget) mode, then polls each job
until it is final and downloads every generated MP3 (each generation returns two songs).
For more details visit https://useapi.net/docs/api-mureka-v1/post-mureka-music-create

Installation Instructions:
==========================

You need Node.js v21 or newer installed to run this script. Download and install Node.js from:

- Windows, macOS, Linux: https://nodejs.org/

After installation, verify by running the following command in a terminal:

   node -v

Running the Script:
===================

Usage: node mureka.mjs <API_TOKEN> [ACCOUNT] [PROMPTS_FILE]

Replace API_TOKEN with your actual useapi.net API token, see https://useapi.net/docs/start-here/setup-useapi
ACCOUNT is optional — your Mureka account id or its Google email, see https://useapi.net/docs/start-here/setup-mureka
  It is only required when more than one Mureka account is configured. With a single account it is auto-selected.
If optional PROMPTS_FILE not provided prompts.json will be used.

Example:
--------

node mureka.mjs user:1234-abcdefhijklmnopqrstuv

This command executes the script using API token user:1234-abcdefhijklmnopqrstuv and the only configured account.

Changelog:
==========

- June 21, 2026: Initial release.

*/

import readline from 'node:readline';
import fs from 'fs/promises';
import { writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';


// Constants
const RESULTS_FILE = 'mureka_results.txt';
const ERRORS_FILE = 'mureka_errors.txt';
const DEFAULT_PROMPTS_FILE = 'prompts.json';
const SLEEP_429 = 10 * 1000; // in milliseconds — wait between rate-limit / concurrent-limit retries
const MAX_429_RETRIES = 6;   // give up a prompt after this many consecutive 429s (all slots busy)
const SLEEP_POLL = 15 * 1000; // in milliseconds — a song takes ~45 seconds on average to generate

// Current SkyMusic models for POST /music/create. V9 is the API default when model is omitted.
// The API also accepts older aliases (V7.5, V7, O1, V6) that map to current engines — add any
// you want to use here. See https://useapi.net/docs/api-mureka-v1/post-mureka-music-create
const SUPPORTED_MODELS = ['V9', 'V8', 'O2', 'V7.6'];

const urlAccounts = 'https://api.useapi.net/v1/mureka/accounts';
const urlMusicCreate = 'https://api.useapi.net/v1/mureka/music/create';
const urlJobs = 'https://api.useapi.net/v1/mureka/jobs/';

// Utility to sleep for given milliseconds
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to fetch configured Mureka API accounts
async function fetchAccounts(apiToken) {
    const response = await fetch(urlAccounts, {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiToken}`
        }
    });

    if (!response.ok) {
        console.error(`⛔ Error fetching accounts (HTTP ${response.status}): ${response.statusText}`);
        process.exit(1);
    }

    return response.json();
}

// Submit a single prompt to POST /music/create in async mode. Returns { status, jobid }.
async function submitMusic(apiToken, account, prompt, index) {
    const { model, prompt: text } = prompt;

    console.log(`🚀 ${model ?? 'default (V9)'} » Prompt #${index} • account ${account} …`);

    // model is omitted from the body when not specified, so the API applies its own default (V9).
    const body = JSON.stringify({
        account,
        prompt: text,
        model,
        async: true
    });

    const createResponse = await fetch(urlMusicCreate, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`
        },
        body
    });

    const createBody = await createResponse.text();

    // async:true → 201 Created with { jobid, status:'created', … }.
    // (200 OK would be the synchronous result and also carries a jobid — handled too.)
    if (createResponse.status == 200 || createResponse.status == 201) {
        const json = JSON.parse(createBody);
        const { jobid } = json;
        if (jobid) {
            await fs.appendFile(RESULTS_FILE, `${jobid},#${index}:${text ?? ''}\n`);
            console.log(`✅ jobid`, jobid);
            return { status: createResponse.status, jobid };
        } else {
            const error = `No jobid found in HTTP ${createResponse.status} response`;
            console.log(`❓ ${error}`, createBody);
            await fs.appendFile(ERRORS_FILE, `${error},#${index}:${text ?? ''}\n`);
            return { status: 500 };
        }
    } else {
        switch (createResponse.status) {
            case 429:
                console.log(`🔄️ Retry on HTTP ${createResponse.status} (rate limit or all generation slots busy)`);
                break;
            case 400:
                console.log(`🛑 Validation error`, createBody);
                await fs.appendFile(ERRORS_FILE, `${createResponse.status},#${index}:${text ?? ''}\n`);
                break;
            case 402:
            case 412:
                console.log(`🛑 Subscription expired or insufficient credits`, createBody);
                await fs.appendFile(ERRORS_FILE, `${createResponse.status},#${index}:${text ?? ''}\n`);
                break;
            case 596:
                console.log(`🛑 Account session expired — re-add the account at https://useapi.net/docs/api-mureka-v1/post-mureka-accounts`, createBody);
                await fs.appendFile(ERRORS_FILE, `${createResponse.status},#${index}:${text ?? ''}\n`);
                break;
            default:
                console.log(`❗ FAILED with HTTP ${createResponse.status}`, createBody);
                await fs.appendFile(ERRORS_FILE, `${createResponse.status},#${index}:${text ?? ''}\n`);
        }
        return { status: createResponse.status };
    }
}

// Download a single mp3_url to disk.
async function downloadMp3(url, filename, jobid, prompt) {
    try {
        await fs.access(filename);
        console.log(`⚠️ ${filename} already exists. Skipping download.`);
        return;
    } catch {
        // File does not exist, proceed with downloading
    }

    console.log(`✅ Downloading ${url} to ${filename}`);
    try {
        const audioResponse = await fetch(url);
        if (!audioResponse.ok) {
            console.error(`⛔ Unable to download ${jobid} (HTTP ${audioResponse.status}):\n${prompt}\n`, url);
            return;
        }
        const stream = Readable.fromWeb(audioResponse.body);
        await writeFile(filename, stream);
    } catch (err) {
        console.error(`⛔ Error during download: ${err}`);
    }
}

// Poll every submitted job until it is final, then download each generated song's MP3.
async function download(apiToken) {
    if (! await fileExists(RESULTS_FILE)) return;

    try {
        const resultsContent = await fs.readFile(RESULTS_FILE, 'utf8');
        const lines = resultsContent.trim().split('\n');

        for (const line of lines) {
            const commaAt = line.indexOf(',');
            const jobid = commaAt === -1 ? line : line.slice(0, commaAt);
            const prompt = commaAt === -1 ? '' : line.slice(commaAt + 1);
            // jobid contains ':' (…-bot:mureka) — make a filesystem-safe base name.
            const safeJob = jobid.replace(/[:]/g, '_');

            console.log(`👉 ${jobid}`);

            while (true) {
                const response = await fetch(`${urlJobs}${encodeURIComponent(jobid)}`, {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${apiToken}`
                    }
                });

                if (!response.ok) {
                    // 404 = job not found or expired (jobs are retained for 7 days).
                    console.log(`🛑 Poll failed ${jobid} (HTTP ${response.status}):\n${prompt}\n`, await response.text());
                    break;
                }

                const job = await response.json();
                const { status, response: result, error, errorDetails } = job;

                if (status == 'failed') {
                    console.error(`🛑 FAILED ${jobid} (${error ?? 'unknown error'}${errorDetails ? ` — ${errorDetails}` : ''}):\n${prompt}\n`);
                    break;
                }

                if (status == 'completed') {
                    const songs = result?.songs ?? [];

                    if (songs.length === 0) {
                        console.error(`🛑 Job ${jobid} completed but returned no songs:\n${prompt}\n`);
                        break;
                    }

                    // Each generation returns two songs (version "1" and "2") — download both.
                    for (let i = 0; i < songs.length; i++) {
                        const song = songs[i];
                        const url = song?.mp3_url;
                        const variant = song?.version ?? (i + 1);
                        const filename = `${safeJob}_v${variant}.mp3`;

                        if (url)
                            await downloadMp3(url, filename, jobid, prompt);
                        else
                            console.error(`🛑 No mp3_url for song ${i + 1} of ${jobid}:\n${prompt}\n`);
                    }

                    break;
                }

                console.log(`⌛ ${jobid} status (${status ?? 'created'}) and is still in progress, waiting…`);
                await sleep(SLEEP_POLL);
            }
        }
    } catch (error) {
        console.log(`⛔ Error during download:`, error.stack || error);
    }
}

// Main function
async function main() {
    const apiToken = process.argv[2];
    const accountArg = process.argv[3];
    const promptFile = process.argv[4] || DEFAULT_PROMPTS_FILE;

    if (!apiToken) {
        console.error('Usage: node mureka.mjs <API_TOKEN> [ACCOUNT] [PROMPTS_FILE]');
        process.exit(1);
    }

    console.info('Script v1.0');

    console.info('Node version is: ' + process.version);

    try {
        if (await fileExists(RESULTS_FILE)) {
            let user_input;
            while (!['y', 'n'].includes(user_input)) {
                user_input = (await promptUser(`❔ ${RESULTS_FILE} file detected. Do you want to download the results now? (y/n): `))?.toLowerCase();
                if (user_input == 'y') {
                    await download(apiToken);
                    await fs.unlink(RESULTS_FILE);
                }
            }
        }

        const start = new Date();
        try {
            console.info('START EXECUTION', start);
            await execute(apiToken, accountArg, promptFile);
        }
        finally {
            console.info('COMPLETED', new Date());
            console.info('EXECUTION ELAPSED', diffInMinutesAndSeconds(start, new Date()));
        }

        try {
            console.info('START DOWNLOAD', start);
            await download(apiToken);
        }
        finally {
            console.info('TOTAL ELAPSED', diffInMinutesAndSeconds(start, new Date()));
        }
    } catch (error) {
        console.error('⛔ Error during execution:', error.stack || error);
    }
}

// Resolve the Mureka account to use: by id or Google email when provided, otherwise the
// single configured account. Returns the numeric account id string sent to the API.
function resolveAccount(accounts, accountArg) {
    const accountList = Object.values(accounts);

    console.info(`Configured Mureka API accounts (${accountList.length}):`, accountList.map(a => a.account).join(', '));

    if (accountList.length <= 0) {
        console.error(`⛔ No configured Mureka accounts found. Please refer to https://useapi.net/docs/start-here/setup-mureka`);
        process.exit(1);
    }

    let matched;

    if (accountArg) {
        // Match by Mureka account id or by the account's Google email.
        matched = accountList.find(a => a.account === accountArg || a.email === accountArg);
        if (!matched) {
            console.error(`⛔ Account "${accountArg}" not found. Please refer to https://useapi.net/docs/start-here/setup-mureka`);
            process.exit(1);
        }
    } else if (accountList.length === 1) {
        matched = accountList[0];
    } else {
        console.error(`⛔ ${accountList.length} accounts configured — pass the account id or email as the second argument.`);
        process.exit(1);
    }

    if (matched.error) {
        console.error(`⛔ Account ${matched.account} has a pending error: ${matched.error}. Re-add it at https://useapi.net/docs/api-mureka-v1/post-mureka-accounts`);
        process.exit(1);
    }

    return matched.account;
}

async function execute(apiToken, accountArg, promptFile) {
    const accounts = await fetchAccounts(apiToken);
    const account = resolveAccount(accounts, accountArg);

    console.info(`Using Mureka account ${account}`);

    const promptData = await fs.readFile(promptFile, 'utf8');
    const prompts = JSON.parse(promptData);
    console.log(`Total number of prompts to process`, prompts.length);

    let warnings = [];

    // Parameters accepted by this script for POST /music/create.
    // See https://useapi.net/docs/api-mureka-v1/post-mureka-music-create for the full parameter set.
    const supportedParams = ['model', 'prompt'];

    const invalidKeys = (prompt) => Object.keys(prompt).filter(key => !key.startsWith('__') && !supportedParams.includes(key));

    for (let i = 1; i <= prompts.length; i++) {
        const prompt = prompts[i - 1];
        const { prompt: text, model } = prompt;

        const notSupported = invalidKeys(prompt);
        if (notSupported.length)
            warnings.push(`⚠️  Following params not supported: ${notSupported.join(',')}. Prompt ${i}`);

        if (!text)
            warnings.push(`⚠️  Please specify a prompt. Prompt ${i}`);

        if (text && text.length > 3000)
            warnings.push(`⚠️  prompt exceeds 3000 characters. Prompt ${i}`);

        if (model && !SUPPORTED_MODELS.includes(model))
            warnings.push(`⚠️  Unknown model "${model}" — supported: ${SUPPORTED_MODELS.join(', ')}. Prompt ${i}`);
    }

    if (warnings.length > 0) {
        warnings.forEach(warning => console.warn(warning));
        console.error(`⛔ Execution stopped due to warnings.`);
        process.exit(1);
    }

    for (let i = 0; i < prompts.length; i++) {
        const prompt = prompts[i];
        let retries429 = 0;
        while (true) {
            const { status } = await submitMusic(apiToken, account, prompt, i + 1);
            if (status == 429) {
                if (++retries429 > MAX_429_RETRIES) {
                    console.error(`⛔ Gave up on prompt #${i + 1} after ${MAX_429_RETRIES} retries — all slots still busy.`);
                    await fs.appendFile(ERRORS_FILE, `429 (gave up after ${MAX_429_RETRIES} retries),#${i + 1}\n`);
                    break;
                }
                await sleep(SLEEP_429);
            } else if (status == 402 || status == 412 || status == 596) {
                process.exit(1);
            } else
                break;
        }
    }
}

// Utility function to check if a file exists
async function fileExists(path) {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

// Function to prompt user input
async function promptUser(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => rl.question(query, answer => {
        rl.close();
        resolve(answer);
    }));
}

function diffInMinutesAndSeconds(date1, date2) {
    const diffInSeconds = Math.floor((date2 - date1) / 1000);
    return `${Math.floor(diffInSeconds / 60)} minutes ${diffInSeconds % 60} seconds`;
};

main();
