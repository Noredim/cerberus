export type OperationPurpose = 'REVENDA' | 'USO_CONSUMO' | 'ATIVO_IMOBILIZADO';

export type TaxRecoveryStatus =
  | 'RASCUNHO'
  | 'EM_PROCESSAMENTO'
  | 'PROCESSADA'
  | 'PROCESSADA_COM_PENDENCIAS'
  | 'CONCLUIDA'
  | 'CANCELADA';

export type CalculationItemStatus =
  | 'A_RECUPERAR'
  | 'A_RECOLHER'
  | 'SEM_DIFERENCA'
  | 'PENDENTE_PARAMETRIZACAO';

export interface TaxRecoveryItemDetail {
  id: string;
  tax_recovery_document_id: string;
  fiscal_document_item_id: string;
  nItem: number;
  status: CalculationItemStatus;

  cProd?: string;
  xProd?: string;
  NCM?: string;
  CFOP?: string;
  uCom?: string;
  qCom?: number;
  vUnCom?: number;
  vProd?: number;

  icms_st_original: number;
  icms_st_recalculated: number;
  icms_st_diff: number;
  difal_original: number;
  difal_recalculated: number;
  difal_diff: number;
  total_to_recover: number;
  total_to_collect: number;
  net_balance: number;

  original_scenario_json?: Record<string, any>;
  destination_scenario_json?: Record<string, any>;
  audit_memory_json?: {
    steps?: string[];
    summary?: Record<string, any>;
  };
  pending_reasons?: string[];
}

export interface TaxRecoveryDocument {
  id: string;
  tax_recovery_id: string;
  fiscal_document_id: string;

  access_key?: string;
  nNF?: string;
  serie?: string;
  dhEmi?: string;
  issuer_name?: string;
  issuer_cnpj?: string;
  uf_emit?: string;
  recipient_name?: string;
  recipient_cnpj?: string;
  uf_dest?: string;
  vNF?: number;

  entry_purpose?: string;
  real_destination?: string;

  calculation_status: 'OK' | 'PENDENTE_PARAMETRIZACAO' | 'ERRO';
  status_message?: string;

  icms_st_original: number;
  difal_original: number;
  icms_st_recalculated: number;
  difal_recalculated: number;
  total_to_recover: number;
  total_to_collect: number;
  net_balance: number;

  items_count: number;
  items?: TaxRecoveryItemDetail[];
}

export interface TaxRecoveryAnalysis {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  entry_purpose: OperationPurpose;
  real_destination: OperationPurpose;
  status: TaxRecoveryStatus;

  total_notes_count: number;
  total_notes_value: number;
  total_icms_st_original: number;
  total_difal_original: number;
  total_icms_st_recalculated: number;
  total_difal_recalculated: number;
  total_to_recover: number;
  total_to_collect: number;
  net_balance: number;
  pending_items_count: number;
  pending_notes_value: number;

  created_by?: string;
  creator_name?: string;
  updated_by?: string;
  company_name?: string;
  created_at: string;
  updated_at: string;

  documents?: TaxRecoveryDocument[];
}

export interface PaginatedTaxRecoveryList {
  items: TaxRecoveryAnalysis[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
