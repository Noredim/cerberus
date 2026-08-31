import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Trash2, AlertTriangle, Search, ArrowUpDown, ArrowUp, ArrowDown, X, Clock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/modals/Modal';

interface KitSummary {
  valor_mensal_kit: number;
  valor_mensal_antes_impostos: number; // billing value shown in form
  lucro_mensal_kit: number;
  margem_kit: number;
  roi_meses: number;
}

interface Kit {
  id: string;
  nome_kit: string;
  tipo_contrato: string;
  quantidade_kits: number;
  created_at?: string;
  updated_at?: string;
  summary?: KitSummary;
}

const fmtC = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
};

const RENTAL_TYPES = ['LOCACAO', 'COMODATO'];

type SortField = 'updated_at' | 'nome_kit' | 'tipo_contrato' | 'quantidade_kits' | 'valor_mensal' | 'lucro' | 'margem' | 'roi';

export const OpportunityKitList = () => {
  const navigate = useNavigate();
  const { activeCompanyId } = useAuth();
  const [kits, setKits] = useState<Kit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Deletion modal state
  const [kitToDelete, setKitToDelete] = useState<Kit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (activeCompanyId) fetchKits();
  }, [activeCompanyId]);

  const fetchKits = async () => {
    try {
      const { data } = await api.get(`/opportunity-kits/company/${activeCompanyId}`);
      setKits(data);
    } catch (error) {
      console.error('Error fetching kits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDeleteModal = (kit: Kit) => {
    setKitToDelete(kit);
    setDeleteError(null);
  };

  const handleCloseDeleteModal = () => {
    if (isDeleting) return;
    setKitToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!kitToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/opportunity-kits/${kitToDelete.id}`);
      setKits(prev => prev.filter(k => k.id !== kitToDelete.id));
      setKitToDelete(null);
    } catch (error: any) {
      console.error('Error deleting kit:', error);
      const detailMessage = error.response?.data?.detail || 'Ocorreu um erro ao tentar excluir o kit.';
      setDeleteError(detailMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'updated_at' ? 'desc' : 'asc');
    }
  };

  const filteredAndSortedKits = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = kits.filter(k => !term || (k.nome_kit && k.nome_kit.toLowerCase().includes(term)));

    return [...filtered].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'updated_at') {
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      if (sortField === 'nome_kit') {
        valA = a.nome_kit || '';
        valB = b.nome_kit || '';
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (sortField === 'tipo_contrato') {
        valA = a.tipo_contrato || '';
        valB = b.tipo_contrato || '';
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (sortField === 'quantidade_kits') {
        valA = a.quantidade_kits || 0;
        valB = b.quantidade_kits || 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      if (sortField === 'valor_mensal') {
        valA = a.summary?.valor_mensal_antes_impostos ?? a.summary?.valor_mensal_kit ?? 0;
        valB = b.summary?.valor_mensal_antes_impostos ?? b.summary?.valor_mensal_kit ?? 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      if (sortField === 'lucro') {
        valA = a.summary?.lucro_mensal_kit ?? 0;
        valB = b.summary?.lucro_mensal_kit ?? 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      if (sortField === 'margem') {
        valA = a.summary?.margem_kit ?? 0;
        valB = b.summary?.margem_kit ?? 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      if (sortField === 'roi') {
        valA = a.summary?.roi_meses ?? 0;
        valB = b.summary?.roi_meses ?? 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      return 0;
    });
  }, [kits, search, sortField, sortOrder]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-brand-primary" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-brand-primary" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Kits da Oportunidade</h1>
          <p className="text-text-muted mt-1">
            Gerencie os combos de produtos e cálculos de locação vinculados a este orçamento.
          </p>
        </div>
        <Button onClick={() => navigate(`/cadastros/kits/novo`)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Kit
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome do kit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2 border border-border-subtle rounded-xl bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all duration-150 shadow-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary rounded-md transition-colors"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-xs text-text-muted flex items-center gap-1.5 self-end sm:self-center">
          <Clock className="w-3.5 h-3.5" />
          <span>
            {kits.length === 0
              ? 'Nenhum kit'
              : search
              ? `${filteredAndSortedKits.length} de ${kits.length} kit(s)`
              : `${kits.length} kit(s) cadastrado(s)`}
          </span>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-text-muted">Carregando kits...</div>
        ) : kits.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-bg-deep rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-brand-primary opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">Nenhum Kit Registrado</h3>
            <p className="text-text-muted max-w-sm mb-6">
              Esta oportunidade ainda não possui kits associados. Crie um novo kit para calcular os valores de locação consolidada.
            </p>
            <Button onClick={() => navigate(`/cadastros/kits/novo`)}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Primeiro Kit
            </Button>
          </div>
        ) : filteredAndSortedKits.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <Search className="w-10 h-10 text-text-muted opacity-40 mb-3" />
            <h3 className="text-base font-semibold text-text-primary mb-1">Nenhum kit encontrado</h3>
            <p className="text-text-muted text-sm max-w-sm mb-4">
              Nenhum kit corresponde ao termo de busca "{search}".
            </p>
            <Button variant="outline" size="sm" onClick={() => setSearch('')}>
              Limpar Filtro de Busca
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-bg-deep/50 text-text-muted font-medium border-b border-border-subtle">
                <tr>
                  <th
                    className="px-6 py-4 cursor-pointer select-none group hover:text-text-primary transition-colors"
                    onClick={() => handleSort('nome_kit')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Nome do Kit</span>
                      {renderSortIcon('nome_kit')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 cursor-pointer select-none group hover:text-text-primary transition-colors"
                    onClick={() => handleSort('tipo_contrato')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Tipo Modalidade</span>
                      {renderSortIcon('tipo_contrato')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-center cursor-pointer select-none group hover:text-text-primary transition-colors"
                    onClick={() => handleSort('quantidade_kits')}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Qtd.</span>
                      {renderSortIcon('quantidade_kits')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-right cursor-pointer select-none group hover:text-text-primary transition-colors"
                    onClick={() => handleSort('valor_mensal')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Valor Mensal</span>
                      {renderSortIcon('valor_mensal')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-right cursor-pointer select-none group hover:text-text-primary transition-colors"
                    onClick={() => handleSort('lucro')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Lucro Mensal</span>
                      {renderSortIcon('lucro')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-right cursor-pointer select-none group hover:text-text-primary transition-colors"
                    onClick={() => handleSort('margem')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Margem</span>
                      {renderSortIcon('margem')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-right cursor-pointer select-none group hover:text-text-primary transition-colors"
                    onClick={() => handleSort('roi')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>ROI</span>
                      {renderSortIcon('roi')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-center cursor-pointer select-none group hover:text-text-primary transition-colors bg-brand-primary/5"
                    onClick={() => handleSort('updated_at')}
                  >
                    <div className="flex items-center justify-center gap-1.5 font-semibold text-brand-primary">
                      <span>Últ. Alteração</span>
                      {renderSortIcon('updated_at')}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredAndSortedKits.map((kit) => {
                  const isRental = RENTAL_TYPES.includes(kit.tipo_contrato);
                  const valorMensal = kit.summary?.valor_mensal_antes_impostos ?? kit.summary?.valor_mensal_kit ?? 0;
                  const lucro = kit.summary?.lucro_mensal_kit ?? 0;
                  const margem = kit.summary?.margem_kit ?? 0;
                  const roi = kit.summary?.roi_meses ?? 0;

                  return (
                    <tr key={kit.id} className="hover:bg-bg-deep/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-text-primary">{kit.nome_kit}</td>
                      <td className="px-6 py-4 text-text-secondary">{kit.tipo_contrato}</td>
                      <td className="px-6 py-4 text-center text-text-secondary">{kit.quantidade_kits}</td>

                      <td className="px-6 py-4 text-right tabular-nums text-text-primary font-medium">
                        {fmtC(valorMensal)}
                      </td>

                      <td className="px-6 py-4 text-right tabular-nums font-medium">
                        {isRental ? (
                          <span className="text-text-muted">—</span>
                        ) : (
                          <span className="text-brand-success">{fmtC(lucro)}</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right tabular-nums font-medium">
                        {isRental ? (
                          <span className="text-text-muted">—</span>
                        ) : (
                          <span className="text-brand-secondary">{Number(margem).toFixed(2)}%</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right tabular-nums">
                        {isRental && roi > 0 ? (
                          <span className="inline-flex items-center gap-1 text-cyan-600 font-bold">
                            {Number(roi).toFixed(1)}
                            <span className="text-[10px] text-text-muted font-normal">m</span>
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center tabular-nums text-xs text-text-secondary whitespace-nowrap bg-brand-primary/5 font-mono">
                        {formatDate(kit.updated_at || kit.created_at)}
                      </td>

                      <td className="px-6 py-4 text-right font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/cadastros/kits/${kit.id}`)}>
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDeleteModal(kit)}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-500/10"
                            title="Excluir Kit"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      {/* Confirmation Modal for Deletion */}
      <Modal
        isOpen={kitToDelete !== null}
        onClose={handleCloseDeleteModal}
        title="Confirmar Exclusão de Kit"
        description="Esta ação removerá o kit do cadastro de oportunidades."
        maxWidth="md"
      >
        <div className="space-y-4">
          {deleteError ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-3 text-rose-600 dark:text-rose-400 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-1">Não foi possível excluir o kit:</span>
                <p>{deleteError}</p>
              </div>
            </div>
          ) : (
            <p className="text-text-primary text-sm">
              Tem certeza que deseja excluir o kit <strong className="font-bold text-text-primary">{kitToDelete?.nome_kit}</strong>? Esta ação não poderá ser desfeita.
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <Button variant="outline" onClick={handleCloseDeleteModal} disabled={isDeleting}>
              {deleteError ? 'Fechar' : 'Cancelar'}
            </Button>
            {!deleteError && (
              <Button
                variant="primary"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
