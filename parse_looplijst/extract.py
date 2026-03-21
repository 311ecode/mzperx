import subprocess
from pathlib import Path

import pdfplumber


def extract_text_from_pdf(pdf_path: Path) -> str:
    """
    Use pdftotext -layout which preserves spatial column x-positions.
    Falls back to pdfplumber if pdftotext is unavailable.
    """
    try:
        result = subprocess.run(
            ['pdftotext', '-layout', str(pdf_path), '-'],
            capture_output=True, text=True, check=True,
        )
        return result.stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        with pdfplumber.open(pdf_path) as pdf:
            return '\n'.join(page.extract_text() or '' for page in pdf.pages)
