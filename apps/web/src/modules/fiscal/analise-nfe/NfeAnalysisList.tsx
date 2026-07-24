import React, { useEffect, useState } from 'react';
import {
    FileText,
    Search,
    Plus,
    Loader2,
    Trash2,
    Eye,
    UploadCloud,
    AlertCircle,
    X,
    CheckCircle2,
    RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';

interface NfeAnalysis {
    id: string;
    tenant_id: string;
    name: string;
    file_name: string;
    file_hash: string;
    status: string;
    error_message: string | null;
    created_at: string;
    updated_at: string;
    fiscal_document: {
        id: string;
        access_key: string;
        nNF: string | null;
        serie: string | null;
        issuer_name: string | null;
        vNF: number | null;
    } | null;
}

const NfeAnalysisList: React.FC = () => {
    const navigate = useNavigate();
    const [analyses, setAnalyses] = useState<NfeAnalysis[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [analysisName, setAnalysisName] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // Duplicate handling states
    const [duplicateInfo, setDuplicateInfo] = useState<{
        access_key: string;
        name: string;
        imported_at: string;
    } | null>(null);

    // Fetch analysis list
    const fetchAnalyses = async () => {
        setLoading(true);
        try {
            const response = await api.get('/fiscal/analise-nfe');
            setAnalyses(response.data);
        } catch (error) {
            console.error('Error loading Nfe analyses:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalyses();
    }, []);

    // Handle delete
    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Deseja realmente excluir a análise "${name}"?`)) return;
        
        try {
            await api.delete(`/fiscal/analise-nfe/${id}`);
            setAnalyses(prev => prev.filter(item => item.id !== id));
        } catch (error) {
            console.error('Error deleting analysis:', error);
            alert('Não foi possível excluir a análise.');
        }
    };

    // Handle upload submit
    const handleUpload = async (force: boolean = false) => {
        if (!selectedFile) {
            setUploadError('Por favor, selecione um arquivo XML.');
            return;
        }
        if (!analysisName.trim()) {
            setUploadError('Por favor, defina um nome para a análise.');
            return;
        }

        setUploading(true);
        setUploadError(null);

        const formData = new FormData();
        formData.append('name', analysisName);
        formData.append('file', selectedFile);
        formData.append('force_reprocess', force ? 'true' : 'false');

        try {
            const response = await api.post('/fiscal/analise-nfe', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            // On success, close modal and reload list
            setIsModalOpen(false);
            setAnalysisName('');
            setSelectedFile(null);
            setDuplicateInfo(null);
            fetchAnalyses();
            
            // Navigate directly to the detail mirror
            navigate(`/fiscal/analise-nfe/${response.data.id}`);

        } catch (error: any) {
            console.error('Error uploading NFe XML:', error);
            if (error.response && error.response.status === 409) {
                // Duplicate NFe
                const detail = error.response.data.detail;
                if (detail && detail.duplicate) {
                    setDuplicateInfo({
                        access_key: detail.access_key,
                        name: detail.name,
                        imported_at: detail.imported_at
                    });
                } else {
                    setUploadError('Esta nota já foi importada no sistema.');
                }
            } else {
                setUploadError(error.response?.data?.detail || 'Erro ao realizar upload da nota.');
            }
        } finally {
            setUploading(false);
        }
    };

    // Filter results
    const filteredAnalyses = analyses.filter(item => 
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.file_name.toLowerCase().includes(search.toLowerCase()) ||
        (item.fiscal_document?.access_key && item.fiscal_document.access_key.includes(search)) ||
        (item.fiscal_document?.issuer_name && item.fiscal_document.issuer_name.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="space-y-6 w-full">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                        Análise de <span className="text-brand-primary">NF-e</span>
                    </h1>
                    <p className="text-text-muted mt-1">Importe notas fiscais no formato XML para conferência, auditoria de tributos e formação de espelho da nota.</p>
                </div>

                <button
                    onClick={() => {
                        setIsModalOpen(true);
                        setUploadError(null);
                        setDuplicateInfo(null);
                    }}
                    className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md font-medium hover:bg-brand-primary/90 transition-colors min-h-[40px] cursor-pointer shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    Nova Importação
                </button>
            </header>

            {/* List Table */}
            <div className="bg-surface rounded-lg border border-border-subtle shadow-sm flex flex-col">
                <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-surface gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por nome da análise, arquivo, chave ou emitente..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-1.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                        />
                    </div>
                </div>

                <div className="min-h-[200px] overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#f8f9fa] dark:bg-bg-deep">
                            <tr className="text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                                <th className="px-6 py-3 font-semibold">Análise</th>
                                <th className="px-6 py-3 font-semibold">Arquivo XML</th>
                                <th className="px-6 py-3 font-semibold">Dados da Nota</th>
                                <th className="px-6 py-3 font-semibold">Status</th>
                                <th className="px-6 py-3 font-semibold">Data da Importação</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle bg-surface">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-text-muted">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-primary" />
                                        Carregando análises de XML...
                                    </td>
                                </tr>
                            ) : filteredAnalyses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-text-muted">
                                        Nenhuma análise de NF-e cadastrada.
                                    </td>
                                </tr>
                            ) : filteredAnalyses.map((item) => (
                                <tr key={item.id} className="hover:bg-bg-deep/40 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-text-primary">{item.name}</div>
                                        {item.fiscal_document?.issuer_name && (
                                            <div className="text-xs text-text-muted">{item.fiscal_document.issuer_name}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-text-secondary">
                                        <div className="flex items-center gap-1.5">
                                            <FileText className="w-4 h-4 text-text-muted" />
                                            <span className="truncate max-w-[200px]" title={item.file_name}>{item.file_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {item.fiscal_document ? (
                                            <div>
                                                <div className="font-mono text-xs text-text-primary">
                                                    {item.fiscal_document.access_key.replace(/(.{4})/g, '$1 ').trim()}
                                                </div>
                                                <div className="text-xs text-text-muted mt-0.5">
                                                    NF-e Nº {item.fiscal_document.nNF || '-'} | Série {item.fiscal_document.serie || '-'}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-text-muted">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {item.status === 'PROCESSED' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Processado
                                            </span>
                                        )}
                                        {item.status === 'PENDING' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                Pendente
                                            </span>
                                        )}
                                        {item.status === 'ERROR' && (
                                            <span 
                                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 cursor-help"
                                                title={item.error_message || 'Erro no processamento'}
                                            >
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                Erro
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-text-secondary">
                                        {new Date(item.created_at).toLocaleString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            {item.status === 'PROCESSED' && (
                                                <button
                                                    onClick={() => navigate(`/fiscal/analise-nfe/${item.id}`)}
                                                    className="p-1.5 text-text-muted hover:text-brand-primary transition-colors cursor-pointer rounded hover:bg-bg-deep"
                                                    title="Visualizar Espelho"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(item.id, item.name)}
                                                className="p-1.5 text-text-muted hover:text-brand-danger transition-colors cursor-pointer rounded hover:bg-bg-deep"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Importação */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-bg-surface w-full max-w-lg rounded-lg border border-border-subtle shadow-xl overflow-hidden flex flex-col"
                    >
                        <header className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-surface">
                            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                <UploadCloud className="w-5 h-5 text-brand-primary" />
                                Importar XML de NF-e
                            </h3>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </header>

                        <div className="p-6 space-y-4 flex-1">
                            {uploadError && (
                                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-brand-danger rounded-md text-sm flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{uploadError}</span>
                                </div>
                            )}

                            {duplicateInfo ? (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-md text-sm space-y-3">
                                    <div className="flex items-start gap-2.5 text-amber-800 dark:text-amber-400 font-semibold">
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <span>Esta nota fiscal já foi feito o upload!</span>
                                    </div>
                                    <p className="text-text-secondary text-xs">
                                        Importada anteriormente na análise <strong className="text-text-primary">"{duplicateInfo.name}"</strong> em {new Date(duplicateInfo.imported_at).toLocaleString('pt-BR')}.
                                    </p>
                                    <p className="text-text-secondary text-xs font-medium">
                                        Deseja reprocessar a nota? Ela será atualizada com os dados do arquivo atual e registrará a data de processamento de hoje.
                                    </p>
                                    <div className="flex items-center gap-2 pt-1">
                                        <button
                                            type="button"
                                            disabled={uploading}
                                            onClick={() => handleUpload(true)}
                                            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded font-medium transition-colors cursor-pointer"
                                        >
                                            {uploading ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <RefreshCw className="w-3.5 h-3.5" />
                                            )}
                                            Sim, Reprocessar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDuplicateInfo(null)}
                                            className="bg-bg-deep hover:bg-bg-surface border border-border-subtle text-text-primary text-xs px-3 py-1.5 rounded font-medium transition-colors cursor-pointer"
                                        >
                                            Voltar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                                            Nome da Análise
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Análise de Custo - Fornecedor X"
                                            value={analysisName}
                                            onChange={(e) => setAnalysisName(e.target.value)}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                                            Arquivo XML da Nota (.xml)
                                        </label>
                                        <div className="border-2 border-dashed border-border-subtle rounded-lg p-6 flex flex-col items-center justify-center bg-bg-deep hover:border-brand-primary/50 transition-colors relative">
                                            <input
                                                type="file"
                                                accept=".xml"
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files.length > 0) {
                                                        const file = e.target.files[0];
                                                        setSelectedFile(file);
                                                        // Auto fill analysis name if empty
                                                        if (!analysisName) {
                                                            setAnalysisName(`Análise - ${file.name.replace('.xml', '')}`);
                                                        }
                                                    }
                                                }}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <UploadCloud className="w-10 h-10 text-text-muted mb-2" />
                                            {selectedFile ? (
                                                <div className="text-center">
                                                    <p className="text-sm font-semibold text-text-primary">{selectedFile.name}</p>
                                                    <p className="text-xs text-text-muted">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <p className="text-sm text-text-secondary font-medium">Arraste ou clique para selecionar</p>
                                                    <p className="text-xs text-text-muted mt-1">Somente arquivos .xml de NF-e</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {!duplicateInfo && (
                            <footer className="px-6 py-4 border-t border-border-subtle bg-bg-deep flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-border-subtle rounded-md text-sm text-text-secondary hover:bg-bg-surface transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    disabled={uploading}
                                    onClick={() => handleUpload(false)}
                                    className="flex items-center gap-2 bg-brand-primary text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                                >
                                    {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Começar Importação
                                </button>
                            </footer>
                        )}
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default NfeAnalysisList;
