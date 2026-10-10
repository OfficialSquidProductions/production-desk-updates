import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from server import extract_pdf


class WindowsPDFTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            import pypdf
        except ImportError:
            raise unittest.SkipTest('Windows PDF dependency is installed by the Windows build')

    def test_windows_pdf_retains_text_and_page_breaks(self):
        from pypdf import PdfReader, PdfWriter
        from test_slate import simple_pdf
        page = PdfReader(io.BytesIO(simple_pdf())).pages[0]
        writer = PdfWriter()
        writer.add_page(page)
        writer.add_page(page)
        output = io.BytesIO()
        writer.write(output)
        with patch('server.sys.platform', 'win32'):
            text = extract_pdf(output.getvalue())
        self.assertEqual(text.count('A kettle whistles.'), 2)
        self.assertEqual(text.count('\f'), 1)

    def test_scanned_and_password_protected_pdf_have_useful_errors(self):
        from pypdf import PdfWriter
        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)
        output = io.BytesIO()
        writer.write(output)
        with patch('server.sys.platform', 'win32'):
            with self.assertRaisesRegex(ValueError, 'no extractable text'):
                extract_pdf(output.getvalue())
            writer.encrypt('secret')
            output = io.BytesIO()
            writer.write(output)
            with self.assertRaisesRegex(ValueError, 'password-protected'):
                extract_pdf(output.getvalue())

    def test_damaged_pdf_is_reported_as_import_error(self):
        with patch('server.sys.platform', 'win32'):
            with self.assertRaisesRegex(ValueError, 'Could not read this PDF'):
                extract_pdf(b'not a PDF')
