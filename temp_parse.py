import json

try:
    with open('apps/api/temp_pyright.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"Total Diagnostics: {len(data.get('generalDiagnostics', []))}")
    for diag in data.get('generalDiagnostics', []):
        msg = diag.get('message', '')
        # Filter for 'round' errors
        if 'round' in msg:
            line = diag['range']['start']['line'] + 1
            print(f"Line {line}: {msg}")
except Exception as e:
    print(f"Error: {e}")
