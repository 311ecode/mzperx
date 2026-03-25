#!/usr/bin/env python3
"""Quick diagnostic: show detected columns and pdftotext layout."""
import sys
from pathlib import Path
from parse_looplijst.extract import extract_text_from_pdf
from parse_looplijst.parsers.route import _detect_columns

pdf_path = Path(sys.argv[1])
text = extract_text_from_pdf(pdf_path)

print("=== Detected columns ===")
bounds = _detect_columns(text)
for i, (lo, hi) in enumerate(bounds):
    print(f"  col{i}: chars {lo}-{hi}")

print("\n=== First 50 lines raw ===")
for i, line in enumerate(text.splitlines()[:50]):
    print(f"{i:3d} [{len(line):3d}] {line}")
