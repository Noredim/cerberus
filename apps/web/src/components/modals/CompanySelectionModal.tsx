import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, CheckCircle2 } from 'lucide-react';
import type { UserCompany } from '../../contexts/AuthContext';

interface CompanySelectionModalProps {
    isOpen: boolean;
    companies: UserCompany[];
    onSelect: (companyId: string) => void;
}

const CompanySelectionModal: React.FC<CompanySelectionModalProps> = ({
    isOpen,
    companies,
    onSelect
}) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (selectedId) {
            onSelect(selectedId);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-lg bg-bg-surface rounded-xl shadow-2xl border border-border-subtle overflow-hidden flex flex-col"
                >
                    <div className="px-6 py-5 border-b border-border-subtle bg-bg-deep text-center">
                        <div className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-3">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-display font-bold text-text-primary">
                            Selecione sua Empresa
                        </h2>
                        <p className="text-sm text-text-muted mt-1">
                            Escolha a empresa ou filial com a qual você irá trabalhar nesta sessão.
                        </p>
                    </div>

                    <div className="p-6 overflow-y-auto max-h-[60vh]">
                        {companies.length === 0 ? (
                            <div className="text-center py-8 text-text-muted">
                                Nenhuma empresa vinculada ao seu usuário.
                                <br /> Procure o administrador do sistema.
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {companies.map((company) => {
                                    const isSelected = selectedId === company.company_id;
                                    return (
                                        <button
                                            key={company.company_id}
                                            onClick={() => setSelectedId(company.company_id)}
                                            className={`flex items-center p-4 rounded-lg border text-left transition-all ${
                                                isSelected 
                                                    ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary' 
                                                    : 'border-border-subtle bg-bg-deep hover:border-brand-primary/50'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <h3 className={`text-base font-semibold truncate ${isSelected ? 'text-brand-primary' : 'text-text-primary'}`}>
                                                    {company.company_name}
                                                </h3>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <p className="text-sm text-text-muted truncate">
                                                        CNPJ: {company.company_cnpj}
                                                    </p>
                                                    {company.is_default && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-brand-success/10 text-brand-success px-1.5 py-0.5 rounded">
                                                            <CheckCircle2 className="w-3 h-3" /> Padrão
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className={`w-5 h-5 ml-4 rounded-full border flex flex-shrink-0 items-center justify-center transition-colors ${
                                                isSelected 
                                                    ? 'border-brand-primary bg-brand-primary' 
                                                    : 'border-text-muted/30'
                                            }`}>
                                                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 border-t border-border-subtle bg-bg-deep flex justify-end">
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedId}
                            className="px-6 py-2.5 bg-brand-primary text-white text-sm font-medium rounded-md hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto flex justify-center"
                        >
                            Acessar Sistema
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CompanySelectionModal;
