export interface Supplier {
    id: string;
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string;
    email?: string;
    telefone?: string;
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

export interface SupplierCreate {
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string;
    email?: string;
    telefone?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipality_id?: string;
    state_id?: string;
}

export interface SupplierUpdate extends Partial<SupplierCreate> {
    active?: boolean;
}
