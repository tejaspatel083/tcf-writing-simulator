import urllib.request
import json
import re
import os
import sys
import ssl

BASE_URL = "https://www.formation-tcfcanada.com/epreuve/expression-ecrite/sujets-actualites"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
}

# Create SSL context that bypasses local OS certificate chain issues
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

def fetch_url(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=20) as resp:
            return resp.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return None

def extract_month_links():
    html = fetch_url(BASE_URL)
    if not html:
        return []
    
    matches = re.findall(r'href="(/epreuve/expression-ecrite/sujets-actualites/[a-z0-9-]+)"', html)
    month_links = []
    for m in set(matches):
        if 'favoris' in m or m.endswith('/sujets-actualites'):
            continue
        month_links.append(m)
    return month_links

def extract_month_data(html):
    pos = html.find('monthData')
    if pos == -1:
        return None
    
    brace_idx = html.find('{', pos)
    if brace_idx == -1:
        return None
    
    depth = 0
    end_idx = brace_idx
    in_string = False
    escape = False
    
    for i in range(brace_idx, len(html)):
        char = html[i]
        if escape:
            escape = False
            continue
        if char == '\\':
            escape = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if not in_string:
            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    end_idx = i + 1
                    break
                    
    raw_json_str = html[brace_idx:end_idx]
    try:
        return json.loads(raw_json_str)
    except Exception as e:
        cleaned = re.sub(r',\s*}', '}', raw_json_str)
        cleaned = re.sub(r',\s*]', ']', cleaned)
        try:
            return json.loads(cleaned)
        except Exception as e2:
            print(f"JSON parsing error: {e2}", file=sys.stderr)
            return None

def clean_html_text(text):
    if not text:
        return ""
    text = re.sub(r'</?(p|div|br|li|h\d)[^>]*>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = text.replace('&nbsp;', ' ').replace('&rsquo;', "'").replace('&lsquo;', "'")
    text = text.replace('&ldquo;', '"').replace('&rdquo;', '"').replace('&laquo;', '«').replace('&raquo;', '»')
    text = text.replace('&amp;', '&').replace('&eacute;', 'é').replace('&egrave;', 'è').replace('&ecirc;', 'ê')
    text = text.replace('&agrave;', 'à').replace('&acirc;', 'â').replace('&ocirc;', 'ô').replace('&icirc;', 'î')
    text = text.replace('&ucirc;', 'û').replace('&ccedil;', 'ç').replace('&#39;', "'").replace('&quot;', '"')
    lines = [l.strip() for l in text.split('\n')]
    cleaned_lines = []
    prev_empty = False
    for l in lines:
        if not l:
            if not prev_empty:
                cleaned_lines.append("")
                prev_empty = True
        else:
            cleaned_lines.append(l)
            prev_empty = False
    return '\n'.join(cleaned_lines).strip()

def parse_task(task_obj):
    if not task_obj:
        return None
    instruction = ""
    for field in ['consigne', 'instruction', 'sujet', 'content', 'description']:
        if field in task_obj and task_obj[field]:
            instruction = clean_html_text(task_obj[field])
            break
            
    doc1 = ""
    for field in ['document1', 'doc1', 'text1', 'source1']:
        if field in task_obj and task_obj[field]:
            doc1 = clean_html_text(task_obj[field])
            break
            
    doc2 = ""
    for field in ['document2', 'doc2', 'text2', 'source2']:
        if field in task_obj and task_obj[field]:
            doc2 = clean_html_text(task_obj[field])
            break
            
    return {
        "instruction": instruction,
        "document1": doc1 if doc1 else None,
        "document2": doc2 if doc2 else None
    }

def normalize_month_name(month_str):
    if not month_str:
        return "Janvier"
    month_str = month_str.strip().capitalize()
    mapping = {
        "Fevrier": "Février",
        "Février": "Février",
        "Fvrier": "Février",
        "Aout": "Août",
        "Août": "Août",
        "Aot": "Août",
        "Decembre": "Décembre",
        "Décembre": "Décembre"
    }
    return mapping.get(month_str, month_str)

def main():
    output_dir = os.path.join(os.path.dirname(__file__), "..", "src", "data")
    output_file = os.path.join(output_dir, "questions.json")
    
    # 1. Load existing database to ensure we NEVER lose previously scraped questions
    structured_db = {}
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                structured_db = json.load(f)
            print(f"Loaded existing database with years: {list(structured_db.keys())}")
        except Exception as e:
            print(f"Warning: could not read existing {output_file}: {e}")
            structured_db = {}

    print("Fetching main page to discover available months...")
    links = extract_month_links()
    print(f"Found {len(links)} dynamic month links from main page.")
    
    french_months_slugs = [
        "janvier", "fevrier", "fvrier", "mars", "avril", "mai", "juin",
        "juillet", "aout", "aot", "septembre", "octobre", "novembre", "decembre"
    ]
    years_to_check = [2024, 2025, 2026, 2027, 2028]
    
    generated_slugs = []
    for y in years_to_check:
        for m in french_months_slugs:
            generated_slugs.append(f"{m}-{y}")
            generated_slugs.append(m)
            
    all_links = set(links)
    for slug in generated_slugs:
        all_links.add(f"/epreuve/expression-ecrite/sujets-actualites/{slug}")
        
    found_any_new = False
    
    for link in sorted(all_links):
        url = f"https://www.formation-tcfcanada.com{link}"
        html = fetch_url(url)
        if not html:
            continue
            
        mdata = extract_month_data(html)
        if not mdata:
            continue
            
        raw_month = mdata.get('name', '').strip()
        year = mdata.get('year')
        
        if not year or not raw_month:
            slug = link.split('/')[-1]
            parts = slug.split('-')
            if len(parts) >= 2 and parts[-1].isdigit():
                year = int(parts[-1])
                raw_month = parts[0].capitalize()
        
        year_str = str(year) if year else "2026"
        month_name = normalize_month_name(raw_month)
        
        combos_list = mdata.get('combinaisons', [])
        if not combos_list:
            continue
            
        if year_str not in structured_db:
            structured_db[year_str] = {}
            
        parsed_combos = []
        for idx, c in enumerate(combos_list, start=1):
            t1 = parse_task(c.get('tache1'))
            t2 = parse_task(c.get('tache2'))
            t3 = parse_task(c.get('tache3'))
            
            task1 = {
                "instruction": t1.get("instruction") if t1 else "",
                "minWords": 60,
                "maxWords": 120
            }
            
            task2 = {
                "instruction": t2.get("instruction") if t2 else "",
                "minWords": 120,
                "maxWords": 150
            }
            
            task3 = {
                "instruction": t3.get("instruction") if t3 else "",
                "minWords": 120,
                "maxWords": 180
            }
            if t3 and t3.get("document1"):
                task3["document1"] = t3["document1"]
            if t3 and t3.get("document2"):
                task3["document2"] = t3["document2"]
                
            parsed_combos.append({
                "combination": c.get("id") or idx,
                "combinationNumber": idx,
                "tasks": {
                    "task1": task1,
                    "task2": task2,
                    "task3": task3
                }
            })
            
        if parsed_combos:
            # Check if this month has more combinations or is new
            existing_count = len(structured_db[year_str].get(month_name, []))
            if len(parsed_combos) > existing_count or month_name not in structured_db[year_str]:
                structured_db[year_str][month_name] = parsed_combos
                print(f"  [UPDATED] {month_name} {year_str}: {len(parsed_combos)} combinations (was {existing_count})")
                found_any_new = True

    if found_any_new:
        os.makedirs(output_dir, exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(structured_db, f, ensure_ascii=False, indent=2)
        print(f"Successfully updated database at {output_file}")
    else:
        print("Database is already up to date. No new topics found.")

if __name__ == '__main__':
    main()
