import copy
import json
import tempfile
from pathlib import Path
import unittest
from film import validate_uss
from project_file import import_project, export_project

class ShotShootingOrderTests(unittest.TestCase):
    def setUp(self):
        self.value=json.loads((Path(__file__).parent/'portable-project.productiondesk').read_text())
        self.project=self.value['workspace']['projects'][0]
    def test_full_portable_roundtrip_retains_distinct_order_and_all_shot_links(self):
        self.project['_shotShootingOrder']=[s['id'] for s in reversed(self.project['_shots'])]
        before=copy.deepcopy(self.value)
        with tempfile.TemporaryDirectory() as sender:
            data=Path(sender)/'workspace.json';workspace=import_project(data,self.value)
            portable=json.loads(export_project(data,workspace))
            self.assertEqual(portable,before)
        # The sender's storage is gone before a clean recipient imports it.
        self.assertFalse(Path(sender).exists())
        with tempfile.TemporaryDirectory() as recipient:
            restored=import_project(Path(recipient)/'workspace.json',portable)
            self.assertEqual(json.loads(export_project(Path(recipient)/'workspace.json',restored)),before)
    def test_invalid_order_shape_rejected_but_old_client_stale_ids_are_supported(self):
        for order in [None,{},'shot',[1],[''],['a','a'],[{}]]:
            self.project['_shotShootingOrder']=order
            with self.subTest(order=order),self.assertRaisesRegex(ValueError,'Shot shooting order'):validate_uss(self.project)
        self.project['_shotShootingOrder']=['deleted-by-old-client'];validate_uss(self.project)
