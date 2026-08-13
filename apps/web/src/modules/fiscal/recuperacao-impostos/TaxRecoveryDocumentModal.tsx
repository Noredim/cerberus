import React, { useState } from 'react';
import {
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Info,
  ShoppingCart,
  Building2,
  ArrowRightLeft,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  TrendingUp
} from 'lucide-react';
import type { TaxRecoveryDocument, TaxRecoveryItemDetail } from './types';

interface Props {
  document: TaxRecoveryDocument | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TaxRecoveryDocumentModal: React.FC<Props> = ({ document, isOpen, onClose }) => {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [showTechnicalLogs, setShowTechnicalLogs] = useState<Record<string, boolean>>({});

  if (!isOpen || !document) return null;

  const toggleLogs = (itemId: string) => {
    setShowTechnicalLogs((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatQuantity = (val?: number) => {
    const q = Number(val || 1);
    return Number.isInteger(q)
      ? q.toLocaleString('pt-BR')
      : q.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  const formatNCM = (ncm?: string) => {
    if (!ncm) return '---';
    const clean = ncm.replace(/\D/g, '');
    if (clean.length === 8) {
      return `${clean.slice(0, 4)}.${clean.slice(4, 6)}.${clean.slice(6, 8)}`;
    }
    return ncm;
  };

  const formatNumberInText = (text: string) => {
    if (!text) return '';
    return text.replace(/R\$\s*(\d+(\.\d+)?)/g, (match, p1) => {
      const num = parseFloat(p1);
      if (isNaN(num)) return match;
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
    });
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'A_RECUPERAR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 shadow-2xs whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3" /> A Recuperar
          </span>
        );
      case 'A_RECOLHER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 shadow-2xs whitespace-nowrap">
            <AlertTriangle className="w-3 h-3" /> A Recolher
          </span>
        );
      case 'SEM_DIFERENCA':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
            Sem Diferença
          </span>
        );
      case 'PENDENTE_PARAMETRIZACAO':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 shadow-2xs whitespace-nowrap">
            Pendente Parametrização
          </span>
        );
      default:
        return null;
    }
  };

  const getStepCategory = (stepIndex: number, stepText: string) => {
    if (stepText.includes('Finalidade') || stepText.includes('Operação')) {
      return { title: 'Parâmetros da Operação', icon: ArrowRightLeft, color: 'text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-950 border-blue-300 dark:border-blue-800' };
    }
    if (stepText.includes('MVA') || stepText.includes('NCM')) {
      return { title: 'Regra Tributária NCM/MVA', icon: FileCheck, color: 'text-indigo-800 dark:text-indigo-200 bg-indigo-100 dark:bg-indigo-950 border-indigo-300 dark:border-indigo-800' };
    }
    if (stepText.includes('ST') || stepText.includes('Recálculo ST')) {
      return { title: 'Apuração ICMS-ST (Revenda)', icon: ShoppingCart, color: 'text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800' };
    }
    if (stepText.includes('DIFAL')) {
      return { title: 'Apuração DIFAL (Ativo/Uso)', icon: Building2, color: 'text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950 border-amber-300 dark:border-amber-800' };
    }
    if (stepText.includes('Diferença')) {
      return { title: 'Resultado e Confronto', icon: Calculator, color: 'text-brand-primary bg-brand-primary/10 border-brand-primary/30' };
    }
    return { title: `Etapa ${stepIndex + 1}`, icon: Info, color: 'text-text-primary bg-bg-deep border-border-subtle' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-surface border border-border-subtle rounded-xl w-full max-w-6xl shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-deep/50">
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-primary" />
              Detalhes da Nota Fiscal nº {document.nNF || '---'} ({document.serie || '1'})
            </h2>
            <p className="text-xs text-text-muted font-mono mt-0.5">{document.access_key}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1.5 rounded-md hover:bg-bg-deep transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Header Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-bg-deep/50 border border-border-subtle rounded-lg text-xs">
            <div>
              <span className="text-text-muted block text-[10px] uppercase font-semibold">Emitente / Fornecedor</span>
              <strong className="text-text-primary truncate block">{document.issuer_name || '---'}</strong>
              <div className="text-[11px] text-text-muted font-mono">{document.issuer_cnpj}</div>
            </div>

            <div>
              <span className="text-text-muted block text-[10px] uppercase font-semibold">UF Origem / Destino</span>
              <strong className="text-text-primary font-semibold">{document.uf_emit || '--'} &rarr; {document.uf_dest || '--'}</strong>
            </div>

            <div>
              <span className="text-text-muted block text-[10px] uppercase font-semibold">Valor Total da Nota</span>
              <strong className="text-text-primary font-mono text-sm">{formatCurrency(document.vNF)}</strong>
            </div>

            <div>
              <span className="text-text-muted block text-[10px] uppercase font-semibold">Saldo Auditado da Nota</span>
              <strong className={`font-mono text-sm font-extrabold ${document.net_balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatCurrency(document.net_balance)}
              </strong>
            </div>
          </div>

          {/* Items Audit Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Itens da Nota Fiscal ({document.items?.length || 0})
              </h3>
              <span className="text-[11px] text-text-muted">Clique no item para expandir a memória de cálculo do ST e DIFAL</span>
            </div>

            <div className="border border-border-subtle rounded-lg overflow-hidden bg-surface shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-[#f8f9fa] dark:bg-bg-deep text-text-muted uppercase font-semibold text-[10px] tracking-wider border-b border-border-subtle">
                    <tr>
                      <th className="w-8 px-2 py-2 text-center"></th>
                      <th className="px-3 py-2 min-w-[210px]">ITEM / NCM</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap min-w-[130px]">QTD X VLR UNIT.</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap min-w-[110px]">VLR TOTAL ITEM</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap min-w-[140px]">ST CALCULADO (UNIT. X TOTAL)</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap min-w-[140px]">DIFAL (UNIT. E TOTAL)</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap min-w-[120px]">SALDO A RECUPERAR</th>
                      <th className="px-3 py-2 text-center whitespace-nowrap min-w-[120px]">SITUAÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle bg-surface">
                    {document.items?.map((item: TaxRecoveryItemDetail) => {
                      const isExpanded = expandedItemId === item.id;
                      const qCom = item.qCom || 1;
                      const itemBalance = item.total_to_recover - item.total_to_collect;

                      const stTotal = item.icms_st_original > 0 ? item.icms_st_original : item.icms_st_recalculated;
                      const stUnit = stTotal / qCom;

                      const difalTotal = item.difal_recalculated;
                      const difalUnit = difalTotal / qCom;

                      const isLogsOpen = !!showTechnicalLogs[item.id];

                      return (
                        <React.Fragment key={item.id}>
                          <tr
                            className={`transition-colors cursor-pointer ${
                              isExpanded
                                ? 'bg-brand-primary/5 dark:bg-brand-primary/10 border-l-2 border-l-brand-primary'
                                : 'hover:bg-bg-deep/60'
                            }`}
                            onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                          >
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedItemId(isExpanded ? null : item.id);
                                }}
                                className="p-1 text-brand-primary hover:bg-brand-primary/10 rounded transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            <td className="px-3 py-2">
                              <div className="font-semibold text-text-primary text-[11px] leading-tight">
                                #{item.nItem} - {item.xProd || 'Produto sem descrição'}
                              </div>
                              <div className="text-[10px] text-text-muted font-mono mt-0.5 flex items-center gap-1.5">
                                <span>Cod: {item.cProd || '---'}</span>
                                <span>•</span>
                                <span>NCM: <strong className="text-text-primary bg-bg-deep px-1 rounded">{formatNCM(item.NCM)}</strong></span>
                              </div>
                            </td>

                            <td className="px-3 py-2 text-right font-mono text-text-muted whitespace-nowrap">
                              {formatQuantity(item.qCom)} un <br />
                              <span className="text-[10px] text-text-muted">x {formatCurrency(item.vUnCom)}</span>
                            </td>

                            <td className="px-3 py-2 text-right font-semibold text-text-primary font-mono whitespace-nowrap">
                              {formatCurrency(item.vProd)}
                            </td>

                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                              <div className="text-[10px] text-text-muted" title="Valor Unitário de ST">
                                Unit: {formatCurrency(stUnit)}
                              </div>
                              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400" title="Valor Total de ST">
                                Total: {formatCurrency(stTotal)}
                              </div>
                            </td>

                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                              <div className="text-[10px] text-text-muted" title="Valor Unitário de DIFAL">
                                Unit: {formatCurrency(difalUnit)}
                              </div>
                              <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400" title="Valor Total de DIFAL">
                                Total: {formatCurrency(difalTotal)}
                              </div>
                            </td>

                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <span className={`inline-block px-2.5 py-1 font-extrabold font-mono text-xs rounded-md shadow-2xs ${
                                itemBalance >= 0
                                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              }`}>
                                {formatCurrency(itemBalance)}
                              </span>
                            </td>

                            <td className="px-3 py-2 text-center whitespace-nowrap">
                              {getItemStatusBadge(item.status)}
                            </td>
                          </tr>

                          {/* Expanded Clean Executive Calculation Memory Cards */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="px-6 py-5 bg-bg-deep/40 border-b border-border-subtle">
                                <div className="space-y-4">
                                  {/* Title Header */}
                                  <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-brand-primary">
                                      <Calculator className="w-4 h-4 text-brand-primary" />
                                      <span>Resumo da Memória de Cálculo Tributária (Item #{item.nItem})</span>
                                    </div>
                                    <div className="text-xs text-text-muted font-mono">
                                      Qtd: <strong className="text-text-primary">{formatQuantity(item.qCom)} un</strong> | NCM: <strong className="text-text-primary">{formatNCM(item.NCM)}</strong>
                                    </div>
                                  </div>

                                  {/* 3 Executive Summary Cards */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Executive Card 1: Memória de Cálculo ST */}
                                    <div className="bg-surface border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-4 space-y-3 shadow-xs">
                                      <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                          <ShoppingCart className="w-4 h-4" /> Memória de Cálculo ICMS-ST
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                                          REVENDA
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                                        <div className="bg-bg-deep/60 p-2 rounded-lg border border-border-subtle">
                                          <span className="text-[10px] text-text-muted block uppercase font-semibold">ST Unitário</span>
                                          <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm block mt-0.5">
                                            {formatCurrency(stUnit)}
                                          </strong>
                                        </div>

                                        <div className="bg-bg-deep/60 p-2 rounded-lg border border-border-subtle">
                                          <span className="text-[10px] text-text-muted block uppercase font-semibold">ST Total da Nota</span>
                                          <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm block mt-0.5">
                                            {formatCurrency(stTotal)}
                                          </strong>
                                        </div>
                                      </div>

                                      <div className="text-[11px] text-text-muted font-mono leading-relaxed bg-bg-deep/40 p-2 rounded border border-border-subtle">
                                        <strong>Regra ST MT (Engine Cerberus):</strong> MVA 40,33% • Base ST: {formatCurrency((item.vProd || 0) * 1.4033)} • Alíquota Destino: 17% • Crédito Efetivo: 7% • Crédito Outorgado: 12%
                                      </div>
                                    </div>

                                    {/* Executive Card 2: Memória de Cálculo DIFAL */}
                                    <div className="bg-surface border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 space-y-3 shadow-xs">
                                      <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                          <Building2 className="w-4 h-4" /> Memória de Cálculo DIFAL
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                                          ATIVO IMOBILIZADO
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                                        <div className="bg-bg-deep/60 p-2 rounded-lg border border-border-subtle">
                                          <span className="text-[10px] text-text-muted block uppercase font-semibold">DIFAL Unitário</span>
                                          <strong className="text-amber-600 dark:text-amber-400 font-extrabold text-sm block mt-0.5">
                                            {formatCurrency(difalUnit)}
                                          </strong>
                                        </div>

                                        <div className="bg-bg-deep/60 p-2 rounded-lg border border-border-subtle">
                                          <span className="text-[10px] text-text-muted block uppercase font-semibold">DIFAL Total da Nota</span>
                                          <strong className="text-amber-600 dark:text-amber-400 font-extrabold text-sm block mt-0.5">
                                            {formatCurrency(difalTotal)}
                                          </strong>
                                        </div>
                                      </div>

                                      <div className="text-[11px] text-text-muted font-mono leading-relaxed bg-bg-deep/40 p-2 rounded border border-border-subtle">
                                        <strong>Regra DIFAL MT (Base por dentro):</strong> Base sem ICMS: {formatCurrency((item.vProd || 0) * 0.88)} / (1 - 0.17) = Base DIFAL {formatCurrency((item.vProd || 0) * 0.88 / 0.83)}
                                      </div>
                                    </div>

                                    {/* Executive Card 3: Saldo Final a Ressarcir */}
                                    <div className="bg-surface border border-brand-primary/40 rounded-xl p-4 space-y-3 shadow-xs bg-brand-primary/5 dark:bg-brand-primary/10">
                                      <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                                        <span className="text-xs font-bold text-brand-primary flex items-center gap-1.5">
                                          <TrendingUp className="w-4 h-4" /> Saldo Auditado a Ressarcir
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-primary/20 text-brand-primary border border-brand-primary/30">
                                          CONFRONTO FINAL
                                        </span>
                                      </div>

                                      <div className="space-y-1 text-xs font-mono">
                                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                          <span>(+) ICMS-ST de Revenda:</span>
                                          <strong>{formatCurrency(stTotal)}</strong>
                                        </div>
                                        <div className="flex justify-between text-rose-600 dark:text-rose-400">
                                          <span>(-) DIFAL a Recolher:</span>
                                          <strong>{formatCurrency(difalTotal)}</strong>
                                        </div>
                                      </div>

                                      <div className="pt-2 border-t border-border-subtle flex flex-col items-center justify-center p-2 rounded-lg bg-surface border shadow-2xs">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">SALDO LÍQUIDO A RECUPERAR</span>
                                        <strong className={`text-lg font-black font-mono mt-0.5 ${itemBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                          {formatCurrency(itemBalance)}
                                        </strong>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Pendency Warning if exists */}
                                  {item.pending_reasons && item.pending_reasons.length > 0 && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-lg text-amber-800 dark:text-amber-200 text-xs">
                                      <strong className="font-semibold flex items-center gap-1.5 mb-1 text-amber-900 dark:text-amber-100">
                                        <AlertTriangle className="w-4 h-4 text-amber-600" /> Pendências Identificadas no Recálculo:
                                      </strong>
                                      <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px]">
                                        {item.pending_reasons.map((reason: string, rIdx: number) => (
                                          <li key={rIdx}>{reason}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Optional Collapsible Technical Logs */}
                                  {item.audit_memory_json?.steps && (
                                    <div className="pt-2">
                                      <button
                                        onClick={() => toggleLogs(item.id)}
                                        className="text-xs font-semibold text-brand-primary hover:text-brand-primary/80 flex items-center gap-1 font-mono transition-colors"
                                      >
                                        {isLogsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        {isLogsOpen ? 'Ocultar etapas brutas da auditoria' : 'Exibir etapas brutas da auditoria passo a passo'}
                                      </button>

                                      {isLogsOpen && (
                                        <div className="space-y-2 mt-3 pl-2 border-l-2 border-brand-primary/30">
                                          {item.audit_memory_json.steps.map((step: any, sIdx: number) => {
                                            const isStringStep = typeof step === 'string';
                                            const stepText = isStringStep
                                              ? step
                                              : step.description || step.title || step.formula || JSON.stringify(step);
                                            
                                            const formattedText = formatNumberInText(stepText);
                                            const category = getStepCategory(sIdx, stepText);
                                            const StepIcon = category.icon;

                                            return (
                                              <div
                                                key={sIdx}
                                                className="p-3 bg-surface border border-border-subtle rounded-lg text-text-primary space-y-1.5 shadow-2xs hover:border-brand-primary/40 transition-colors"
                                              >
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${category.color} flex items-center gap-1`}>
                                                      <StepIcon className="w-3 h-3" />
                                                      Passo {sIdx + 1}: {category.title}
                                                    </span>
                                                  </div>

                                                  {!isStringStep && step.recalculated_value !== undefined && (
                                                    <span className="text-xs font-mono font-bold text-brand-primary">
                                                      Resultado: {formatCurrency(step.recalculated_value)}
                                                    </span>
                                                  )}
                                                </div>

                                                <div className="text-text-primary font-mono text-[11px] leading-relaxed whitespace-pre-wrap pl-1">
                                                  {formattedText}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-border-subtle bg-bg-deep/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primary/90 rounded-md shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
