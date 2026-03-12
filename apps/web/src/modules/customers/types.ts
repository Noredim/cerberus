export type CustomerType = 'PRIVADO' | 'PUBLICO';
export type CustomerEsfera = 'MUNICIPAL' | 'ESTADUAL' | 'FEDERAL' | 'AUTARQUIA';

export interface Customer {
    id: string;
    tenant_id: string;
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string;
    email?: string;
    telefone?: string;
    tipo: CustomerType;
    esfera?: CustomerEsfera;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipality_id?: string;
    state_id?: string;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CustomerCreate {
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string;
    email?: string;
    telefone?: string;
    tipo: CustomerType;
    esfera?: CustomerEsfera;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipality_id?: string;
    state_id?: string;
}

export interface CustomerUpdate {
    razao_social?: string;
    nome_fantasia?: string;
    email?: string;
    telefone?: string;
    tipo?: CustomerType;
    esfera?: CustomerEsfera;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipality_id?: string;
    state_id?: string;
    active?: boolean;
}
