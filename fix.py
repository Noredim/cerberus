import sys
import re

with open('C:/cerberus/diff_sales.txt', 'r', encoding='utf-16le') as f:
    sales = f.read()

with open('C:/cerberus/diff_opp.txt', 'r', encoding='utf-16le') as f:
    opp = f.read()

def fix_content(content):
    # Instead of string replace, we can try to do the byte trick line by line
    lines = content.split('\n')
    fixed_lines = []
    for line in lines:
        try:
            # If the line has the mojibake, encoding it as cp1252 and decoding as utf-8 works for pure mojibake
            if 'Ã' in line or 'Â' in line or 'â' in line:
                # We have to be careful not to encode actual valid characters if mixed.
                # Let's just use replace dictionary for common words.
                pass
        except:
            pass

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
        'M?dia': 'Média',
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
        'Ã': 'í',  # Sometimes 'í' becomes 'Ã' with another invisible char, we'll fix what we can
    }
    
    for k, v in replacements.items():
        content = content.replace(k, v)
    return content

with open('C:/cerberus/diff_sales.patch', 'w', encoding='utf-8') as f:
    f.write(fix_content(sales))

with open('C:/cerberus/diff_opp.patch', 'w', encoding='utf-8') as f:
    f.write(fix_content(opp))
