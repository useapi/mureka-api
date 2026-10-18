"""

Script version 1.0, October 18, 2026

Script to turn a song into sheet music with the Mureka API v1 by useapi.net.
The source is one of your Mureka songs (song_id), a YouTube link, or a local MP3 file.
Uses POST /music/score, downloads the returned zip (MusicXML, staff PDF, numbered-notation PDF)
and unzips it into an output folder.
For more details visit https://useapi.net/docs/api-mureka-v1/post-mureka-music-score
Tutorial: https://useapi.net/docs/articles/mureka-sheet-music

Each score costs 10 Mureka Gold from your Mureka account.

Python port of sheet-music.mjs, standard library only (no pip install needed).

Installation Instructions:
==========================

You need Python 3.x installed to run this script. Download and install Python from:

- Windows, macOS, Linux: https://www.python.org/

After installation, verify by running the following command in a terminal:

   python3 --version

Running the Script:
===================

Usage: python3 sheet-music.py <API_TOKEN> <SOURCE> [ACCOUNT] [TITLE]

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

python3 sheet-music.py user:1234-abcdefhijklmnopqrstuv user:1234-mureka:12345678901234-song:33445566

Changelog:
==========

- October 18, 2026: Initial release.

"""

import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
import zipfile


# Constants
SCRIPT = 'sheet-music.py'
OUTPUT_DIR = 'output'
MIN_DURATION = 10 * 1000       # in milliseconds — the score endpoint takes 10 seconds…
MAX_DURATION = 10 * 60 * 1000  # …to 10 minutes of audio
SCORE_TIMEOUT = 180            # in seconds — a score takes about 5 to 15 seconds, plus up to 15 for a YouTube link

urlAccounts = 'https://api.useapi.net/v1/mureka/accounts'
urlYoutube = 'https://api.useapi.net/v1/mureka/files/youtube/'
urlFilesVocal = 'https://api.useapi.net/v1/mureka/files/vocal/'
urlScore = 'https://api.useapi.net/v1/mureka/music/score'


# Print the failed call's HTTP status and body, then stop.
def fail(what, status, body):
    print(f'ERROR: {what} failed with HTTP {status}', file=sys.stderr)
    if body:
        print(body, file=sys.stderr)
    sys.exit(1)


# Perform an HTTP request and return (status, body_bytes). HTTP errors are returned
# as their status (mirroring fetch, which does not throw on 4xx/5xx).
def http_request(url, method='GET', headers=None, data=None, timeout=120):
    # api.useapi.net's Cloudflare edge rejects urllib's default User-Agent (error 1010, HTTP 403).
    req = urllib.request.Request(url, data=data, method=method, headers={'User-Agent': SCRIPT, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


# Call the API and return the parsed JSON body. Any non-2xx answer stops the script.
def api(what, url, **kwargs):
    status, body = http_request(url, **kwargs)
    text = body.decode('utf-8', errors='replace')
    if not (200 <= status < 300):
        fail(what, status, text)
    try:
        return json.loads(text)
    except ValueError:
        fail(what, status, f'Response is not JSON: {text}')


def authHeaders(apiToken, extra=None):
    return {'Accept': 'application/json', 'Authorization': f'Bearer {apiToken}', **(extra or {})}


# Resolve the Mureka account to use: by id or email when provided, otherwise the
# single configured account. Returns the numeric account id string sent to the API.
def resolveAccount(apiToken, accountArg):
    accounts = api('GET /accounts', urlAccounts, headers=authHeaders(apiToken))
    accountList = list(accounts.values())

    print(f'Configured Mureka API accounts ({len(accountList)}):', ', '.join(a.get('account', '') for a in accountList))

    if len(accountList) <= 0:
        print('ERROR: No configured Mureka accounts found. Please refer to https://useapi.net/docs/start-here/setup-mureka', file=sys.stderr)
        sys.exit(1)

    if accountArg:
        # Match by Mureka account id or by the account's email.
        matched = next((a for a in accountList if a.get('account') == accountArg or a.get('email') == accountArg), None)
        if not matched:
            print(f'ERROR: Account "{accountArg}" not found. Please refer to https://useapi.net/docs/start-here/setup-mureka', file=sys.stderr)
            sys.exit(1)
    elif len(accountList) == 1:
        matched = accountList[0]
    else:
        print(f'ERROR: {len(accountList)} accounts configured — pass the account id or email as the third argument.', file=sys.stderr)
        sys.exit(1)

    if matched.get('error'):
        print(f"ERROR: Account {matched['account']} has a pending error: {matched['error']}. Re-add it at https://useapi.net/docs/api-mureka-v1/post-mureka-accounts", file=sys.stderr)
        sys.exit(1)

    return matched['account']


# Work out which kind of SOURCE was given.
def sourceKind(source):
    if re.fullmatch(r'user:\d+-mureka:\d+-song:\d+', source):
        return 'song'
    if re.match(r'^https?://([a-z0-9-]+\.)?(youtube\.com|youtu\.be)/', source, re.I):
        return 'youtube'
    if re.match(r'^https?://', source, re.I):
        return 'url'
    if os.path.isfile(source):
        if os.path.splitext(source)[1].lower() != '.mp3':
            print('ERROR: Only .mp3 files can be uploaded (POST /files/vocal takes audio/mpeg).', file=sys.stderr)
            sys.exit(1)
        return 'file'
    print(f'ERROR: SOURCE "{source}" is not a song_id, a link, or an existing local file.', file=sys.stderr)
    sys.exit(1)


def formatDuration(ms):
    if not isinstance(ms, (int, float)):
        return 'unknown length'
    s = round(ms / 1000)
    return f'{s // 60}:{s % 60:02d}'


def outOfRange(ms):
    return isinstance(ms, (int, float)) and (ms < MIN_DURATION or ms > MAX_DURATION)


# Free length check of a YouTube link with GET /files/youtube (duration is in milliseconds).
def checkYoutube(apiToken, account, url):
    query = urllib.parse.urlencode({'account': account, 'url': url})
    result = api('GET /files/youtube', f'{urlYoutube}?{query}', headers=authHeaders(apiToken))
    duration = result.get('duration')

    print(f'YouTube soundtrack: "{result.get("name")}", {formatDuration(duration)}')

    if outOfRange(duration):
        print(f'ERROR: The audio must be 10 seconds to 10 minutes long (this one is {formatDuration(duration)}). Trim it and pass the MP3 instead.', file=sys.stderr)
        sys.exit(1)


# Upload a local MP3 privately with POST /files/vocal and return its url.
def uploadMp3(apiToken, account, file, title):
    vocalTitle = title or os.path.splitext(os.path.basename(file))[0]
    query = urllib.parse.urlencode({'account': account, 'title': vocalTitle})

    print(f'Uploading {file} with POST /files/vocal (private to your account) …')

    with open(file, 'rb') as f:
        data = f.read()

    result = api('POST /files/vocal', f'{urlFilesVocal}?{query}', method='POST',
                 headers=authHeaders(apiToken, {'Content-Type': 'audio/mpeg'}), data=data, timeout=600)
    url = result.get('url')
    duration = result.get('duration_milliseconds')

    if not url:
        print('ERROR: POST /files/vocal returned no url.', file=sys.stderr)
        sys.exit(1)

    print(f'Uploaded, {formatDuration(duration)}: {url}')

    if outOfRange(duration):
        print(f'WARNING: The audio must be 10 seconds to 10 minutes long (this one is {formatDuration(duration)}). The score call will likely fail.')

    return url


# POST /music/score. The call waits for the result (about 5 to 15 seconds) and is a paid action
# (10 Mureka Gold), so it is sent once and never retried.
def score(apiToken, body):
    print('Calling POST /music/score (10 Mureka Gold) …')
    started = time.time()

    payload = json.dumps({k: v for k, v in body.items() if v is not None}).encode('utf-8')
    result = api('POST /music/score', urlScore, method='POST',
                 headers=authHeaders(apiToken, {'Content-Type': 'application/json'}), data=payload, timeout=SCORE_TIMEOUT)

    print(f'Score ready in {time.time() - started:.1f} seconds: "{result.get("title")}"')

    if not result.get('url'):
        print('ERROR: POST /music/score returned no url.', json.dumps(result), file=sys.stderr)
        sys.exit(1)

    return result


# Download the zip, save it, and unzip it into output/<title>/.
# Only each entry's file name is kept, so nothing is written outside the output folder.
def downloadAndUnzip(url, title):
    safeTitle = re.sub(r'[\\/:*?"<>|\x00-\x1f]', '_', title or 'score').strip() or 'score'
    outDir = os.path.join(OUTPUT_DIR, safeTitle)
    zipPath = os.path.join(OUTPUT_DIR, f'{safeTitle}.zip')

    print(f'Downloading {url}')
    status, data = http_request(url, timeout=120)
    if not (200 <= status < 300):
        fail('Zip download', status, data.decode('utf-8', errors='replace'))

    os.makedirs(outDir, exist_ok=True)
    with open(zipPath, 'wb') as f:
        f.write(data)

    files = []
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            name = os.path.basename(info.filename.replace('\\', '/'))
            content = z.read(info)
            with open(os.path.join(outDir, name), 'wb') as f:
                f.write(content)
            files.append((name, len(content)))

    print(f'\nSaved {zipPath} and unzipped {len(files)} files into {outDir}{os.sep}')
    for name, size in files:
        print(f'  {name:<48} {size:>10,} bytes')


def main():
    args = sys.argv[1:]
    apiToken = args[0] if len(args) > 0 else None
    source = args[1] if len(args) > 1 else None
    accountArg = args[2] if len(args) > 2 and args[2] != '-' else None
    title = args[3] if len(args) > 3 else None

    if not apiToken or not source:
        print(f'Usage: python3 {SCRIPT} <API_TOKEN> <SOURCE> [ACCOUNT] [TITLE]', file=sys.stderr)
        print('SOURCE: a Mureka song_id, a YouTube link, or a local .mp3 file', file=sys.stderr)
        sys.exit(1)

    if title and len(title) > 100:
        print('ERROR: TITLE exceeds 100 characters.', file=sys.stderr)
        sys.exit(1)

    print('Script v1.0')
    print('Python version is: ' + sys.version.split()[0])

    try:
        kind = sourceKind(source)

        if kind == 'song':
            # A song_id already names its account, and the zip always uses the song's own title.
            if title:
                print('WARNING: TITLE is ignored for a song_id, the song keeps its own title.')
            body = {'song_id': source}
        else:
            account = resolveAccount(apiToken, accountArg)
            print(f'Using Mureka account {account}')

            url = source
            if kind == 'youtube':
                checkYoutube(apiToken, account, source)
            elif kind == 'file':
                url = uploadMp3(apiToken, account, source, title)

            body = {'account': account, 'url': url, 'title': title}

        result = score(apiToken, body)
        downloadAndUnzip(result['url'], result.get('title') or title)
    except (urllib.error.URLError, OSError, zipfile.BadZipFile) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
