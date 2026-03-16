export type ProductType = 'EQUIPAMENTO' | 'SERVICO';
export type ProductFinalidade = 'REVENDA' | 'ATIVO';

export interface ProductFormData {
    company_id: string;
    nome: string;
    descricao?: string;
    tipo: ProductType;
    finalidade: ProductFinalidade;
    unidade?: string;
    categoria?: string;
    marca?: string;
    modelo?: string;
    part_number?: string;
    ncm_codigo?: string;
    cest_codigo?: string;
    cmt_codigo?: string;
    ativo: boolean;
    suppliers: ProductSupplier[];
    vlr_referencia_revenda?: number | null;
    vlr_referencia_uso_consumo?: number | null;
    data_atualizacao_revenda?: string | null;
    data_atualizacao_uso_consumo?: string | null;
    origem_valor_uso_consumo?: string | null;
}

export interface ProductSupplier {
    id?: string;
    supplier_id: string;
    codigo_externo: string;
    unidade: string;
    fator_conversao: string;
}

export interface Product {
    id: string;
    tenant_id: string;
    company_id: string;
    codigo: string;
    nome: string;
    descricao?: string;
    tipo: ProductType;
    finalidade: ProductFinalidade;
    unidade?: string;
    categoria?: string;
    marca?: string;
    modelo?: string;
    part_number?: string;
    ncm_codigo?: string;
    cest_codigo?: string;
    cmt_codigo?: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
    suppliers?: ProductSupplier[];
    vlr_referencia_revenda?: number | null;
    vlr_referencia_uso_consumo?: number | null;
    data_atualizacao_revenda?: string | null;
    data_atualizacao_uso_consumo?: string | null;
    origem_valor_uso_consumo?: string | null;
}

export interface ProductCreate {
    company_id: string;
    nome: string;
    descricao?: string;
    tipo: ProductType;
    finalidade: ProductFinalidade;
    unidade?: string;
    categoria?: string;
    marca?: string;
    modelo?: string;
    ncm_codigo?: string;
    cest_codigo?: string;
    cmt_codigo?: string;
    ativo: boolean;
}

export interface ProductUpdate extends Partial<ProductCreate> {
    suppliers?: { supplier_id: string; codigo_externo: string; unidade: string; fator_conversao: string; }[];
}

export interface MvaLookupResult {
    found: boolean;
    mva_percent?: number;
    ncm_base?: string;
    description?: string;
}
