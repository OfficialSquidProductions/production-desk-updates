#!/usr/bin/env python3
"""Build paired, offline demos from Production Desk's original The Last Light script.

Run with --scenic-root ../../scenic-store to refresh Scenic's shared/mobile bundle.
No workspace or release metadata is touched.
"""
import argparse
import ast
import base64
import copy
import hashlib
import json
import math
from pathlib import Path
import sys
import textwrap
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import film
from project_file import validate_workspace

STAMP = '2026-11-02T12:00:00.000Z'
KEY = 'productiondesk.the-last-light.v3'
SCENIC_KEY = 'scenic-the-last-light-v2'
counter = 0

def identifier():
    global counter
    counter += 1
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'productiondesk/the-last-light/v3/' + str(counter)))

# Descriptions supplement the unchanged script with explicitly fictional planning data.
SPECS = [
 ('North coast', 'Maya and Eli drive toward the lighthouse.', ['MAYA','ELI'], [('car','set','Station wagon',480,430,74,180)],
  [('Wide',24,'Tracking','Station wagon follows the coastal road toward the lighthouse.'),('Medium',50,'Static','Maya and Eli react to the lighthouse in the mist.')]),
 ('North coast', 'An old map points to their destination.', ['MAYA','ELI'], [('car','set','Station wagon',480,430,74,180),('book','prop','Folded road map',490,380,12,9)],
  [('Medium',35,'Static','Maya unfolds the road map beside Eli.'),('Insert',85,'Static','Red circle on the folded road map marks the lighthouse.')]),
 ('Point Harbor lighthouse', "Jonah greets Maya with her father's key.", ['MAYA','JONAH'], [('keys','prop','Brass key',510,420,3,1.5),('car','set','Station wagon',220,340,74,180)],
  [('Wide',24,'Static','Station wagon stops at the foot of the lighthouse; Jonah waits.'),('Close-up',85,'Static','Jonah offers the brass key to Maya.')]),
 ('Point Harbor lighthouse', "Maya retraces her father's morning ritual.", ['MAYA','JONAH'], [],
  [('Medium wide',35,'Tilt','Follow Jonah and Maya ascending the winding stairwell.'),('Insert',85,'Static','Maya runs her hand along the worn stone.')]),
 ('Point Harbor lighthouse', 'Eli discovers a letter addressed to Maya.', ['MAYA','ELI'], [('coffee-table','set','Wooden box · planning footprint',510,420,18,12),('book','prop','Letter',500,420,8,11),('book','prop','Photograph',530,420,6,4),('plate','prop','Compass',545,440,3,3)],
  [('Medium',50,'Static','Eli opens the wooden box as Maya watches.'),('Insert',85,'Static','Letter, photograph and compass inside the wooden box.')]),
 ('Point Harbor lighthouse', 'Maya and Jonah talk as the tide comes in.', ['MAYA','JONAH'], [('coffee-table','set','Seawall · planning footprint',510,460,72,16)],
  [('Medium wide',35,'Static','Maya and Jonah sit on the seawall above the tide.'),('Close-up',85,'Static','Maya listens as Jonah remembers her father.')]),
 ('Point Harbor lighthouse', 'Maya brings the lighthouse back to life.', ['MAYA'], [('keys','prop','Brass key',510,420,3,1.5)],
  [('Insert',85,'Static','Maya turns the brass key in the lighthouse mechanism.'),('Medium',50,'Pan','The lantern wakes; Maya sees the light return.')]),
 ('North coast', 'Maya and Eli leave the coast behind.', ['MAYA','ELI'], [('car','set','Station wagon',480,430,74,180)],
  [('Medium',50,'Static','Eli closes the car door; Maya is ready to leave.'),('Wide',24,'Pan','The lighthouse beam sweeps the water behind the departing wagon.')])
]

def original_script():
    tree=ast.parse((ROOT/'tests/demo_data.py').read_text())
    return next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='DEMO' for t in n.targets))

def script_pdf(scenes):
    # One original scene per page gives every scene usable linked PDF coverage.
    objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'',b'<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>']
    refs=[]
    for index,b in enumerate(scenes):
        page_id=len(objects)+1;stream_id=page_id+1;refs.append(page_id)
        objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {stream_id} 0 R >>'.encode())
        lines=[f'THE LAST LIGHT - FICTIONAL DEMO - {index+1}/8','']
        for line in b['_scriptText'].splitlines():
            lines.extend(textwrap.wrap(line,68,replace_whitespace=False) or [''])
        commands=['BT /F1 10 Tf 13 TL 52 744 Td']
        for line in lines:
            escaped=line.encode('ascii','replace').decode().replace('\\','\\\\').replace('(','\\(').replace(')','\\)')
            commands.append('('+escaped+') Tj T*')
        commands.append('ET');stream='\n'.join(commands).encode()
        objects.append(b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream')
    objects[1]=('<< /Type /Pages /Count 8 /Kids ['+' '.join(f'{n} 0 R' for n in refs)+'] >>').encode()
    raw=bytearray(b'%PDF-1.4\n');offsets=[0]
    for n,value in enumerate(objects,1):
        offsets.append(len(raw));raw.extend(f'{n} 0 obj\n'.encode()+value+b'\nendobj\n')
    start=len(raw);raw.extend(f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode())
    for off in offsets[1:]:raw.extend(f'{off:010d} 00000 n \n'.encode())
    raw.extend(f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n'.encode())
    return bytes(raw)

def build(scenic_root=None):
    global counter
    counter=0;film.uid=identifier;film.now=lambda:STAMP
    script=original_script();source_hash=hashlib.sha256(script.encode()).hexdigest()
    p=film.import_script(script,'The Last Light.fountain')
    p.update(project='DEMO · The Last Light',author='Fictional demo team',company='Demo production — fictional',description='Maya and Eli travel to Point Harbor; Jonah helps Maya reconnect with her father’s lighthouse. Original eight-scene Production Desk screenplay.',episode='1',episodeName='The Last Light',season='Demo',scriptColor='White',scriptDate=STAMP,schedColor='Blue',schedDate=STAMP,_demo=True,_betaDemo={'key':KEY,'version':3},_sourceScript={'filename':'The Last Light.fountain','text':script},_importNotes='All people, locations, dates, takes, timings and production plans are fictional. The screenplay is unchanged from Production Desk’s original The Last Light demo. Scenic shares the eight scenes and shots. Files transfer edits; there is no automatic sync.',_sharedDemo={'title':'The Last Light','scriptSHA256':source_hash,'revision':1})
    scenes=p['breakdowns'];assert len(scenes)==8
    def add(b,ucid,name):
        eid=film.element(p,ucid,name)
        if eid not in b['elements']:b['elements'].append(eid)
        return next(e for e in p['elements'] if e['id']==eid)
    all_shots=[];scenic_scenes=[]
    for i,(b,spec) in enumerate(zip(scenes,SPECS)):
        location,description,characters,props,shot_specs=spec;n=i+1
        b.update(description=description,comments=f'Fictional planning example. Scene {n}: preserve prop positions and screen direction between cameras A and B.',pages=[.375,.75,1.125,.5,1.25,.875,.625,.375][i],scriptPage=str(n),duration=[60,75,90,45,90,60,75,45][i]*60000,_needsReview=i==7,_completed=i==2,_stripColor=['#F9DDE6','#DDE7F5','#DDEDDC','#E8E0F2'][i%4])
        for ucid,name in [(3,'1' if n<7 else '2'),(4,'Main unit'),(5,'Arrival' if n<4 else 'The letter and light'),(6,location),(110,'Camera A / B · full-frame'),(111,'Tripod and small dolly'),(112,'Soft fill / lighthouse practical'),(113,'Dialogue and coastal ambience'),(106,'Travel layers · continuity stills'),(107,'Natural look · wind continuity'),(118,'Closed fictional set · access check'),(119,'Local weather and tide reference'),(123,'Example notes · no real shoot planned'),(124,'Verify continuity before marking complete')]:add(b,ucid,name)
        if i in (0,1,7):add(b,103,'Station wagon')
        for _,_,name,*_ in props:
            if name!='Station wagon':add(b,104 if name in ['Folded road map','Brass key','Letter','Photograph','Compass'] else 116,name)
        if i==3:add(b,115,'Worn stone stairwell · scenic treatment')
        if i==5:add(b,117,'Coastal greenery · frame edge')
        if i==6:
            add(b,105,'Controlled lantern glow · lighting cue only');add(b,122,'Lighthouse mechanism · static scenic prop');add(b,121,'Optional beam cleanup · demo planning note')
        shot_list=[]
        for j,(size,lens,movement,desc) in enumerate(shot_specs):
            status='Done' if i==2 and j==0 else 'Ready' if i==2 else 'Planned'
            shot={'id':identifier(),'created':STAMP,'sceneId':b['id'],'number':chr(65+j),'description':desc,'size':size,'movement':movement,'camera':chr(65+j),'lens':str(lens),'equipment':'Small dolly' if movement=='Tracking' else 'Tripod','setupMinutes':10+j*5,'shootMinutes':8+j*2,'actualMinutes':20 if status=='Done' else None,'status':status,'takes':3 if status=='Done' else 0,'circleTake':'2' if status=='Done' else '', 'priority':'Essential' if j==0 else 'Preferred','notes':f'FICTIONAL DEMO · The Last Light · scene {n}. '+('Sample completed take data for testing.' if status=='Done' else 'Match action and prop continuity between setups.')}
            all_shots.append(shot)
            shot_list.append({'id':f'last-light-shot-{n}{chr(65+j)}','checked':i==2 and j==0,'day':{1:'Day 3',2:'Day 3',3:'Day 1',4:'Day 1',5:'Day 1',6:'Day 2',7:'Day 2',8:'Unscheduled'}[n],'scene':str(n),'number':str(n)+shot['number'],**{k:str(shot[k]) if shot[k] is not None else '' for k in ['description','size','movement','camera','lens','equipment','setupMinutes','shootMinutes','actualMinutes','status','circleTake','priority','notes']},'takes':str(shot['takes'])})
        def item(id,asset,type,name,x,y,width,height):return {'id':f'last-light-{n}-{id}','asset':asset,'type':type,'name':name,'x':x,'y':y,'width':width*3,'height':height*3,'rotation':0}
        interior=n in (2,4,5,7)
        # Maps are illustrative blocking plans, not surveyed locations or safety plans.
        def wall(id,name,x,y,x2,y2):return {'id':f'last-light-{n}-{id}','type':'wall','name':name,'x':x,'y':y,'x2':x2,'y2':y2,'thickness':13.5}
        objects=[]
        if n in (1,8):
            objects.extend([wall('road-west','Coastal road · west edge',240,60,240,900),wall('road-east','Coastal road · east edge',780,60,780,900)])
        elif n in (3,6):
            tower=item('tower','room-circle','room','Lighthouse exterior · illustrative footprint',820,250,180,180);tower.update(thickness=13.5,keepProportions=True);objects.append(tower)
            objects.append(wall('seawall','Seawall · tide beyond this line',120,620,1000,620))
        else:
            floor=item('floor','room-circle' if n in (4,5,7) else 'room-rectangle','room','Stairwell' if n==4 else 'Lantern room' if n in (5,7) else 'Vehicle interior · illustrative blocking',540,480,300,280);floor.update(thickness=13.5,keepProportions=False);objects.append(floor)
        if n==4:
            for step in range(6):
                angle=math.pi*.2+step*.22
                objects.append(wall('step-'+str(step),'Stair tread · height not modeled',540+150*math.cos(angle),480+150*math.sin(angle),540+300*math.cos(angle),480+300*math.sin(angle)))
        if n in (5,7):objects.append(item('mechanism','coffee-table','set','Lantern mechanism · planning footprint',700,320,36,36))
        for j,(asset,type,name,x,y,width,height) in enumerate(props):
            if n==6:continue  # The seawall is actual map geometry above.
            objects.append(item('prop-'+str(j),asset,type,name,x,y,width,height))
        for j,char in enumerate(characters):
            x=(430+j*110) if n in (1,2,8) else 420+j*220;y=410 if n in (1,2,8) else 530
            end_x,end_y=(x,y) if n in (1,2,6) else (x+50,y-80)
            if n==8 and char=='ELI':x,y=650,430;end_x,end_y=540,410
            objects.append({'id':f'last-light-{n}-{char.lower()}','type':'actor','name':char.title()+' · fictional adult','x':x,'y':y,'rotation':-90,'color':['#cf7d96','#7b9cc9'][j%2],'marks':[{'x':x,'y':y,'rotation':-90,'notes':'Start · '+description},{'x':end_x,'y':end_y,'rotation':-70,'notes':'End · '+description}],'showRoute':True,'pathDuration':8})
        for j,s in enumerate(shot_list):
            lens=int(s['lens']);objects.append({'id':f'last-light-{n}-camera-{j}','type':'camera','name':f'Camera {s["camera"]} · {s["number"]}','x':330+j*420,'y':800,'rotation':-70-j*40,'lens':lens,'fov':2*math.atan(36/(2*lens))*180/math.pi,'sensorWidth':36,'viewDistance':800,'shot':s['size'],'height':'Eye level','notes':s['description'],'shotId':s['id']})
        for camera in [o for o in objects if o['type']=='camera']:
            linked=next(shot for shot in shot_list if shot['id']==camera['shotId'])
            if linked['movement']!='Static':
                camera.update(marks=[{'x':camera['x'],'y':camera['y'],'rotation':camera['rotation'],'notes':'Start · '+linked['description']},{'x':camera['x']+80 if linked['movement']=='Tracking' else camera['x'],'y':camera['y'],'rotation':camera['rotation']+20 if linked['movement']=='Pan' else camera['rotation'],'notes':'End · illustrative '+linked['movement'].lower()+' preview; tilt height is not modeled'}],showRoute=True,pathDuration=8)
        objects.append({'id':f'last-light-{n}-fill','asset':'led-panel','type':'light','name':'Lantern practical' if n==7 else 'Soft fill · demo fixture','x':540,'y':210,'rotation':90,'power':65 if interior else 35,'temperature':2800 if n==7 else 5600,'beam':110,'radius':700,'enabled':True})
        scenic_scenes.append({'id':f'last-light-scene-{n}','title':b['_scriptText'].splitlines()[0].split(' ',1)[1],'subtitle':next(e['name'] for e in p['elements'] if e['id'] in b['elements'] and e['category']==p['categories'][0]['id']).title()+' · '+next(e['name'] for e in p['elements'] if e['id'] in b['elements'] and e['category']==p['categories'][2]['id']),'ambient':25 if n in (7,8) else 45,'notes':'FICTIONAL DEMO — THE LAST LIGHT\nOriginal Production Desk screenplay. All characters are fictional adults.\nLocation: '+location+' (fictional).\n\n'+b['_scriptText']+'\n\nDEMO NOTES\n'+description+'\nBlocking, equipment, dates and take data are illustrative testing examples. Use Play scene; inspect camera links, lenses, lighting and shot coverage. Export updated shots from Production Desk and import the CSV here to update matching scene/shot numbers without replacing maps. No automatic sync.','shotList':shot_list,'objects':objects})
    cast=[e for e in p['elements'] if e['category']==next(c['id'] for c in p['categories'] if c['ucid']==100)]
    for e in cast:e['daysOff']=[0,6];e['isIdLock']=True
    cast[0]['linkedElements']=[cast[1]['id']]
    cast[-1]['events']=[{'id':identifier(),'type':'dayOff','date':'2026-11-04T12:00:00.000Z','name':'Fictional availability exception'}]
    banners=[]
    for title in ['PREP · continuity / safe blocking check','MEAL · sample schedule banner','WRAP · save files and reset props']:
        banner=copy.deepcopy(scenes[0]);banner.update(id=identifier(),type='banner',bannerText=title,scene=None,description=None,comments=None,pages=None,duration=None,scriptPage=None,elements=[],_scriptText='');banners.append(banner)
    p['breakdowns']=[*scenes,*banners]
    cal=p['calendars'][0];cal['events']=[{'id':identifier(),'type':'start','date':STAMP,'name':None},{'id':identifier(),'type':'dayOff','date':'2026-11-05T12:00:00.000Z','name':'Fictional turnaround'}]
    ids=[b['id'] for b in scenes];first=p['stripboards'][0];first['name']='Location-first shoot'
    first['boards'][0]['breakdownIds']=[[banners[0]['id'],*ids[2:5],banners[1]['id']],[*ids[5:7],banners[2]['id']],[*ids[:2]]];first['boards'][1]['breakdownIds']=[ids[7]]
    alternate=copy.deepcopy(first);alternate.update(id=identifier(),name='Story-order alternate')
    for board in alternate['boards']:board['id']=identifier()
    alternate['boards'][0]['breakdownIds']=[[banners[0]['id'],*ids[:3]],[*ids[3:6]],[*ids[6:],banners[2]['id']]];alternate['boards'][1]['breakdownIds']=[banners[1]['id']];p['stripboards'].append(alternate)
    p['_shots']=all_shots;p['_shotSettings']={'startTime':'08:00'}
    raw=script_pdf(scenes);digest=hashlib.sha256(raw).hexdigest();marks=[]
    for i in range(8):marks.append({'id':identifier(),'type':'coverage','page':i,'start':[.18,.2],'end':[.18,.58],'color':'#E60026','width':2,'shotId':all_shots[i*2]['id'],'style':'solid' if i%2==0 else 'wavy','note':f'{i+1}A · '+all_shots[i*2]['description']})
    marks.extend([{'id':identifier(),'type':'pen','page':0,'start':[.45,.23],'points':[[.45,.23],[.54,.25],[.59,.24]],'color':'#E60026','width':2},{'id':identifier(),'type':'highlighter','page':4,'start':[.24,.37],'points':[[.24,.37],[.7,.37]],'color':'#E9BF40','width':12},{'id':identifier(),'type':'arrow','page':6,'start':[.72,.52],'end':[.6,.4],'color':'#456FA3','width':2},{'id':identifier(),'type':'text','page':7,'start':[.6,.58],'text':'Continuity: key, map, letter, photograph and compass.','color':'#E60026','width':2}])
    p['_linedScript']={'activePdf':digest,'documents':[{'sha256':digest,'filename':'The Last Light — original demo.pdf','marks':marks}]}
    workspace={'version':1,'activeProject':p['id'],'projects':[p],'_pdfDocuments':{digest:base64.b64encode(raw).decode()}};validate_workspace(workspace)
    scenic={'version':1,'projectId':SCENIC_KEY,'demoKey':SCENIC_KEY,'name':'DEMO · The Last Light','theme':'light','active':scenic_scenes[0]['id'],'scenes':scenic_scenes,'editorSettings':{'grid':True,'snap':True,'simulation':True},'sharedDemo':{'title':'The Last Light','scriptSHA256':source_hash,'revision':1},'portable':{'format':'org.squidproductions.scenic.project','version':1}}
    target=ROOT/'tests/fixtures/demo';target.mkdir(exist_ok=True)
    (target/'the-last-light.productiondesk').write_text(json.dumps({'format':'org.squidproductions.productiondesk.project','formatVersion':1,'workspace':workspace},ensure_ascii=False,indent=2)+'\n')
    (target/'the-last-light.fountain').write_text(script)
    (target/'the-last-light.scenic').write_text(json.dumps(scenic,ensure_ascii=False,indent=2)+'\n')
    spec={'title':'The Last Light','fictional':True,'revision':1,'scriptSHA256':source_hash,'canonicalSource':'windows-src/tests/demo_data.py:DEMO','characters':['MAYA','ELI','JONAH'],'scenes':[{'sceneId':b['id'],'scenicSceneId':ss['id'],'number':b['scene'],'heading':ss['title'],'description':b['description'],'scriptText':b['_scriptText'],'location':SPECS[i][0],'characters':SPECS[i][2],'props':[x[2] for x in SPECS[i][3]],'shots':[dict(shot,number=b['scene']+shot['number']) for shot in all_shots if shot['sceneId']==b['id']]} for i,(b,ss) in enumerate(zip(scenes,scenic_scenes))]}
    (target/'the-last-light-spec.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
    if scenic_root:
        scenic_root=Path(scenic_root)
        module=(scenic_root/'tools/demo-controller.js').read_text().replace('/* GENERATED_FIXTURE */',json.dumps(scenic,ensure_ascii=False,separators=(',',':')))
        (scenic_root/'dist/demo.js').write_text(module)
        (scenic_root/'ios/Resources/web/demo.js').write_text(module)
    print('Built The Last Light: unchanged script, 8 scenes,16 linked shots,2 schedules,3 banners,8 PDF pages,12 marks; paired Scenic maps.')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--scenic-root',type=Path);build(parser.parse_args().scenic_root)
