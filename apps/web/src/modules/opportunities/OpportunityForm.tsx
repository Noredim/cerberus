import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Wrench, Settings, Package, FileSpreadsheet, Calculator, HelpCircle, Building2, User } from 'lucide-react';
import { useOpportunities } from './hooks/useOpportunities';
import type { OpportunityCreatePayload, TipoCliente, TipoOperacao } from './types';
import { useCompanies } from '../companies/hooks/useCompanies';
import { motion, AnimatePresence } from 'framer-motion';

// Mock components that we will fetch
import { OpportunityEquipamentos } from './components/OpportunityEquipamentos';
import { OpportunityOrcamentos } from './components/OpportunityOrcamentos';
import { OpportunityParameters } from './components/OpportunityParameters';

export function OpportunityForm() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = Boolean(id);

    const { getOpportunity, createOpportunity, updateOpportunity, loading } = useOpportunities();
    const { fetchCompanies } = useCompanies();

    const [activeTab, setActiveTab] = useState('equipamentos');
    const [companiesList, setCompaniesList] = useState<any[]>([]);

    const [formData, setFormData] = useState<OpportunityCreatePayload>({
        titulo_oportunidade: '',
        tipo_cliente: 'PRIVADO',
        tipo_operacao: 'VENDA',
        possui_instalacao: false,
        possui_manutencao: false,
        status: 'RASCUNHO',
        empresa_id: '',
        perfil_tributario_origem_id: '', // Temporary placeholder until real companies are bound
        observacoes: ''
    });

    useEffect(() => {
        const fetchDependencies = async () => {
            try {
                const comps = await fetchCompanies();
                setCompaniesList(comps);

                if (comps.length > 0 && !isEditing) {
                    // pre-select first company
                    setFormData(prev => ({
                        ...prev,
                        empresa_id: comps[0].id,
                        // Simplification for scaffolding: getting first active tax profile
                        perfil_tributario_origem_id: comps[0].tax_profiles?.[0]?.id || '00000000-0000-0000-0000-000000000000'
                    }));
                }

                if (isEditing && id) {
                    const opp = await getOpportunity(id);
                    setFormData({
                        titulo_oportunidade: opp.titulo_oportunidade,
                        cliente_id: opp.cliente_id,
                        tipo_cliente: opp.tipo_cliente,
                        tipo_operacao: opp.tipo_operacao,
                        possui_instalacao: opp.possui_instalacao,
                        possui_manutencao: opp.possui_manutencao,
                        status: opp.status,
                        data_abertura: opp.data_abertura,
                        responsavel_comercial: opp.responsavel_comercial,
                        origem_oportunidade: opp.origem_oportunidade,
                        observacoes: opp.observacoes,
                        empresa_id: opp.empresa_id,
                        perfil_tributario_origem_id: opp.perfil_tributario_origem_id,
                    });
                }
            } catch (error) {
                console.error("Failed to load dependencies", error);
            }
        };
        fetchDependencies();
    }, [id, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing && id) {
                await updateOpportunity(id, formData);
            } else {
                const created = await createOpportunity(formData);
                navigate(`/ oportunidades / ${created.id} `);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const tabs = [
        { id: 'parametros', label: 'Parâmetros da Venda', icon: Calculator, visible: true },
        { id: 'equipamentos', label: 'Equipamentos & Itens', icon: Package, visible: true },
        { id: 'orcamentos', label: 'Orçamentos (Excel)', icon: FileSpreadsheet, visible: true },
        { id: 'instalacao', label: 'Instalação', icon: Wrench, visible: formData.possui_instalacao },
        { id: 'manutencao', label: 'Manutenção', icon: Settings, visible: formData.possui_manutencao },
    ].filter(t => t.visible);

    const getFieldClass = (_value?: any) => {
        return `w-full h-11 px-4 py-2.5 rounded-lg border border-divider bg-surface focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all font-medium text-sm`;
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-[calc(100vh-theme(spacing.16))] animate-in fade-in duration-500">
            {/* Context Header */}
            <div className="flex-none bg-surface border-b border-divider px-6 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/oportunidades')}
                        className="p-2 -ml-2 text-text-muted hover:text-text-primary hover:bg-theme-bg rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-text-primary">
                                {isEditing ? `Edição: ${formData.titulo_oportunidade || 'Oportunidade'} ` : 'Nova Oportunidade'}
                            </h1>
                            <span className={`px - 2 py - 0.5 rounded text - [10px] font - bold tracking - wider ${isEditing ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                } `}>
                                {isEditing ? formData.status : 'RASCUNHO'}
                            </span>
                        </div>
                        <p className="text-sm text-text-muted mt-0.5">
                            {isEditing ? 'Configure os parâmetros e adicione itens para formatar o preço.' : 'Preencha o cabeçalho base da negociação.'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-lg hover:bg-brand-primary/90 transition-colors shadow-sm disabled:opacity-50 font-medium"
                    >
                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
                        <span>{isEditing ? 'Salvar Alterações' : 'Criar Oportunidade'}</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto bg-theme-bg">
                <div className="max-w-6xl mx-auto p-6 space-y-6">

                    {/* Header Section (Always Visible) */}
                    <div className="pt-2">
                        <div className="px-1">
                            <h2 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
                                <HelpCircle size={20} className="text-brand-primary" />
                                Cabeçalho da Oportunidade
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Título da Oportunidade</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.titulo_oportunidade}
                                        onChange={(e) => setFormData({ ...formData, titulo_oportunidade: e.target.value })}
                                        placeholder="Ex: Contrato de Manutenção Predial SP"
                                        className={getFieldClass(formData.titulo_oportunidade)}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                                        <Building2 size={14} /> Empresa (Vendedora)
                                    </label>
                                    <select
                                        required
                                        value={formData.empresa_id}
                                        onChange={(e) => {
                                            const comp = companiesList.find(c => c.id === e.target.value);
                                            setFormData({
                                                ...formData,
                                                empresa_id: e.target.value,
                                                perfil_tributario_origem_id: comp?.tax_profiles?.[0]?.id || ''
                                            });
                                        }}
                                        className={getFieldClass(formData.empresa_id)}
                                        disabled={isEditing} // Não pode mudar de cnpj vendedor depois de criado
                                    >
                                        <option value="">Selecione...</option>
                                        {companiesList.map(c => (
                                            <option key={c.id} value={c.id}>{c.razao_social}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                                        <User size={14} /> Tipo de Cliente
                                    </label>
                                    <select
                                        value={formData.tipo_cliente}
                                        onChange={(e) => setFormData({ ...formData, tipo_cliente: e.target.value as TipoCliente })}
                                        className={getFieldClass(true)}
                                    >
                                        <option value="PRIVADO">Privado (B2B/B2C)</option>
                                        <option value="PUBLICO">Público (Licitação)</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Tipo de Operação</label>
                                    <select
                                        value={formData.tipo_operacao}
                                        onChange={(e) => setFormData({ ...formData, tipo_operacao: e.target.value as TipoOperacao })}
                                        className={getFieldClass(true)}
                                        disabled={isEditing} // Trava a operação base
                                    >
                                        <option value="VENDA">Venda Direta</option>
                                        <option value="COMODATO_LOCACAO">Locação / Comodato</option>
                                    </select>
                                </div>

                                {/* Dynamic Booleans that control tabs */}
                                <div className="col-span-full border-t border-divider pt-6 mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-3 p-4 rounded-xl hover:bg-surface/50 cursor-pointer transition-colors border border-transparent hover:border-divider">
                                        <input
                                            type="checkbox"
                                            checked={formData.possui_instalacao}
                                            onChange={(e) => setFormData({ ...formData, possui_instalacao: e.target.checked })}
                                            className="w-5 h-5 rounded text-brand-primary"
                                        />
                                        <div>
                                            <div className="font-semibold text-text-primary text-sm">Possui Instalação?</div>
                                            <div className="text-xs text-text-muted">Atrála serviços de implantação/instalação únicos a esta oportunidade.</div>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 p-4 rounded-xl hover:bg-surface/50 cursor-pointer transition-colors border border-transparent hover:border-divider">
                                        <input
                                            type="checkbox"
                                            checked={formData.possui_manutencao}
                                            onChange={(e) => setFormData({ ...formData, possui_manutencao: e.target.checked })}
                                            className="w-5 h-5 rounded text-brand-primary"
                                        />
                                        <div>
                                            <div className="font-semibold text-text-primary text-sm">Possui Manutenção Recorrente?</div>
                                            <div className="text-xs text-text-muted">Adiciona aba para controle de SLA e itens de manutenção mensal.</div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Tabs Section - Only rendered if Editing (meaning Head is Saved) */}
                    {isEditing ? (
                        <div className="flex flex-col min-h-[500px] mt-6">
                            {/* Tab Navigation */}
                            <div className="flex gap-1 border-b border-divider overflow-x-auto no-scrollbar">
                                {tabs.map((tab) => {
                                    const Icon = tab.icon;
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex items-center gap-2 px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors border-b-2 cursor-pointer ${isActive
                                                ? 'border-brand-primary text-brand-primary'
                                                : 'border-transparent text-text-muted hover:text-text-primary hover:border-divider'
                                                }`}
                                        >
                                            <Icon size={18} />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Tab Content Areas */}
                            <div className="p-6 flex-1">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'parametros' && (
                                        <motion.div
                                            key="parametros"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                        >
                                            <OpportunityParameters oppId={id!} />
                                        </motion.div>
                                    )}
                                    {activeTab === 'equipamentos' && (
                                        <motion.div
                                            key="equipamentos"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                        >
                                            <OpportunityEquipamentos oppId={id!} />
                                        </motion.div>
                                    )}
                                    {activeTab === 'orcamentos' && (
                                        <motion.div
                                            key="orcamentos"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                        >
                                            <OpportunityOrcamentos oppId={id!} />
                                        </motion.div>
                                    )}
                                    {activeTab === 'instalacao' && (
                                        <motion.div
                                            key="instalacao"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                        >
                                            <div className="py-12 flex flex-col justify-center items-center text-center">
                                                <Wrench className="text-brand-primary/50 mb-4" size={48} />
                                                <h3 className="text-xl font-bold text-text-primary">Módulo de Instalação Selecionado</h3>
                                                <p className="text-text-muted mt-2">Equipamentos vinculados a serviços de implantação.</p>
                                            </div>
                                        </motion.div>
                                    )}
                                    {activeTab === 'manutencao' && (
                                        <motion.div
                                            key="manutencao"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                        >
                                            <div className="py-12 flex flex-col justify-center items-center text-center">
                                                <Settings className="text-brand-primary/50 mb-4" size={48} />
                                                <h3 className="text-xl font-bold text-text-primary">Parâmetros de Manutenção (SLA/Mensalidade)</h3>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-text-muted border border-dashed border-divider rounded-xl mt-4">
                            Salve o cabeçalho inicial para desbloquear a inserção de equipamentos e orçamentos.
                        </div>
                    )}

                </div>
            </div>
        </form>
    );
}
