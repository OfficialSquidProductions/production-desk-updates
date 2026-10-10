import copy
import json
from pathlib import Path
import tempfile
import unittest
from film import import_script, parse_heading, parse_script, validate_uss, empty_project
from server import atomic_save, demo_workspace, extract_pdf

FDX = '''<?xml version="1.0"?><FinalDraft><Content>
<Paragraph Type="Scene Heading" Number="12A"><Text>INT. KITCHEN - NIGHT</Text></Paragraph>
<Paragraph Type="Action"><Text>A brass </Text><Text>key glints.</Text></Paragraph>
<Paragraph Type="Character"><Text>MAYA (O.S.)</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>Where are you?</Text></Paragraph>
<Paragraph Type="Scene Heading" Number="13"><Text>EXT. GARDEN - DAWN</Text></Paragraph>
<Paragraph Type="Character"><Text>MAYA</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>There you are.</Text></Paragraph>
</Content></FinalDraft>'''

def simple_pdf():
    text = b'BT /F1 12 Tf 50 700 Td (INT. KITCHEN - DAY) Tj 0 -24 Td (A kettle whistles.) Tj 0 -24 Td (MAYA) Tj 0 -24 Td (We are late.) Tj ET'
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>',
               b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
               b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
               b'<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
               b'<< /Length '+str(len(text)).encode()+b' >>\nstream\n'+text+b'\nendstream']
    data = b'%PDF-1.4\n'; offsets = [0]
    for i, obj in enumerate(objects,1):
        offsets.append(len(data)); data += str(i).encode()+b' 0 obj\n'+obj+b'\nendobj\n'
    start = len(data)
    data += b'xref\n0 6\n0000000000 65535 f \n'
    data += b''.join(('%010d 00000 n \n'%o).encode() for o in offsets[1:])
    return data+b'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+str(start).encode()+b'\n%%EOF'

class ImportTests(unittest.TestCase):
    def test_final_draft_numbers_cast_and_formatted_runs(self):
        p = import_script(FDX,'Test.fdx'); validate_uss(p)
        self.assertEqual([b['scene'] for b in p['breakdowns']], ['12A','13'])
        castcat = next(c for c in p['categories'] if c['ucid']==100)
        cast = [e for e in p['elements'] if e['category']==castcat['id']]
        self.assertEqual([e['name'] for e in cast], ['MAYA'])
        self.assertIn('A brass key glints.',p['breakdowns'][0]['_scriptText'])
        self.assertEqual(cast[0]['elementId'],'1')
    def test_pdfkit_extract_and_parse(self):
        text = extract_pdf(simple_pdf())
        p=import_script(text,'Test.pdf'); validate_uss(p)
        self.assertEqual(len(p['breakdowns']),1)
        self.assertIn('A kettle whistles.',p['breakdowns'][0]['_scriptText'])
    def test_fountain_numbers_and_combined_heading(self):
        self.assertEqual(parse_heading('INT./EXT. CAR - NIGHT #2B#'),('2B','I/E','CAR','Night'))
        self.assertEqual(parse_heading('12 EXT. ROAD - DAY 12'),('12','EXT','ROAD','Day'))
    def test_pdf_page_markers(self):
        scenes=parse_script('INT. ROOM - DAY\nAction.\n\f\nEXT. BEACH - DUSK\nAction.')
        self.assertEqual([s['startPage'] for s in scenes],['1','2'])
    def test_missing_headings_rejected(self):
        with self.assertRaisesRegex(ValueError,'No scene headings'): parse_script('No scene headings here')
    def test_bad_final_draft_rejected(self):
        with self.assertRaisesRegex(ValueError,'valid XML'): parse_script('<FinalDraft>',True)
    def test_xml_entities_rejected(self):
        with self.assertRaisesRegex(ValueError,'entities'): parse_script('<!DOCTYPE x [<!ENTITY x "bad">]><FinalDraft/>',True)

class StandardTests(unittest.TestCase):
    def setUp(self): self.project=demo_workspace()['projects'][0]
    def test_valid_schedule_and_round_trip(self):
        self.assertIs(validate_uss(self.project),self.project)
        p=json.loads(json.dumps({'universalScheduleStandard':self.project}))['universalScheduleStandard']
        validate_uss(p)
        self.assertEqual(p['stripboards'],self.project['stripboards'])
        self.assertEqual(p['breakdowns'][0]['pages'],.375)
        self.assertEqual(p['breakdowns'][0]['duration'],3600000)
    def test_required_keys_and_categories(self):
        self.assertEqual(next(c['ucid'] for c in self.project['categories'] if c['name']=='Props'),104)
        self.assertEqual(set(self.project['breakdowns'][0]) & {'id','bannerText','comments','created','description','elements','pages','scene','scriptPage','duration','type'}, {'id','bannerText','comments','created','description','elements','pages','scene','scriptPage','duration','type'})
    def test_duplicate_ids_rejected(self):
        self.project['elements'][1]['id']=self.project['elements'][0]['id']
        with self.assertRaisesRegex(ValueError,'Duplicate'): validate_uss(self.project)
    def test_broken_element_link_rejected(self):
        self.project['breakdowns'][0]['elements'].append('missing')
        with self.assertRaisesRegex(ValueError,'unknown element'): validate_uss(self.project)
    def test_missing_breakdown_in_scenario_rejected(self):
        self.project['stripboards'][0]['boards'][1]['breakdownIds'].pop()
        with self.assertRaisesRegex(ValueError,'every breakdown'): validate_uss(self.project)
    def test_duplicate_strip_rejected(self):
        self.project['stripboards'][0]['boards'][1]['breakdownIds'].append(self.project['breakdowns'][0]['id'])
        with self.assertRaisesRegex(ValueError,'exactly once'): validate_uss(self.project)
    def test_wrong_numeric_type_rejected(self):
        self.project['breakdowns'][0]['pages']='3/8'
        with self.assertRaisesRegex(ValueError,'nonnegative number'): validate_uss(self.project)
    def test_calendar_links_and_weekdays(self):
        self.project['calendars'][0]['daysOff']=[7]
        with self.assertRaisesRegex(ValueError,'weekdays'): validate_uss(self.project)
    def test_unknown_version_rejected(self):
        self.project['ussVersion']='2.0.0'
        with self.assertRaisesRegex(ValueError,'supports USS'): validate_uss(self.project)
    def test_breakdown_only(self):
        p=empty_project();p.pop('stripboards');p.pop('calendars');validate_uss(p)
        self.assertEqual(p['stripboards'],[])
    def test_strip_colors_survive_round_trip(self):
        self.project['breakdowns'][0]['_stripColor']='#E60026'
        restored=json.loads(json.dumps(self.project));validate_uss(restored)
        self.assertEqual(restored['breakdowns'][0]['_stripColor'],'#E60026')
    def test_invalid_strip_colors_rejected(self):
        for value in ['red', '#123', '#ZZ0000', 'url(https://example.com)', 123]:
            with self.subTest(value=value):
                self.project['breakdowns'][0]['_stripColor']=value
                with self.assertRaisesRegex(ValueError,'Strip color'):validate_uss(self.project)
    def test_automatic_strip_color_is_valid(self):
        self.project['breakdowns'][0]['_stripColor']=None
        validate_uss(self.project)
    def test_unknown_extensions_preserved(self):
        self.project['_vendor']={'setting':'value'};validate_uss(self.project)
        self.assertEqual(self.project['_vendor'],{'setting':'value'})

class ShotTests(unittest.TestCase):
    def setUp(self):
        self.project=demo_workspace()['projects'][0]
        self.shot={'id':'shot-1','sceneId':self.project['breakdowns'][0]['id'], 'number':'A','description':'Wide master','size':'Wide','movement':'Static','camera':'A','lens':'35','equipment':'Tripod','notes':'Keep the horizon level','circleTake':'2','priority':'Essential','status':'Done','setupMinutes':10,'shootMinutes':15,'actualMinutes':28,'takes':3}
        self.project['_shots']=[self.shot]
        self.project['_shotSettings']={'startTime':'07:30'}
    def test_shots_survive_disk_backup_round_trip(self):
        validate_uss(self.project)
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'backup.json';atomic_save(path,self.project)
            restored=json.loads(path.read_text(encoding='utf-8'));validate_uss(restored)
            self.assertEqual(restored['_shots'],[self.shot])
    def test_shots_follow_scene_id_across_days(self):
        scenario=self.project['stripboards'][0]
        bid=self.shot['sceneId']
        scenario['boards'][1]['breakdownIds'].remove(bid)
        scenario['boards'][0]['breakdownIds'][0].append(bid)
        validate_uss(self.project)
        self.assertEqual(self.project['_shots'][0]['sceneId'],bid)
    def test_orphan_shot_is_rejected(self):
        self.shot['sceneId']='missing'
        with self.assertRaisesRegex(ValueError,'unknown scene'):validate_uss(self.project)
    def test_banner_cannot_own_shots(self):
        self.project['breakdowns'][0]['type']='banner'
        with self.assertRaisesRegex(ValueError,'unknown scene'):validate_uss(self.project)
    def test_duplicate_shot_numbers_rejected(self):
        self.project['_shots'].append(dict(self.shot,id='shot-2',number='a'))
        with self.assertRaisesRegex(ValueError,'Duplicate shot number'):validate_uss(self.project)
    def test_different_scenes_can_reuse_a_suffix(self):
        self.project['_shots'].append(dict(self.shot,id='shot-2',sceneId=self.project['breakdowns'][1]['id']))
        validate_uss(self.project)
    def test_invalid_times_never_save(self):
        for value in [-1,float('inf'),float('nan'),1.5,'20',True,1441]:
            with self.subTest(value=value):
                self.shot['setupMinutes']=value
                with self.assertRaisesRegex(ValueError,'whole number'):validate_uss(self.project)
    def test_unreported_actual_time_is_preserved(self):
        self.shot['actualMinutes']=None
        validate_uss(self.project)
        self.assertIsNone(self.project['_shots'][0]['actualMinutes'])
    def test_invalid_status_and_start_time(self):
        self.shot['status']='Bogus'
        with self.assertRaisesRegex(ValueError,'status'):validate_uss(self.project)
        self.shot['status']='Planned';self.project['_shotSettings']['startTime']='24:60'
        with self.assertRaisesRegex(ValueError,'HH:MM'):validate_uss(self.project)

class PersistenceTests(unittest.TestCase):
    def test_atomic_save_keeps_previous_and_unicode(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'workspace.json'
            atomic_save(path,{'title':'First'})
            atomic_save(path,{'title':'Café — draft two'})
            self.assertEqual(json.loads(path.read_text(encoding='utf-8'))['title'],'Café — draft two')
            self.assertEqual(json.loads(path.with_suffix('.previous.json').read_text(encoding='utf-8'))['title'],'First')
            self.assertEqual(list(Path(directory).glob('*.tmp')),[])
    def test_nonfinite_json_never_overwrites_good_data(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'workspace.json';atomic_save(path,{'ok':True})
            with self.assertRaises(ValueError): atomic_save(path,{'pages':float('nan')})
            self.assertEqual(json.loads(path.read_text(encoding='utf-8')),{'ok':True})

if __name__=='__main__': unittest.main()
