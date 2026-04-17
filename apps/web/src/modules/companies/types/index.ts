export interface Company {
    id: string;
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string;
    inscricao_estadual?: string;
    inscricao_municipal?: string;

    // Endereço
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cep?: string;
    municipality_id: string;
    state_id: string;

    status: string;
    created_at: string;
    updated_at: string;

    cnaes: CompanyCnae[];
    tax_profiles?: TaxProfile[];
    benefits?: CompanyBenefit[];
    logo_url?: string;
    sales_parameters?: CompanySalesParameter;
}

export interface CompanySalesParameter {
    id?: string;
    company_id?: string;
    mkp_padrao: number;
    despesa_administrativa: number;
    comissionamento: number;
    pis: number;
    cofins: number;
    csll: number;
    irpj: number;
    iss: number;
    icms_interno: number;
    icms_externo: number;
}

export interface CompanyCnae {
    cnae_codigo: string;
    tipo: 'PRIMARIO' | 'SECUNDARIO';
}

export interface TaxBenefit {
    id: string;
    nome: string;
}

export interface CompanyBenefit {
    id: string;
    status: string;
    benefit: TaxBenefit;
}

export interface TaxProfile {
    id?: string;
    vigencia_inicio: string;
    vigencia_fim?: string;
    regime_tributario: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL' | 'MEI' | 'OUTRO';
    contribuinte_icms: boolean;
    contribuinte_iss: boolean;
    inscricao_estadual?: string;
    inscricao_municipal?: string;
    regime_iss: string;
    regime_icms: string;
    perfil_tarifario_st?: boolean;
    observacoes?: string;
    is_active?: boolean; // UI helper
}

export interface CompanyQsa {
    nome: string;
    qualificacao?: string;
    pais_origem?: string;
    nome_rep_legal?: string;
    qualificacao_rep_legal?: string;
}

export interface CNPJActivity {
    codigo: string;
    descricao: string;
    tipoCnae: string;
}

export interface CNPJLookupResult {
    success: boolean;
    source: string;
    normalizedData: {
        cnpj: string;
        tipo: string;
        razaoSocial: string;
        nomeFantasia: string;
        situacaoCadastral: string;
        naturezaJuridica: string;
        dataAbertura: string;
        porte: string;
        capitalSocial: number;
        email: string;
        telefone: string;
        endereco: {
            logradouro: string;
            numero: string;
            complemento: string;
            bairro: string;
            cep: string;
            municipio: string;
            uf: string;
        };
        atividadePrincipal: CNPJActivity[];
        atividadesSecundarias: CNPJActivity[];
        qsa: any[];
        simples: { optante: boolean };
        simei: { optante: boolean };
    };
    providerMeta: {
        fromCache: boolean;
        provider: string;
    };
}
