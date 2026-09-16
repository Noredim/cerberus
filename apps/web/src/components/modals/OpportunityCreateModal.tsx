import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Receipt, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../services/api';
import { Button } from '../ui/Button';
import { CustomerCombobox, type CustomerOption } from '../ui/CustomerCombobox';
import { QuickCustomerCreateModal } from './QuickCustomerCreateModal';
import { useAuth } from '../../contexts/AuthContext';

interface OpportunityCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (id: string, newTitulo?: string, newCustomerId?: string, newUsarProdutosGerais?: boolean) => void;
  initialData?: { id: string; titulo: string; customerId: string; usarProdutosGerais?: boolean };
}

export function OpportunityCreateModal({ isOpen, onClose, onSuccess, initialData }: OpportunityCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [vendedorId, setVendedorId] = useState('');
  const [salesTeamId, setSalesTeamId] = useState('');
  const [userSalesTeams, setUserSalesTeams] = useState<any[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [usarProdutosGerais, setUsarProdutosGerais] = useState(true);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [error, setError] = useState('');
  const [allCompanyTeams, setAllCompanyTeams] = useState<any[]>([]);
  const { user, activeCompanyId, userCompanies } = useAuth();
  const currentCompanyId = activeCompanyId || localStorage.getItem('company_id') || userCompanies[0]?.company_id;

  const [defaultFormaPagamentoId, setDefaultFormaPagamentoId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setTitulo(initialData.titulo || '');
      setCustomerId(initialData.customerId || '');
      setUsarProdutosGerais(initialData.usarProdutosGerais ?? true);
    } else {
      setTitulo('');
      setCustomerId('');
      setSelectedCustomer(null);
      setVendedorId('');
      setSalesTeamId('');
      setUsarProdutosGerais(true);
      setDefaultFormaPagamentoId(null);
    }
    setError('');

    const loadModalData = async () => {
      setLoadingTeams(true);
      try {
        const [custRes, profRes, teamsRes, fpRes] = await Promise.all([
          api.get('/cadastro/clientes', { params: { limit: 50 } }).catch(err => {
            console.warn('Erro ao carregar clientes:', err);
            return { data: [] };
          }),
          api.get('/professionals', { params: { limit: 500 } }).catch(err => {
            console.warn('Erro ao carregar profissionais:', err);
            return { data: [] };
          }),
          currentCompanyId ? api.get(`/companies/${currentCompanyId}/sales-teams`).catch(err => {
            console.warn('Erro ao carregar sales-teams:', err);
            return { data: [] };
          }) : Promise.resolve({ data: [] }),
          api.get('/cadastro/formas-pagamento').catch(err => {
            console.warn('Erro ao carregar formas de pagamento:', err);
            return { data: [] };
          })
        ]);

        const fps = Array.isArray(fpRes.data) ? fpRes.data : [];
        const defaultFp = fps.find((fp: any) => fp.ativo && fp.is_default && (fp.tipo_uso === 'VENDA' || fp.tipo_uso === 'AMBOS'));
        if (defaultFp) {
          setDefaultFormaPagamentoId(defaultFp.id);
        }

        const custItems: CustomerOption[] = Array.isArray(custRes.data) ? custRes.data : custRes.data.items || [];
        setCustomers(custItems);

        if (initialData?.customerId) {
          const found = custItems.find(c => c.id === initialData.customerId);
          if (found) {
            setSelectedCustomer(found);
          } else {
            api.get(`/cadastro/clientes/${initialData.customerId}`)
              .then(res => {
                if (res.data) {
                  setSelectedCustomer(res.data);
                  setCustomers(prev => [res.data, ...prev.filter(c => c.id !== res.data.id)]);
                }
              })
              .catch(e => console.warn('Erro ao carregar cliente inicial:', e));
          }
        }

        const profItems = Array.isArray(profRes.data) ? profRes.data : profRes.data.items || [];
        const validSellers = profItems.filter((p: any) => p.role?.can_perform_sale === true);
        setProfessionals(validSellers);

        const teamsList = Array.isArray(teamsRes.data) ? teamsRes.data : [];
        const activeTeams = teamsList.filter((t: any) => t.ativo);
        setAllCompanyTeams(activeTeams);

        let selectedVId = vendedorId;
        if (!selectedVId && !initialData?.id && user?.id) {
          const myProf = validSellers.find((p: any) => p.user_id === user.id || p.id === user.id);
          if (myProf) {
            selectedVId = myProf.id;
            setVendedorId(myProf.id);
          }
        }

        if (selectedVId) {
          const prof = validSellers.find((p: any) => p.id === selectedVId);
          const targetUserId = prof?.user_id || prof?.id || selectedVId;
          const matched = activeTeams.filter((t: any) =>
            Array.isArray(t.members) && t.members.some((m: any) =>
              (targetUserId && m.user_id === targetUserId) ||
              (selectedVId && m.user_id === selectedVId)
            )
          );
          setUserSalesTeams(matched);
          if (matched.length === 1) {
            setSalesTeamId(matched[0].id);
          } else if (matched.length > 1) {
            setSalesTeamId(matched[0].id);
          } else if (activeTeams.length > 0) {
            setSalesTeamId(activeTeams[0].id);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados da modal de oportunidade:', err);
      } finally {
        setLoadingTeams(false);
      }
    };

    loadModalData();
  }, [isOpen, currentCompanyId, initialData]);

  const handleVendedorChange = (newVId: string) => {
    setVendedorId(newVId);
    if (!newVId) {
      setUserSalesTeams([]);
      setSalesTeamId('');
      return;
    }
    const prof = professionals.find(p => p.id === newVId);
    const targetUserId = prof?.user_id || prof?.id || newVId;
    const matched = allCompanyTeams.filter((t: any) =>
      Array.isArray(t.members) && t.members.some((m: any) =>
        (targetUserId && m.user_id === targetUserId) ||
        (newVId && m.user_id === newVId)
      )
    );
    setUserSalesTeams(matched);
    if (matched.length === 1) {
      setSalesTeamId(matched[0].id);
    } else if (matched.length > 1) {
      setSalesTeamId(matched[0].id);
    } else if (allCompanyTeams.length > 0) {
      setSalesTeamId(allCompanyTeams[0].id);
    } else {
      setSalesTeamId('');
    }
  };

  const handleCustomerCreated = (newCustomer: any) => {
    setCustomers(prev => [newCustomer, ...prev]);
    setCustomerId(newCustomer.id);
    setSelectedCustomer(newCustomer);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !customerId) {
        setError("Título e Cliente são obrigatórios.");
        return;
    }
    if (!initialData && !vendedorId) {
        setError("Vendedor é obrigatório.");
        return;
    }
    
    setError('');
    setLoading(true);
    
    try {
        if (initialData?.id) {
          // Edit mode (do not touch vendedor_id or responsavel_ids)
          await api.patch(`/sales-budgets/${initialData.id}/header`, { 
            titulo, 
            customer_id: customerId,
            sales_team_id: salesTeamId || null,
            usar_produtos_gerais: usarProdutosGerais
          });
          onSuccess(initialData.id, titulo, customerId, usarProdutosGerais);
        } else {
          // Create mode
          const payload = {
            titulo,
            customer_id: customerId,
            vendedor_id: vendedorId,
            sales_team_id: salesTeamId || null,
            forma_pagamento_id: defaultFormaPagamentoId || null,
            responsavel_ids: user?.id ? [user.id] : [],
            data_orcamento: new Date().toISOString().slice(0, 10),
            status: 'EM_LANCAMENTO',
            usar_produtos_gerais: usarProdutosGerais
          };
          const res = await api.post('/sales-budgets', payload);
          onSuccess(res.data.id, titulo, customerId, usarProdutosGerais);
        }
    } catch (err: any) {
       console.error(err);
       setError(`Falha ao ${initialData?.id ? 'editar' : 'criar'} oportunidade: ` + (err.response?.data?.detail || err.message));
    } finally {
       setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-surface rounded-2xl shadow-xl flex flex-col"
        >
            <div className="p-6 border-b border-border-subtle bg-bg-deep flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
                <Receipt className="w-5 h-5" />
                </div>
                <div>
                <h2 className="text-xl font-display font-bold text-text-primary tracking-tight">
                  {initialData?.id ? 'Editar Cabeçalho' : 'Nova Oportunidade'}
                </h2>
                <p className="text-xs text-text-muted">
                  {initialData?.id ? 'Altere os dados principais da oportunidade' : 'Preencha o cabeçalho para iniciar'}
                </p>
                </div>
            </div>
            <button
                onClick={onClose}
                className="p-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors cursor-pointer"
            >
                <X className="w-5 h-5" />
            </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
                <div className="p-3 bg-brand-danger/10 border border-brand-danger/20 rounded-lg text-xs text-brand-danger">
                {error}
                </div>
            )}

            <div className="space-y-1.5">
                <label className="text-sm font-bold text-text-muted uppercase tracking-wider">Título *</label>
                <input
                    type="text"
                    required
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
                    placeholder="Ex: Instalação CCTV Matriz"
                />
            </div>

            <div className="space-y-1.5">
                <label className="flex justify-between items-center text-sm font-bold text-text-muted uppercase tracking-wider">
                   <span>Cliente *</span>
                   <button 
                     type="button" 
                     onClick={() => setShowQuickCustomer(true)}
                     className="text-brand-primary hover:underline normal-case text-xs flex items-center gap-1 cursor-pointer"
                   >
                     <Plus className="w-3 h-3" /> Novo
                   </button>
                </label>
                <CustomerCombobox
                  value={customerId}
                  onChange={(newId, customerObj) => {
                    setCustomerId(newId);
                    setSelectedCustomer(customerObj || null);
                  }}
                  initialCustomers={customers}
                  selectedCustomerObject={selectedCustomer}
                  onOpenQuickModal={() => setShowQuickCustomer(true)}
                  placeholder="Buscar cliente por Nome ou CNPJ..."
                />
            </div>

            {customerId && selectedCustomer && (
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-text-muted uppercase tracking-wider">Cidade</label>
                    <input
                      type="text"
                      disabled
                      value={selectedCustomer.city_nome || 'Não informada'}
                      className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none text-sm text-text-primary h-11 disabled:opacity-60 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-text-muted uppercase tracking-wider">Estado</label>
                    <input
                      type="text"
                      disabled
                      value={selectedCustomer.state_sigla || 'Não informado'}
                      className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none text-sm text-text-primary h-11 disabled:opacity-60 cursor-not-allowed"
                    />
                  </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-text-muted uppercase tracking-wider">Vendedor *</label>
                    <select
                        required={!initialData?.id}
                        disabled={!!initialData?.id}
                        value={vendedorId}
                        onChange={e => handleVendedorChange(e.target.value)}
                        className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11 disabled:opacity-60"
                    >
                        {!!initialData?.id ? (
                          <option value="">Não modificável</option>
                        ) : (
                          <>
                            <option value="">Selecione um vendedor...</option>
                            {professionals.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </>
                        )}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-text-muted uppercase tracking-wider">Responsável *</label>
                    <input
                        type="text"
                        disabled
                        value={user?.name || 'Carregando...'}
                        className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none text-sm text-text-primary h-11 disabled:opacity-60 cursor-not-allowed"
                    />
                </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center justify-between">
                <span>Equipe de Venda *</span>
                {vendedorId && userSalesTeams.length > 1 && (
                  <span className="text-[10px] text-brand-primary font-bold">
                    ({userSalesTeams.length} equipes disponíveis)
                  </span>
                )}
              </label>

              {!vendedorId ? (
                <select
                  disabled
                  className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none text-sm text-text-primary h-11 disabled:opacity-60 cursor-not-allowed"
                >
                  <option value="">Selecione um vendedor primeiro...</option>
                </select>
              ) : loadingTeams ? (
                <div className="flex items-center gap-2 py-2.5 px-4 bg-bg-deep border border-border-subtle rounded-md text-xs text-text-muted h-11">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                  <span>Buscando equipes de venda...</span>
                </div>
              ) : userSalesTeams.length > 1 ? (
                <select
                  required
                  value={salesTeamId}
                  onChange={e => setSalesTeamId(e.target.value)}
                  className="w-full bg-bg-deep border border-brand-primary/50 rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11 font-semibold"
                >
                  <option value="">Selecione a equipe de venda...</option>
                  {userSalesTeams.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              ) : userSalesTeams.length === 1 ? (
                <select
                  disabled
                  value={userSalesTeams[0].id}
                  className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none text-sm text-text-primary h-11 disabled:opacity-80 cursor-not-allowed font-medium"
                >
                  <option value={userSalesTeams[0].id}>{userSalesTeams[0].nome}</option>
                </select>
              ) : allCompanyTeams.length > 0 ? (
                <select
                  value={salesTeamId}
                  onChange={e => setSalesTeamId(e.target.value)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary text-sm text-text-primary h-11"
                >
                  <option value="">Selecione uma equipe da empresa...</option>
                  {allCompanyTeams.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              ) : (
                <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                  Nenhuma equipe de vendas cadastrada para esta empresa.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-4 pb-2">
              <input
                type="checkbox"
                id="usar_produtos_gerais"
                checked={usarProdutosGerais}
                onChange={e => setUsarProdutosGerais(e.target.checked)}
                className="w-4 h-4 rounded border-border-strong text-brand-primary focus:ring-brand-primary cursor-pointer"
              />
              <label htmlFor="usar_produtos_gerais" className="text-sm font-semibold text-text-primary cursor-pointer select-none">
                Usar Produtos Gerais
              </label>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-border-subtle">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-lg font-bold text-text-muted hover:bg-bg-deep transition-colors cursor-pointer text-sm"
                >
                    Cancelar
                </button>
                <Button
                    type="submit"
                    disabled={loading || !titulo || !customerId}
                    className="flex items-center gap-2 font-bold cursor-pointer text-sm"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {initialData?.id ? 'Salvar Alterações' : 'Criar e Continuar'}
                </Button>
            </div>
            </form>
        </motion.div>
        </div>

        <QuickCustomerCreateModal 
          isOpen={showQuickCustomer} 
          onClose={() => setShowQuickCustomer(false)}
          onSuccess={handleCustomerCreated} 
        />
    </>
  );
}
