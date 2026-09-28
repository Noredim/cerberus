import React, { useState, useRef } from 'react';
import { 
  Download, Upload, FileSpreadsheet, AlertTriangle, 
  RefreshCw, ArrowRight, Check, Loader2
} from 'lucide-react';
import Modal from '../../../components/modals/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { api } from '../../../services/api';

interface ImportPreviewItem {
  linha: number;
  codigo: string;
  nome: string;
  quantidade: number;
  valor_unitario_estimado: number;
  is_duplicate: boolean;
  duplicate_reason?: string;
}

interface ImportPreviewResponse {
  items: ImportPreviewItem[];
  total_itens: number;
  total_quantidade: number;
  total_valor_estimado_unitario: number;
  total_duplicados: number;
}

interface LicitacaoItemImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  licitacaoId: string;
  lote: {
    id: string;
    numero: string;
    nome: string;
  } | null;
  onSuccess: () => void;
}

export const LicitacaoItemImportModal: React.FC<LicitacaoItemImportModalProps> = ({
  isOpen,
  onClose,
  licitacaoId,
  lote,
  onSuccess,
}) => {
  const [tipoFornecimento, setTipoFornecimento] = useState<'Unitário' | 'Mensal'>('Unitário');
  const [totalMeses, setTotalMeses] = useState<number>(12);
  const [estrategia, setEstrategia] = useState<'ADICIONAR' | 'SUBSTITUIR'>('ADICIONAR');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setErrorMsg(null);
    setIsAnalyzing(false);
    setIsSubmitting(false);
    setTipoFornecimento('Unitário');
    setTotalMeses(12);
    setEstrategia('ADICIONAR');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      setErrorMsg(null);
      const response = await api.get('/licitacoes/templates/itens-lote-template', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Template_Importacao_Itens_Lote.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erro ao baixar template:', err);
      setErrorMsg('Falha ao baixar o modelo oficial de planilha.');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setPreviewData(null);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!validExtensions.includes(ext)) {
        setErrorMsg('Formato inválido. Por favor, envie uma planilha .xlsx, .xls ou arquivo .csv.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleAnalyzeFile = async () => {
    if (!selectedFile || !lote) return;

    try {
      setIsAnalyzing(true);
      setErrorMsg(null);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await api.post<ImportPreviewResponse>(
        `/licitacoes/${licitacaoId}/lotes/${lote.id}/preview-import-items`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setPreviewData(response.data);
    } catch (err: any) {
      console.error('Erro ao analisar arquivo:', err);
      const detail = err.response?.data?.detail || 'Erro ao processar e validar a planilha enviada.';
      setErrorMsg(detail);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !lote) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      await api.post(`/licitacoes/${licitacaoId}/lotes/${lote.id}/import-items`, {
        tipo_fornecimento: tipoFornecimento,
        total_meses: tipoFornecimento === 'Mensal' ? totalMeses : null,
        estrategia: estrategia,
        items: previewData.items.map(item => ({
          codigo: item.codigo,
          nome: item.nome,
          quantidade: item.quantidade,
          valor_unitario_estimado: item.valor_unitario_estimado,
        })),
      });

      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Erro ao confirmar importação:', err);
      const detail = err.response?.data?.detail || 'Erro ao importar os itens para o lote.';
      setErrorMsg(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!lote) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Importar Itens da Planilha — Lote ${lote.numero}: ${lote.nome}`}
      maxWidth="4xl"
    >
      <div className="space-y-5 text-text-primary">
        {/* Banner de Instruções e Download de Modelo */}
        <div className="bg-bg-deep/60 border border-border-subtle rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-lg shrink-0 mt-0.5">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-text-primary">
                Importação em Lote via Planilha
              </h4>
              <p className="text-xs text-text-muted">
                Preencha as colunas <strong>Item</strong>, <strong>Nome do Item</strong>, <strong>Quantidade</strong> e <strong>Valor Estimado Unitário</strong>.
                Formatos aceitos: <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
            className="shrink-0 flex items-center gap-2 text-xs border-border-subtle hover:bg-bg-surface"
          >
            {isDownloadingTemplate ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-primary" />
            ) : (
              <Download className="w-3.5 h-3.5 text-brand-primary" />
            )}
            <span>Baixar Modelo (.xlsx)</span>
          </Button>
        </div>

        {/* Configurações de Fornecimento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-bg-surface p-4 rounded-xl border border-border-subtle">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase">
              Tipo do Fornecimento *
            </label>
            <select
              value={tipoFornecimento}
              onChange={(e) => setTipoFornecimento(e.target.value as 'Unitário' | 'Mensal')}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-10"
            >
              <option value="Unitário">Unitário (Entrega Única / Global)</option>
              <option value="Mensal">Mensal (Serviço Continuado / Recorrente)</option>
            </select>
          </div>

          {tipoFornecimento === 'Mensal' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase">
                Total de Meses do Contrato *
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={totalMeses}
                onChange={(e) => setTotalMeses(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-10"
                placeholder="Ex: 12"
              />
            </div>
          ) : (
            <div className="space-y-1.5 opacity-60">
              <label className="text-xs font-bold text-text-muted uppercase">
                Total de Meses
              </label>
              <input
                type="text"
                disabled
                value="Não aplicável (Unitário)"
                className="w-full bg-bg-deep/50 border border-border-subtle rounded-md py-2 px-3 text-sm text-text-muted focus:outline-none h-10 cursor-not-allowed"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase">
              Estratégia de Importação
            </label>
            <select
              value={estrategia}
              onChange={(e) => setEstrategia(e.target.value as 'ADICIONAR' | 'SUBSTITUIR')}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-10"
            >
              <option value="ADICIONAR">Adicionar aos itens existentes</option>
              <option value="SUBSTITUIR">Substituir itens existentes do Lote</option>
            </select>
          </div>
        </div>

        {/* Upload e Seleção de Arquivo */}
        {!previewData && (
          <div className="space-y-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border-subtle hover:border-brand-primary/50 bg-bg-deep/30 hover:bg-bg-deep/50 rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-3"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-full">
                <Upload className="w-6 h-6" />
              </div>
              {selectedFile ? (
                <div>
                  <p className="text-sm font-semibold text-text-primary">{selectedFile.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {(selectedFile.size / 1024).toFixed(1)} KB — Clique para escolher outro arquivo
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Clique aqui ou arraste sua planilha
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Formatos suportados: Excel (.xlsx, .xls) ou CSV
                  </p>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isAnalyzing}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleAnalyzeFile}
                disabled={!selectedFile || isAnalyzing}
                className="flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <span>Validar & Pré-visualizar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Pré-visualização dos Itens Carregados */}
        {previewData && (
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-bg-surface rounded-xl border border-border-subtle">
                <span className="text-[10px] font-bold uppercase text-text-muted tracking-wider">Itens Encontrados</span>
                <p className="text-lg font-bold text-text-primary mt-0.5">{previewData.total_itens}</p>
              </div>

              <div className="p-3 bg-bg-surface rounded-xl border border-border-subtle">
                <span className="text-[10px] font-bold uppercase text-text-muted tracking-wider">Quantidade Total</span>
                <p className="text-lg font-bold text-text-primary mt-0.5">
                  {Number(previewData.total_quantidade).toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="p-3 bg-bg-surface rounded-xl border border-border-subtle">
                <span className="text-[10px] font-bold uppercase text-text-muted tracking-wider">Soma Est. Unitário</span>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {Number(previewData.total_valor_estimado_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>

              <div className="p-3 bg-bg-surface rounded-xl border border-border-subtle">
                <span className="text-[10px] font-bold uppercase text-text-muted tracking-wider">Duplicidades / Alertas</span>
                <p className={`text-lg font-bold mt-0.5 ${previewData.total_duplicados > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {previewData.total_duplicados} {previewData.total_duplicados > 0 ? 'alertas' : 'nenhum'}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Tabela de Preview */}
            <div className="border border-border-subtle rounded-xl overflow-hidden bg-bg-surface">
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-bg-deep/80 text-text-muted uppercase text-[10px] font-semibold sticky top-0 backdrop-blur z-10 border-b border-border-subtle">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">Linha</th>
                      <th className="py-2.5 px-3 w-20">Item</th>
                      <th className="py-2.5 px-3">Nome / Descrição</th>
                      <th className="py-2.5 px-3 text-right w-24">Qtd</th>
                      <th className="py-2.5 px-3 text-right w-32">Est. Unitário</th>
                      <th className="py-2.5 px-3 text-right w-32">Est. Total</th>
                      <th className="py-2.5 px-3 w-36 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {previewData.items.map((item, idx) => {
                      const totalEstimado = Number(item.valor_unitario_estimado) * Number(item.quantidade) * (tipoFornecimento === 'Mensal' ? totalMeses : 1);
                      return (
                        <tr 
                          key={idx} 
                          className={`hover:bg-bg-deep/30 transition-colors ${item.is_duplicate ? 'bg-amber-500/5' : ''}`}
                        >
                          <td className="py-2 px-3 text-center text-text-muted font-mono">{item.linha}</td>
                          <td className="py-2 px-3 font-semibold text-text-primary">{item.codigo}</td>
                          <td className="py-2 px-3 text-text-primary">
                            <span className="line-clamp-1" title={item.nome}>{item.nome}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-text-primary">
                            {Number(item.quantidade).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-text-primary">
                            {Number(item.valor_unitario_estimado) > 0 ? (
                              Number(item.valor_unitario_estimado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            ) : (
                              <span className="text-text-muted">R$ 0,00</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                            {totalEstimado > 0 ? (
                              totalEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            ) : (
                              <span className="text-text-muted">R$ 0,00</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.is_duplicate ? (
                              <Badge variant="warning" className="text-[10px] px-1.5 py-0.5 whitespace-nowrap">
                                ⚠️ {item.duplicate_reason || 'Duplicado'}
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-[10px] px-1.5 py-0.5 whitespace-nowrap">
                                ✓ Válido
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ações da visualização */}
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewData(null);
                  setSelectedFile(null);
                  setErrorMsg(null);
                }}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Escolher outra planilha</span>
              </Button>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleConfirmImport}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar e Importar {previewData.total_itens} Itens</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
