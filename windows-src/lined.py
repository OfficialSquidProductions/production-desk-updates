"""Original PDF storage and validation for lined scripts."""
import base64
import hashlib
import math
from pathlib import Path
import re
import tempfile
import os

MAX_PDF = 40 * 1024 * 1024
MAX_BACKUP = 200 * 1024 * 1024
HASH = re.compile(r'[a-f0-9]{64}')


def validate_lining(project):
    lining = project.get('_linedScript')
    if lining is None:
        return
    if not isinstance(lining, dict) or not isinstance(lining.get('documents'), list):
        raise ValueError('Invalid lined script documents.')
    hashes = set()
    ids = set()
    shots = {s['id'] for s in project.get('_shots', [])}
    scenes = {s['id'] for s in project.get('breakdowns', []) if s.get('type') == 'scene'}
    def number(value, low, high):
        return type(value) in (int, float) and math.isfinite(value) and low <= value <= high
    def point(value):
        return isinstance(value, list) and len(value) == 2 and all(number(n, 0, 1) for n in value)
    for document in lining['documents']:
        if not isinstance(document, dict) or not isinstance(document.get('sha256'), str) or not HASH.fullmatch(document['sha256']):
            raise ValueError('Invalid original PDF reference.')
        if document['sha256'] in hashes:
            raise ValueError('Duplicate original PDF reference.')
        hashes.add(document['sha256'])
        if not isinstance(document.get('filename'), str) or not 1 <= len(document['filename']) <= 240:
            raise ValueError('Invalid original PDF filename.')
        marks = document.get('marks')
        if not isinstance(marks, list) or len(marks) > 10000:
            raise ValueError('Invalid lined script annotations.')
        for mark in marks:
            if not isinstance(mark, dict) or not isinstance(mark.get('id'), str) or not mark['id'] or mark['id'] in ids:
                raise ValueError('Invalid or duplicate annotation ID.')
            ids.add(mark['id'])
            kind = mark.get('type')
            if kind not in ('coverage', 'pen', 'highlighter', 'arrow', 'text'):
                raise ValueError('Unknown annotation tool.')
            if type(mark.get('page')) is not int or not 0 <= mark['page'] < 10000:
                raise ValueError('Invalid annotation page.')
            if mark.get('space', 'page') not in ('page', 'document'):
                raise ValueError('Invalid annotation coordinate space.')
            if 'endPage' in mark and (type(mark['endPage']) is not int or not mark['page'] <= mark['endPage'] < 10000):
                raise ValueError('Invalid annotation ending page.')
            if not isinstance(mark.get('color'), str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', mark['color']):
                raise ValueError('Invalid annotation color.')
            if not number(mark.get('width'), .5, 30) or not point(mark.get('start')):
                raise ValueError('Invalid annotation position or width.')
            if 'labelAt' in mark and not (isinstance(mark['labelAt'], list) and len(mark['labelAt']) == 2
                    and number(mark['labelAt'][0], -.5, 1.5) and number(mark['labelAt'][1], 0, 1)):
                raise ValueError('Invalid coverage label position.')
            if kind in ('coverage', 'arrow') and not point(mark.get('end')):
                raise ValueError('Invalid annotation end position.')
            if kind == 'coverage':
                shot_id = mark.get('shotId')
                if (shot_id not in (None, '') and (not isinstance(shot_id, str) or shot_id not in shots)) or mark.get('style') not in ('solid', 'wavy'):
                    raise ValueError('Coverage line requires a valid shot link or an unlinked draft, and a line style.')
                if mark['start'][0] != mark['end'][0]:
                    raise ValueError('Coverage lines must be vertical.')
                draft = mark.get('draft', {})
                if not isinstance(draft, dict):
                    raise ValueError('Invalid coverage shot details.')
                for key, maximum in [('number', 24), ('description', 2000), ('movement', 500), ('camera', 100), ('lens', 100), ('size', 100), ('equipment', 500)]:
                    if key in draft and (not isinstance(draft[key], str) or len(draft[key]) > maximum):
                        raise ValueError('Invalid coverage ' + key + '.')
                if 'sceneId' in draft and (not isinstance(draft['sceneId'], str) or draft['sceneId'] not in scenes):
                    raise ValueError('Coverage draft references an unknown scene.')
            if kind in ('pen', 'highlighter'):
                points = mark.get('points')
                if not isinstance(points, list) or not 2 <= len(points) <= 20000 or not all(point(p) for p in points):
                    raise ValueError('Invalid drawing points.')
            for key in ('text', 'note'):
                if key in mark and (not isinstance(mark[key], str) or len(mark[key]) > 2000):
                    raise ValueError('Annotation notes must be text of at most 2000 characters.')
    if lining.get('activePdf') not in hashes and lining.get('activePdf') is not None:
        raise ValueError('Invalid active PDF.')


def pdf_path(datafile, digest):
    if not isinstance(digest, str) or not HASH.fullmatch(digest):
        raise ValueError('Invalid original PDF reference.')
    return datafile.parent / 'pdfs' / (digest + '.pdf')


def store_pdf(datafile, raw, filename):
    if not 0 < len(raw) <= MAX_PDF or b'%PDF-' not in raw[:1024]:
        raise ValueError('Choose an original PDF smaller than 40 MB.')
    digest = hashlib.sha256(raw).hexdigest()
    destination = pdf_path(datafile, digest)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and hashlib.sha256(destination.read_bytes()).hexdigest() != digest:
        raise ValueError('An existing original PDF is damaged. Your files were preserved.')
    if not destination.exists():
        fd, temporary = tempfile.mkstemp(dir=destination.parent, prefix='.pdf-')
        try:
            with os.fdopen(fd, 'wb') as file:
                file.write(raw)
                file.flush()
                os.fsync(file.fileno())
            os.replace(temporary, destination)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    return {'sha256': digest, 'filename': Path(filename).name[:240] or 'script.pdf', 'marks': []}


def referenced_pdfs(workspace):
    return {d['sha256'] for p in workspace['projects'] for d in (p.get('_linedScript') or {}).get('documents', [])}


def add_backup_pdfs(datafile, workspace):
    documents = {}
    total = 0
    for digest in referenced_pdfs(workspace):
        path = pdf_path(datafile, digest)
        if not path.is_file():
            raise ValueError('An original PDF is missing. Reattach it before exporting a full backup.')
        raw = path.read_bytes()
        if len(raw) > MAX_PDF or hashlib.sha256(raw).hexdigest() != digest:
            raise ValueError('An original PDF is damaged. Reattach it before saving a project file.')
        total += len(raw)
        if total * 4 / 3 > MAX_BACKUP - MAX_PDF:
            raise ValueError('This backup exceeds 200 MB. Split the productions into separate backups.')
        documents[digest] = base64.b64encode(raw).decode('ascii')
    return dict(workspace, _pdfDocuments=documents) if documents else workspace


def restore_backup_pdfs(datafile, workspace):
    documents = workspace.pop('_pdfDocuments', {})
    if not isinstance(documents, dict):
        raise ValueError('Invalid PDF attachments in backup.')
    wanted = referenced_pdfs(workspace)
    decoded = []
    for digest in wanted:
        if digest in documents:
            encoded = documents[digest]
            if not isinstance(encoded, str) or len(encoded) > MAX_PDF * 4 / 3 + 4:
                raise ValueError('Invalid PDF attachment size.')
            try:
                raw = base64.b64decode(encoded, validate=True)
            except (ValueError, TypeError):
                raise ValueError('Invalid PDF attachment encoding.')
            if hashlib.sha256(raw).hexdigest() != digest or b'%PDF-' not in raw[:1024]:
                raise ValueError('PDF attachment checksum does not match.')
            decoded.append(raw)
        else:
            existing = pdf_path(datafile, digest)
            if not existing.is_file():
                raise ValueError('Backup is missing an original PDF attachment.')
            if hashlib.sha256(existing.read_bytes()).hexdigest() != digest:
                raise ValueError('An existing original PDF is damaged. Your files were preserved.')
        existing = pdf_path(datafile, digest)
        if existing.exists() and hashlib.sha256(existing.read_bytes()).hexdigest() != digest:
            raise ValueError('An existing original PDF is damaged. Your files were preserved.')
    for raw in decoded:
        store_pdf(datafile, raw, 'script.pdf')
    return workspace
