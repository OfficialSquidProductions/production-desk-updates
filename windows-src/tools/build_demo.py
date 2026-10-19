#!/usr/bin/env python3
"""Regenerate the offline portable sample from the retained Scenic reference."""
import base64
import copy
import hashlib
import json
from pathlib import Path
import textwrap
import uuid
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import film
from project_file import validate_workspace

STAMP = '2026-11-02T12:00:00.000Z'
counter = 0
def identifier():
    global counter
    counter += 1
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'productiondesk/the-last-cue/v2/' + str(counter)))

def script_pdf(script):
    lines=[]
    for line in script.splitlines():
        lines.extend(textwrap.wrap(line, 68, replace_whitespace=False) or [''])
    # Two original pages exercise paging and linked coverage without external files.
    cut=(len(lines)+1)//2
    pages=[lines[:cut], lines[cut:]]
    objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'',b'<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>']
    page_refs=[]
    for index, text in enumerate(pages):
        page_id=len(objects)+1;stream_id=page_id+1;page_refs.append(page_id)
        objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {stream_id} 0 R >>'.encode())
        commands=['BT /F1 10 Tf 13 TL 52 744 Td']
        for line in [f'THE LAST CUE - FICTIONAL DEMO - {index+1}/2','']+text:
            escaped=line.encode('ascii','replace').decode().replace('\\','\\\\').replace('(','\\(').replace(')','\\)')
            commands.append('('+escaped+') Tj T*')
        commands.append('ET');stream='\n'.join(commands).encode()
        objects.append(b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream')
    objects[1]=('<< /Type /Pages /Count 2 /Kids ['+' '.join(f'{n} 0 R' for n in page_refs)+'] >>').encode()
    raw=bytearray(b'%PDF-1.4\n');offsets=[0]
    for n,value in enumerate(objects,1):
        offsets.append(len(raw));raw.extend(f'{n} 0 obj\n'.encode()+value+b'\nendobj\n')
    start=len(raw);raw.extend(f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode())
    for off in offsets[1:]:raw.extend(f'{off:010d} 00000 n \n'.encode())
    raw.extend(f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n'.encode())
    return bytes(raw)

def build():
    film.uid=identifier;film.now=lambda:STAMP
    reference=json.loads((ROOT/'web/demo/scenic-reference.json').read_text())
    scene=reference['scene']
    story=scene['notes'].split('\nDEMO NOTES\n')[0]
    body=story[story.index('A desk, chair'):]
    paragraphs=[]
    for line in body.splitlines():
        if line.startswith(('MAYA:','LEO:')):
            name,dialogue=line.split(':',1);paragraphs.extend(['',name,dialogue.strip(),''])
        elif line:paragraphs.extend([line,''])
    script='Title: The Last Cue\nCredit: Original fictional rehearsal, matching Scenic\nAuthor: Fictional demo content\nNotes: Maya (22) and Leo (23) are fictional adults.\n\nINT. BLACK-BOX THEATRE - EVENING #1#\n\n'+'\n'.join(paragraphs).strip()+'\n'
    p=film.import_script(script,'The Last Cue.fountain');p.update(project='DEMO · The Last Cue',author='Fictional rehearsal team',company='Demo production — fictional',description='Maya and Leo rehearse lighting cue twelve, hold for the missed wash, reset, and finish together. Matches Scenic scene 1 and shots 1A–1D.',episode='1',episodeName='Rehearsal',season='Demo',_demo=True,_betaDemo={'key':'productiondesk.scenic.the-last-cue.v2','version':2},_sourceScript={'filename':'The Last Cue.fountain','text':script},_importNotes='Fictional offline sample. Scene 1 and four shots match Scenic. Timings, dates, departments and annotations are sample planning data, not additional story scenes.')
    b=p['breakdowns'][0];b.update(description='Maya calls cue twelve; Leo selects thirteen. The pair reset and complete rehearsal.',comments='Cue 12: stage wash. Cue 13: practical lamp. Confirm wash before the practical. All characters and production details are fictional.',duration=45*60000,pages=1.0,scriptPage='1–2',_needsReview=False,_stripColor='#F9DDE6')
    def add(ucid,name):
        eid=film.element(p,ucid,name)
        if eid not in b['elements']:b['elements'].append(eid)
        return next(e for e in p['elements'] if e['id']==eid)
    add(3,'1');add(4,'Main unit');add(6,'College black-box rehearsal floor')
    for ucid,names in {104:['Prop notebook · cue list','Practical lamp'],110:['Cameras A–D · 24/50/85/35 mm'],111:['Tripods'],112:['Stage wash · cue twelve','Practical lamp · cue thirteen','Lighting console'],113:['Dialogue rehearsal recording'],115:['Black-box rehearsal floor'],116:['Rehearsal desk','Maya’s chair'],119:['Lighting cue list'],123:['Reset notebook and chair before cue twelve']}.items():
        for name in names:add(ucid,name)
    cast=[e for e in p['elements'] if e['category']==next(c['id'] for c in p['categories'] if c['ucid']==100)]
    for e in cast:e['daysOff']=[0,6];e['isIdLock']=True
    if len(cast)==2:cast[0]['linkedElements']=[cast[1]['id']]
    cast[-1]['events']=[{'id':identifier(),'type':'dayOff','date':'2026-11-04T12:00:00.000Z','name':'Fictional availability example'}]
    banners=[]
    for title in ['PREP · Stand by lighting cue twelve','WRAP · Reset notebook and chair']:
        banner=copy.deepcopy(b);banner.update(id=identifier(),type='banner',bannerText=title,scene=None,description=None,comments=None,pages=None,duration=None,scriptPage=None,elements=[],_scriptText='')
        banners.append(banner)
    p['breakdowns']=[b,*banners]
    cal=p['calendars'][0];cal['events']=[{'id':identifier(),'type':'start','date':STAMP,'name':None},{'id':identifier(),'type':'dayOff','date':'2026-11-05T12:00:00.000Z','name':'Fictional turnaround'}]
    first=p['stripboards'][0];first['name']='Rehearsal shoot';first['boards'][0]['breakdownIds']=[[banners[0]['id'],b['id'],banners[1]['id']]]
    first['boards'][1]['breakdownIds']=[]
    alternate=copy.deepcopy(first);alternate.update(id=identifier(),name='Unscheduled planning copy')
    for board in alternate['boards']:board['id']=identifier()
    alternate['boards'][0]['breakdownIds']=[[banners[0]['id'],banners[1]['id']]];alternate['boards'][1]['breakdownIds']=[b['id']]
    p['stripboards'].append(alternate)
    # Scenic's Normal maps to PD's middle priority; the story/camera data is exact.
    p['_shots']=[{'id':identifier(),'created':STAMP,'sceneId':b['id'],'number':s['number'][1:],'description':s['description'],'size':s['size'],'movement':s['movement'],'camera':s['camera'],'lens':s['lens'],'equipment':s['equipment'],'setupMinutes':int(s['setupMinutes']),'shootMinutes':int(s['shootMinutes']),'actualMinutes':None,'status':s['status'],'takes':0,'circleTake':'','priority':'Preferred','notes':s['notes']} for s in scene['shotList']]
    p['_shotSettings']={'startTime':'09:00'}
    raw=script_pdf(script);digest=hashlib.sha256(raw).hexdigest()
    marks=[{'id':identifier(),'type':'coverage','page':0,'start':[.18,.25],'end':[.18,.7],'color':'#E60026','width':2,'shotId':p['_shots'][0]['id'],'style':'solid','note':'1A · establish the rehearsal floor'},
           {'id':identifier(),'type':'coverage','page':1,'start':[.22,.22],'end':[.22,.56],'color':'#456FA3','width':2,'shotId':p['_shots'][1]['id'],'style':'wavy','note':'1B · Maya calls hold, Leo off camera'},
           {'id':identifier(),'type':'pen','page':0,'start':[.45,.23],'points':[[.45,.23],[.54,.25],[.59,.24]],'color':'#E60026','width':2},
           {'id':identifier(),'type':'highlighter','page':1,'start':[.24,.37],'points':[[.24,.37],[.7,.37]],'color':'#E9BF40','width':12},
           {'id':identifier(),'type':'arrow','page':1,'start':[.72,.52],'end':[.6,.4],'color':'#456FA3','width':2},
           {'id':identifier(),'type':'text','page':1,'start':[.6,.58],'text':'Reset chair and notebook before cue twelve.','color':'#E60026','width':2}]
    p['_linedScript']={'activePdf':digest,'documents':[{'sha256':digest,'filename':'The Last Cue — original demo.pdf','marks':marks}]}
    workspace={'version':1,'activeProject':p['id'],'projects':[p],'_pdfDocuments':{digest:base64.b64encode(raw).decode()}}
    validate_workspace(workspace)
    target=ROOT/'web/demo';target.mkdir(exist_ok=True)
    (target/'the-last-cue.productiondesk').write_text(json.dumps({'format':'org.squidproductions.productiondesk.project','formatVersion':1,'workspace':workspace},ensure_ascii=False,indent=2)+'\n')
    (target/'the-last-cue.fountain').write_text(script)
    print('Built Scenic-matched portable demo:1scene,4shots,2scenarios,2banners,2PDFpages,6marks.')

if __name__=='__main__':build()
