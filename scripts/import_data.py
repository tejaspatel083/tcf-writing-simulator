import urllib.request
import json
import re
import os
import sys

BASE_URL = "https://www.formation-tcfcanada.com/epreuve/expression-ecrite/sujets-actualites"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
}

def fetch_url(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return None

def extract_month_links():
    html = fetch_url(BASE_URL)
    if not html:
        return []
    
    # Find all month links e.g. href="/epreuve/expression-ecrite/sujets-actualites/janvier-2026"
    # also handle full or relative links
    matches = re.findall(r'href="(/epreuve/expression-ecrite/sujets-actualites/[a-z0-9-]+)"', html)
    # filter out 'favoris' or non-month slugs
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
    
    raw_str = html[brace_idx:end_idx]
    
    # Next.js RSC payload escapes quotes inside strings
    # We replace double-escaped or escaped quotes
    try:
        data = json.loads(raw_str)
        return data
    except Exception:
        pass
    
    # Try cleaning escaped quotes
    cleaned = raw_str.replace('\\"', '"').replace('\\\\', '\\')
    try:
        data = json.loads(cleaned)
        return data
    except Exception as e:
        print(f"Failed to decode JSON: {e}", file=sys.stderr)
        return None

def clean_text(val):
    if not val:
        return ""
    if isinstance(val, dict):
        # Extract texte, sujet, titre, or content
        txt = val.get('texte') or val.get('content') or val.get('sujet') or val.get('titre') or str(val)
        return str(txt).strip()
    if isinstance(val, list):
        return "\n".join([clean_text(item) for item in val]).strip()
    return str(val).strip()

def parse_task(task_obj):
    if not task_obj:
        return None
    
    if isinstance(task_obj, str):
        return {"instruction": clean_text(task_obj)}
    
    instruction = clean_text(task_obj.get('sujet') or task_obj.get('instruction') or task_obj.get('texte') or '')
    
    res = {
        "instruction": instruction
    }
    
    doc1 = task_obj.get('document1') or task_obj.get('doc1') or task_obj.get('texte1')
    doc2 = task_obj.get('document2') or task_obj.get('doc2') or task_obj.get('texte2')
    
    if doc1:
        res["document1"] = clean_text(doc1)
    if doc2:
        res["document2"] = clean_text(doc2)
        
    return res

def normalize_month_name(month_str):
    if not month_str:
        return "Inconnu"
    month_str = re.sub(r'\d+', '', month_str).strip()
    month_str = month_str.capitalize()
    
    mapping = {
        "Fevrier": "Février",
        "Fév": "Février",
        "Fvrier": "Février",
        "Aout": "Août",
        "Aot": "Août",
        "Decembre": "Décembre"
    }
    return mapping.get(month_str, month_str)

def main():
    print("Fetching main page to discover available months...")
    links = extract_month_links()
    print(f"Found {len(links)} dynamic month links from main page.")
    
    # Generate slugs for past, current, and upcoming years
    french_months_slugs = [
        "janvier", "fevrier", "fvrier", "mars", "avril", "mai", "juin",
        "juillet", "aout", "aot", "septembre", "octobre", "novembre", "decembre"
    ]
    years_to_check = [2024, 2025, 2026, 2027, 2028]
    
    generated_slugs = []
    for y in years_to_check:
        for m in french_months_slugs:
            generated_slugs.append(f"{m}-{y}")
            # Also add without year e.g. /avril
            generated_slugs.append(m)
            
    all_links = set(links)
    for slug in generated_slugs:
        all_links.add(f"/epreuve/expression-ecrite/sujets-actualites/{slug}")
        
    structured_db = {}
    
    for link in sorted(all_links):
        url = f"https://www.formation-tcfcanada.com{link}"
        print(f"Scraping {url}...")
        html = fetch_url(url)
        if not html:
            continue
            
        mdata = extract_month_data(html)
        if not mdata:
            print(f"  No monthData found in {link}")
            continue
            
        raw_month = mdata.get('name', '').strip()
        year = mdata.get('year')
        
        if not year or not raw_month:
            # try parsing year and month from slug e.g. /septembre-2026
            slug = link.split('/')[-1]
            parts = slug.split('-')
            if len(parts) >= 2 and parts[-1].isdigit():
                year = int(parts[-1])
                raw_month = parts[0].capitalize()
        
        year_str = str(year) if year else "2026"
        month_name = normalize_month_name(raw_month)
        
        if year_str not in structured_db:
            structured_db[year_str] = {}
            
        if month_name not in structured_db[year_str]:
            structured_db[year_str][month_name] = []
            
        combos_list = mdata.get('combinaisons', [])
        print(f"  Extracted {len(combos_list)} combinaisons for {month_name} {year_str}")
        
        parsed_combos = []
        for idx, c in enumerate(combos_list, start=1):
            t1 = parse_task(c.get('tache1'))
            t2 = parse_task(c.get('tache2'))
            t3 = parse_task(c.get('tache3'))
            
            # Format requirements:
            # task1: minWords 60, maxWords 120
            # task2: minWords 120, maxWords 150
            # task3: minWords 120, maxWords 180
            
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
            if t3 and "document1" in t3:
                task3["document1"] = t3["document1"]
            if t3 and "document2" in t3:
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
            
        structured_db[year_str][month_name] = parsed_combos

    output_dir = os.path.join(os.path.dirname(__file__), "..", "src", "data")
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "questions.json")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(structured_db, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully saved database to {output_file}")

if __name__ == '__main__':
    main()
