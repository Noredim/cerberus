from typing import Dict, List

# Constantes de Aplicação
APLICACOES_VALIDAS = [
    "REVENDA",
    "MATERIAL_APLICADO",
    "MATERIAL_COMODATO",
    "CONSUMO_INTERNO",
    "OUTRAS_REMESSAS",
    "RETORNO_CONSERTO",
    "COMBUSTIVEL",
    "CANCELAMENTO",
]

# Rótulos amigáveis para exibição no frontend
APLICACAO_LABELS = {
    "REVENDA": "Revenda",
    "MATERIAL_APLICADO": "Material Aplicado",
    "MATERIAL_COMODATO": "Material para Comodato",
    "CONSUMO_INTERNO": "Consumo Interno",
    "OUTRAS_REMESSAS": "Outras Remessas",
    "RETORNO_CONSERTO": "Retorno de Conserto",
    "COMBUSTIVEL": "Combustível",
    "CANCELAMENTO": "Cancelamento",
}

# Constantes de Tributação
TRIBUTACOES_VALIDAS = [
    "ICMS_ST",
    "DIFAL_ST",
    "DIFAL",
    "NAO_TRIBUTADA",
    "OPERACAO_NORMAL",
    "ST_DESTACADO",
    "CANCELAMENTO",
]

TRIBUTACAO_LABELS = {
    "ICMS_ST": "ICMS ST",
    "DIFAL_ST": "DIFAL ST",
    "DIFAL": "DIFAL",
    "NAO_TRIBUTADA": "Operação Não Tributada",
    "OPERACAO_NORMAL": "Operação Normal",
    "ST_DESTACADO": "ST Destacado",
    "CANCELAMENTO": "Cancelamento",
}

# Matriz estrita de compatibilidade entre Aplicação e Tipo de Tributação
COMPATIBILIDADE_TRIBUTACAO: Dict[str, List[str]] = {
    "REVENDA": [
        "ICMS_ST",
        "ST_DESTACADO",
        "NAO_TRIBUTADA",
        "OPERACAO_NORMAL",
    ],
    "OUTRAS_REMESSAS": [
        "ICMS_ST",
        "ST_DESTACADO",
        "NAO_TRIBUTADA",
        "OPERACAO_NORMAL",
    ],
    "RETORNO_CONSERTO": [
        "ICMS_ST",
        "ST_DESTACADO",
        "NAO_TRIBUTADA",
        "OPERACAO_NORMAL",
    ],
    "MATERIAL_APLICADO": [
        "DIFAL_ST",
        "DIFAL",
        "ST_DESTACADO",
        "NAO_TRIBUTADA",
        "OPERACAO_NORMAL",
    ],
    "MATERIAL_COMODATO": [
        "DIFAL_ST",
        "DIFAL",
        "ST_DESTACADO",
        "NAO_TRIBUTADA",
        "OPERACAO_NORMAL",
    ],
    "CONSUMO_INTERNO": [
        "DIFAL_ST",
        "DIFAL",
        "ST_DESTACADO",
        "NAO_TRIBUTADA",
        "OPERACAO_NORMAL",
    ],
    "COMBUSTIVEL": [
        "DIFAL_ST",
        "DIFAL",
        "ST_DESTACADO",
        "NAO_TRIBUTADA",
        "OPERACAO_NORMAL",
    ],
    "CANCELAMENTO": [
        "CANCELAMENTO",
    ],
}


def get_tributacoes_permitidas(aplicacao: str) -> List[str]:
    """
    Retorna a lista de tipos de tributação permitidos para a aplicação informada.
    """
    if aplicacao not in COMPATIBILIDADE_TRIBUTACAO:
        raise ValueError(f"Aplicação '{aplicacao}' é inválida.")
    return COMPATIBILIDADE_TRIBUTACAO[aplicacao]


def validate_classification(aplicacao: str, tipo_tributacao: str) -> None:
    """
    Valida se a combinação entre Aplicação e Tipo de Tributação é permitida.
    Lança ValueError se for incompatível ou se algum valor for inválido.
    """
    if aplicacao not in APLICACOES_VALIDAS:
        raise ValueError(
            f"Aplicação '{aplicacao}' inválida. Opções válidas: {', '.join(APLICACOES_VALIDAS)}"
        )

    if tipo_tributacao not in TRIBUTACOES_VALIDAS:
        raise ValueError(
            f"Tipo de tributação '{tipo_tributacao}' inválido. Opções válidas: {', '.join(TRIBUTACOES_VALIDAS)}"
        )

    permitidas = COMPATIBILIDADE_TRIBUTACAO[aplicacao]
    if tipo_tributacao not in permitidas:
        raise ValueError(
            f"A tributação '{tipo_tributacao}' não é permitida para a aplicação '{aplicacao}'. "
            f"Opções permitidas: {', '.join(permitidas)}"
        )
