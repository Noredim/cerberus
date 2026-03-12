from typing import TypedDict, Optional
from decimal import Decimal
import math

class DifalInput(TypedDict):
    tipo_orcamento: str # ATIVO_IMOBILIZADO_USO_CONSUMO | REVENDA
    criar_cenario_difal: bool
    uf_origem: Optional[str]
    uf_destino: Optional[str]
    valor_produto: float
    valor_ipi: float
    valor_frete: float
    valor_icms_st: float
    aliquota_orcamento: float # ex: 0.12 for 12%
    aliquota_interna_destino: float # ex: 0.17 for 17%

class DifalOutput(TypedDict):
    operacao_interestadual: bool
    icms_origem: float
    valor_difal_base: float
    diferenca_difal_st: float
    valor_difal: float
    custo_com_difal: float
    is_valid: bool
    missing_fields: list[str]

def calcular_difal_item_formacao_preco(data: DifalInput) -> DifalOutput:
    """Implementa a regra de negócio para cálculo de DIFAL."""
    missing = []
    if not data.get("uf_origem"): missing.append("uf_origem")
    if not data.get("uf_destino"): missing.append("uf_destino")
    if data.get("valor_produto") is None: missing.append("valor_produto")
    if data.get("aliquota_orcamento") is None: missing.append("aliquota_orcamento")
    if data.get("aliquota_interna_destino") is None: missing.append("aliquota_interna_destino")
    
    def safe_float(v):
        if v is None: return 0.0
        try:
            f = float(v)
            if math.isnan(f) or math.isinf(f): return 0.0
            return f
        except (ValueError, TypeError):
            return 0.0

    ret = {
        "operacao_interestadual": False,
        "icms_origem": 0.0,
        "valor_difal_base": 0.0,
        "diferenca_difal_st": 0.0,
        "valor_difal": 0.0,
        "custo_com_difal": 0.0,
        "is_valid": False,
        "missing_fields": missing
    }

    if missing:
        return DifalOutput(**ret)

    uf_origem = (data.get("uf_origem") or "").upper()
    uf_destino = (data.get("uf_destino") or "").upper()
    operacao_interestadual = uf_origem != uf_destino
    
    valor_produto = safe_float(data["valor_produto"])
    aliquota_orcamento = safe_float(data["aliquota_orcamento"])
    aliquota_interna_destino = safe_float(data["aliquota_interna_destino"])
    valor_icms_st = safe_float(data["valor_icms_st"])
    valor_ipi = safe_float(data["valor_ipi"])
    valor_frete = safe_float(data["valor_frete"])
    
    ret["operacao_interestadual"] = operacao_interestadual
    ret["is_valid"] = True
    
    if not operacao_interestadual:
        ret["icms_origem"] = 0.0
        ret["valor_difal_base"] = 0.0
        ret["valor_difal"] = 0.0
        ret["diferenca_difal_st"] = 0.0
    else:
        # 3.1 ICMS de origem
        icms_origem = valor_produto * aliquota_orcamento
        ret["icms_origem"] = icms_origem
        
        # Evitar divisao por zero
        if aliquota_interna_destino >= 1.0:
            aliquota_interna_destino = 0.99
            
        # 3.2 DIFAL base
        base_calculo = (valor_produto - icms_origem) / (1.0 - aliquota_interna_destino)
        valor_difal_base = (base_calculo * aliquota_interna_destino) - (valor_produto * aliquota_orcamento)
        ret["valor_difal_base"] = valor_difal_base

    tipo_orcamento = data.get("tipo_orcamento", "REVENDA")
    
    if tipo_orcamento == "ATIVO_IMOBILIZADO_USO_CONSUMO":
        if operacao_interestadual:
            ret["valor_difal"] = ret["valor_difal_base"]
        else:
            ret["valor_difal"] = 0.0
            
        ret["custo_com_difal"] = valor_produto + valor_ipi + valor_frete + ret["valor_difal"]
        
    elif tipo_orcamento == "REVENDA":
        criar_cenario = data.get("criar_cenario_difal", False)
        
        if not criar_cenario:
            ret["valor_difal"] = 0.0
        else:
            if operacao_interestadual:
                diferenca_difal_st = ret["valor_difal_base"] - valor_icms_st
                ret["diferenca_difal_st"] = diferenca_difal_st
                
                if diferenca_difal_st > 0:
                    ret["valor_difal"] = valor_icms_st + diferenca_difal_st
                elif diferenca_difal_st < 0:
                    ret["valor_difal"] = ret["valor_difal_base"]
                else:
                    ret["valor_difal"] = ret["valor_difal_base"]
            else:
                ret["valor_difal"] = 0.0
                
        ret["custo_com_difal"] = valor_produto + valor_ipi + valor_frete + ret["valor_difal"]
        
    # Arredondar e evitar infinity/NaN
    for k in ["icms_origem", "valor_difal_base", "diferenca_difal_st", "valor_difal", "custo_com_difal"]:
        ret[k] = safe_float(ret[k])
        
    return DifalOutput(**ret)
