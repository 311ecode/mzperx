#!/usr/bin/env python3
"""
parse_looplijst.py
Parses a Wijklijst/Looplijst PDF into structured JSON.

Usage:
    python3 parse_looplijst.py <input.pdf> [output.json]

Requirements:
    pip install pdfplumber
    apt install poppler-utils
"""

import sys
import json
from pathlib import Path

from parse_looplijst.extract import extract_text_from_pdf
from parse_looplijst.parsers import (
    extract_metadata,
    parse_newspaper_summary,
    parse_complaints,
    parse_delivery_route,
)


def parse_pdf(pdf_path: Path) -> dict | None:
    try:
        text = extract_text_from_pdf(pdf_path)
    except Exception as e:
        print(f"Error reading PDF: {e}", file=sys.stderr)
        return None

    summary = parse_newspaper_summary(text)

    # Derive newspaper codes from summary for the route parser.
    # Delivery lines use short codes (HD, TEL, VK) while the summary
    # may have longer codes (HDC, HD_MA, MANTEL). We generate all variants:
    newspaper_codes = set()
    for ns in summary:
        newspaper_codes.add(ns['code'])
        newspaper_codes.add(ns['edition'])
        # Strip trailing 'C' from code (HDC -> HD)
        if ns['code'].endswith('C') and len(ns['code']) > 2:
            newspaper_codes.add(ns['code'][:-1])
        # Strip _suffix from edition (HD_MA -> HD, NRC_MA -> NRC)
        if '_' in ns['edition']:
            newspaper_codes.add(ns['edition'].split('_')[0])

    return {
        'metadata':          extract_metadata(text),
        'newspaper_summary': summary,
        'complaints':        parse_complaints(text),
        'delivery_route':    parse_delivery_route(text, newspaper_codes),
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 parse_looplijst.py <input.pdf> [output.json]", file=sys.stderr)
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"Error: file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    if pdf_path.suffix.lower() != '.pdf':
        print(f"Error: not a PDF file: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    json_path = Path(sys.argv[2]) if len(sys.argv) >= 3 else pdf_path.with_suffix('.json')

    print(f"Parsing: {pdf_path}", file=sys.stderr)
    result = parse_pdf(pdf_path)

    if not result:
        print("✗ Failed to parse PDF", file=sys.stderr)
        sys.exit(1)

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    streets    = len(result['delivery_route'])
    deliveries = sum(len(s['deliveries']) for s in result['delivery_route'])
    print(f"✓ {streets} streets, {deliveries} deliveries → {json_path}", file=sys.stderr)
    print(json_path)


if __name__ == '__main__':
    main()
