"""

Script version 1.0, October 4, 2026

Script to batch-generate instrumental tracks with the Mureka API v1 by useapi.net 🚀
Uses POST /music/create-instrumental in asynchronous (fire-and-forget) mode, then polls each job
until it is final and downloads every generated MP3 (each generation returns two tracks).
For more details visit https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-instrumental

Python port of instrumental.mjs, standard library only (no pip install needed).

Installation Instructions:
==========================

You need Python 3.x installed to run this script. Download and install Python from:

- Windows, macOS, Linux: https://www.python.org/

After installation, verify by running the following command in a terminal:

   python3 --version

Running the Script:
===================

Usage: python3 instrumental.py <API_TOKEN> [ACCOUNT] [PROMPTS_FILE]

Replace API_TOKEN with your actual useapi.net API token, see https://useapi.net/docs/start-here/setup-useapi
ACCOUNT is optional — your Mureka account id or its email, see https://useapi.net/docs/start-here/setup-mureka
  It is only required when more than one Mureka account is configured. With a single account it is auto-selected.
If optional PROMPTS_FILE not provided prompts.json will be used.

Example:
--------

python3 instrumental.py user:1234-abcdefhijklmnopqrstuv

This command executes the script using API token user:1234-abcdefhijklmnopqrstuv and the only configured account.

Changelog:
==========

- October 4, 2026: Initial release.

"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime


# Constants
SCRIPT = 'instrumental.py'
RESULTS_FILE = 'instrumental_results.txt'
ERRORS_FILE = 'instrumental_errors.txt'
DEFAULT_PROMPTS_FILE = 'prompts.json'
SLEEP_429 = 10        # in seconds — wait between rate-limit / concurrent-limit retries
MAX_429_RETRIES = 6   # give up a prompt after this many consecutive 429s (all slots busy)
SLEEP_POLL = 15       # in seconds — a song takes ~45 seconds on average to generate

# Current Mureka models for POST /music/create-instrumental. V9.5 is the API default when model is omitted.
# Retired names (V7, O1, V6, V5.5) redirect to V7.6 — add any you want to use here.
# See https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-instrumental
SUPPORTED_MODELS = ['V9.5', 'V9', 'V8', 'O2', 'V7.6', 'V7.5']

# Fields of each prompts.json entry that are sent to the endpoint as-is.
# See https://useapi.net/docs/api-mureka-v1/post-mureka-music-create-instrumental for the full parameter set.
SUPPORTED_PARAMS = ['model', 'prompt', 'title']

urlAccounts = 'https://api.useapi.net/v1/mureka/accounts'
urlMusicCreate = 'https://api.useapi.net/v1/mureka/music/create-instrumental'
urlJobs = 'https://api.useapi.net/v1/mureka/jobs/'


# Validate one prompts.json entry, returning a list of warnings.
def validatePrompt(prompt, i):
    warnings = []
    text = prompt.get('prompt')
    title = prompt.get('title')
    model = prompt.get('model')

    if not text:
        warnings.append(f'⚠️  Please describe the music in prompt. Prompt {i}')
    if text and len(text) > 1000:
        warnings.append(f'⚠️  prompt exceeds 1000 characters. Prompt {i}')
    if title and len(title) > 50:
        warnings.append(f'⚠️  title exceeds 50 characters. Prompt {i}')
    if model and model not in SUPPORTED_MODELS:
        warnings.append(f'⚠️  Unknown model "{model}" — supported: {", ".join(SUPPORTED_MODELS)}. Prompt {i}')
    return warnings

# Short label for a prompt, written to the results file and log lines.
def promptLabel(prompt):
    return (prompt.get('prompt') or '').replace('\n', ' / ')

# Perform an HTTP request and return (status, body_text). HTTP errors are returned
# as their status (mirroring fetch, which does not throw on 4xx/5xx).
def http_request(url, method='GET', headers=None, data=None):
    # api.useapi.net's Cloudflare edge rejects urllib's default User-Agent (error 1010, HTTP 403).
    req = urllib.request.Request(url, data=data, method=method, headers={'User-Agent': SCRIPT, **(headers or {})})
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, response.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', errors='replace')


def appendFile(path, text):
    with open(path, 'a', encoding='utf-8') as f:
        f.write(text)


# Fetch configured Mureka API accounts
def fetchAccounts(apiToken):
    status, body = http_request(urlAccounts, headers={
        'Accept': 'application/json',
        'Authorization': f'Bearer {apiToken}'
    })

    if not (200 <= status < 300):
        print(f'⛔ Error fetching accounts (HTTP {status}): {body}', file=sys.stderr)
        sys.exit(1)

    return json.loads(body)


# Submit a single prompt in async mode. Returns the HTTP status.
def submitMusic(apiToken, account, prompt, index):
    model = prompt.get('model')
    label = promptLabel(prompt)

    print(f"🚀 {model or 'default (V9.5)'} » Prompt #{index} • account {account} …")

    # Fields not in the prompt are left out of the body, so the API applies its own defaults (model V9.5).
    body = {'account': account, 'async': True}
    for key in SUPPORTED_PARAMS:
        if prompt.get(key) is not None:
            body[key] = prompt[key]

    status, responseText = http_request(urlMusicCreate, method='POST', headers={
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {apiToken}'
    }, data=json.dumps(body).encode('utf-8'))

    # async:true → 201 Created with { jobid, status:'created', … }.
    # (200 OK would be the synchronous result and also carries a jobid — handled too.)
    if status in (200, 201):
        jobid = json.loads(responseText).get('jobid')
        if jobid:
            appendFile(RESULTS_FILE, f'{jobid},#{index}:{label}\n')
            print('✅ jobid', jobid)
            return status
        print(f'❓ No jobid found in HTTP {status} response', responseText)
        appendFile(ERRORS_FILE, f'No jobid found in HTTP {status} response,#{index}\n')
        return 500

    if status == 555 and '(6303)' in responseText:
        # Mureka rejects two submissions that arrive at the same moment on one account
        # ("User generate multiple feeds at the same time") — wait and retry like a 429.
        print('🔄️ Retry on HTTP 555 (another submission on this account is in progress)')
        return 429

    if status == 429:
        print(f'🔄️ Retry on HTTP {status} (rate limit or all generation slots busy)')
    elif status == 400:
        print('🛑 Validation error', responseText)
    elif status in (402, 412):
        print('🛑 Subscription expired or insufficient credits', responseText)
    elif status == 596:
        print('🛑 Account session expired — re-add the account at https://useapi.net/docs/api-mureka-v1/post-mureka-accounts', responseText)
    else:
        print(f'❗ FAILED with HTTP {status}', responseText)

    if status != 429:
        appendFile(ERRORS_FILE, f'{status},#{index}\n')
    return status


# Download a single mp3_url to disk.
def downloadMp3(url, filename, jobid, label):
    if os.path.exists(filename):
        print(f'⚠️ {filename} already exists. Skipping download.')
        return

    print(f'✅ Downloading {url} to {filename}')
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': SCRIPT})) as response:
            data = response.read()
        with open(filename, 'wb') as f:
            f.write(data)
    except urllib.error.HTTPError as e:
        print(f'⛔ Unable to download {jobid} (HTTP {e.code}):\n{label}\n', url, file=sys.stderr)
    except Exception as err:
        print(f'⛔ Error during download: {err}', file=sys.stderr)


# Poll every submitted job until it is final, then download each generated song's MP3.
def download(apiToken):
    if not os.path.exists(RESULTS_FILE):
        return

    with open(RESULTS_FILE, 'r', encoding='utf-8') as f:
        lines = f.read().strip().split('\n')

    for line in lines:
        if not line:
            continue
        jobid, _, label = line.partition(',')
        # jobid contains ':' (…-bot:mureka) — make a filesystem-safe base name.
        safeJob = jobid.replace(':', '_')

        print(f'👉 {jobid}')

        while True:
            status, body = http_request(f'{urlJobs}{urllib.parse.quote(jobid, safe="")}', headers={
                'Accept': 'application/json',
                'Authorization': f'Bearer {apiToken}'
            })

            if not (200 <= status < 300):
                # 404 = job not found or expired (jobs are retained for 7 days).
                print(f'🛑 Poll failed {jobid} (HTTP {status}):\n{label}\n', body)
                break

            job = json.loads(body)
            jobStatus = job.get('status')

            if jobStatus == 'failed':
                details = f" — {job['errorDetails']}" if job.get('errorDetails') else ''
                print(f"🛑 FAILED {jobid} ({job.get('error') or 'unknown error'}{details}):\n{label}\n", file=sys.stderr)
                break

            if jobStatus == 'completed':
                songs = (job.get('response') or {}).get('songs') or []

                if not songs:
                    print(f'🛑 Job {jobid} completed but returned no songs:\n{label}\n', file=sys.stderr)
                    break

                # Each generation returns two songs (version "1" and "2") — download both.
                for i, song in enumerate(songs):
                    url = (song or {}).get('mp3_url')
                    variant = (song or {}).get('version') or (i + 1)
                    if url:
                        downloadMp3(url, f'{safeJob}_v{variant}.mp3', jobid, label)
                    else:
                        print(f'🛑 No mp3_url for song {i + 1} of {jobid}:\n{label}\n', file=sys.stderr)
                break

            print(f"⌛ {jobid} status ({jobStatus or 'created'}) and is still in progress, waiting…")
            time.sleep(SLEEP_POLL)


# Resolve the Mureka account to use: by id or email when provided, otherwise the
# single configured account. Returns the account id string sent to the API.
def resolveAccount(accounts, accountArg):
    accountList = list(accounts.values())

    print(f'Configured Mureka API accounts ({len(accountList)}):', ', '.join(str(a.get('account')) for a in accountList))

    if not accountList:
        print('⛔ No configured Mureka accounts found. Please refer to https://useapi.net/docs/start-here/setup-mureka', file=sys.stderr)
        sys.exit(1)

    if accountArg:
        # Match by Mureka account id or by the account's email.
        matched = next((a for a in accountList if a.get('account') == accountArg or a.get('email') == accountArg), None)
        if not matched:
            print(f'⛔ Account "{accountArg}" not found. Please refer to https://useapi.net/docs/start-here/setup-mureka', file=sys.stderr)
            sys.exit(1)
    elif len(accountList) == 1:
        matched = accountList[0]
    else:
        print(f'⛔ {len(accountList)} accounts configured — pass the account id or email as the second argument.', file=sys.stderr)
        sys.exit(1)

    if matched.get('error'):
        print(f"⛔ Account {matched.get('account')} has a pending error: {matched['error']}. Re-add it at https://useapi.net/docs/api-mureka-v1/post-mureka-accounts", file=sys.stderr)
        sys.exit(1)

    return matched.get('account')


def execute(apiToken, accountArg, promptFile):
    account = resolveAccount(fetchAccounts(apiToken), accountArg)

    print(f'Using Mureka account {account}')

    with open(promptFile, 'r', encoding='utf-8') as f:
        prompts = json.load(f)
    print('Total number of prompts to process', len(prompts))

    warnings = []
    for i, prompt in enumerate(prompts, start=1):
        notSupported = [key for key in prompt.keys() if not key.startswith('__') and key not in SUPPORTED_PARAMS]
        if notSupported:
            warnings.append(f"⚠️  Following params not supported: {','.join(notSupported)}. Prompt {i}")
        warnings += validatePrompt(prompt, i)

    if warnings:
        for warning in warnings:
            print(warning, file=sys.stderr)
        print('⛔ Execution stopped due to warnings.', file=sys.stderr)
        sys.exit(1)

    for i, prompt in enumerate(prompts, start=1):
        retries429 = 0
        while True:
            status = submitMusic(apiToken, account, prompt, i)
            if status == 429:
                retries429 += 1
                if retries429 > MAX_429_RETRIES:
                    print(f'⛔ Gave up on prompt #{i} after {MAX_429_RETRIES} retries — all slots still busy.', file=sys.stderr)
                    appendFile(ERRORS_FILE, f'429 (gave up after {MAX_429_RETRIES} retries),#{i}\n')
                    break
                time.sleep(SLEEP_429)
            elif status in (402, 412, 596):
                sys.exit(1)
            else:
                break


def diffInMinutesAndSeconds(date1, date2):
    diffInSeconds = int((date2 - date1).total_seconds())
    return f'{diffInSeconds // 60} minutes {diffInSeconds % 60} seconds'


# Main function
def main():
    apiToken = sys.argv[1] if len(sys.argv) > 1 else None
    accountArg = sys.argv[2] if len(sys.argv) > 2 else None
    promptFile = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_PROMPTS_FILE

    if not apiToken:
        print(f'Usage: python3 {SCRIPT} <API_TOKEN> [ACCOUNT] [PROMPTS_FILE]', file=sys.stderr)
        sys.exit(1)

    print('Script v1.0')
    print('Python version is: ' + sys.version)

    if os.path.exists(RESULTS_FILE):
        answer = None
        while answer not in ('y', 'n'):
            answer = input(f'❔ {RESULTS_FILE} file detected. Do you want to download the results now? (y/n): ').strip().lower()
        if answer == 'y':
            download(apiToken)
            os.unlink(RESULTS_FILE)

    start = datetime.now()
    try:
        print('START EXECUTION', start)
        execute(apiToken, accountArg, promptFile)
    finally:
        print('COMPLETED', datetime.now())
        print('EXECUTION ELAPSED', diffInMinutesAndSeconds(start, datetime.now()))

    try:
        print('START DOWNLOAD', start)
        download(apiToken)
    finally:
        print('TOTAL ELAPSED', diffInMinutesAndSeconds(start, datetime.now()))


main()
