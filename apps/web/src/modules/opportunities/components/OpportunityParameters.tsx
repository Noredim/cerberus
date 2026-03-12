import { useState, useEffect } from 'react';
import { Save, Calculator, Percent, TrendingUp, HelpCircle } from 'lucide-react';
import { useOpportunities } from '../hooks/useOpportunities';
import type { OpportunityParametersSalesUpdatePayload } from '../types';

interface OpportunityParametersProps {
    oppId: string;
    // Opcional: Se quisermos o parent passar dados da Empresa para autofill
    empresaTributacao?: any;
}

export function OpportunityParameters({ oppId, empresaTributacao }: OpportunityParametersProps) {
    const { getParametersSales, updateParametersSales, loading: apiLoading } = useOpportunities();
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    // Form State
    const [formData, setFormData] = useState<OpportunityParametersSalesUpdatePayload>({
        mkp_padrao: 0,
        percentual_despesas_administrativas: 0,
        percentual_comissao_padrao: 0,
        pis_percentual: 0,
        cofins_percentual: 0,
        csll_percentual: 0,
        irpj_percentual: 0,
        iss_percentual: 0
    });

    useEffect(() => {
        if (oppId) {
            loadParams();
        }
    }, [oppId]);

    // O Auto-fill a partir da Empresa (se estiver vazio na API, usamos os defaults da Empresa)
    // Para simplificar, o backend retorna 0 se nunca salvo.
    // Então, se get vier 0, e tivermos empresaTributacao, sugerimos.
    const loadParams = async () => {
        setLoading(true);
        try {
            const data = await getParametersSales(oppId);
            if (data) {
                // Remove id e opp_id para o estado do form
                const { id, opportunity_id, ...rest } = data;

                // Lógica de Autofill visual se a API retornou tudo zero (provável primeiro acesso)
                const isAllZero = Object.values(rest).every(v => Number(v) === 0);

                if (isAllZero && empresaTributacao) {
                    setFormData({
                        mkp_padrao: 1.50, // Exemplo de markup genérico caso precise sugerir algo
                        percentual_despesas_administrativas: Number(empresaTributacao.rate_adm || 0),
                        percentual_comissao_padrao: Number(empresaTributacao.rate_comissao || 0),
                        pis_percentual: Number(empresaTributacao.aliquota_pis || 0),
                        cofins_percentual: Number(empresaTributacao.aliquota_cofins || 0),
                        csll_percentual: Number(empresaTributacao.aliquota_csll || 0),
                        irpj_percentual: Number(empresaTributacao.aliquota_irpj || 0),
                        iss_percentual: Number(empresaTributacao.aliquota_iss || 0)
                    });
                } else {
                    setFormData(rest);
                }
            }
        } catch (error) {
            console.error('Failed to load parameters:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof OpportunityParametersSalesUpdatePayload, value: string) => {
        const numValue = value === '' ? 0 : Number(value.replace(',', '.'));
        setFormData(prev => ({ ...prev, [field]: numValue }));
        setSaved(false);
    };

    const handleSave = async () => {
        try {
            await updateParametersSales(oppId, formData);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Failed to save parameters:', error);
            alert('Erro ao salvar os parâmetros. Tente novamente.');
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-text-muted animate-pulse">Carregando parâmetros...</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        <Calculator className="text-brand-primary" size={24} />
                        Parâmetros de Venda
                    </h2>
                    <p className="text-sm text-text-muted mt-1">
                        Defina os percentuais padrão e impostos que serão aplicados no motor de preços desta oportunidade.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={apiLoading}
                    className="flex items-center justify-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-xl hover:bg-brand-primary/90 transition-all font-medium shadow-sm disabled:opacity-50"
                >
                    <Save size={18} />
                    {saved ? 'Salvo com Sucesso!' : 'Salvar Parâmetros'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Seção Comercial */}
                <div className="p-1">
                    <div className="flex items-center gap-2 mb-4 border-b border-divider pb-3">
                        <TrendingUp size={18} className="text-brand-secondary" />
                        <h3 className="font-bold text-text-primary">Indicadores Comerciais</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center justify-between">
                                MKP Padrão (Multiplicador)
                                <span className="tooltip group relative cursor-help">
                                    <HelpCircle size={14} className="text-text-muted/50 hover:text-brand-primary" />
                                    <span className="tooltip-text hidden group-hover:block absolute bottom-full -translate-x-1/2 left-1/2 mb-2 w-48 bg-black/80 text-white text-xs p-2 rounded z-10 text-center">
                                        Ex: 1.50 para margem de 50% sobre custo.
                                    </span>
                                </span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-medium">x</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.mkp_padrao || ''}
                                    onChange={(e) => handleChange('mkp_padrao', e.target.value)}
                                    className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-divider bg-theme-bg/50 focus:bg-surface focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Despesa Administrativa</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"><Percent size={14} /></span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.percentual_despesas_administrativas || ''}
                                    onChange={(e) => handleChange('percentual_despesas_administrativas', e.target.value)}
                                    className="w-full pl-4 pr-8 py-2.5 rounded-lg border border-divider bg-theme-bg/50 focus:bg-surface focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Comissionamento (Padrão)</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"><Percent size={14} /></span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.percentual_comissao_padrao || ''}
                                    onChange={(e) => handleChange('percentual_comissao_padrao', e.target.value)}
                                    className="w-full pl-4 pr-8 py-2.5 rounded-lg border border-divider bg-theme-bg/50 focus:bg-surface focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all font-medium text-brand-secondary"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Seção Tributária */}
                <div className="p-1">
                    <div className="flex items-center justify-between mb-4 border-b border-divider pb-3">
                        <div className="flex items-center gap-2">
                            <Percent size={18} className="text-status-warning" />
                            <h3 className="font-bold text-text-primary">Perfil Tributário da Venda</h3>
                        </div>
                        {empresaTributacao && (
                            <span className="text-xs bg-status-success/10 text-status-success px-2 py-1 rounded-md font-medium border border-status-success/20">
                                Preenchido via Empresa
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { key: 'pis_percentual', label: 'PIS' },
                            { key: 'cofins_percentual', label: 'COFINS' },
                            { key: 'csll_percentual', label: 'CSLL' },
                            { key: 'irpj_percentual', label: 'IRPJ' },
                            { key: 'iss_percentual', label: 'ISS' }
                        ].map((tax) => (
                            <div key={tax.key} className="space-y-1.5 focus-within:z-10">
                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">{tax.label}</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData[tax.key as keyof OpportunityParametersSalesUpdatePayload] || ''}
                                        onChange={(e) => handleChange(tax.key as keyof OpportunityParametersSalesUpdatePayload, e.target.value)}
                                        className="w-full pl-3 pr-8 py-2 rounded-lg border border-divider bg-theme-bg/50 focus:bg-surface focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all text-sm font-medium"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs font-bold">%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Info Note */}
                    <div className="mt-5 p-3 rounded-lg bg-theme-bg/80 border border-divider text-xs text-text-muted flex items-start gap-2">
                        <HelpCircle size={14} className="shrink-0 mt-0.5 text-brand-primary" />
                        <p>
                            Estes valores substituirão a carga tributária na formatação de preços.
                            ICMS Interno e Externo são parametrizados a nível de NCM do Produto.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}
