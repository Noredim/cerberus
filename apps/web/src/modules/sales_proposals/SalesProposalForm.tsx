import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, ShieldAlert, CheckCircle2, Package, Trash2, Plus, Edit2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { OpportunityKitSearchModal } from '../../components/modals/OpportunityKitSearchModal';
import { QuickOpportunityKitCreateModal } from '../../components/modals/QuickOpportunityKitCreateModal';
import { QuickCustomerCreateModal } from '../../components/modals/QuickCustomerCreateModal';
import Modal from '../../components/modals/Modal';
import { OpportunityKitForm } from '../opportunity_kits/OpportunityKitForm';
import { Tooltip } from '../../components/ui/Tooltip';

const fmt = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const fmtPct = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(Number(v) / 100);

// Fallback if toast library is not explicitly known
const toast = {
    success: (msg: string) => alert(msg),
    error: (msg: string) => alert(msg)
};

export const SalesProposalForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // State
    const [isSaving, setIsSaving] = useState(false);
    const [titulo, setTitulo] = useState('');
    const [numeroProposta, setNumeroProposta] = useState('');
    const [responsavelId, setResponsavelId] = useState('');
    const [vendedorId, setVendedorId] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [status, setStatus] = useState('RASCUNHO');
    
    // Lookups
    const [customers, setCustomers] = useState<any[]>([]);
    const [professionals, setProfessionals] = useState<any[]>([]);
    
    // Factors
    const [fatorMargemProdutos, setFatorMargemProdutos] = useState<number>(0);
    const [fatorMargemServicos, setFatorMargemServicos] = useState<number>(0);
    const [fatorMargemInstalacao, setFatorMargemInstalacao] = useState<number>(0);
    const [fatorMargemManutencao, setFatorMargemManutencao] = useState<number>(0);
    const [freteVenda, setFreteVenda] = useState<number>(0);
    const [despesasAdm, setDespesasAdm] = useState<number>(0);
    const [comissao, setComissao] = useState<number>(0);
    const [isApplyingFactors, setIsApplyingFactors] = useState(false);
    const applyFactorsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Kits State
    const [kits, setKits] = useState<any[]>([]);
    const [showKitSearchModal, setShowKitSearchModal] = useState(false);
    const [showQuickKitModal, setShowQuickKitModal] = useState(false);
    const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
    
    // Actions State
    const [kitToDelete, setKitToDelete] = useState<string | null>(null);
    const [kitToEdit, setKitToEdit] = useState<string | null>(null);

    const [proposal, setProposal] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const loadProposal = async () => {
        if (id === 'novo') return;
        try {
            setIsLoading(true);
            const res = await api.get(`/sales-proposals/${id}`);
            setProposal(res.data);
        } catch (err) {
            console.error('Error fetching proposal', err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadCustomers = async () => {
        try {
            const { data } = await api.get('/cadastro/clientes', { params: { limit: 500 } });
            setCustomers(Array.isArray(data) ? data : data.items || []);
        } catch (err) {
            console.error('Erro ao carregar clientes:', err);
        }
    };

    const loadProfessionals = async () => {
        try {
            const { data } = await api.get('/professionals', { params: { limit: 500 } });
            const items = Array.isArray(data) ? data : data.items || [];
            const validSellers = items.filter((p: any) => p.role?.can_perform_sale === true);
            setProfessionals(validSellers);
        } catch (err) {
            console.error('Erro ao carregar profissionais:', err);
        }
    };

    useEffect(() => {
        loadProposal();
        loadCustomers();
        loadProfessionals();
    }, [id]);

    const refetch = () => {
        loadProposal();
    };

    useEffect(() => {
        if (proposal) {
            setTitulo(proposal.titulo || '');
            setCustomerId(proposal.customer_id || '');
            setObservacoes(proposal.observacoes || '');
            setNumeroProposta(proposal.numero_proposta || '');
            setResponsavelId(proposal.responsavel_id || '');
            setVendedorId(proposal.vendedor_id || '');
            setStatus(proposal.status || 'RASCUNHO');
            
            setFatorMargemProdutos(proposal.fator_margem_produtos || 0);
            setFatorMargemServicos(proposal.fator_margem_servicos || 0);
            setFatorMargemInstalacao(proposal.fator_margem_instalacao || 0);
            setFatorMargemManutencao(proposal.fator_margem_manutencao || 0);
            setFreteVenda(proposal.frete_venda || 0);
            setDespesasAdm(proposal.despesas_adm || 0);
            setComissao(proposal.comissao || 0);
            
            // Assuming backend returns kits inside proposal payload or we need a separate endpoint.
            // Adjust based on how router handles `kits` relationship (typically returned if nested).
            if (proposal.kits) {
                setKits(proposal.kits);
            }
        }
    }, [proposal]);

    const isNew = id === 'novo';
    
    // Access Control Logic
    // Allow edit if user is DIRETORIA, or is the Responsible, or is the current Seller.
    const hasAdminRights = user?.roles?.includes('DIRETORIA') || user?.roles?.includes('ADMIN'); // Adapt to real roles
    const isOwnerOrSeller = (user?.id === responsavelId) || (user?.id === vendedorId);
    
    // If it's a new draft being prepared by the modal, it won't trigger this form initially as new, 
    // but just in case, new items are not read-only for their creator.
    const isReadOnly = !isNew && !hasAdminRights && !isOwnerOrSeller;

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const payload = {
                titulo,
                customer_id: customerId,
                vendedor_id: vendedorId || null,
                observacoes,
                fator_margem_produtos: fatorMargemProdutos,
                fator_margem_servicos: fatorMargemServicos,
                fator_margem_instalacao: fatorMargemInstalacao,
                fator_margem_manutencao: fatorMargemManutencao,
                frete_venda: freteVenda,
                despesas_adm: despesasAdm,
                comissao: comissao
            };
            
            await api.put(`/sales-proposals/${id}`, payload);
            toast.success('Proposta salva com sucesso!');
            refetch();
        } catch (error) {
            console.error('Erro ao salvar proposta:', error);
            toast.error('Erro ao salvar proposta.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const applyFactorsToKits = useCallback(async () => {
        if (isNew || kits.length === 0 || isApplyingFactors) return;
        try {
            setIsApplyingFactors(true);
            // Step 1: Save factors to the proposal FIRST so the DB has the latest values
            const factorsPayload = {
                fator_margem_produtos: fatorMargemProdutos,
                fator_margem_servicos: fatorMargemServicos,
                fator_margem_instalacao: fatorMargemInstalacao,
                fator_margem_manutencao: fatorMargemManutencao,
                frete_venda: freteVenda,
                despesas_adm: despesasAdm,
                comissao: comissao
            };
            await api.put(`/sales-proposals/${id}/factors`, factorsPayload);
            
            // Step 2: Now propagate the saved factors down to each kit
            await api.post(`/sales-proposals/${id}/apply-factors`);
            refetch();
        } catch (error) {
            console.error('Erro ao aplicar fatores:', error);
        } finally {
            setIsApplyingFactors(false);
        }
    }, [id, isNew, kits.length, isApplyingFactors, fatorMargemProdutos, fatorMargemServicos, fatorMargemInstalacao, fatorMargemManutencao, freteVenda, despesasAdm, comissao]);

    // RN06 / RN11: Debounced auto-apply on blur (800ms delay to batch rapid changes)
    const scheduleAutoApply = useCallback(() => {
        if (applyFactorsTimerRef.current) {
            clearTimeout(applyFactorsTimerRef.current);
        }
        applyFactorsTimerRef.current = setTimeout(() => {
            applyFactorsToKits();
        }, 800);
    }, [applyFactorsToKits]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (applyFactorsTimerRef.current) clearTimeout(applyFactorsTimerRef.current);
        };
    }, []);
    
    const handleAddKit = async (kit: any) => {
        try {
            await api.post(`/sales-proposals/${id}/kits`, { opportunity_kit_id: kit.id });
            toast.success('Kit vinculado à proposta!');
            refetch();
        } catch (err: any) {
            console.error('Erro ao adicionar kit', err);
            const msg = err.response?.data?.detail || 'Erro ao vincular kit.';
            toast.error(msg);
        }
    };

    const handleRemoveKit = async (kitId: string) => {
        try {
            await api.delete(`/sales-proposals/${id}/kits/${kitId}`);
            toast.success('Kit removido com sucesso!');
            refetch();
        } catch (error) {
            console.error('Erro ao remover kit:', error);
            toast.error('Não foi possível remover o kit.');
        }
    };

    if (isLoading && !proposal && !isNew) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/comercial/propostas')}
                        className="p-2 text-text-muted hover:text-text-primary rounded-md hover:bg-bg-deep transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                            {isNew ? 'Nova Proposta (Rascunho)' : numeroProposta || 'Detalhes da Proposta'}
                            {!isNew && (
                                <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                                    {status}
                                </span>
                            )}
                        </h1>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                     {!isReadOnly && (
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md hover:bg-brand-primary/90 transition-colors shadow-sm font-medium disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            Salvar Alterações
                        </button>
                     )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="bg-surface rounded-lg shadow-sm border border-border-subtle p-6">
                    <h2 className="text-lg font-semibold text-text-primary mb-4 border-b border-border-subtle pb-2">
                        Informações da Proposta
                    </h2>
                    
                    {isReadOnly && (
                        <div className="mb-4 bg-brand-danger/10 border-l-4 border-brand-danger p-4 rounded-r-md flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-brand-danger mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-brand-danger">Somente Leitura</h3>
                                <p className="text-sm text-text-muted">
                                    Apenas o Responsável, Vendedor ou Diretoria podem editar o corpo da proposta e interagir com kits.
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {/* Campos de Informações Gerais aqui */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Título da Proposta</label>
                            <input 
                                type="text" 
                                value={titulo}
                                onChange={(e) => setTitulo(e.target.value)}
                                disabled={isReadOnly}
                                className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-text-primary focus:border-brand-primary outline-none disabled:opacity-60"
                            />
                        </div>
                        <div>
                            <label className="flex items-center justify-between text-sm font-medium text-text-secondary mb-1">
                                <span>Cliente</span>
                                <button 
                                    type="button" 
                                    onClick={() => setShowQuickCustomerModal(true)}
                                    disabled={isReadOnly}
                                    className="text-brand-primary hover:text-brand-primary/80 flex items-center gap-1 text-xs bg-brand-primary/5 px-2 py-0.5 rounded disabled:opacity-50"
                                >
                                    <Plus className="w-3 h-3" />
                                    Novo
                                </button>
                            </label>
                            <select 
                                value={customerId}
                                onChange={(e) => setCustomerId(e.target.value)}
                                disabled={isReadOnly}
                                className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-text-primary focus:border-brand-primary outline-none disabled:opacity-60"
                            >
                                <option value="">Selecione um cliente</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Vendedor Associado</label>
                            <select 
                                value={vendedorId}
                                onChange={(e) => setVendedorId(e.target.value)}
                                disabled={isReadOnly}
                                className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-text-primary focus:border-brand-primary outline-none disabled:opacity-60"
                            >
                                <option value="">Nenhum Vendedor</option>
                                {professionals.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2 lg:col-span-3">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Observações da Proposta</label>
                            <textarea 
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Descreva aqui o escopo extra, anotações de negociação ou detalhes descritivos da proposta..."
                                className="w-full h-24 resize-none bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-text-primary focus:border-brand-primary outline-none disabled:opacity-60"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-surface rounded-lg shadow-sm border border-border-subtle p-6">
                    <h2 className="text-lg font-semibold text-text-primary mb-4 border-b border-border-subtle pb-2 flex justify-between items-center">
                        <span>Fatores e Marcações Globais</span>
                        <button 
                            disabled={isReadOnly || isSaving || kits.length === 0}
                            onClick={applyFactorsToKits}
                            className="text-sm bg-brand-primary text-white px-3 py-1.5 rounded hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Aplicar aos Kits
                        </button>
                    </h2>
                    
                    {isApplyingFactors && (
                        <div className="text-xs text-brand-primary flex items-center gap-1.5 mb-3 animate-pulse">
                            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" /></svg>
                            Propagando fatores aos kits...
                        </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Fator (Produtos)</label>
                            <input type="number" step="0.01" value={fatorMargemProdutos} onChange={e => setFatorMargemProdutos(Number(e.target.value))} onBlur={scheduleAutoApply} disabled={isReadOnly} className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-1.5 text-text-primary outline-none disabled:opacity-60" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Fator (Serviços)</label>
                            <input type="number" step="0.01" value={fatorMargemServicos} onChange={e => setFatorMargemServicos(Number(e.target.value))} onBlur={scheduleAutoApply} disabled={isReadOnly} className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-1.5 text-text-primary outline-none disabled:opacity-60" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Fator (Instalação)</label>
                            <input type="number" step="0.01" value={fatorMargemInstalacao} onChange={e => setFatorMargemInstalacao(Number(e.target.value))} onBlur={scheduleAutoApply} disabled={isReadOnly} className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-1.5 text-text-primary outline-none disabled:opacity-60" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Fator (Manutenção)</label>
                            <input type="number" step="0.01" value={fatorMargemManutencao} onChange={e => setFatorMargemManutencao(Number(e.target.value))} onBlur={scheduleAutoApply} disabled={isReadOnly} className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-1.5 text-text-primary outline-none disabled:opacity-60" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 border-t border-border-subtle pt-4 mt-2">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">% Frete Venda</label>
                            <input type="number" step="0.01" value={freteVenda} onChange={e => setFreteVenda(Number(e.target.value))} onBlur={scheduleAutoApply} disabled={isReadOnly} className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-1.5 text-text-primary outline-none disabled:opacity-60" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">% Desp. Administrativas</label>
                            <input type="number" step="0.01" value={despesasAdm} onChange={e => setDespesasAdm(Number(e.target.value))} onBlur={scheduleAutoApply} disabled={isReadOnly} className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-1.5 text-text-primary outline-none disabled:opacity-60" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">% Comissão</label>
                            <input type="number" step="0.01" value={comissao} onChange={e => setComissao(Number(e.target.value))} onBlur={scheduleAutoApply} disabled={isReadOnly} className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-1.5 text-text-primary outline-none disabled:opacity-60" />
                        </div>
                    </div>

                </div>

                <div className="bg-surface rounded-lg shadow-sm border border-border-subtle p-6">
                    <h2 className="text-lg font-semibold text-text-primary mb-4 border-b border-border-subtle pb-2 flex justify-between items-center">
                        <span>Itens Comerciais (Kits)</span>
                        <div className="space-x-2">
                             <button
                                onClick={() => setShowQuickKitModal(true)}
                                disabled={isReadOnly || isNew} 
                                title={isNew ? "Salve a proposta primeiro" : "Lançar Kit Exclusivo"}
                                className="text-sm bg-surface border border-brand-primary text-brand-primary px-3 py-1.5 rounded hover:bg-brand-primary/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 inline-flex"
                            >
                                <Plus className="w-4 h-4" />
                                Lançar Kit Exclusivo
                            </button>
                            <button
                                onClick={() => setShowKitSearchModal(true)}
                                disabled={isReadOnly || isNew} 
                                title={isNew ? "Salve a proposta primeiro" : "Selecionar Kit Existente"}
                                className="text-sm bg-brand-primary text-white px-3 py-1.5 rounded hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                            >
                                 <Package className="w-4 h-4" />
                                 Selecionar Kit Existente
                            </button>
                        </div>
                    </h2>
                    
                    {kits.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-border-subtle rounded-lg bg-bg-deep/50">
                            <Package className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-50" />
                            <p className="text-sm text-text-primary font-medium">Nenhum kit vinculado a esta proposta</p>
                            <p className="text-xs text-text-muted mt-1">
                                Um kit agrupa os materiais, serviços e escopo entregáveis do projeto.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto overflow-y-visible">
                            <table className="w-full text-left border-collapse min-w-[1250px]">
                                <thead className="bg-[#f8f9fa] dark:bg-bg-deep text-[9px] font-bold text-text-muted uppercase tracking-wider border-b border-border-subtle">
                                    <tr>
                                        <th className="px-1.5 py-3 whitespace-nowrap pl-4">Nome do Kit</th>
                                        <th className="px-1.5 py-3 whitespace-nowrap text-center w-14">Qtd</th>
                                        <th className="px-1.5 py-3 whitespace-nowrap text-right" title="Custo de Aquisição (Equipamentos e Instalação)">Custo Aq. (Equip/Inst)</th>
                                        <th className="px-1.5 py-3 whitespace-nowrap text-right" title="Custo Manutenção Mensal Operacional (vezes meses)">Custo Manut.</th>
                                        <th className="px-1.5 py-3 whitespace-nowrap text-center w-16">Fator</th>
                                        <th className="px-1.5 py-3 whitespace-nowrap text-right" title="Valor Total de Venda de Equipamentos / Mensalidades">Venda Equip/Loc.</th>
                                        <th className="px-1.5 py-3 whitespace-nowrap text-right font-bold text-brand-primary" title="Faturamento Total Projetado">Fat. Total</th>
                                        <th className="px-1.5 py-3 whitespace-nowrap text-right">Lucro Venda</th>
                                        <th className="px-1.5 py-3 whitespace-nowrap text-right">Marg. Vda</th>
                                        <th className="px-1.5 py-3 whitespace-nowrap text-right">Lucro Manut.</th>
                                        <th className="px-1.5 py-3 whitespace-nowrap text-right">Marg. Manut.</th>
                                        <th className="px-1.5 py-3 whitespace-nowrap text-right">Lucro Final</th>
                                        <th className="px-1.5 py-3 whitespace-nowrap text-right border-l border-border-subtle bg-bg-deep/30 pr-4">Marg. Geral</th>
                                        <th className="px-1.5 py-3 whitespace-nowrap text-center w-14 pr-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle bg-surface text-[11px]">
                                    {kits.map((kitObj) => {
                                        const pk = kitObj.id; // Unique proposal link ID
                                        const kit = kitObj.opportunity_kit || kitObj; // Adapts based on query join return format
                                        const q = Number(kit.quantidade_kits || 1);
                                        const sum = kit.summary || {};
                                        
                                        const isVenda = kit.tipo_contrato === 'VENDA_EQUIPAMENTOS';
                                        
                                        const factorEntries = isVenda
                                            ? [
                                                { label: 'Produtos', value: Number(kit.fator_margem_servicos_produtos || 1) },
                                                { label: 'Serviços', value: Number(kit.fator_margem_servicos_produtos || 1) },
                                                { label: 'Instalação', value: Number(kit.fator_margem_instalacao || 1) },
                                                { label: 'Manutenção', value: Number(kit.fator_margem_manutencao || 1) },
                                            ]
                                            : [
                                                { label: 'Locação', value: Number(kit.fator_margem_locacao || 1) },
                                                { label: 'Produtos/Serv.', value: Number(kit.fator_margem_servicos_produtos || 1) },
                                                { label: 'Instalação', value: Number(kit.fator_margem_instalacao || 1) },
                                                { label: 'Manutenção', value: Number(kit.fator_margem_manutencao || 1) },
                                            ];

                                        const avgFator = factorEntries.reduce((acc, e) => acc + e.value, 0) / factorEntries.length;

                                        const margemGeral = Number(sum.margem_kit || 0);
                                        const margemVenda = Number(sum.margem_equipamentos || 0);
                                        const margemManutencao = Number(sum.margem_manutencao || 0);

                                        const margemColor = margemGeral >= 15 ? 'text-emerald-600' : margemGeral >= 5 ? 'text-amber-600' : 'text-rose-600';
                                        const margemVendaColor = margemVenda >= 15 ? 'text-emerald-600' : margemVenda >= 5 ? 'text-amber-600' : 'text-rose-600';
                                        const margemManutColor = margemManutencao >= 15 ? 'text-emerald-600' : margemManutencao >= 5 ? 'text-amber-600' : 'text-rose-600';

                                        return (
                                            <tr key={pk} className="group hover:bg-bg-deep/50 transition-colors">
                                                <td className="px-1.5 py-3 whitespace-nowrap max-w-[200px] pl-4">
                                                    <div className="flex flex-col truncate">
                                                        <span className="font-semibold text-text-primary truncate">{kit.nome_kit}</span>
                                                        <span className="text-[10px] font-mono text-text-muted">{kit.tipo_contrato || 'Tipo não definido'}</span>
                                                    </div>
                                                </td>

                                                {/* Qtd */}
                                                <td className="px-1.5 py-3 whitespace-nowrap text-center">
                                                    <div className="w-10 mx-auto px-1 py-1 border border-border-subtle rounded bg-bg-deep text-[11px] text-center text-text-primary font-mono select-none" title="Alterações devem ser feitas editando o Escopo do Kit">
                                                        {q}
                                                    </div>
                                                </td>

                                                {/* Custo Aq. */}
                                                <td className="px-1.5 py-3 whitespace-nowrap text-right text-text-muted">
                                                    {fmt(Number(sum.custo_aquisicao_kit || 0) + Number(sum.vlr_instal_calc || 0))}
                                                </td>

                                                {/* Custo Manut. */}
                                                <td className="px-1.5 py-3 whitespace-nowrap text-right text-text-muted">
                                                    {fmt(Number(sum.vlt_manut || 0))}
                                                </td>

                                                {/* Fator */}
                                                <td className="px-1.5 py-3 whitespace-nowrap text-center">
                                                    <Tooltip content={
                                                        <div className="w-48 space-y-1">
                                                            <div className="font-bold border-b border-white/20 pb-1 mb-1">Composição de Margem</div>
                                                            {factorEntries.map((entry) => (
                                                                <div key={entry.label} className="flex justify-between"><span>{entry.label}:</span> <span className="font-mono">{entry.value.toFixed(2)}</span></div>
                                                            ))}
                                                        </div>
                                                    }>
                                                        <div className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] font-bold cursor-help inline-block">
                                                            {avgFator.toFixed(2)}
                                                        </div>
                                                    </Tooltip>
                                                </td>

                                                {/* Venda Equip / Loc */}
                                                <td className="px-1.5 py-3 whitespace-nowrap text-right font-semibold text-text-primary">
                                                    {fmt(Number(sum.venda_equipamentos_total || sum.valor_mensal_antes_impostos || 0))}
                                                </td>

                                                {/* Fat. Total */}
                                                <td className="px-1.5 py-3 whitespace-nowrap text-right font-bold text-brand-primary">
                                                    {fmt(Number(sum.valor_mensal_kit || 0))}
                                                </td>

                                                {/* Lucro Venda */}
                                                <td className={`px-1.5 py-3 whitespace-nowrap text-right font-bold ${margemVendaColor}`}>
                                                    {fmt(Number(sum.lucro_equipamentos || 0))}
                                                </td>

                                                {/* Margem Vda */}
                                                <td className={`px-1.5 py-3 whitespace-nowrap text-right font-medium ${margemVendaColor}`}>
                                                    {fmtPct(margemVenda)}
                                                </td>

                                                {/* Lucro Manut */}
                                                <td className={`px-1.5 py-3 whitespace-nowrap text-right font-bold ${margemManutColor}`}>
                                                    {fmt(Number(sum.lucro_manutencao || 0))}
                                                </td>

                                                {/* Margem Manut */}
                                                <td className={`px-1.5 py-3 whitespace-nowrap text-right font-medium ${margemManutColor}`}>
                                                    {fmtPct(margemManutencao)}
                                                </td>

                                                {/* Lucro Final */}
                                                <td className="px-1.5 py-3 whitespace-nowrap text-right font-bold text-text-primary">
                                                    {fmt(Number(sum.lucro_mensal_kit || 0))}
                                                </td>

                                                {/* Marg. Geral */}
                                                <td className={`px-1.5 py-3 whitespace-nowrap text-right font-bold bg-bg-deep/30 border-l border-border-subtle pr-4 ${margemColor}`}>
                                                    {fmtPct(margemGeral)}
                                                </td>

                                                {/* Ações */}
                                                <td className="px-1.5 py-3 whitespace-nowrap pr-4">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setKitToEdit(kit.id);
                                                            }}
                                                            className="p-1 hover:text-brand-primary text-text-muted rounded transition-colors"
                                                            title="Editar / Ver Custeio"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setKitToDelete(kit.id);
                                                            }}
                                                            disabled={isReadOnly}
                                                            className="p-1 text-brand-danger/70 hover:text-brand-danger hover:bg-brand-danger/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Remover Kit"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            
            <OpportunityKitSearchModal 
                isOpen={showKitSearchModal}
                onClose={() => setShowKitSearchModal(false)}
                onSelect={handleAddKit}
                title="Adicionar Kit à Proposta"
            />
            
            <QuickOpportunityKitCreateModal
                isOpen={showQuickKitModal}
                onClose={() => setShowQuickKitModal(false)}
                salesProposalId={id === 'novo' ? undefined : id}
                onSuccess={(newKit) => {
                    handleAddKit(newKit);
                    // Open the kit for editing without opening a new tab
                    navigate(`/cadastros/kits/${newKit.id}?sales_proposal_id=${id}`);
                }}
            />
            
            <QuickCustomerCreateModal
                isOpen={showQuickCustomerModal}
                onClose={() => setShowQuickCustomerModal(false)}
                onSuccess={(newCustomer) => {
                    setCustomers(prev => [...prev, newCustomer]);
                    setCustomerId(newCustomer.id);
                    setShowQuickCustomerModal(false);
                }}
            />
            
            <Modal
                isOpen={!!kitToDelete}
                onClose={() => setKitToDelete(null)}
                title="Excluir Kit"
                description="Deseja realmente remover este kit da proposta?"
            >
                <div className="flex justify-end gap-3 mt-6">
                    <button 
                        type="button"
                        className="px-4 py-2 border border-border-subtle bg-bg-surface text-text-primary rounded-md font-medium hover:bg-bg-deep transition-colors" 
                        onClick={() => setKitToDelete(null)}
                    >
                        Cancelar
                    </button>
                    <button 
                        type="button"
                        className="px-4 py-2 bg-brand-danger text-white rounded-md font-medium hover:bg-brand-danger/90 transition-colors" 
                        onClick={() => {
                            if (kitToDelete) handleRemoveKit(kitToDelete);
                            setKitToDelete(null);
                        }}
                    >
                        Sim, Excluir
                    </button>
                </div>
            </Modal>
            
            <Modal
                isOpen={!!kitToEdit}
                onClose={() => {
                    setKitToEdit(null);
                    refetch();
                }}
                title="Editar Kit Comercial"
                maxWidth="5xl"
            >
                {kitToEdit && (
                    <OpportunityKitForm 
                        isModal={true}
                        modalEditKitId={kitToEdit}
                        onClose={() => {
                            setKitToEdit(null);
                            refetch();
                        }}
                        onSuccess={() => {
                            setKitToEdit(null);
                            refetch();
                        }}
                    />
                )}
            </Modal>
        </div>
    );
};
