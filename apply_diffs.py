# -*- coding: utf-8 -*-
import codecs

def fix_diff(filename_in, filename_out):
    with open(filename_in, 'r', encoding='utf-16le') as f:
        content = f.read()

    replacements = {
        'Ã§Ã£': 'çã',
        'Ã§Ãµ': 'çõ',
        'Ã§': 'ç',
        'Ã£': 'ã',
        'Ã©': 'é',
        'Ã¡': 'á',
        'Ã³': 'ó',
        'Ã­': 'í',
        'Ãª': 'ê',
        'Ãµ': 'õ',
        'Ã¢': 'â',
        'Ã‡': 'Ç',
        'Ã‰': 'É',
        'Ã€': 'À',
        'Ã”': 'Ô',
        'MǸdia': 'Média',
        'Informaes': 'Informações',
        'Clculo': 'Cálculo',
        'Simultneo': 'Simultâneo',
        'Locao': 'Locação',
        'Instalao': 'Instalação',
        'Comisso': 'Comissão',
        'Ao': 'Ação',
        'Demonstrao': 'Demonstração',
        'â€”': '—',
        'â€¢': '•',
        'Ãº': 'ú',
        'Ã': 'í',
    }
    
    for k, v in replacements.items():
        content = content.replace(k, v)

    with open(filename_out, 'w', encoding='utf-8') as f:
        f.write(content)

fix_diff('C:/cerberus/diff_sales.txt', 'C:/cerberus/diff_sales.patch')
fix_diff('C:/cerberus/diff_opp.txt', 'C:/cerberus/diff_opp.patch')
print('Patches generated')
