import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  UploadCloud,
  Play,
  CheckCircle2,
  XCircle,
  FileText,
  Trash2,
  Eye,
  Loader2,
  Search,
  Check
} from 'lucide-react';
import { api } from '../../../services/api';
import type { TaxRecoveryAnalysis, TaxRecoveryDocument, TaxRecoveryStatus } from './types';
import { TaxRecoveryDocumentModal } from './TaxRecoveryDocumentModal';

export const TaxRecoveryDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState<TaxRecoveryAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Selected Document Detail Modal
  const [selectedDoc, setSelectedDoc] = useState<TaxRecoveryDocument | null>(null);

  // Upload XML Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    imported_count: number;
    errors: { filename: string; error: string }[];
  } | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.get<TaxRecoveryAnalysis>(`/fiscal/tax-recovery/${id}`);
      setAnalysis(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro ao carregar detalhes da recuperação.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleProcess = async () => {
    if (!id) return;
    try {
      setProcessing(true);
      await api.post(`/fiscal/tax-recovery/${id}/process`);
      await fetchDetail();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro ao processar a análise.');
    } finally {
      setProcessing(false);
    }
  };

  const handleComplete = async () => {
    if (!id) return;
    try {
      setProcessing(true);
      await api.post(`/fiscal/tax-recovery/${id}/complete`);
      await fetchDetail();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro ao concluir a análise.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!id || !confirm('Tem certeza que deseja cancelar esta recuperação?')) return;
    try {
      setProcessing(true);
      await api.post(`/fiscal/tax-recovery/${id}/cancel`);
      await fetchDetail();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro ao cancelar a análise.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveDoc = async (docId: string) => {
    if (!id || !confirm('Tem certeza que deseja remover esta nota fiscal da análise?')) return;
    try {
      await api.delete(`/fiscal/tax-recovery/${id}/documents/${docId}`);
      await fetchDetail();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro ao remover a nota da análise.');
    }
  };

  const handleOpenDocDetail = async (docId: string) => {
    if (!id) return;
    try {
      const res = await api.get<TaxRecoveryDocument>(`/fiscal/tax-recovery/${id}/documents/${docId}`);
      setSelectedDoc(res.data);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro ao carregar detalhes do documento.');
    }
  };

  const handleUploadXmls = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || selectedFiles.length === 0) return;

    try {
      setUploading(true);
      setUploadResult(null);
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const res = await api.post(`/fiscal/tax-recovery/${id}/xml`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadResult(res.data);
      setSelectedFiles([]);
      await fetchDetail();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro ao enviar arquivos XML.');
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const getStatusBadge = (status?: TaxRecoveryStatus) => {
    switch (status) {
      case 'RASCUNHO':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">Rascunho</span>;
      case 'EM_PROCESSAMENTO':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">Em Processamento</span>;
      case 'PROCESSADA':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">Processada</span>;
      case 'PROCESSADA_COM_PENDENCIAS':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Com Pendências</span>;
      case 'CONCLUIDA':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">Concluída</span>;
      case 'CANCELADA':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">Cancelada</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="p-6 text-center space-y-4">
        <div className="text-rose-600 dark:text-rose-400 text-sm">{error || 'Análise não encontrada.'}</div>
        <Link to="/fiscal/recuperacao-impostos" className="text-brand-primary hover:underline text-sm font-medium">
          Voltar para a listagem
        </Link>
      </div>
    );
  }

  const filteredDocs = analysis.documents?.filter((doc) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      doc.nNF?.toLowerCase().includes(term) ||
      doc.access_key?.toLowerCase().includes(term) ||
      doc.issuer_name?.toLowerCase().includes(term) ||
      doc.issuer_cnpj?.includes(term)
    );
  }) || [];

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      {/* Breadcrumb & Navigation Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/fiscal/recuperacao-impostos')}
            className="p-2 rounded-md bg-surface border border-border-subtle text-text-muted hover:text-text-primary transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">{analysis.name}</h1>
              {getStatusBadge(analysis.status)}
            </div>
            <p className="text-xs text-text-muted flex items-center gap-4 mt-1">
              <span>Finalidade Entrada: <strong className="text-text-primary">{analysis.entry_purpose}</strong></span>
              <span>Destinação Real: <strong className="text-brand-primary">{analysis.real_destination}</strong></span>
              {analysis.company_name && <span>Empresa: <strong className="text-text-primary">{analysis.company_name}</strong></span>}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-primary bg-surface hover:bg-bg-deep border border-border-subtle rounded-md transition-colors shadow-sm"
          >
            <UploadCloud className="w-4 h-4 text-brand-primary" />
            Adicionar XML
          </button>

          <button
            onClick={handleProcess}
            disabled={processing || analysis.total_notes_count === 0}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primary/90 rounded-md transition-colors shadow-sm shadow-brand-primary/20 disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {analysis.status === 'PROCESSADA' || analysis.status === 'PROCESSADA_COM_PENDENCIAS'
              ? 'Reprocessar Análise'
              : 'Processar Análise'}
          </button>

          {analysis.status !== 'CONCLUIDA' && analysis.status !== 'CANCELADA' && (
            <button
              onClick={handleComplete}
              disabled={processing}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 rounded-md transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Concluir
            </button>
          )}

          {analysis.status !== 'CANCELADA' && (
            <button
              onClick={handleCancel}
              disabled={processing}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 rounded-md transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Cancelar
            </button>
          )}
        </div>
      </header>

      {/* 11 Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 bg-surface border border-border-subtle rounded-lg shadow-sm">
          <div className="text-[11px] text-text-muted uppercase font-semibold">Qtd. de Notas</div>
          <div className="text-lg font-bold text-text-primary mt-1">{analysis.total_notes_count}</div>
        </div>

        <div className="p-3 bg-surface border border-border-subtle rounded-lg shadow-sm">
          <div className="text-[11px] text-text-muted uppercase font-semibold">Valor Tot. Notas</div>
          <div className="text-xs font-bold text-text-primary mt-1 font-mono">{formatCurrency(analysis.total_notes_value)}</div>
        </div>

        <div className="p-3 bg-surface border border-border-subtle rounded-lg shadow-sm">
          <div className="text-[11px] text-text-muted uppercase font-semibold">ST Original</div>
          <div className="text-xs font-bold text-text-muted mt-1 font-mono">{formatCurrency(analysis.total_icms_st_original)}</div>
        </div>

        <div className="p-3 bg-surface border border-border-subtle rounded-lg shadow-sm">
          <div className="text-[11px] text-text-muted uppercase font-semibold">DIFAL Original</div>
          <div className="text-xs font-bold text-text-muted mt-1 font-mono">{formatCurrency(analysis.total_difal_original)}</div>
        </div>

        <div className="p-3 bg-surface border border-border-subtle rounded-lg shadow-sm">
          <div className="text-[11px] text-brand-primary uppercase font-semibold">ST Recalculado</div>
          <div className="text-xs font-bold text-brand-primary mt-1 font-mono">{formatCurrency(analysis.total_icms_st_recalculated)}</div>
        </div>

        <div className="p-3 bg-surface border border-border-subtle rounded-lg shadow-sm">
          <div className="text-[11px] text-brand-primary uppercase font-semibold">DIFAL Recalculado</div>
          <div className="text-xs font-bold text-brand-primary mt-1 font-mono">{formatCurrency(analysis.total_difal_recalculated)}</div>
        </div>

        <div className="p-3 bg-surface border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-lg shadow-sm">
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold">Total A Recuperar</div>
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{formatCurrency(analysis.total_to_recover)}</div>
        </div>

        <div className="p-3 bg-surface border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/10 rounded-lg shadow-sm">
          <div className="text-[11px] text-rose-700 dark:text-rose-400 uppercase font-semibold">Total A Recolher</div>
          <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-1 font-mono">{formatCurrency(analysis.total_to_collect)}</div>
        </div>

        <div className="p-3 bg-surface border border-brand-primary/30 rounded-lg shadow-sm col-span-2 sm:col-span-1">
          <div className="text-[11px] text-brand-primary uppercase font-semibold">Saldo Líquido</div>
          <div className={`text-sm font-extrabold mt-1 font-mono ${analysis.net_balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(analysis.net_balance)}
          </div>
        </div>

        <div className="p-3 bg-surface border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 rounded-lg shadow-sm">
          <div className="text-[11px] text-amber-700 dark:text-amber-400 uppercase font-semibold">Itens Pendentes</div>
          <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1">{analysis.pending_items_count}</div>
        </div>

        <div className="p-3 bg-surface border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 rounded-lg shadow-sm">
          <div className="text-[11px] text-amber-700 dark:text-amber-400 uppercase font-semibold">Notas c/ Pendência</div>
          <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">{formatCurrency(analysis.pending_notes_value)}</div>
        </div>
      </div>

      {/* Linked Documents Section */}
      <div className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-primary" />
            Notas Fiscais Vinculadas ({analysis.documents?.length || 0})
          </h2>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número, chave ou fornecedor..."
              className="w-full bg-bg-deep border border-border-subtle rounded-md pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
        </div>

        {/* Documents Grid */}
        <div className="border border-border-subtle rounded-lg overflow-hidden bg-surface shadow-xs">
          <div className="w-full">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-[#f8f9fa] dark:bg-bg-deep text-text-muted uppercase font-semibold text-[10px] tracking-wider border-b border-border-subtle">
                <tr>
                  <th className="px-2.5 py-2">NUM. DA NOTA</th>
                  <th className="px-2.5 py-2">FORNECEDOR</th>
                  <th className="px-2 py-2 text-center">UF ORIGEM / DESTINO</th>
                  <th className="px-2.5 py-2 text-right">VALOR DA NOTA</th>
                  <th className="px-2.5 py-2 text-right">ST CALCULADO</th>
                  <th className="px-2.5 py-2 text-right">DIFAL CALCULADO</th>
                  <th className="px-2.5 py-2 text-right">SALDO A RECUPERAR</th>
                  <th className="px-2 py-2 text-center">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-surface">
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                      {analysis.documents?.length === 0
                        ? 'Nenhuma Nota Fiscal adicionada a esta análise ainda.'
                        : 'Nenhuma Nota Fiscal encontrada para os filtros aplicados.'}
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc) => {
                    const balance = doc.total_to_recover - doc.total_to_collect;
                    const stVal = doc.icms_st_original > 0 ? doc.icms_st_original : doc.icms_st_recalculated;

                    return (
                      <tr key={doc.id} className="hover:bg-bg-deep/60 transition-colors">
                        <td className="px-2.5 py-2">
                          <div className="font-bold text-text-primary text-[11px] leading-tight">
                            NF-e nº {doc.nNF || '---'} ({doc.serie || '1'})
                          </div>
                          <div className="text-[9px] text-text-muted font-mono truncate max-w-[130px]" title={doc.access_key}>
                            {doc.access_key}
                          </div>
                        </td>

                        <td className="px-2.5 py-2">
                          <div className="font-semibold text-text-primary text-[11px] leading-tight truncate max-w-[150px]" title={doc.issuer_name || ''}>
                            {doc.issuer_name || '---'}
                          </div>
                          <div className="text-[9px] text-text-muted font-mono">{doc.issuer_cnpj || '---'}</div>
                        </td>

                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-bg-deep border border-border-subtle font-mono text-[10px] font-semibold text-text-primary">
                            {doc.uf_emit || '--'} &rarr; {doc.uf_dest || '--'}
                          </span>
                        </td>

                        <td className="px-2.5 py-2 text-right font-semibold text-text-primary font-mono text-[11px]">
                          {formatCurrency(doc.vNF)}
                        </td>

                        <td className="px-2.5 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                          {formatCurrency(stVal)}
                        </td>

                        <td className="px-2.5 py-2 text-right font-semibold text-amber-600 dark:text-amber-400 font-mono text-[11px]">
                          {formatCurrency(doc.difal_recalculated)}
                        </td>

                        <td className="px-2.5 py-2 text-right">
                          <span className={`inline-block px-2 py-0.5 font-extrabold font-mono text-[11px] rounded-md shadow-2xs ${
                            balance >= 0
                              ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}>
                            {formatCurrency(balance)}
                          </span>
                        </td>

                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenDocDetail(doc.id)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-brand-primary hover:bg-brand-primary/90 active:scale-95 rounded-md shadow-xs transition-all"
                              title="Abrir detalhes e memória de cálculo da Nota"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Abrir Nota</span>
                            </button>

                            <button
                              onClick={() => handleRemoveDoc(doc.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors"
                              title="Remover Nota da Análise"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* XML Multi-Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border-subtle rounded-xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-brand-primary" /> Upload de XMLs de NF-e
              </h3>
              <button onClick={() => setIsUploadOpen(false)} className="text-text-muted hover:text-text-primary">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadXmls} className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1 font-medium">
                  Selecione um ou múltiplos arquivos XML (.xml)
                </label>
                <input
                  type="file"
                  multiple
                  accept=".xml"
                  onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                  className="w-full text-xs text-text-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-brand-primary/90 cursor-pointer"
                />
              </div>

              {selectedFiles.length > 0 && (
                <div className="text-xs text-text-muted">
                  {selectedFiles.length} arquivo(s) selecionado(s) para importação.
                </div>
              )}

              {uploadResult && (
                <div className="space-y-2 text-xs">
                  <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> {uploadResult.imported_count} nota(s) importada(s) com sucesso.
                  </div>

                  {uploadResult.errors.length > 0 && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-md text-rose-700 dark:text-rose-300 space-y-1">
                      <div className="font-semibold text-rose-700 dark:text-rose-400">Alertas na Importação:</div>
                      <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px]">
                        {uploadResult.errors.map((errItem, idx) => (
                          <li key={idx}>
                            <strong>{errItem.filename}:</strong> {errItem.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-text-muted hover:text-text-primary"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={uploading || selectedFiles.length === 0}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-brand-primary hover:bg-brand-primary/90 rounded-md shadow-sm disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  <span>Enviar XMLs</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Document Details Modal */}
      <TaxRecoveryDocumentModal
        document={selectedDoc}
        isOpen={Boolean(selectedDoc)}
        onClose={() => setSelectedDoc(null)}
      />
    </div>
  );
};
