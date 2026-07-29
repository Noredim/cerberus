import React, { useState, useRef } from 'react';
import axios from 'axios';
import {
    X,
    UploadCloud,
    FileCode,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Layers,
    RefreshCw,
    Package,
    Info
} from 'lucide-react';
import { api } from '../../../services/api';

interface NfePreviewItem {
    file_name: string;
    access_key: string;
    nNF?: string;
    serie?: string;
    mod?: string;
    natOp?: string;
    dhEmi?: string;
    competencia?: string;
    issuer_cnpj?: string;
    issuer_name?: string;
    uf_emit?: string;
    recipient_cnpj?: string;
    recipient_name?: string;
    uf_dest?: string;
    vProd: number;
    vNF: number;
    items?: Array<{
        nItem?: number;
        cProd?: string;
        xProd?: string;
        NCM?: string;
        CFOP?: string;
        uCom?: string;
        qCom?: number;
        vUnCom?: number;
        vProd?: number;
    }>;
    item_count: number;
    is_duplicate: boolean;
    existing_imported_at?: string;
    existing_imported_by?: string;
    xml_content: string;
    error?: string;
    is_event?: boolean;
    document_type?: string;
    justification?: string;
}

interface NfeBatchImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess: () => void;
}

const APLICACOES_OPTIONS = [
    { value: 'REVENDA', label: 'Revenda' },
    { value: 'MATERIAL_APLICADO', label: 'Material Aplicado' },
    { value: 'MATERIAL_COMODATO', label: 'Material para Comodato' },
    { value: 'CONSUMO_INTERNO', label: 'Consumo Interno' },
    { value: 'OUTRAS_REMESSAS', label: 'Outras Remessas' },
    { value: 'RETORNO_CONSERTO', label: 'Retorno de Conserto' },
    { value: 'COMBUSTIVEL', label: 'Combustível' },
    { value: 'CANCELAMENTO', label: 'Cancelamento' }
];

const COMPATIBILIDADE_TRIBUTACAO: Record<string, { value: string; label: string }[]> = {
    REVENDA: [
        { value: 'ICMS_ST', label: 'ICMS ST' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    OUTRAS_REMESSAS: [
        { value: 'ICMS_ST', label: 'ICMS ST' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    RETORNO_CONSERTO: [
        { value: 'ICMS_ST', label: 'ICMS ST' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    MATERIAL_APLICADO: [
        { value: 'DIFAL_ST', label: 'DIFAL ST' },
        { value: 'DIFAL', label: 'DIFAL' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    MATERIAL_COMODATO: [
        { value: 'DIFAL_ST', label: 'DIFAL ST' },
        { value: 'DIFAL', label: 'DIFAL' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    CONSUMO_INTERNO: [
        { value: 'DIFAL_ST', label: 'DIFAL ST' },
        { value: 'DIFAL', label: 'DIFAL' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    COMBUSTIVEL: [
        { value: 'DIFAL_ST', label: 'DIFAL ST' },
        { value: 'DIFAL', label: 'DIFAL' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    CANCELAMENTO: [
        { value: 'CANCELAMENTO', label: 'Cancelamento' }
    ]
};

export const NfeBatchImportModal: React.FC<NfeBatchImportModalProps> = ({
    isOpen,
    onClose,
    onImportSuccess
}) => {
    const [step, setStep] = useState<'upload' | 'classify'>('upload');
    const [files, setFiles] = useState<File[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [previews, setPreviews] = useState<NfePreviewItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [classifications, setClassifications] = useState<Record<number, { aplicacao: string; tipo_tributacao: string; observacao: string }>>({});
    const [reviewedIndices, setReviewedIndices] = useState<Record<number, boolean>>({});
    const [forceReprocess, setForceReprocess] = useState(false);
    const [allowEventWithoutInvoice, setAllowEventWithoutInvoice] = useState(true);
    const [importing, setImporting] = useState(false);

    const abortControllerRef = useRef<AbortController | null>(null);

    if (!isOpen) return null;

    const handleCancelOrClose = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setPreviewing(false);
        setImporting(false);
        clearFiles();
        onClose();
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const selectedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.xml'));
            setFiles(prev => [...prev, ...selectedFiles]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.xml'));
            setFiles(prev => [...prev, ...selectedFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const clearFiles = () => {
        setFiles([]);
        setPreviews([]);
        setClassifications({});
        setReviewedIndices({});
        setStep('upload');
        setCurrentIndex(0);
    };

    const handleStartPreview = async () => {
        if (files.length === 0) return;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setPreviewing(true);
        try {
            const formData = new FormData();
            files.forEach(f => formData.append('files', f));

            const response = await api.post('/fiscal/acompanhamento-nfe/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                signal: controller.signal
            });

            const erroredItems = response.data.previews.filter((p: NfePreviewItem) => !!p.error);
            const validItems: NfePreviewItem[] = response.data.previews.filter((p: NfePreviewItem) => !p.error);
            setPreviews(validItems);

            if (erroredItems.length > 0 && validItems.length === 0) {
                const errorMsgs = erroredItems.map((p: NfePreviewItem) => `- ${p.file_name}: ${p.error}`).join('\n');
                alert(`Nenhum arquivo XML válido foi identificado para importação:\n${errorMsgs}`);
                setPreviewing(false);
                return;
            }

            if (validItems.length === 0) {
                alert('Nenhum arquivo XML válido foi identificado para importação.');
                setPreviewing(false);
                return;
            }

            // Inicializar classificações padrão (se for evento de cancelamento, pré-selecionar CANCELAMENTO / CANCELAMENTO)
            const initialClass: Record<number, { aplicacao: string; tipo_tributacao: string; observacao: string }> = {};
            validItems.forEach((prev, idx) => {
                if (prev.is_event || prev.document_type === 'NFE_EVENT') {
                    initialClass[idx] = {
                        aplicacao: 'CANCELAMENTO',
                        tipo_tributacao: 'CANCELAMENTO',
                        observacao: prev.justification || 'Evento de Cancelamento'
                    };
                } else {
                    initialClass[idx] = { aplicacao: 'REVENDA', tipo_tributacao: 'ICMS_ST', observacao: '' };
                }
            });
            setClassifications(initialClass);
            setReviewedIndices({ 0: true });
            setStep('classify');
            setCurrentIndex(0);
        } catch (err: any) {
            if (axios.isCancel(err) || err?.name === 'CanceledError' || err?.name === 'AbortError') {
                console.log('Leitura prévia de XMLs cancelada pelo usuário.');
                return;
            }
            console.error('Erro ao realizar leitura prévia dos XMLs:', err);
            alert(err.response?.data?.detail || 'Falha ao ler arquivos XML.');
        } finally {
            setPreviewing(false);
            abortControllerRef.current = null;
        }
    };

    const handleAplicacaoChange = (index: number, aplicacao: string) => {
        const permitidas = COMPATIBILIDADE_TRIBUTACAO[aplicacao] || [];
        const defaultTrib = permitidas.length > 0 ? permitidas[0].value : '';
        setClassifications(prev => ({
            ...prev,
            [index]: {
                ...prev[index],
                aplicacao,
                tipo_tributacao: defaultTrib
            }
        }));
    };

    const handleTributacaoChange = (index: number, tipo_tributacao: string) => {
        setClassifications(prev => ({
            ...prev,
            [index]: {
                ...prev[index],
                tipo_tributacao
            }
        }));
    };

    const applyToAll = () => {
        const current = classifications[currentIndex];
        if (!current) return;
        const newClass: Record<number, { aplicacao: string; tipo_tributacao: string; observacao: string }> = {};
        const newReviewed: Record<number, boolean> = {};
        previews.forEach((_, idx) => {
            newClass[idx] = { ...current };
            newReviewed[idx] = true;
        });
        setClassifications(newClass);
        setReviewedIndices(newReviewed);
        alert('Classificação aplicada para todas as notas do lote!');
    };

    const isAllReviewed = previews.length > 0 && previews.every((_, idx) => !!reviewedIndices[idx]);
    const isLastNote = currentIndex === previews.length - 1;
    const showImportButton = isLastNote || isAllReviewed;

    const handleNextOrImport = () => {
        setReviewedIndices(prev => ({ ...prev, [currentIndex]: true }));

        if (showImportButton) {
            handleFinishImport();
        } else {
            const nextIdx = Math.min(previews.length - 1, currentIndex + 1);
            setCurrentIndex(nextIdx);
            setReviewedIndices(prev => ({ ...prev, [nextIdx]: true }));
        }
    };

    const handleFinishImport = async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setImporting(true);
        try {
            const payloadNotes = previews.map((prev, idx) => ({
                file_name: prev.file_name || 'nota.xml',
                xml_content: prev.xml_content,
                aplicacao: classifications[idx]?.aplicacao || 'CANCELAMENTO',
                tipo_tributacao: classifications[idx]?.tipo_tributacao || 'CANCELAMENTO',
                observacao_classificacao: classifications[idx]?.observacao || ''
            }));

            const response = await api.post(
                '/fiscal/acompanhamento-nfe/importar',
                {
                    notes: payloadNotes,
                    force_reprocess_duplicates: forceReprocess,
                    allow_event_without_invoice: allowEventWithoutInvoice
                },
                { signal: controller.signal }
            );

            const summary = response.data;
            alert(
                `Importação concluída com sucesso!\n` +
                `- Importadas/Classificadas: ${summary.imported_count}\n` +
                `- Duplicadas: ${summary.duplicate_count}\n` +
                `- Rejeitadas/Erros: ${summary.rejected_count}`
            );

            onImportSuccess();
            onClose();
            clearFiles();
        } catch (err: any) {
            if (axios.isCancel(err) || err?.name === 'CanceledError' || err?.name === 'AbortError') {
                console.log('Importação de lote cancelada pelo usuário.');
                return;
            }
            console.error('Erro na importação em lote:', err);
            const detailMsg = typeof err.response?.data?.detail === 'string'
                ? err.response.data.detail
                : Array.isArray(err.response?.data?.detail)
                ? err.response.data.detail.map((d: any) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join('\n')
                : 'Erro ao processar importação.';
            alert(detailMsg);
        } finally {
            setImporting(false);
            abortControllerRef.current = null;
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    const currentPreview = previews[currentIndex];
    const currentClass = classifications[currentIndex] || { aplicacao: 'REVENDA', tipo_tributacao: 'ICMS_ST', observacao: '' };
    const tributacoesPermitidas = COMPATIBILIDADE_TRIBUTACAO[currentClass.aplicacao] || [];

    const getItemsForPreview = (preview?: NfePreviewItem) => {
        if (!preview) return [];
        if (preview.items && preview.items.length > 0) {
            return preview.items;
        }
        if (!preview.xml_content) return [];
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(preview.xml_content, 'text/xml');
            const detNodes = Array.from(xmlDoc.getElementsByTagName('det'));
            return detNodes.map((det, idx) => {
                const prod = det.getElementsByTagName('prod')[0];
                const getTxt = (tag: string) => {
                    const node = prod?.getElementsByTagName(tag)[0];
                    return node ? node.textContent || '' : '';
                };
                return {
                    nItem: parseInt(det.getAttribute('nItem') || String(idx + 1), 10),
                    cProd: getTxt('cProd'),
                    xProd: getTxt('xProd'),
                    NCM: getTxt('NCM'),
                    uCom: getTxt('uCom'),
                    qCom: parseFloat(getTxt('qCom')) || undefined,
                    vUnCom: parseFloat(getTxt('vUnCom')) || undefined,
                    vProd: parseFloat(getTxt('vProd')) || undefined,
                };
            });
        } catch (e) {
            console.error('Erro ao extrair itens da prévia:', e);
            return [];
        }
    };

    const currentItems = getItemsForPreview(currentPreview);

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl border border-border-subtle shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-border-subtle bg-bg-deep flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                            <UploadCloud className="w-5 h-5 text-brand-primary" />
                            Importação e Classificação de NF-e em Lote
                        </h2>
                        <p className="text-xs text-text-muted mt-0.5">
                            {step === 'upload' ? 'Selecione ou arraste arquivos XML para leitura prévia.' : `Classificação de notas fiscais (${currentIndex + 1} de ${previews.length})`}
                        </p>
                    </div>
                    <button
                        onClick={handleCancelOrClose}
                        className="p-1.5 rounded-lg hover:bg-surface text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {step === 'upload' ? (
                        <>
                            {/* Drag and drop area */}
                            <div
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                                    dragActive ? 'border-brand-primary bg-brand-primary/10' : 'border-border-subtle bg-bg-deep/40 hover:border-brand-primary/50'
                                }`}
                            >
                                <input
                                    type="file"
                                    multiple
                                    accept=".xml"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="nfe-xml-input"
                                />
                                <label htmlFor="nfe-xml-input" className="cursor-pointer flex flex-col items-center gap-3">
                                    <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-full">
                                        <FileCode className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-text-primary">
                                            Clique para selecionar arquivos XML ou arraste até aqui
                                        </p>
                                        <p className="text-xs text-text-muted mt-1">
                                            Suporta arquivos de Nota Fiscal Eletrônica (.xml) modelo 55
                                        </p>
                                    </div>
                                </label>
                            </div>

                            {/* Selected Files List */}
                            {files.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
                                        <span>Arquivos selecionados ({files.length})</span>
                                        <button
                                            onClick={clearFiles}
                                            className="text-brand-danger hover:underline cursor-pointer"
                                        >
                                            Limpar todos
                                        </button>
                                    </div>

                                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                                        {files.map((file, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between bg-bg-deep px-3.5 py-2.5 rounded-lg border border-border-subtle text-xs"
                                            >
                                                <div className="flex items-center gap-2.5 overflow-hidden">
                                                    <FileCode className="w-4 h-4 text-brand-primary shrink-0" />
                                                    <span className="truncate font-mono font-medium text-text-primary">{file.name}</span>
                                                    <span className="text-text-muted">({(file.size / 1024).toFixed(1)} KB)</span>
                                                </div>
                                                <button
                                                    onClick={() => removeFile(idx)}
                                                    className="p-1 text-text-muted hover:text-brand-danger transition-colors cursor-pointer"
                                                    title="Remover arquivo"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Opções Avançadas de Importação */}
                            <div className="bg-bg-deep p-4 rounded-xl border border-border-subtle space-y-3">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={allowEventWithoutInvoice}
                                        onChange={e => setAllowEventWithoutInvoice(e.target.checked)}
                                        className="mt-0.5 rounded border-border-subtle text-brand-primary focus:ring-brand-primary accent-brand-primary cursor-pointer"
                                    />
                                    <div className="space-y-0.5">
                                        <span className="text-xs font-bold text-text-primary block">
                                            Importar cancelamento mesmo sem a NF-e original
                                        </span>
                                        <span className="text-[11px] text-text-muted block leading-relaxed">
                                            Quando ativado, o sistema criará um registro resumido da NF-e com situação Cancelada a partir das informações do evento.
                                        </span>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-border-subtle">
                                    <input
                                        type="checkbox"
                                        checked={forceReprocess}
                                        onChange={e => setForceReprocess(e.target.checked)}
                                        className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary accent-brand-primary cursor-pointer"
                                    />
                                    <span className="text-xs font-medium text-text-secondary">
                                        Forçar reprocessamento de notas e eventos duplicados
                                    </span>
                                </label>
                            </div>
                        </>
                    ) : (
                        /* Step 2: Classify */
                        <div className="space-y-6">
                            {/* Stepper Header */}
                            <div className="flex items-center justify-between bg-bg-deep p-3.5 rounded-lg border border-border-subtle text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-text-primary">
                                        Nota Fiscal {currentIndex + 1} de {previews.length}
                                    </span>
                                    {reviewedIndices[currentIndex] && (
                                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Classificada
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={currentIndex === 0}
                                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                        className="p-1.5 rounded border border-border-subtle bg-surface hover:bg-bg-deep disabled:opacity-40 text-text-primary cursor-pointer"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        disabled={currentIndex === previews.length - 1}
                                        onClick={() => {
                                            setReviewedIndices(prev => ({ ...prev, [currentIndex]: true }));
                                            const nextIdx = Math.min(previews.length - 1, currentIndex + 1);
                                            setCurrentIndex(nextIdx);
                                            setReviewedIndices(prev => ({ ...prev, [nextIdx]: true }));
                                        }}
                                        className="p-1.5 rounded border border-border-subtle bg-surface hover:bg-bg-deep disabled:opacity-40 text-text-primary cursor-pointer"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Current Preview Card */}
                            {currentPreview && (
                                <div className="space-y-4">
                                    {/* Duplicity warning */}
                                    {currentPreview.is_duplicate && (
                                        <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-lg flex items-start gap-3 text-xs text-amber-600 dark:text-amber-400">
                                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                            <div>
                                                <strong className="block font-bold">Nota Fiscal Duplicada Detectada!</strong>
                                                Esta NF-e (Chave {currentPreview.access_key}) já foi importada anteriormente no sistema
                                                {currentPreview.existing_imported_at && ` em ${new Date(currentPreview.existing_imported_at).toLocaleString('pt-BR')}`}.
                                            </div>
                                        </div>
                                    )}

                                    {/* Info Block */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-bg-deep p-4 rounded-xl border border-border-subtle text-xs">
                                        <div>
                                            <span className="text-text-muted block text-[10px] font-bold uppercase">Fornecedor</span>
                                            <span className="font-bold text-text-primary text-sm block mt-0.5">{currentPreview.issuer_name || '-'}</span>
                                            <span className="font-mono text-text-secondary mt-0.5 block">CNPJ: {currentPreview.issuer_cnpj || '-'}</span>
                                        </div>

                                        <div>
                                            <span className="text-text-muted block text-[10px] font-bold uppercase">Dados da Nota</span>
                                            <span className="font-semibold text-text-primary block mt-0.5">
                                                Nº {currentPreview.nNF || '-'} | Série {currentPreview.serie || '1'} (UF Origem: {currentPreview.uf_emit || '-'})
                                            </span>
                                            <span className="text-text-secondary block mt-0.5">
                                                Emissão: {currentPreview.dhEmi ? new Date(currentPreview.dhEmi).toLocaleDateString('pt-BR') : '-'}
                                                {currentPreview.competencia && <span className="font-semibold text-text-primary"> (Comp. {currentPreview.competencia})</span>}
                                            </span>
                                            {currentPreview.natOp && (
                                                <span className="text-text-secondary block mt-0.5 truncate" title={currentPreview.natOp}>
                                                    Nat. Operação: <span className="font-medium text-text-primary">{currentPreview.natOp}</span>
                                                </span>
                                            )}
                                        </div>

                                        <div className="relative group/totais">
                                             <span className="text-text-muted block text-[10px] font-bold uppercase flex items-center gap-1">
                                                 Totais <Info className="w-3 h-3 text-brand-primary cursor-help" />
                                             </span>
                                             <span className="text-base font-bold text-brand-primary block mt-0.5 cursor-help underline decoration-dotted decoration-brand-primary/40 underline-offset-4">
                                                 {formatCurrency(currentPreview.vNF)}
                                             </span>
                                             <span className="text-text-secondary block mt-0.5 cursor-help">
                                                 Produtos: {formatCurrency(currentPreview.vProd)} ({currentPreview.item_count} itens)
                                             </span>

                                             {/* Popover flutuante com as descrições dos itens ao passar o mouse */}
                                             <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-surface border border-border-subtle shadow-2xl rounded-xl p-3.5 opacity-0 invisible group-hover/totais:opacity-100 group-hover/totais:visible transition-all duration-200 z-50 pointer-events-none">
                                                 <div className="flex items-center justify-between border-b border-border-subtle pb-2 mb-2">
                                                     <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                                                         <Package className="w-3.5 h-3.5 text-brand-primary" />
                                                         Itens da Nota ({currentItems.length})
                                                     </span>
                                                     <span className="text-[10px] font-mono text-text-muted">Total: {formatCurrency(currentPreview.vNF)}</span>
                                                 </div>
                                                 <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                                                     {currentItems.map((item, i) => (
                                                         <div key={i} className="text-xs bg-bg-deep p-2.5 rounded-lg border border-border-subtle space-y-1">
                                                             <div className="flex items-start justify-between gap-2">
                                                                 <span className="font-semibold text-text-primary text-[11px] leading-snug">
                                                                     {item.nItem ? `${item.nItem}. ` : ''}{item.xProd || 'Item sem descrição'}
                                                                 </span>
                                                                 <span className="font-bold text-brand-primary text-[11px] shrink-0">
                                                                     {formatCurrency(item.vProd || 0)}
                                                                 </span>
                                                             </div>
                                                             <div className="text-[10px] text-text-muted flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono">
                                                                 {item.qCom !== undefined && <span>Qtd: {item.qCom} {item.uCom || ''}</span>}
                                                                 {item.vUnCom !== undefined && <span>Unit: {formatCurrency(item.vUnCom)}</span>}
                                                                 {item.NCM && <span>NCM: {item.NCM}</span>}
                                                             </div>
                                                         </div>
                                                     ))}
                                                     {currentItems.length === 0 && (
                                                         <p className="text-xs text-text-muted italic py-2 text-center">Nenhum detalhe de item encontrado.</p>
                                                     )}
                                                 </div>
                                             </div>
                                         </div>
                                    </div>

                                    {/* Form Block */}
                                    <div className="bg-surface p-4 rounded-xl border border-border-subtle space-y-4">
                                        <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider flex items-center gap-1.5">
                                            <Layers className="w-4 h-4" />
                                            Classificação Fiscal Obrigatória
                                        </h3>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {/* Campo Aplicação */}
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-text-primary block">
                                                    Aplicação <span className="text-brand-danger">*</span>
                                                </label>
                                                <select
                                                    value={currentClass.aplicacao}
                                                    onChange={e => handleAplicacaoChange(currentIndex, e.target.value)}
                                                    className="w-full bg-bg-deep border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                                                >
                                                    {APLICACOES_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Campo Tipo de Tributação (Filtrado) */}
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-text-primary block">
                                                    Tipo de Tributação <span className="text-brand-danger">*</span>
                                                </label>
                                                <select
                                                    value={currentClass.tipo_tributacao}
                                                    onChange={e => handleTributacaoChange(currentIndex, e.target.value)}
                                                    className="w-full bg-bg-deep border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                                                >
                                                    {tributacoesPermitidas.map(opt => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Observações */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-text-primary block">
                                                Observação da Classificação (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                value={currentClass.observacao}
                                                onChange={e => setClassifications(prev => ({
                                                    ...prev,
                                                    [currentIndex]: { ...prev[currentIndex], observacao: e.target.value }
                                                }))}
                                                placeholder="Justificativa ou nota interna..."
                                                className="w-full bg-bg-deep border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                                            />
                                        </div>

                                        {/* Ação Aplicar a todas */}
                                        <div className="pt-2 flex items-center justify-between border-t border-border-subtle text-xs">
                                            <button
                                                type="button"
                                                onClick={applyToAll}
                                                className="text-brand-primary font-medium hover:underline cursor-pointer flex items-center gap-1.5"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                                Aplicar esta mesma classificação para todas as {previews.length} notas do lote
                                            </button>

                                            {previews.some(p => p.is_duplicate) && (
                                                <label className="flex items-center gap-2 cursor-pointer text-text-secondary font-medium">
                                                    <input
                                                        type="checkbox"
                                                        checked={forceReprocess}
                                                        onChange={e => setForceReprocess(e.target.checked)}
                                                        className="rounded text-brand-primary focus:ring-brand-primary"
                                                    />
                                                    Sobrescrever/Reprocessar notas duplicadas
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border-subtle bg-bg-deep flex items-center justify-between">
                    {step === 'upload' ? (
                        <>
                            <button
                                onClick={handleCancelOrClose}
                                className="px-4 py-2 border border-border-subtle rounded-lg text-xs font-medium text-text-secondary hover:bg-surface transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>

                            <button
                                disabled={files.length === 0 || previewing}
                                onClick={handleStartPreview}
                                className="px-5 py-2 bg-brand-primary text-white rounded-lg text-xs font-semibold hover:bg-brand-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
                            >
                                {previewing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processando XMLs...
                                    </>
                                ) : (
                                    <>
                                        Avançar para Classificação ({files.length})
                                        <ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setStep('upload')}
                                className="px-4 py-2 border border-border-subtle rounded-lg text-xs font-medium text-text-secondary hover:bg-surface transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Voltar para Upload
                            </button>

                            <button
                                disabled={importing}
                                onClick={handleNextOrImport}
                                className={`px-6 py-2 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer ${
                                    showImportButton ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-brand-primary hover:bg-brand-primary/90'
                                }`}
                            >
                                {importing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Salvação e Importação...
                                    </>
                                ) : showImportButton ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        Confirmar e Importar Lote ({previews.length} {previews.length === 1 ? 'nota' : 'notas'})
                                    </>
                                ) : (
                                    <>
                                        Confirmar e Próxima Nota ({currentIndex + 1} de {previews.length})
                                        <ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
