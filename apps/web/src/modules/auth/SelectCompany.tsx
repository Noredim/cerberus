import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, ArrowRight } from 'lucide-react';

const SelectCompany: React.FC = () => {
    const { userCompanies, setActiveCompany } = useAuth();

    return (
        <div className="min-h-screen bg-bg-deep flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-bg-surface rounded-lg border border-border-subtle shadow-xl overflow-hidden p-6">
                <div className="flex flex-col items-center justify-center mb-8">
                    <div className="bg-brand-primary/10 p-3 rounded-full mb-4">
                        <Building2 className="w-8 h-8 text-brand-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-text-primary text-center">Selecionar Empresa</h2>
                    <p className="text-sm text-text-muted text-center mt-2">
                        Escolha a empresa com a qual você deseja trabalhar nesta sessão.
                    </p>
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {userCompanies.map((company: any) => (
                        <button
                            key={company.company_id}
                            onClick={() => setActiveCompany(company.company_id)}
                            className="w-full text-left p-4 rounded-md border border-border-subtle hover:border-brand-primary hover:bg-bg-deep transition-all group flex items-center justify-between"
                        >
                            <div>
                                <h3 className="font-medium text-text-primary">{company.company_name}</h3>
                                <p className="text-xs text-text-muted mt-1">CNPJ: {company.company_cnpj}</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SelectCompany;
