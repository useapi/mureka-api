"""

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

Python port of own-voice.mjs, standard library only (no pip install needed).

Installation Instructions:
==========================

You need Python 3.x installed to run this script. Download and install Python from:

- Windows, macOS, Linux: https://www.python.org/

After installation, verify by running the following command in a terminal:

   python3 --version

Running the Script:
===================

Usage: python3 own-voice.py <API_TOKEN> <COMMAND> [ARGS] [--account ACCOUNT] [--song SONG_FILE]

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

python3 own-voice.py user:1234-abcdefhijklmnopqrstuv character ./my-voice.mp3

Changelog:
==========

- October 18, 2026: Initial release.

"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


# Constants
SCRIPT = 'own-voice.py'
OUTPUT_DIR = 'output'
DEFAULT_SONG_FILE = 'song.json'
SLEEP_POLL = 15            # in seconds — a song takes about 45 to 90 seconds
MAX_POLL = 15 * 60         # in seconds — stop polling after 15 minutes
SUPPORTED_MODELS = ['V9.5', 'V9', 'V8', 'O2', 'V7.6', 'V7.5']

urlAccounts = 'https://api.useapi.net/v1/mureka/accounts'
urlFilesVocal = 'https://api.useapi.net/v1/mureka/files/vocal/'
urlCharacters = 'https://api.useapi.net/v1/mureka/music/characters'
urlCharactersPublish = 'https://api.useapi.net/v1/mureka/music/characters-publish'
urlCreateAdvanced = 'https://api.useapi.net/v1/mureka/music/create-advanced'
urlJobs = 'https://api.useapi.net/v1/mureka/jobs/'

USAGE = f'''Usage: python3 {SCRIPT} <API_TOKEN> <COMMAND> [ARGS] [--account ACCOUNT] [--song SONG_FILE]
Commands:
  voice <VOICE.mp3 | VOCAL_ID>        one song in your voice
  character <VOICE.mp3 | VOCAL_ID>    create a character, then one song with it
  sing <CHARACTER_ID>                 one song with an existing character
  list                                list your characters
  publish <CHARACTER_ID> <private|public>
  delete <CHARACTER_ID>'''


# Print the failed call's HTTP status and body, then stop.
def fail(what, status, body):
    print(f'ERROR: {what} failed with HTTP {status}', file=sys.stderr)
    if body:
        print(body, file=sys.stderr)
    sys.exit(1)


def stop(message):
    print(f'ERROR: {message}', file=sys.stderr)
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
def api(what, url, apiToken, method='GET', json_body=None, data=None, content_type=None, timeout=120):
    headers = {'Accept': 'application/json', 'Authorization': f'Bearer {apiToken}'}
    if json_body is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps({k: v for k, v in json_body.items() if v is not None}).encode('utf-8')
    elif content_type:
        headers['Content-Type'] = content_type

    status, body = http_request(url, method=method, headers=headers, data=data, timeout=timeout)
    text = body.decode('utf-8', errors='replace')
    if not (200 <= status < 300):
        fail(what, status, text)
    try:
        return json.loads(text) if text else {}
    except ValueError:
        fail(what, status, f'Response is not JSON: {text}')


# Resolve the Mureka account to use: by id or email when provided, otherwise the
# single configured account. Returns the numeric account id string sent to the API.
def resolveAccount(apiToken, accountArg):
    accounts = api('GET /accounts', urlAccounts, apiToken)
    accountList = list(accounts.values())

    print(f'Configured Mureka API accounts ({len(accountList)}):', ', '.join(a.get('account', '') for a in accountList))

    if len(accountList) <= 0:
        stop('No configured Mureka accounts found. Please refer to https://useapi.net/docs/start-here/setup-mureka')

    if accountArg:
        # Match by Mureka account id or by the account's email.
        matched = next((a for a in accountList if a.get('account') == accountArg or a.get('email') == accountArg), None)
        if not matched:
            stop(f'Account "{accountArg}" not found. Please refer to https://useapi.net/docs/start-here/setup-mureka')
    elif len(accountList) == 1:
        matched = accountList[0]
    else:
        stop(f'{len(accountList)} accounts configured — pass the account id or email with --account.')

    if matched.get('error'):
        stop(f"Account {matched['account']} has a pending error: {matched['error']}. Re-add it at https://useapi.net/docs/api-mureka-v1/post-mureka-accounts")

    print(f"Using Mureka account {matched['account']}")
    return matched['account']


# Read and check song.json: the song settings plus the character settings for option B.
def readSong(songFile, needCharacter):
    try:
        with open(songFile, encoding='utf-8') as f:
            song = json.load(f)
    except (OSError, ValueError) as error:
        stop(f'Cannot read {songFile}: {error}')

    lyrics = song.get('lyrics')
    title = song.get('title')
    desc = song.get('desc')
    model = song.get('model')
    vocal_gender = song.get('vocal_gender')
    character = song.get('character') or {}
    problems = []

    if not lyrics:
        problems.append('lyrics is required')
    if lyrics and len(lyrics) > 5000:
        problems.append('lyrics exceeds 5000 characters')
    if title and len(title) > 50:
        problems.append('title exceeds 50 characters')
    if desc and len(desc) > 1000:
        problems.append('desc exceeds 1000 characters')
    if model and model not in SUPPORTED_MODELS:
        problems.append(f'unknown model "{model}", supported: {", ".join(SUPPORTED_MODELS)}')
    if vocal_gender and vocal_gender not in ('female', 'male'):
        problems.append('vocal_gender must be female or male')

    if needCharacter:
        name = character.get('name')
        if not name:
            problems.append('character.name is required')
        if name and len(name) > 50:
            problems.append('character.name exceeds 50 characters')
        if character.get('bio') and len(character['bio']) > 1000:
            problems.append('character.bio exceeds 1000 characters')
        if character.get('desc') and len(character['desc']) > 1000:
            problems.append('character.desc exceeds 1000 characters')
        if isinstance(character.get('tags'), list) and len(character['tags']) > 10:
            problems.append('character.tags has more than 10 tags')

    if problems:
        stop(f'{songFile}: {"; ".join(problems)}')
    return song


def formatDuration(ms):
    if not isinstance(ms, (int, float)):
        return 'unknown length'
    s = round(ms / 1000)
    return f'{s // 60}:{s % 60:02d}'


# POST /files/vocal: upload an MP3 voice clip, private to your account. Returns its id (vocal_id).
# A number instead of a file path is taken as a vocal_id you already uploaded.
def uploadVoice(apiToken, account, voice, title):
    if re.fullmatch(r'\d+', voice):
        print(f'Using vocal_id {voice} (already uploaded)')
        return voice

    if os.path.splitext(voice)[1].lower() != '.mp3':
        stop('Only .mp3 files can be uploaded (POST /files/vocal takes audio/mpeg).')

    try:
        with open(voice, 'rb') as f:
            data = f.read()
    except OSError as error:
        stop(f'Cannot read {voice}: {error}')

    vocalTitle = title or os.path.splitext(os.path.basename(voice))[0]
    query = urllib.parse.urlencode({'account': account, 'title': vocalTitle})

    print(f'Uploading {voice} with POST /files/vocal (private to your account, free) …')
    result = api('POST /files/vocal', f'{urlFilesVocal}?{query}', apiToken, method='POST',
                 data=data, content_type='audio/mpeg', timeout=600)

    if not result.get('id'):
        stop(f'POST /files/vocal returned no id: {json.dumps(result)}')
    print(f'Uploaded "{result.get("title") or vocalTitle}", {formatDuration(result.get("duration_milliseconds"))}, vocal_id {result["id"]}')
    return str(result['id'])


# POST /music/characters: turn an uploaded voice into a reusable singer (free, ready at once).
def createCharacter(apiToken, account, vocal_id, character):
    name = character.get('name')
    isPrivate = character.get('private') is not False  # this script keeps characters private unless song.json says false

    print(f'Creating character "{name}" with POST /music/characters (free, {"private" if isPrivate else "public on mureka.ai"}) …')
    result = api('POST /music/characters', urlCharacters, apiToken, method='POST', json_body={
        'account': account,
        'vocal_id': int(vocal_id),
        'name': name,
        'bio': character.get('bio'),
        'tags': character.get('tags'),
        'desc': character.get('desc'),
        'private': isPrivate,
    })

    if not result.get('id'):
        stop(f'POST /music/characters returned no id: {json.dumps(result)}')
    print(f'Character "{result.get("name")}" created, character_id {result["id"]}')
    return result['id']


def download(url, file):
    status, data = http_request(url, timeout=300)
    if not (200 <= status < 300):
        fail(f'Download of {url}', status, data.decode('utf-8', errors='replace'))
    with open(file, 'wb') as f:
        f.write(data)


# POST /music/create-advanced in async mode, then poll GET /jobs/<jobid> and download the songs.
# A song is a paid action, so the call is sent once and never retried.
def createSong(apiToken, account, song, voice):
    body = {
        'account': account,
        'lyrics': song.get('lyrics'),
        'title': song.get('title'),
        'desc': song.get('desc'),
        'model': song.get('model'),
        'vocal_gender': song.get('vocal_gender'),
        **voice,
        'async': True,
    }
    using = f"character_id {voice['character_id']}" if 'character_id' in voice else f"vocal_id {voice['vocal_id']}"

    print(f'Calling POST /music/create-advanced ({song.get("model") or "V9.5"}, {using}) …')
    created = api('POST /music/create-advanced', urlCreateAdvanced, apiToken, method='POST', json_body=body)

    jobid = created.get('jobid')
    if not jobid:
        stop(f'POST /music/create-advanced returned no jobid: {json.dumps(created)}')
    print(f'jobid {jobid}')

    # A 200 answer already carries the songs; a 201 answer is polled until the job is final.
    songs = created.get('songs')
    started = time.time()

    while songs is None:
        if time.time() - started > MAX_POLL:
            stop(f'Job {jobid} is still running after 15 minutes. Check it later with GET /jobs/{jobid}')
        time.sleep(SLEEP_POLL)

        job = api(f'GET /jobs/{jobid}', f'{urlJobs}{urllib.parse.quote(jobid, safe="")}', apiToken)
        status = job.get('status')
        if status == 'failed':
            details = f" ({job['errorDetails']})" if job.get('errorDetails') else ''
            stop(f'Job {jobid} failed: {job.get("error") or "unknown error"}{details}')
        if status == 'completed':
            songs = (job.get('response') or {}).get('songs') or []
            break
        print(f'Job status {status or "created"}, waiting …')

    if not songs:
        stop(f'Job {jobid} completed but returned no songs.')
    print(f'Done in {round(time.time() - started)} seconds, {len(songs)} songs:')

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for i, s in enumerate(songs):
        safeTitle = re.sub(r'[\\/:*?"<>|\x00-\x1f]', '_', s.get('title') or song.get('title') or 'song').strip() or 'song'
        file = os.path.join(OUTPUT_DIR, f'{safeTitle}_v{s.get("version") or i + 1}.mp3')
        print(f'  {s.get("song_id")}  {formatDuration(s.get("duration_milliseconds"))}  {file}')
        if s.get('mp3_url'):
            download(s['mp3_url'], file)
        else:
            print(f'  WARNING: no mp3_url for {s.get("song_id")}')


# GET /music/characters, 20 per page, newest first. Follows last_id to the end.
def listCharacters(apiToken, account):
    last_id = None
    count = 0

    for _ in range(50):
        params = {'account': account}
        if last_id:
            params['last_id'] = str(last_id)

        result = api('GET /music/characters', f'{urlCharacters}/?{urllib.parse.urlencode(params)}', apiToken)
        items = result.get('list') or []

        for c in items:
            count += 1
            visibility = 'public' if c.get('is_published') else 'private'
            tags = f"  [{', '.join(c['tags'])}]" if isinstance(c.get('tags'), list) and c['tags'] else ''
            print(f'{str(c.get("id")):<18} {visibility:<8} {c.get("name")}{tags}')

        if len(items) < 20 or not result.get('last_id') or result.get('last_id') == last_id:
            break
        last_id = result['last_id']

    print(f'{count} characters' if count else 'No characters on this account.')


# POST /music/characters-publish: private hides the character, public publishes it on mureka.ai.
def publishCharacter(apiToken, account, character_id, visibility):
    if visibility not in ('private', 'public'):
        stop('The last argument of publish must be private or public.')
    result = api('POST /music/characters-publish', urlCharactersPublish, apiToken, method='POST', json_body={
        'account': account,
        'character_id': int(character_id),
        'private': visibility == 'private',
    })
    now = 'private' if result.get('private') else 'public on mureka.ai'
    print(f'Character {result.get("character_id") or character_id} is now {now}')


# DELETE /music/characters: songs made with it and the uploaded voice are kept.
def deleteCharacter(apiToken, account, character_id):
    query = urllib.parse.urlencode({'account': account, 'character_id': str(character_id)})
    api('DELETE /music/characters', f'{urlCharacters}/?{query}', apiToken, method='DELETE')
    print(f'Character {character_id} deleted.')


# Split the arguments into positionals and the --account / --song options.
def parseArgs(argv):
    positional = []
    options = {}
    i = 0
    while i < len(argv):
        if argv[i] in ('--account', '--song'):
            if i + 1 >= len(argv):
                stop(f'{argv[i]} needs a value.')
            options[argv[i][2:]] = argv[i + 1]
            i += 2
        else:
            positional.append(argv[i])
            i += 1
    return positional, options


def requireId(value, what):
    if not value or not re.fullmatch(r'\d+', value):
        stop(f'{what} must be a number.\n{USAGE}')
    return value


def main():
    positional, options = parseArgs(sys.argv[1:])
    apiToken, command, arg1, arg2 = (positional + [None] * 4)[:4]
    songFile = options.get('song') or DEFAULT_SONG_FILE
    accountArg = options.get('account')

    if not apiToken or not command:
        print(USAGE, file=sys.stderr)
        sys.exit(1)

    print('Script v1.0')
    print('Python version is: ' + sys.version.split()[0])

    try:
        if command == 'voice':
            if not arg1:
                stop(f'voice needs an MP3 file or a vocal_id.\n{USAGE}')
            song = readSong(songFile, False)
            account = resolveAccount(apiToken, accountArg)
            vocal_id = uploadVoice(apiToken, account, arg1, (song.get('character') or {}).get('name'))
            createSong(apiToken, account, song, {'vocal_id': vocal_id})
        elif command == 'character':
            if not arg1:
                stop(f'character needs an MP3 file or a vocal_id.\n{USAGE}')
            song = readSong(songFile, True)
            account = resolveAccount(apiToken, accountArg)
            vocal_id = uploadVoice(apiToken, account, arg1, song['character']['name'])
            character_id = createCharacter(apiToken, account, vocal_id, song['character'])
            createSong(apiToken, account, song, {'character_id': int(character_id)})
            print(f'Sing again with: python3 {SCRIPT} <API_TOKEN> sing {character_id}')
        elif command == 'sing':
            character_id = requireId(arg1, 'CHARACTER_ID')
            song = readSong(songFile, False)
            account = resolveAccount(apiToken, accountArg)
            createSong(apiToken, account, song, {'character_id': int(character_id)})
        elif command == 'list':
            account = resolveAccount(apiToken, accountArg)
            listCharacters(apiToken, account)
        elif command == 'publish':
            character_id = requireId(arg1, 'CHARACTER_ID')
            account = resolveAccount(apiToken, accountArg)
            publishCharacter(apiToken, account, character_id, arg2)
        elif command == 'delete':
            character_id = requireId(arg1, 'CHARACTER_ID')
            account = resolveAccount(apiToken, accountArg)
            deleteCharacter(apiToken, account, character_id)
        else:
            stop(f'Unknown command "{command}".\n{USAGE}')
    except (urllib.error.URLError, OSError) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
