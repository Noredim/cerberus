import React, { useState } from 'react';
import {
    X,
    Upload,
    FileJson,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { ncmApi } from '../api/ncmApi';
import type { NcmImportResult } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const NcmImportModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<NcmImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected && selected.type === 'application/json') {
            setFile(selected);
            setError(null);
            setResult(null);
        } else {
            setError('Por favor, selecione um arquivo JSON válido.');
            setFile(null);
        }
    };

    const handleImport = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);

        try {
            const text = await file.text();
            const jsonData = JSON.parse(text);

            if (!jsonData.Nomenclaturas || !Array.isArray(jsonData.Nomenclaturas)) {
                throw new Error('Formato JSON inválido. Deve conter o campo "Nomenclaturas".');
            }

            const importResult = await ncmApi.importJson(jsonData);
            setResult(importResult);
        } catch (err: any) {
            setError(err.message || 'Erro ao processar o arquivo.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-surface w-full max-w-lg rounded-2xl border border-border-subtle shadow-2xl overflow-hidden"
            >
                <div className="p-6 border-b border-border-subtle flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-primary/10 rounded-lg">
                            <Upload className="w-5 h-5 text-brand-primary" />
                        </div>
                        <h2 className="text-xl font-bold text-text-primary">Importar NCM (JSON)</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-bg-deep rounded-full text-text-muted cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8">
                    {!result ? (
                        <div className="space-y-6">
                            <label className="border-2 border-dashed border-border-subtle rounded-xl p-10 flex flex-col items-center gap-4 bg-bg-deep/30 transition-colors hover:bg-bg-deep/50 relative cursor-pointer group">
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileChange}
                                    className="sr-only"
                                />
                                <div className="p-4 bg-surface border border-border-subtle rounded-full shadow-sm group-hover:border-brand-primary transition-colors">
                                    <FileJson className="w-8 h-8 text-brand-primary" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-text-primary">
                                        {file ? file.name : 'Selecione o arquivo JSON'}
                                    </p>
                                    <p className="text-xs text-text-muted mt-1">
                                        Tamanho máximo recomendado: 10MB
                                    </p>
                                </div>
                            </label>

                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                                    <p className="text-sm text-red-500 font-medium">{error}</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2 text-sm font-medium text-text-muted hover:text-text-primary cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={!file || loading}
                                    onClick={handleImport}
                                    className="flex items-center gap-2 bg-brand-primary text-white px-8 py-2.5 rounded-lg font-bold hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Processando...
                                        </>
                                    ) : 'Iniciar Importação'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 py-4">
                            <div className="flex flex-col items-center gap-4">
                                <div className="p-4 bg-green-500/10 rounded-full">
                                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-text-primary">Importação Concluída</h3>
                                    <p className="text-text-muted text-sm mt-1">Os dados foram processados com sucesso.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-bg-deep rounded-xl border border-border-subtle">
                                    <p className="text-xs font-bold text-text-muted uppercase mb-1">Processados</p>
                                    <p className="text-2xl font-display font-bold text-text-primary">{result.total_processados}</p>
                                </div>
                                <div className="p-4 bg-green-500/5 rounded-xl border border-green-500/10">
                                    <p className="text-xs font-bold text-green-600 uppercase mb-1">Inseridos</p>
                                    <p className="text-2xl font-display font-bold text-green-600">{result.total_inseridos}</p>
                                </div>
                                <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                                    <p className="text-xs font-bold text-blue-600 uppercase mb-1">Atualizados</p>
                                    <p className="text-2xl font-display font-bold text-blue-600">{result.total_atualizados}</p>
                                </div>
                                <div className="p-4 bg-yellow-500/5 rounded-xl border border-yellow-500/10">
                                    <p className="text-xs font-bold text-yellow-600 uppercase mb-1">Ignorados/Erro</p>
                                    <p className="text-2xl font-display font-bold text-yellow-600">{result.total_ignorados}</p>
                                </div>
                            </div>

                            <button
                                onClick={onSuccess}
                                className="w-full flex items-center justify-center gap-2 bg-text-primary text-surface px-6 py-3 rounded-xl font-bold hover:bg-text-primary/90 transition-all cursor-pointer"
                            >
                                Ver Listagem
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
