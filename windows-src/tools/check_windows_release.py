#!/usr/bin/env python3
"""Gate Windows publication on an increasing application version."""
import argparse
import json
import os
from pathlib import Path
import re
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def release_config(root=None):
    root = Path(root) if root is not None else ROOT
    specific = root / 'desktop/windows/release.json'
    # Keep older checkouts usable without tying future Windows versions to Mac.
    source = specific if specific.exists() else root / 'desktop/release.json'
    config = json.loads(source.read_text())
    if not isinstance(config, dict) or not isinstance(config.get('version'), str):
        raise ValueError('Windows release metadata requires a version string.')
    return config


def version_tuple(value):
    if not isinstance(value, str) or not re.fullmatch(r'(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)', value):
        raise ValueError('Windows release version must be major.minor.patch.')
    return tuple(int(part) for part in value.split('.'))


def should_publish(candidate, previous):
    current = version_tuple(candidate)
    if previous is None:
        return True
    published = version_tuple(previous)
    if current < published:
        raise ValueError('The app version is older than the published Windows release.')
    return current > published


def latest_version(repository):
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', repository):
        raise ValueError('Invalid GitHub repository.')
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'Production-Desk-release-check'}
    token = os.environ.get('GH_TOKEN')
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = Request('https://api.github.com/repos/' + repository + '/releases/latest', headers=headers)
    try:
        with urlopen(request, timeout=30) as response:
            release = json.load(response)
    except HTTPError as error:
        if error.code == 404:
            return None
        raise
    tag = release.get('tag_name', '')
    match = re.fullmatch(r'windows-(\d+\.\d+\.\d+)-build-\d+', tag)
    if not match:
        raise ValueError('The latest GitHub release must be the Windows channel; publish Mac releases with latest=false.')
    return match.group(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repository', required=True)
    parser.add_argument('--event', required=True)
    parser.add_argument('--ref', required=True)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--require-newer', action='store_true')
    args = parser.parse_args()
    config = release_config()
    candidate = config['version']
    if config.get('channel') == 'beta':
        if args.require_newer:
            raise ValueError('Beta builds cannot publish to the production update channel.')
        if args.output:
            args.output.write_text('publish=false\nprevious_version=\n', encoding='utf-8')
        print('Beta build: validation only; production publication is disabled.')
        return
    version_tuple(candidate)
    publish = False
    previous = None
    if args.event in ('push', 'workflow_dispatch') and args.ref == 'refs/heads/main':
        previous = latest_version(args.repository)
        publish = should_publish(candidate, previous)
    if args.require_newer and not publish:
        raise ValueError('Increase desktop/windows/release.json version before publishing another Windows installer.')
    if args.output:
        with args.output.open('a', encoding='utf-8') as output:
            output.write('publish=' + str(publish).lower() + '\n')
            output.write('previous_version=' + (previous or '') + '\n')
    print('Windows ' + candidate + (': new version eligible for publication.' if publish else ': validation only; no new installer will be published.'))


if __name__ == '__main__':
    main()
