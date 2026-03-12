import React, { useState } from 'react';
import {
    Upload,
    FileText,
    X,
    AlertTriangle,
    CheckCircle2,
    Info,
    Download
} from 'lucide-react';
import { api } from '../../../services/api';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';

interface NcmStImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    headerId: string;
    onSuccess: (summary: any) => void;
}

const NcmStImportModal: React.FC<NcmStImportModalProps> = ({ isOpen, onClose, headerId, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [strategy, setStrategy] = useState<'REPLACE' | 'APPEND'>('REPLACE');
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleImport = async () => {
        if (!file) {
            setError('Por favor, selecione um arquivo CSV.');
            return;
        }

        try {
            setImporting(true);
            setError(null);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('strategy', strategy);

            const response = await api.post(`/cadastro/ncm-st/${headerId}/importar-csv`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            onSuccess(response.data);
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao importar arquivo.');
        } finally {
            setImporting(false);
        }
    };

    const downloadTemplate = () => {
        const headers = "item,ativo,ncm_sh,ncm_normalizado,cest,descricao,observacoes,vigencia_inicio,fundamento,segmento_anexo,cest_normalizado,mva_percent,vigencia_fim";
        const blob = new Blob([headers], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'modelo_ncm_st.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <Card className="w-full max-w-lg shadow-2xl border-none">
                <div className="p-6 border-b border-border-subtle flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                            <Upload className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-text-primary">Importar Itens NCM ST</h2>
                            <p className="text-sm text-text-muted">Selecione um arquivo CSV com os dados.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-bg-deep rounded-full transition-colors">
                        <X className="w-5 h-5 text-text-muted" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-bg-deep border-2 border-dashed border-border-subtle rounded-xl p-8 flex flex-col items-center justify-center gap-4 group hover:border-brand-primary/50 transition-colors relative">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="w-12 h-12 rounded-full bg-surface shadow-sm flex items-center justify-center text-text-muted group-hover:scale-110 group-hover:text-brand-primary transition-all">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-text-primary">
                                {file ? file.name : 'Clique para selecionar ou arraste o arquivo'}
                            </p>
                            <p className="text-xs text-text-muted mt-1">Apenas arquivos .CSV são permitidos</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                            <Info className="w-4 h-4 text-brand-primary" />
                            Estratégia de Importação
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setStrategy('REPLACE')}
                                className={`p-3 rounded-lg border text-sm font-medium transition-all flex flex-col gap-1 ${strategy === 'REPLACE' ? 'bg-brand-primary/5 border-brand-primary text-brand-primary ring-1 ring-brand-primary/20' : 'bg-surface border-border-subtle text-text-muted hover:bg-bg-deep'}`}
                            >
                                Substituir
                                <span className="text-[10px] font-normal opacity-80">Apaga itens atuais e insere novos</span>
                            </button>
                            <button
                                onClick={() => setStrategy('APPEND')}
                                className={`p-3 rounded-lg border text-sm font-medium transition-all flex flex-col gap-1 ${strategy === 'APPEND' ? 'bg-brand-primary/5 border-brand-primary text-brand-primary ring-1 ring-brand-primary/20' : 'bg-surface border-border-subtle text-text-muted hover:bg-bg-deep'}`}
                            >
                                Adicionar
                                <span className="text-[10px] font-normal opacity-80">Mantém itens atuais e soma novos</span>
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-brand-danger/10 border border-brand-danger/20 text-brand-danger p-3 rounded-md flex items-center gap-2 animate-in slide-in-from-top-2">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    )}

                    <div className="bg-bg-deep rounded-lg p-4 flex items-start gap-3">
                        <Download className="w-5 h-5 text-brand-primary mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-text-primary">Modelo de Importação</p>
                            <p className="text-xs text-text-muted mt-0.5">Baixe o arquivo CSV modelo com as colunas necessárias.</p>
                            <button
                                onClick={downloadTemplate}
                                className="text-xs font-bold text-brand-primary hover:underline mt-2 flex items-center gap-1"
                            >
                                Baixar Modelo.csv
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-border-subtle flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleImport}
                        disabled={importing || !file}
                        className="bg-brand-primary"
                    >
                        {importing ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Importando...
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Confirmar Importação
                            </div>
                        )}
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default NcmStImportModal;
