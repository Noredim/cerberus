import re

with open('c:\\cerberus\\apps\\web\\src\\modules\\opportunity_kits\\OpportunityKitForm.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'Custos de Instala' in line:
        print(f"Line {i+1}: {line.strip()}")
        
    if 'Custos Operacionais Mensais' in line:
        print(f"Line {i+1}: {line.strip()}")
