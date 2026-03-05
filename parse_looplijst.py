import sys
import json
import re
from pathlib import Path
from datetime import datetime
try:
    import pdfplumber
except ImportError:
    print("Error: pdfplumber not installed. Run the setup script first.", file=sys.stderr)
    sys.exit(1)

def format_date(date_str):
    """Convert date to YYYY-MM-DD format, handling both DD-MM-YYYY and YYYY-MM-DD inputs"""
    # Replace O with 0
    cleaned = date_str.replace('O', '0')
    
    # Split by dash
    parts = cleaned.split('-')
    
    if len(parts) != 3:
        return cleaned
    
    # Detect format by checking which part is likely the year
    if len(parts[0]) == 4:
        # Already YYYY-MM-DD format
        year, month, day = parts[0], parts[1], parts[2]
    elif len(parts[2]) == 4:
        # DD-MM-YYYY format
        day, month, year = parts[0], parts[1], parts[2]
    else:
        # Assume DD-MM-YY and convert to 4-digit year
        day = parts[0].zfill(2)
        month = parts[1].zfill(2)
        year = '20' + parts[2].zfill(2)
    
    # Ensure proper padding
    day = day.zfill(2)
    month = month.zfill(2)
    
    return f"{year}-{month}-{day}"

def extract_metadata(text):
    """Extract metadata from PDF text"""
    metadata = {}
   
    # Distribution date
    date_match = re.search(r'<distributiedatum>([^<]+)</distributiedatum>', text)
    if date_match:
        metadata['distribution_date'] = format_date(date_match.group(1))
   
    # Document type
    doctype_match = re.search(r'<doctype>([^<]+)</doctype>', text)
    if doctype_match:
        metadata['document_type'] = doctype_match.group(1)
   
    # Element type and number
    elemtype_match = re.search(r'<elementtype>([^<]+)</elementtype>', text)
    if elemtype_match:
        metadata['element_type'] = elemtype_match.group(1)
   
    elemno_match = re.search(r'<elementno>([^<]+)</elementno>', text)
    if elemno_match:
        metadata['element_number'] = elemno_match.group(1)
   
    # Route code
    route_match = re.search(r'</ronde>\s*\n\s*([0-9O ]+)', text)
    if route_match:
        metadata['route_code'] = route_match.group(1).strip()
   
    # Area name
    area_match = re.search(r'\n([A-Z][A-Z ]+[A-Z])\s+WIJKLIJST', text)
    if area_match:
        metadata['area'] = area_match.group(1).strip()
   
    # Generated timestamp
    gen_match = re.search(r'gegenereerd op ([O0-9-]+ [O0-9:]+)', text)
    if gen_match:
        gen_str = gen_match.group(1).replace('O', '0')
        metadata['generated_on'] = gen_str
   
    # Document number
    doc_match = re.search(r'Doc\.nr\.\s+([0-9.]+)', text)
    if doc_match:
        metadata['document_number'] = doc_match.group(1)
   
    return metadata

def parse_newspaper_summary(text):
    """Parse newspaper summary table"""
    newspapers = []
   
    # Find the table section
    table_start = text.find('Titel Editie Naam')
    complaint_start = text.find('Klacht Datum Product')
   
    if table_start == -1 or complaint_start == -1:
        return newspapers
   
    table_section = text[table_start:complaint_start]
    lines = table_section.split('\n')[1:]
   
    newspaper_codes = ['HDC', 'TEL', 'NRC', 'AD', 'ND', 'HFD', 'TR', 'VK', 'HP', 'KW']
   
    for line in lines:
        line = line.strip()
        if not line or line.startswith('Klacht'):
            continue
       
        for code in newspaper_codes:
            if line.startswith(code):
                parts = line.split()
                if len(parts) >= 8:
                    try:
                        newspapers.append({
                            'code': parts[0],
                            'title': parts[1],
                            'name': ' '.join(parts[2:-6]),
                            'edition': parts[-6].replace('O', '0'),
                            'standard_bundles': int(parts[-5].replace('O', '0')),
                            'loose_copies': int(parts[-4].replace('O', '0')),
                            'subscriber_count': int(parts[-3].replace('O', '0')),
                            'lv_count': int(parts[-2].replace('O', '0')),
                            'leftover_papers': 0,
                            'total_circulation': int(parts[-1].replace('O', '0'))
                        })
                    except (ValueError, IndexError):
                        continue
                break
   
    return newspapers

def parse_complaints(text):
    """Parse complaints section"""
    complaints = []
   
    complaint_start = text.find('Klacht Datum Product')
    route_start = text.find('VONDELWEG')
   
    if complaint_start == -1:
        return complaints
   
    if route_start != -1:
        complaint_section = text[complaint_start:route_start]
    else:
        complaint_section = text[complaint_start:]
   
    lines = complaint_section.split('\n')[1:]
   
    for line in lines:
        line = line.strip()
        if not line or 'VONDELWEG' in line:
            break
       
        parts = line.split()
        if len(parts) >= 5:
            complaint_type = parts[0]
            if complaint_type in ['NIET', 'VERKEERD']:
                try:
                    if parts[1] in ['KRANT', 'VERKEERD']:
                        full_type = f"{parts[0]} {parts[1]}"
                        date_idx = 2
                    else:
                        full_type = parts[0]
                        date_idx = 1
                   
                    date_str = parts[date_idx]
                    product = parts[date_idx + 1]
                    subscription = parts[date_idx + 2]
                   
                    remaining = ' '.join(parts[date_idx + 3:])
                    addr_parts = remaining.split(',')
                    if len(addr_parts) >= 2:
                        address = f"{addr_parts[0]}, {addr_parts[1].split()[0]}"
                        name = ' '.join(addr_parts[1].split()[1:])
                       
                        complaints.append({
                            'type': full_type,
                            'date': format_date(date_str),
                            'product': product,
                            'subscription_type': subscription,
                            'address': address,
                            'name': name
                        })
                except (IndexError, ValueError):
                    continue
   
    return complaints

def parse_delivery_route(text):
    """Parse delivery route with streets and deliveries"""
    delivery_route = []
   
    route_start = text.find('VONDELWEG')
    route_end = text.find('EINDE WIJKLIJST')
   
    if route_start == -1:
        return delivery_route
   
    route_section = text[route_start:route_end if route_end != -1 else len(text)]
    lines = route_section.split('\n')
   
    street_suffixes = ['STRAAT', 'WEG', 'LAAN', 'PLEIN', 'SINGEL', 'GRACHT', 'KADE', 'DIJK', 'PAD']
    newspaper_codes = ['HD', 'TEL', 'VK', 'NRC', 'AD', 'ND', 'HFD', 'TR', 'HP', 'KW']
   
    current_street = None
    current_city = 'HAARLEM'
    deliveries = []
   
    for line in lines:
        line = line.strip()
        if not line:
            continue
       
        if re.match(r'^[0-9O]+[A-Z]?\s+', line):
            parts = line.split()
            if len(parts) >= 2:
                house_number = parts[0].replace('O', '0')
               
                newspaper = None
                name = None
               
                for i, part in enumerate(parts[1:], 1):
                    if part in newspaper_codes:
                        newspaper = part
                        if i > 1:
                            name = ' '.join(parts[1:i])
                        if len(parts) > i + 1:
                            extra = ' '.join(parts[i+1:])
                            if extra and extra != '-':
                                if not name:
                                    name = extra
                        break
               
                if newspaper and current_street:
                    delivery = {
                        'house_number': house_number,
                        'newspaper': newspaper
                    }
                    if name:
                        delivery['name'] = name
                    deliveries.append(delivery)
       
        elif line.isupper() and not any(char.isdigit() for char in line):
            is_street = False
           
            for suffix in street_suffixes:
                if suffix in line:
                    is_street = True
                    break
           
            if is_street or not any(code in line.split() for code in newspaper_codes):
                if current_street and deliveries:
                    delivery_route.append({
                        'street': current_street,
                        'city': current_city,
                        'deliveries': deliveries
                    })
               
                if ',' in line:
                    parts = line.split(',')
                    current_street = parts[0].strip()
                    current_city = parts[1].strip()
                else:
                    current_street = line.strip()
                    current_city = 'HAARLEM'
               
                deliveries = []
   
    if current_street and deliveries:
        delivery_route.append({
            'street': current_street,
            'city': current_city,
            'deliveries': deliveries
        })
   
    return delivery_route

def parse_pdf(pdf_path):
    """Main parsing function"""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            text = ''
           
            for page in pdf.pages:
                page_width = page.width
                page_height = page.height
               
                col_width = page_width / 3
               
                columns_text = []
               
                for i in range(3):
                    x0 = i * col_width
                    x1 = (i + 1) * col_width
                   
                    column = page.crop((x0, 0, x1, page_height))
                    col_text = column.extract_text()
                    if col_text:
                        columns_text.append(col_text)
               
                text += '\n'.join(columns_text) + '\n'
           
            result = {
                'metadata': extract_metadata(text),
                'newspaper_summary': parse_newspaper_summary(text),
                'complaints': parse_complaints(text),
                'delivery_route': parse_delivery_route(text)
            }
           
            return result
   
    except Exception as e:
        print(f"Error parsing PDF: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return None

def main():
    if len(sys.argv) != 2:
        print("Usage: python parse_looplijst.py <pdf_file_path>", file=sys.stderr)
        sys.exit(1)
   
    pdf_path = Path(sys.argv[1])
   
    if not pdf_path.exists():
        print(f"Error: File not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
   
    if not pdf_path.suffix.lower() == '.pdf':
        print(f"Error: Not a PDF file: {pdf_path}", file=sys.stderr)
        sys.exit(1)
   
    print(f"Parsing: {pdf_path}", file=sys.stderr)
   
    result = parse_pdf(pdf_path)
   
    if result:
        json_path = pdf_path.with_suffix('.json')
       
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
       
        print(json_path)
        print(f"✓ Successfully parsed!", file=sys.stderr)
        print(f"✓ Output saved to: {json_path}", file=sys.stderr)
    else:
        print("✗ Failed to parse PDF", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
