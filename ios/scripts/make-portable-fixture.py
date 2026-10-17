"""Generate fictional cross-platform data with every persisted extension."""
import copy
import json
from pathlib import Path
import sys
import tempfile
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'ProductionDesk-Desktop'))
from server import demo_workspace
from lined import store_pdf
from project_file import export_project
root = Path(__file__).resolve().parents[2]
w = demo_workspace(); p = w['projects'][0]
p.update(author='Fictional Writer', company='Test Studio', description='Transfer test — café', episode='2', episodeName='The return', season='1', schedColor='Blue', schedDate='2026-10-17', scriptColor='White', scriptDate='2026-10-16', _sourceScript={'filename':'Original.fountain','text':'Title: Transfer test\n\nINT. ROOM - DAY\n\n<not executable>\n\nMAYA\nHello.'}, _shotSettings={'startTime':'08:45'}, _customExtension={'preserve':[None,True,4,{'label':'untouched'}]})
p['breakdowns'][0].update(_stripColor='#7953AD', comments='Scene note', _completed=True, _needsReview=False)
p['_shots']=[{'id':'fixture-shot','sceneId':p['breakdowns'][0]['id'],'number':'A','description':'Wide master','size':'Wide','movement':'Push in','camera':'A','lens':'35','equipment':'Dolly','notes':'Take note','circleTake':'2','priority':'Essential','status':'Done','setupMinutes':10,'shootMinutes':15,'actualMinutes':28,'takes':3}]
scenario=copy.deepcopy(p['stripboards'][0]);scenario['id']='alternate';scenario['name']='Rain plan'
for i,board in enumerate(scenario['boards']):board['id']='alternate-board-'+str(i)
p['stripboards'].append(scenario)
with tempfile.TemporaryDirectory() as directory:
 datafile=Path(directory)/'workspace.json'
 document=store_pdf(datafile,(root/'ProductionDesk-Desktop/tests/lined-script.pdf').read_bytes(),'Original PDF.pdf')
 document['marks']=[{'id':'fixture-mark','type':'coverage','page':0,'endPage':1,'space':'document','start':[.2,.3],'end':[.2,.8],'color':'#E60026','width':2,'shotId':'fixture-shot','style':'wavy','note':'Cue note'}, {'id':'fixture-note','type':'text','page':1,'start':[.3,.4],'color':'#E60026','width':2,'text':'Keep this note'}]
 p['_linedScript']={'activePdf':document['sha256'],'documents':[document]}
 raw=export_project(datafile,w)
 destination=root/'ProductionDesk-iOS/ProductionDeskTests/Fixtures/portable-desktop.productiondesk'
 destination.write_bytes(raw)
 (root/'evidence/portable-desktop.productiondesk').write_bytes(raw)
 (root/'ProductionDesk-Desktop/tests/portable-project.productiondesk').write_bytes(raw)
 print(destination)
