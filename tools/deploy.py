#!/usr/bin/env python3
"""Deploy the working tree to main as ONE commit through the GitHub Git Data API.

Use this when `git push` isn't available (for example, from a Claude session).
It uploads every tracked file that differs from main, in a single commit, so the
test-then-deploy workflow runs once per release.

Usage:
    GITHUB_TOKEN=<fine-grained PAT> python3 tools/deploy.py "v9.1: short description" [--prune]

--prune also deletes files that exist on main but not locally. Leave it off
unless you removed a file on purpose.

The token needs Contents: read and write on birria-corp/ZepTrack, plus
Workflows: read and write when a file under .github/workflows changes.
"""
import base64, json, os, subprocess, sys, urllib.request

REPO = 'birria-corp/ZepTrack'
API = f'https://api.github.com/repos/{REPO}'
TOKEN = os.environ.get('GITHUB_TOKEN')
SKIP_DIRS = {'.git', 'node_modules'}


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': f'Bearer {TOKEN}', 'Accept': 'application/vnd.github+json'})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        sys.exit(f'{method} {path} failed: {e.code} {e.read().decode()[:300]}')


def git_blob_sha(data):
    return subprocess.run(['git', 'hash-object', '--stdin'], input=data, capture_output=True).stdout.decode().strip()


def main():
    if not TOKEN or len(sys.argv) < 2:
        sys.exit(__doc__)
    message = next(a for a in sys.argv[1:] if not a.startswith('--'))
    head = call('GET', '/git/ref/heads/main')['object']['sha']
    base_tree = call('GET', f'/git/commits/{head}')['tree']['sha']
    remote = {e['path']: e['sha'] for e in call('GET', f'/git/trees/{base_tree}?recursive=1')['tree'] if e['type'] == 'blob'}

    local = {}
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            path = os.path.relpath(os.path.join(root, f), '.')
            local[path] = open(path, 'rb').read()

    changes = []
    for path, data in sorted(local.items()):
        if remote.get(path) == git_blob_sha(data):
            continue
        blob = call('POST', '/git/blobs', {'content': base64.b64encode(data).decode(), 'encoding': 'base64'})
        changes.append({'path': path, 'mode': '100755' if os.access(path, os.X_OK) else '100644', 'type': 'blob', 'sha': blob['sha']})
    deleted = [p for p in remote if p not in local] if '--prune' in sys.argv else []
    changes += [{'path': p, 'mode': '100644', 'type': 'blob', 'sha': None} for p in deleted]
    if not changes:
        print('Nothing to deploy.')
        return
    tree = call('POST', '/git/trees', {'base_tree': base_tree, 'tree': changes})
    commit = call('POST', '/git/commits', {'message': message, 'tree': tree['sha'], 'parents': [head]})
    call('PATCH', '/git/refs/heads/main', {'sha': commit['sha']})
    print(f"Committed {commit['sha'][:10]}: {len(changes)} file(s)")
    for c in changes:
        print(('  deleted ' if c['sha'] is None else '  updated ') + c['path'])


if __name__ == '__main__':
    main()
