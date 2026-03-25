#!/usr/bin/env python3
"""Quick diagnostic: show detected columns and pdftotext layout."""
import sys
from pathlib import Path
from parse_looplijst.extract import extract_text_from_pdf
from parse_looplijst.parsers.route import _detect_columns, _find_route_start

pdf_path = Path(sys.argv[1])
text = extract_text_from_pdf(pdf_path)

start = _find_route_start(text)
bounds = _detect_columns(text, start)

print("=== Detected columns ===")
for i, (lo, hi) in enumerate(bounds):
    print(f"  col{i}: chars {lo}-{hi}")
print(f"  route_start: line {start}")

print("\n=== First 60 lines raw ===")
for i, line in enumerate(text.splitlines()[:60]):
    marker = ' <<< START' if i == start else ''
    print(f"{i:3d} [{len(line):3d}] {line}{marker}")
