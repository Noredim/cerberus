# -*- coding: utf-8 -*-
import codecs

def fix_diff(filename_in, filename_out):
    with open(filename_in, 'r', encoding='utf-8') as f:
        content = f.read()

    replacements = {
        '├í': 'á',
        '├ó': 'â',
        '├º': 'ç',
        '├ú': 'ã',
        '├¬': 'ê',
        '├¡': 'í',
        '├│': 'ó',
        '├Á': 'õ',
        '├í': 'á',
        '├©': 'é',
        'ÔÇö': '—',
        'ÔÇó': '•',
        'ÔòÉ': '═',
        '├': 'Ã', # fallback maybe? Let's not do single character fallback unless necessary
    }
    
    for k, v in replacements.items():
        if len(k) > 1:
            content = content.replace(k, v)

    with open(filename_out, 'w', encoding='utf-8') as f:
        f.write(content)

fix_diff('C:/cerberus/diff_sales.patch', 'C:/cerberus/diff_sales_fixed.patch')
fix_diff('C:/cerberus/diff_opp.patch', 'C:/cerberus/diff_opp_fixed.patch')
print('Fixed patches generated')
