"""Versioned portable Production Desk projects; never evaluates file content."""
import copy
import json
from film import prepare_project
from lined import MAX_BACKUP, referenced_pdfs, add_backup_pdfs, restore_backup_pdfs

FORMAT = 'org.squidproductions.productiondesk.project'
VERSION = 1


def validate_workspace(value):
    if not isinstance(value, dict) or type(value.get('version')) is not int or value['version'] != 1:
        raise ValueError('Unsupported or invalid Production Desk workspace version.')
    projects = value.get('projects')
    if not isinstance(projects, list) or not projects:
        raise ValueError('This file has no productions.')
    for project in projects:
        prepare_project(project)
    ids = [p['id'] for p in projects]
    if len(set(ids)) != len(ids) or value.get('activeProject') not in ids:
        raise ValueError('Invalid active project or duplicate production IDs.')
    plain = {key: item for key, item in value.items() if key != '_pdfDocuments'}
    if len(json.dumps(plain, ensure_ascii=False, allow_nan=False).encode('utf-8')) > 40 * 1024 * 1024:
        raise ValueError('The production data exceeds 40 MB.')
    return value


def export_project(datafile, workspace):
    workspace = copy.deepcopy(workspace)
    validate_workspace(workspace)
    if len(workspace['projects']) != 1:
        raise ValueError('Choose one production to save as a project file.')
    workspace = add_backup_pdfs(datafile, workspace)
    workspace.setdefault('_pdfDocuments', {})
    value = {'format': FORMAT, 'formatVersion': VERSION, 'workspace': workspace}
    raw = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode('utf-8')
    if len(raw) > MAX_BACKUP:
        raise ValueError('This project file exceeds 200 MB.')
    return raw


def import_project(datafile, value):
    if not isinstance(value, dict) or value.get('format') != FORMAT:
        raise ValueError('This is not a Production Desk project file.')
    if type(value.get('formatVersion')) is not int or value['formatVersion'] != VERSION:
        raise ValueError('This Production Desk project version is not supported. Update Production Desk to open it.')
    workspace = validate_workspace(value.get('workspace'))
    if len(workspace['projects']) != 1:
        raise ValueError('A project file must contain one production.')
    documents = workspace.get('_pdfDocuments')
    if not isinstance(documents, dict) or set(documents) != referenced_pdfs(workspace):
        raise ValueError('This project is missing an embedded original PDF. Save it again from the source device.')
    restore_backup_pdfs(datafile, workspace)
    return workspace
