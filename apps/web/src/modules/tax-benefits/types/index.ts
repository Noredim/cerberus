export interface TaxBenefit {
    id: string;
    nome: string;
    descricao?: string;
    esfera: 'MUNICIPAL' | 'ESTADUAL' | 'FEDERAL';
    tributo_alvo: 'ISS' | 'ICMS' | 'IPI' | 'PIS' | 'COFINS' | 'IRPJ' | 'CSLL' | 'OUTRO';
    tipo_beneficio: 'REDUCAO_ALIQUOTA' | 'ISENCAO' | 'DIFERIMENTO' | 'CREDITO_PRESUMIDO' | 'BASE_CALCULO_REDUZIDA' | 'OUTRO';
    regra_json: {
        condicoes: {
            uf: string[];
            municipio_ibge: string[];
            cnae_incluir: string[];
            cnae_excluir: string[];
            ncm_incluir: string[];
            ncm_excluir: string[];
            operacao: string[];
            cliente_tipo: string[];
            valor_min?: number;
            valor_max?: number;
        };
        efeitos: {
            aliquota_nova?: number;
            reducao_percentual?: number;
            base_reduzida_percentual?: number;
            credito_percentual?: number;
            observacao_nf?: string;
        };
        vigencia: {
            inicio: string;
            fim?: string;
        };
        prioridade: number;
    };
    requer_habilitacao: boolean;
    documento_base?: string;
    ativo: boolean;
    created_at?: string;
    updated_at?: string;
}
