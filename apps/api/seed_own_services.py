import sys
import os

# Add the project root to the sys.path so we can import src
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from src.core.database import SessionLocal
from src.modules.tenants.models import Tenant
from src.modules.companies.models import Company
from src.modules.roles.models import Role
from src.modules.own_services.models import OwnService
from src.modules.own_services.schemas import OwnServiceItemCreate
from src.modules.own_services.router import _calc_consolidated, _build_items

import uuid

def seed_services():
    db = SessionLocal()
    try:
        # Get defaults
        tenant = db.query(Tenant).first()
        company = db.query(Company).first()
        
        if not tenant or not company:
            print("❌ Erro: Tenant ou Company não encontrados no banco.")
            return
        
        # Mapping C0xx to explicit Role Names derived from DB
        role_map = {
            "C004": "ENGENHEIRO ELETRICISTA",
            "C005": "ENGENHEIRO ELETRICISTA DE PROJETOS",
            "C007": "ELETRICISTA PLENO",
            "C008": "TÉCNICO EM TELECOM JR. III",
            "C010": "TÉCNICO DE VIDEOMONITORAMENTO",
            "C011": "AUXILIAR TÉCNICO",
            "C012": "SUPORTE TÉCNICO NÍVEL I",
            "C016": "TÉCNICO EM TELECOM SENIOR",
            "C018": "TÉCNICO EM ELETROTÉCNICA",
            "C019": "ANALISTA DE TI",
            "C020": "AUXILIAR TÉCNICO I",
            "C021": "AUXILIAR TÉCNICO CFTV",
            "C023": "COORDENADORA ADMINISTRATIVA",
            "C025": "SERVENTE",
            "C026": "COORDENADORA DE SUPORTE TÉCNICO"
        }
        
        # Load all roles
        roles = db.query(Role).all()
        # Create an inverted dictionary of name -> id
        role_ids = {r.name: r.id for r in roles}
        
        # Missing check
        missing = []
        for code, name in role_map.items():
            if name not in role_ids:
                missing.append(name)
        if missing:
            print(f"❌ Erro: Os seguintes cargos não foram encontrados no BD: {missing}")
            return
        
        # The payload translates the raw SQL to our standardized schema
        services_data = [
            # 1
            {"nome": "ADMINISTRAÇÃO DA OBRA", "unidade": "Ud", "vigencia": 2026, "items": [
                {"cargo": "C004", "fator": 44},
                {"cargo": "C023", "fator": 100}
            ]},
            # 2
            {"nome": "DOCUMENTAÇÃO FINAL E PROJETO AS BUILT", "unidade": "prancFATORa", "vigencia": 2026, "items": [
                {"cargo": "C005", "fator": 8},
                {"cargo": "C020", "fator": 8}
            ]},
            # 3
            {"nome": "PROJETO EXECUTIVO E DOCUMENTAÇÃO TÉCNICA", "unidade": "prancFATORa", "vigencia": 2026, "items": [
                {"cargo": "C005", "fator": 10},
                {"cargo": "C020", "fator": 10}
            ]},
            # 4
            {"nome": "SERVIÇO DE EMISSÃO DE ART", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C004", "fator": 1},
                {"cargo": "C023", "fator": 0}
            ]},
            # 5
            {"nome": "MONTAGEM DE INFRA EM ELETROCALHA ATÉ 3M", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.5},
                {"cargo": "C020", "fator": 0.5}
            ]},
            # 6
            {"nome": "MONTAGEM DE INFRA EM ELETROCALHA ACIMA 3M", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.75},
                {"cargo": "C020", "fator": 0.75}
            ]},
            # 7
            {"nome": "MONTAGEM DE CANALETA ALUMÍNIO 0,30M", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.4},
                {"cargo": "C020", "fator": 0.4}
            ]},
            # 8
            {"nome": "MONTAGEM DE CANALETA ALUMÍNIO ACIMA 0,30M", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.6},
                {"cargo": "C020", "fator": 0.6}
            ]},
            # 9
            {"nome": "MONTAGEM DE CANALETA PVC 0,30M", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.3},
                {"cargo": "C020", "fator": 0.3}
            ]},
            # 10
            {"nome": "MONTAGEM DE CANALETA PVC ACIMA 0,30M", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.45},
                {"cargo": "C020", "fator": 0.45}
            ]},
            # 11
            {"nome": "MONTAGEM DE ELETRODUTO RÍGIDO PVC ATÉ 3M", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.35},
                {"cargo": "C020", "fator": 0.35}
            ]},
            # 12
            {"nome": "MONTAGEM DE ELETRODUTO RÍGIDO PVC ACIMA 3M", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.52},
                {"cargo": "C020", "fator": 0.52}
            ]},
            # 13
            {"nome": "MONTAGEM ELETRODUTO RÍGIDO ZINCADO ATÉ 3M", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.45},
                {"cargo": "C020", "fator": 0.45}
            ]},
            # 14
            {"nome": "MONTAGEM ELETRODUTO RÍGIDO ZINCADO ACIMA 3M", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.67},
                {"cargo": "C020", "fator": 0.67}
            ]},
            # 15
            {"nome": "MONTAGEM DE ELETRODUTO FLEXÍVEL ATÉ 3M", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.2},
                {"cargo": "C020", "fator": 0.2}
            ]},
            # 16
            {"nome": "MONTAGEM DE ELETRODUTO FLEXÍVEL ACIMA 3M", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.3},
                {"cargo": "C020", "fator": 0.3}
            ]},
            # 17
            {"nome": "MONTAGEM DE QUADRO DE ENERGIA ATÉ 100A", "unidade": "Un.", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 2},
                {"cargo": "C020", "fator": 2}
            ]},
            # 18
            {"nome": "MONTAGEM DE QUADRO DE ENERGIA ATÉ 225A", "unidade": "Un.", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 4},
                {"cargo": "C020", "fator": 4}
            ]},
            # 19
            {"nome": "MONTAGEM DE QUADRO DE ENERGIA ACIMA 225A", "unidade": "Un.", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 6},
                {"cargo": "C020", "fator": 6}
            ]},
            # 20
            {"nome": "INSTALAÇÃO DE DISJUNTOR MONOFÁSICO", "unidade": "pç", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.2},
                {"cargo": "C020", "fator": 0.2}
            ]},
            # 21
            {"nome": "INSTALAÇÃO DE DISJUNTOR BIFÁSICO", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.3},
                {"cargo": "C020", "fator": 0.3}
            ]},
            # 22
            {"nome": "INSTALAÇÃO DE DISJUNTOR TRIFÁSICO", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.4},
                {"cargo": "C020", "fator": 0.4}
            ]},
            # 23
            {"nome": "SERVIÇO DE LANÇAMENTO CABOS ELÉTRICO 2,5 ATÉ 6MM2", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C007", "fator": 0.1},
                {"cargo": "C020", "fator": 0.1}
            ]},
            # 24
            {"nome": "SERVIÇO DE LANÇAMENTO CABOS ELÉTRICO 10 ATÉ 16MM2", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C007", "fator": 0.15},
                {"cargo": "C020", "fator": 0.15}
            ]},
            # 25
            {"nome": "SERVIÇO DE LANÇAMENTO CABOS ELÉTRICO ACIMA DE 16MM2", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C007", "fator": 0.2},
                {"cargo": "C020", "fator": 0.2}
            ]},
            # 26
            {"nome": "SERVIÇO DE MONTAGEM DAS TOMADAS BAIXA ELÉTRICAS", "unidade": "Pt.", "vigencia": 2026, "items": [
                {"cargo": "C007", "fator": 0.5},
                {"cargo": "C020", "fator": 0.5}
            ]},
            # 27
            {"nome": "SERVIÇO DE MONTAGEM DAS TOMADAS ALTA ELÉTRICAS", "unidade": "Pt.", "vigencia": 2026, "items": [
                {"cargo": "C007", "fator": 0.6},
                {"cargo": "C020", "fator": 0.6}
            ]},
            # 28
            {"nome": "SERVIÇO DE MONTAGEM DAS TOMADAS TETO ELÉTRICAS", "unidade": "Pt.", "vigencia": 2026, "items": [
                {"cargo": "C007", "fator": 0.8},
                {"cargo": "C020", "fator": 0.8}
            ]},
            # 29
            {"nome": "SERVIÇO DE INSTALAÇÃO DE LUMINÁRIAS DE EMBUTIR", "unidade": "Pt.", "vigencia": 2026, "items": [
                {"cargo": "C007", "fator": 0.7},
                {"cargo": "C020", "fator": 0.7}
            ]},
            # 30
            {"nome": "SERVIÇO DE INSTALAÇÃO DE LUMINÁRIAS DE SOBREPOR", "unidade": "Pt.", "vigencia": 2026, "items": [
                {"cargo": "C007", "fator": 0.6},
                {"cargo": "C020", "fator": 0.6}
            ]},
            # 31
            {"nome": "SERVIÇO DE INSTALAÇÃO DE REATOR", "unidade": "Pt.", "vigencia": 2026, "items": [
                {"cargo": "C007", "fator": 0.3},
                {"cargo": "C020", "fator": 0.3}
            ]},
            # 32
            {"nome": "INSTALAÇÃO E ORGANIZAÇÃO DOS RACKS DE 6 ATÉ 12U", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 4},
                {"cargo": "C011", "fator": 4}
            ]},
            # 33
            {"nome": "INSTALAÇÃO E ORGANIZAÇÃO RACKS DE 16 ATÉ 36U", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 6},
                {"cargo": "C011", "fator": 6}
            ]},
            # 34
            {"nome": "INSTALAÇÃO E ORGANIZAÇÃO DOS RACKS DE 44U", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 8},
                {"cargo": "C011", "fator": 8}
            ]},
            # 35
            {"nome": "SERVIÇO DE LANÇAMENTO DOS CABOS METÁLICOS", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 0.08},
                {"cargo": "C011", "fator": 0.08}
            ]},
            # 36
            {"nome": "SERVIÇO DE MONTAGEM DE PATCH PANEL 24 PORTAS", "unidade": "pç", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 1},
                {"cargo": "C011", "fator": 1}
            ]},
            # 37
            {"nome": "SERVIÇO DE MONTAGEM DE PATCH PANEL 48 PORTAS", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 2},
                {"cargo": "C011", "fator": 2}
            ]},
            # 38
            {"nome": "CONECTORIZAÇÃO PONTOS LÓGICOS 0,30 ATÉ 1,20M", "unidade": "Pt", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 0.4},
                {"cargo": "C011", "fator": 0.4}
            ]},
            # 39
            {"nome": "CONECTORIZAÇÃO PONTOS LÓGICOS ACIMA DE 1,20M", "unidade": "PL", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 0.6},
                {"cargo": "C011", "fator": 0.6}
            ]},
            # 40
            {"nome": "SERVIÇO DE IDENTIFICAÇÃO DOS PONTOS LÓGICOS", "unidade": "Pt", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 0.1},
                {"cargo": "C011", "fator": 0.1}
            ]},
            # 41
            {"nome": "SERVIÇO DE CERTIFICAÇÃO DOS PONTOS LÓGICOS", "unidade": "Pt", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 0.3},
                {"cargo": "C011", "fator": 0.3}
            ]},
            # 42
            {"nome": "SERVIÇO DE MONTAGEM DE VOICE PANEL 50 PORTAS", "unidade": "pç", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 2},
                {"cargo": "C011", "fator": 2}
            ]},
            # 43
            {"nome": "SERVIÇO DE MONTAGEM DE VOICE PANEL 30 PORTAS", "unidade": "pç", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 1.5},
                {"cargo": "C011", "fator": 1.5}
            ]},
            # 44
            {"nome": "SERVIÇO DE MONTAGEM DE VOICE PANEL 20 PORTAS", "unidade": "P", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 1},
                {"cargo": "C011", "fator": 1}
            ]},
            # 45
            {"nome": "SERVIÇO DE LANÇAMENTO CABO TELEFONICO CCI 2 PARES", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 0.08},
                {"cargo": "C011", "fator": 0.08}
            ]},
            # 46
            {"nome": "SERVIÇO DE LANÇAMENTO CABO TELEFONICO CI ATÉ 50 PARES", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 0.12},
                {"cargo": "C011", "fator": 0.12}
            ]},
            # 47
            {"nome": "SERVIÇO DE LANÇAMENTO CABO TELEFONICO CI ACIMA 50 PARES", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 0.15},
                {"cargo": "C011", "fator": 0.15}
            ]},
            # 48
            {"nome": "LANÇAMENTO CABO TELEFONICO CTP APL ATÉ 50 PARES", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 0.14},
                {"cargo": "C011", "fator": 0.14}
            ]},
            # 49
            {"nome": "LANÇAMENTO CABO TELEFONICO CTP APL ACIMA 50 PARES", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 0.18},
                {"cargo": "C011", "fator": 0.18}
            ]},
            # 50
            {"nome": "SERVIÇO DE INSTALAÇÃO DE TOMADA PADRÃO TELEBRAS", "unidade": "Pt", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 0.4},
                {"cargo": "C011", "fator": 0.4}
            ]},
            # 51
            {"nome": "ORGANIZAÇÃO DOS DG TELEFONIA ATÉ 50 RAMAIS", "unidade": "Un.", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 2},
                {"cargo": "C011", "fator": 2}
            ]},
            # 52
            {"nome": "ORGANIZAÇÃO DG TELEFONIA 51 ATÉ 100 RAMAIS", "unidade": "Un.", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 3},
                {"cargo": "C011", "fator": 3}
            ]},
            # 53
            {"nome": "ORGANIZAÇÃO DOS DG TELEFONIA ACIMA 100 RAMAIS", "unidade": "Un.", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 4},
                {"cargo": "C011", "fator": 4}
            ]},
            # 54
            {"nome": "SERVIÇO DE MONTAGEM BLOCOS DE ENGATE RÁPIDO M10", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C008", "fator": 0.2},
                {"cargo": "C011", "fator": 0.2}
            ]},
            # 55
            {"nome": "INSTALAÇÃO E MONTAGEM DE DIO 24FO", "unidade": "un", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 2},
                {"cargo": "C011", "fator": 2}
            ]},
            # 56
            {"nome": "INSTALAÇÃO E MONTAGEM DE DIO 36FO", "unidade": "pç", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 2.5},
                {"cargo": "C011", "fator": 2.5}
            ]},
            # 57
            {"nome": "INSTALAÇÃO E MONTAGEM DE DIO 48FO", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 3},
                {"cargo": "C011", "fator": 3}
            ]},
            # 58
            {"nome": "INSTALAÇÃO E MONTAGEM DE DIO 72FO", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 4},
                {"cargo": "C011", "fator": 4}
            ]},
            # 59
            {"nome": "INSTALAÇÃO E MONTAGEM DE DIO 144FO", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 6},
                {"cargo": "C011", "fator": 6}
            ]},
            # 60
            {"nome": "INSTALAÇÃO E MONTAGEM DE CAIXA DE EMENDA 12FO", "unidade": "pç", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 1.5},
                {"cargo": "C011", "fator": 1.5}
            ]},
            # 61
            {"nome": "INSTALAÇÃO E MONTAGEM DE CAIXA DE EMENDA 24FO", "unidade": "pç", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 2},
                {"cargo": "C011", "fator": 2}
            ]},
            # 62
            {"nome": "INSTALAÇÃO E MONTAGEM DE CAIXA DE EMENDA 36FO", "unidade": "un", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 2.5},
                {"cargo": "C011", "fator": 2.5}
            ]},
            # 63
            {"nome": "INSTALAÇÃO E MONTAGEM DE CAIXA DE EMENDA 48FO", "unidade": "un", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 3},
                {"cargo": "C011", "fator": 3}
            ]},
            # 64
            {"nome": "INSTALAÇÃO E MONTAGEM DE CAIXA DE EMENDA 144FO", "unidade": "un", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 5},
                {"cargo": "C011", "fator": 5}
            ]},
            # 65
            {"nome": "SERVIÇO DE FUSÃO EM FIBRA OPTICA", "unidade": "un", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 0.6},
                {"cargo": "C011", "fator": 0.6}
            ]},
            # 66
            {"nome": "CERTIFICAÇÃO EM FIBRA OPTICA VIA OTDR", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 1},
                {"cargo": "C026", "fator": 1}
            ]},
            # 67
            {"nome": "MEDIÇÃO EM FIBRA OPTICA VIA POWER METER", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 1},
                {"cargo": "C011", "fator": 1}
            ]},
            # 68
            {"nome": "LANÇAMENTO DE CABOS ÓPTICOS INDOOR/OUTDOOR", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 0.1},
                {"cargo": "C011", "fator": 0.1}
            ]},
            # 69
            {"nome": "LANÇAMENTO DE CABOS ÓPTICOS AUTOSUSTENTADO", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 0.15},
                {"cargo": "C011", "fator": 0.15}
            ]},
            # 70
            {"nome": "SERVIÇO DE LANÇAMENTO DE CORDOALHA", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 0.15},
                {"cargo": "C011", "fator": 0.15}
            ]},
            # 71
            {"nome": "SERVIÇO DE LANÇAMENTO DE CABOS ÓPTICOS ESPINADO", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 0.12},
                {"cargo": "C011", "fator": 0.12}
            ]},
            # 72
            {"nome": "SERVIÇO DE INSTALAÇÃO DE SPLITTER", "unidade": "PL", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 0.5},
                {"cargo": "C011", "fator": 0.5}
            ]},
            # 73
            {"nome": "SERVIÇO DE INSTALAÇÃO DE ROSETA", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 0.4},
                {"cargo": "C011", "fator": 0.4}
            ]},
            # 74
            {"nome": "SERVIÇO DE INSTALAÇÃO DE ONU", "unidade": "PC", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 0.6},
                {"cargo": "C011", "fator": 0.6}
            ]},
            # 75
            {"nome": "SERVIÇO DE INSTALAÇÃO DE OLT", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C016", "fator": 2},
                {"cargo": "C011", "fator": 2}
            ]},
            # 76
            {"nome": "CONFIGURAÇÃO/PROGRAMAÇÃO DE REDE PON", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C019", "fator": 4},
                {"cargo": "C012", "fator": 3.3}
            ]},
            # 77
            {"nome": "SERVIÇO DE INSTALAÇÃO CÂMERAS", "unidade": "PL", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 1.5},
                {"cargo": "C021", "fator": 1.5}
            ]},
            # 78
            {"nome": "SERVIÇO DE INSTALAÇÃO DE NVR", "unidade": "Un.", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 2},
                {"cargo": "C021", "fator": 2}
            ]},
            # 79
            {"nome": "CONFIGURAÇÃO/PROGRAMAÇÃO PARA SISTEMA DE CFTV", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C019", "fator": 2},
                {"cargo": "C012", "fator": 2}
            ]},
            # 80
            {"nome": "MONTAGEM E INSTALAÇÃO DE CAIXA HERMÉTICA", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 1},
                {"cargo": "C021", "fator": 1}
            ]},
            # 81
            {"nome": "LANÇAMENTO CABO FLEXÍVEL MULTIVIAS ACESSO", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 0.1},
                {"cargo": "C021", "fator": 0.1}
            ]},
            # 82
            {"nome": "INSTALAÇÃO PLACA CONTROLADORA ACESSO", "unidade": "pç", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 1.5},
                {"cargo": "C021", "fator": 1.5}
            ]},
            # 83
            {"nome": "INSTALAÇÃO LEITORA DE CONTROLE DE ACESSO", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 1},
                {"cargo": "C021", "fator": 1}
            ]},
            # 84
            {"nome": "INSTALAÇÃO FONTE ININTERRUPTA ACESSO", "unidade": "P", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 1},
                {"cargo": "C021", "fator": 1}
            ]},
            # 85
            {"nome": "MONTAGEM E INSTALAÇÃO FECHADURA MAGNÉTICA", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 1.5},
                {"cargo": "C021", "fator": 1.5}
            ]},
            # 86
            {"nome": "MONTAGEM E INSTALAÇÃO DAS BOTOEIRAS", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 0.5},
                {"cargo": "C021", "fator": 0.5}
            ]},
            # 87
            {"nome": "MONTAGEM E INSTALAÇÃO DE CATRACA", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 4},
                {"cargo": "C021", "fator": 4}
            ]},
            # 88
            {"nome": "MONTAGEM E INSTALAÇÃO DE CANCELA", "unidade": "PC", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 4},
                {"cargo": "C021", "fator": 4}
            ]},
            # 89
            {"nome": "CONFIGURAÇÃO/PROGRAMAÇÃO CONTROLE ACESSO", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C019", "fator": 2},
                {"cargo": "C012", "fator": 2}
            ]},
            # 90
            {"nome": "TREINAMENTO CADASTRO USUÁRIOS ACESSO", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C026", "fator": 2},
                {"cargo": "C023", "fator": 0.96}
            ]},
            # 91
            {"nome": "LANÇAMENTO DE CABO FLEXÍVEL MULTIVIAS PARA ALARME", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 0.1},
                {"cargo": "C021", "fator": 0.1}
            ]},
            # 92
            {"nome": "INSTALAÇÃO E PROGRAMAÇÃO DE CENTRAL DE INTRUSÃO", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 4},
                {"cargo": "C021", "fator": 4}
            ]},
            # 93
            {"nome": "INSTALAÇÃO E ATIVAÇÃO DE SENSORES DE INTRUSÃO", "unidade": "un", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 1},
                {"cargo": "C021", "fator": 1}
            ]},
            # 94
            {"nome": "INSTALAÇÃO E ATIVAÇÃO DE SIRENE INTRUSÃO", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C010", "fator": 0.5},
                {"cargo": "C021", "fator": 0.5}
            ]},
            # 95
            {"nome": "LANÇAMENTO DE CABO BLINDADO PARA INCÊNDIO", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.1},
                {"cargo": "C020", "fator": 0.1}
            ]},
            # 96
            {"nome": "INSTALAÇÃO E ATIVAÇÃO DE SENSORES DE INCÊNDIO", "unidade": "pç", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 1},
                {"cargo": "C020", "fator": 1}
            ]},
            # 97
            {"nome": "INSTALAÇÃO E ATIVAÇÃO DE ACIONADORES DE INCÊNDIO", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 1},
                {"cargo": "C020", "fator": 1}
            ]},
            # 98
            {"nome": "INSTALAÇÃO E ATIVAÇÃO DE SIRENE INCÊNDIO", "unidade": "P", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.5},
                {"cargo": "C020", "fator": 0.5}
            ]},
            # 99
            {"nome": "INSTALAÇÃO E ATIVAÇÃO DE LUMINÁRIA DE EMERGÊNCIA", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.5},
                {"cargo": "C020", "fator": 0.5}
            ]},
            # 100
            {"nome": "INSTALAÇÃO E CONFIGURAÇÃO DE CENTRAL DE INCÊNDIO", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 4},
                {"cargo": "C020", "fator": 4}
            ]},
            # 101
            {"nome": "SERVIÇO DE LANÇAMENTO DOS CABOS HDMI", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C007", "fator": 0.1},
                {"cargo": "C020", "fator": 0.1}
            ]},
            # 102
            {"nome": "SERVIÇO DE CONECTORIZAÇÃO DE CABO HDMI", "unidade": "pc", "vigencia": 2026, "items": [
                {"cargo": "C007", "fator": 0.5},
                {"cargo": "C020", "fator": 0.5}
            ]},
            # 103
            {"nome": "SERVIÇO DE INSTALAÇÃO DE HASTE DE ATERRAMENTO", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 2},
                {"cargo": "C025", "fator": 2}
            ]},
            # 104
            {"nome": "LANÇAMENTO CABO COBRE NU PARA ATERRAMENTO", "unidade": "m", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 0.2},
                {"cargo": "C025", "fator": 0.2}
            ]},
            # 105
            {"nome": "SERVIÇO DE SOLDA ISOTÉRMICA", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C018", "fator": 1},
                {"cargo": "C025", "fator": 1}
            ]},
            # 106
            {"nome": "SERVIÇO DE CONFIGURAÇÃO/PROGRAMAÇÃO SWITCH", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C019", "fator": 2},
                {"cargo": "C012", "fator": 2}
            ]},
            # 107
            {"nome": "RECOMPOSIÇÃO BÁSICA PAREDES E PINTURA", "unidade": "m2", "vigencia": 2026, "items": [
                {"cargo": "C025", "fator": 1.5},
                {"cargo": "C011", "fator": 0.81}
            ]},
            # 108
            {"nome": "SERVIÇO DE LIMPEZA DA OBRA", "unidade": "vb", "vigencia": 2026, "items": [
                {"cargo": "C025", "fator": 8},
                {"cargo": "C011", "fator": 8}
            ]}
        ]

        count = 0
        for svc_data in services_data:
            # Map items
            items = []
            for item in svc_data["items"]:
                role_name = role_map[item["cargo"]]
                role_id = role_ids[role_name]
                
                # Fator -> Minutes logic
                fator = float(item["fator"])

                print(f"DEBUG: Using Cargo [{item['cargo']}] -> {role_name} ({role_id}) with fator {fator}")

                if fator > 0:
                    items.append(OwnServiceItemCreate(
                        role_id=role_id,
                        fator=fator
                    ))
            
            # Substr unidade if > 10 chars
            unidade = (svc_data["unidade"] or "")[:10]
            if unidade.lower() in ["un.", "ud", "un"]:
                unidade = "UN"
            
            # By-pass router request parsing and insert raw ORM
            new_id = uuid.uuid4()
            _, total_minutos = _calc_consolidated(items)

            svc = OwnService(
                id=new_id,
                tenant_id=tenant.id,
                company_id=str(company.id),
                nome_servico=svc_data["nome"],
                unidade=unidade,
                vigencia=svc_data["vigencia"],
                tempo_total_minutos=total_minutos,
                ativo=True
            )
            db.add(svc)
            db.flush()

            for item in _build_items(new_id, items):
                db.add(item)
                
            db.commit()
            count += 1
            
        print(f"✅ Sucesso: Inseridos {count} serviços próprios corretamente no BD com todos relacionamentos e métricas validadas!")
    except Exception as e:
        print(f"❌ Erro na inserção: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_services()
