import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Loader2
} from 'lucide-react';
import { api } from '../../../services/api';
import type { TaxRecoveryAnalysis, PaginatedTaxRecoveryList, TaxRecoveryStatus, OperationPurpose } from './types';
import { TaxRecoveryFormModal } from './TaxRecoveryFormModal';

export const TaxRecoveryList: React.FC = () => {
  const navigate = useNavigate();

  const [analyses, setAnalyses] = useState<TaxRecoveryAnalysis[]>([]);
  const [page] = useState(1);
  const [size] = useState(10);
  const [loading, setLoading] = useState(false);

  // Filters State
  const [filterName, setFilterName] = useState('');
  const [filterEntry, setFilterEntry] = useState<string>('');
  const [filterDest, setFilterDest] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TaxRecoveryAnalysis | null>(null);

  const fetchAnalyses = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page, size };
      if (filterName.trim()) params.name = filterName.trim();
      if (filterEntry) params.entry_purpose = filterEntry;
      if (filterDest) params.real_destination = filterDest;
      if (filterStatus) params.status = filterStatus;

      const res = await api.get<PaginatedTaxRecoveryList>('/fiscal/tax-recovery', { params });
      setAnalyses(res.data.items);
    } catch (err: any) {
      console.error('Erro ao carregar lista de recuperações:', err);
    } finally {
      setLoading(false);
    }
  }, [page, size, filterName, filterEntry, filterDest, filterStatus]);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const handleCreateSubmit = async (data: {
    name: string;
    entry_purpose: OperationPurpose;
    real_destination: OperationPurpose;
    description?: string;
  }) => {
    if (editingItem) {
      await api.put(`/fiscal/tax-recovery/${editingItem.id}`, data);
    } else {
      const res = await api.post<TaxRecoveryAnalysis>('/fiscal/tax-recovery', data);
      navigate(`/fiscal/recuperacao-impostos/${res.data.id}`);
      return;
    }
    await fetchAnalyses();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir a recuperação "${name}"?`)) return;
    try {
      await api.delete(`/fiscal/tax-recovery/${id}`);
      await fetchAnalyses();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro ao excluir a recuperação.');
    }
  };

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '---';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: TaxRecoveryStatus) => {
    switch (status) {
      case 'RASCUNHO':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">Rascunho</span>;
      case 'EM_PROCESSAMENTO':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">Em Processamento</span>;
      case 'PROCESSADA':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">Processada</span>;
      case 'PROCESSADA_COM_PENDENCIAS':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Com Pendências</span>;
      case 'CONCLUIDA':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">Concluída</span>;
      case 'CANCELADA':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">Cancelada</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
            Recuperação de <span className="text-brand-primary">Impostos</span>
          </h1>
          <p className="text-text-muted mt-1">
            Análise tributária de reenquadramento entre finalidade de entrada e destinação real da mercadoria (ICMS-ST e DIFAL).
          </p>
        </div>

        <button
          onClick={() => {
            setEditingItem(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md font-medium hover:bg-brand-primary/90 transition-colors min-h-[40px] cursor-pointer shadow-sm shadow-brand-primary/20 shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>Nova recuperação</span>
        </button>
      </header>

      {/* Filter Panel */}
      <div className="bg-surface border border-border-subtle rounded-lg p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
          <Filter className="w-4 h-4 text-brand-primary" />
          <span>Filtros de Pesquisa</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Nome da recuperação..."
              className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>

          <div>
            <select
              value={filterEntry}
              onChange={(e) => setFilterEntry(e.target.value)}
              className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="">Todas Finalidades Entrada</option>
              <option value="REVENDA">Revenda</option>
              <option value="USO_CONSUMO">Uso e Consumo</option>
              <option value="ATIVO_IMOBILIZADO">Ativo Imobilizado</option>
            </select>
          </div>

          <div>
            <select
              value={filterDest}
              onChange={(e) => setFilterDest(e.target.value)}
              className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="">Todas Destinações Reais</option>
              <option value="REVENDA">Revenda</option>
              <option value="USO_CONSUMO">Uso e Consumo</option>
              <option value="ATIVO_IMOBILIZADO">Ativo Imobilizado</option>
            </select>
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="">Todos os Status</option>
              <option value="RASCUNHO">Rascunho</option>
              <option value="EM_PROCESSAMENTO">Em Processamento</option>
              <option value="PROCESSADA">Processada</option>
              <option value="PROCESSADA_COM_PENDENCIAS">Com Pendências</option>
              <option value="CONCLUIDA">Concluída</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Tax Recovery Analyses */}
      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#f8f9fa] dark:bg-bg-deep text-text-muted uppercase font-semibold text-[10px] tracking-wider border-b border-border-subtle">
              <tr>
                <th className="px-4 py-3">Recuperação</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Entrada &rarr; Destino</th>
                <th className="px-4 py-3 text-center">Notas</th>
                <th className="px-4 py-3 text-right">Valor Notas</th>
                <th className="px-4 py-3 text-right">ST Orig. x Recalc.</th>
                <th className="px-4 py-3 text-right">DIFAL Orig. x Recalc.</th>
                <th className="px-4 py-3 text-right">A Recuperar</th>
                <th className="px-4 py-3 text-right">A Recolher</th>
                <th className="px-4 py-3 text-right">Saldo Líquido</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Criação</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-surface">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-text-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-primary mb-2" />
                    Carregando recuperações...
                  </td>
                </tr>
              ) : analyses.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-text-muted flex flex-col items-center justify-center">
                    <FileText className="w-10 h-10 text-text-muted/30 mb-2" />
                    Nenhuma recuperação de impostos cadastrada.
                  </td>
                </tr>
              ) : (
                analyses.map((item) => (
                  <tr key={item.id} className="hover:bg-bg-deep/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-primary hover:text-brand-primary cursor-pointer" onClick={() => navigate(`/fiscal/recuperacao-impostos/${item.id}`)}>
                        {item.name}
                      </div>
                      <div className="text-[10px] text-text-muted">Resp: {item.creator_name || '---'}</div>
                    </td>

                    <td className="px-4 py-3 text-text-primary font-medium">
                      {item.company_name || item.tenant_id}
                    </td>

                    <td className="px-4 py-3 font-medium">
                      <span className="text-text-muted">{item.entry_purpose}</span>
                      <span className="text-text-muted mx-1">&rarr;</span>
                      <span className="text-brand-primary font-semibold">{item.real_destination}</span>
                    </td>

                    <td className="px-4 py-3 text-center font-semibold text-text-primary">
                      {item.total_notes_count}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-text-primary font-mono">
                      {formatCurrency(item.total_notes_value)}
                    </td>

                    <td className="px-4 py-3 text-right font-mono">
                      <div className="text-text-muted">{formatCurrency(item.total_icms_st_original)}</div>
                      <div className="text-brand-primary font-semibold">{formatCurrency(item.total_icms_st_recalculated)}</div>
                    </td>

                    <td className="px-4 py-3 text-right font-mono">
                      <div className="text-text-muted">{formatCurrency(item.total_difal_original)}</div>
                      <div className="text-brand-primary font-semibold">{formatCurrency(item.total_difal_recalculated)}</div>
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatCurrency(item.total_to_recover)}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-rose-600 dark:text-rose-400 font-mono">
                      {formatCurrency(item.total_to_collect)}
                    </td>

                    <td className="px-4 py-3 text-right font-bold font-mono">
                      <span className={item.net_balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {formatCurrency(item.net_balance)}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(item.status)}
                    </td>

                    <td className="px-4 py-3 text-center text-text-muted text-[11px]">
                      {formatDate(item.created_at)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/fiscal/recuperacao-impostos/${item.id}`)}
                          title="Visualizar Detalhes"
                          className="p-1.5 text-text-muted hover:text-brand-primary transition-colors hover:bg-bg-deep rounded-md"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setIsModalOpen(true);
                          }}
                          title="Editar Cadastro"
                          className="p-1.5 text-text-muted hover:text-amber-500 transition-colors hover:bg-bg-deep rounded-md"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          title="Excluir"
                          className="p-1.5 text-text-muted hover:text-rose-500 transition-colors hover:bg-bg-deep rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova / Editar Recuperação */}
      <TaxRecoveryFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateSubmit}
        initialData={
          editingItem
            ? {
                name: editingItem.name,
                entry_purpose: editingItem.entry_purpose,
                real_destination: editingItem.real_destination,
                description: editingItem.description
              }
            : undefined
        }
        isEditing={Boolean(editingItem)}
      />
    </div>
  );
};
