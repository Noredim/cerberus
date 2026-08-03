import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Edit2, Eye, History, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { ownServicesApi } from '../../services/ownServicesApi';
import type { OwnServiceListItem } from '../../services/ownServicesApi';
import OwnServicesModal from './OwnServicesModal';
import { OwnServiceHistoryModal } from './OwnServiceHistoryModal';

type ModalMode = 'create' | 'edit' | 'view';

interface ModalState {
  open: boolean;
  mode: ModalMode;
  serviceId: string | null;
}

const formatCurrency = (val?: number) => {
  if (val === undefined || val === null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val);
};

const OwnServicesDashboard: React.FC = () => {
  const [records, setRecords] = useState<OwnServiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'create', serviceId: null });
  const [historyModal, setHistoryModal] = useState<{ open: boolean; serviceId: string | null; serviceName: string }>({
    open: false,
    serviceId: null,
    serviceName: '',
  });
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ownServicesApi.list();
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = (mode: ModalMode, serviceId: string | null = null) => {
    setOpenDropdown(null);
    setModal({ open: true, mode, serviceId });
  };

  const openHistory = (serviceId: string, serviceName: string) => {
    setOpenDropdown(null);
    setHistoryModal({ open: true, serviceId, serviceName });
  };

  const closeModal = () => setModal((prev) => ({ ...prev, open: false }));

  const handleSuccess = () => {
    closeModal();
    load();
  };

  const handleDeactivate = async (id: string, nome: string) => {
    setOpenDropdown(null);
    if (!window.confirm(`Deseja inativar o serviço "${nome}"?`)) return;
    setDeleteError(null);
    try {
      await ownServicesApi.remove(id);
      await load();
    } catch (err: any) {
      setDeleteError(err.response?.data?.detail || 'Erro ao inativar o serviço.');
    }
  };

  return (
    <div className="p-6 md:p-8 w-full space-y-8 relative min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-brand-primary" />
            Serviços Próprios
          </h1>
          <p className="text-text-muted max-w-2xl">
            Cadastre e gerencie serviços internos com composição de cargos, tempos de execução e valores por faixa de Hora/Homem.
          </p>
        </div>

        <button
          id="btn-novo-servico-proprio"
          onClick={() => openModal('create')}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-primary/90 transition-all hover:scale-[1.02] shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Novo Serviço Próprio
        </button>
      </div>

      {/* Error banner */}
      {deleteError && (
        <div className="p-3 rounded-md bg-brand-danger/10 border border-brand-danger/30 text-brand-danger text-sm">
          {deleteError}
        </div>
      )}

      {/* Grid */}
      <div className="bg-surface rounded-lg border border-border-subtle shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#f8f9fa] dark:bg-bg-deep border-b border-border-subtle">
              <tr className="text-xs text-text-muted uppercase tracking-wider">
                <th className="px-4 py-3 font-semibold w-16">ID</th>
                <th className="px-4 py-3 font-semibold">Nome do Serviço</th>
                <th className="px-3 py-3 font-semibold">Unidade</th>
                <th className="px-3 py-3 font-semibold">Vigência</th>
                <th className="px-3 py-3 font-semibold text-center">Cargos</th>
                <th className="px-3 py-3 font-semibold text-center">Tempo Consolidado</th>
                <th className="px-4 py-3 font-semibold text-right text-emerald-600 dark:text-emerald-400">H. Normal</th>
                <th className="px-4 py-3 font-semibold text-right text-blue-600 dark:text-blue-400">H. Extra</th>
                <th className="px-4 py-3 font-semibold text-right text-indigo-600 dark:text-indigo-400">H.E. Ad. Not.</th>
                <th className="px-4 py-3 font-semibold text-right text-amber-600 dark:text-amber-400">H.E. Dom./Fer.</th>
                <th className="px-4 py-3 font-semibold text-right text-rose-600 dark:text-rose-400">H.E. Dom./Fer. Not.</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-surface">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-5 py-10 text-center text-text-muted animate-pulse">
                    Carregando registros...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-5 py-10 text-center text-text-muted">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList className="w-8 h-8 opacity-30" />
                      <span>Nenhum serviço próprio cadastrado.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => (
                  <tr key={r.id} className="group hover:bg-bg-deep transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold font-mono bg-bg-deep border border-border-subtle text-text-muted">
                        SP{String(idx + 1).padStart(3, '0')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary">{r.nome_servico}</td>
                    <td className="px-3 py-3 text-sm text-text-muted">{r.unidade || '—'}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-brand-primary/10 text-brand-primary">
                        {r.vigencia}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-bg-deep text-text-primary border border-border-subtle">
                        {r.qt_cargos}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-mono text-sm font-semibold text-text-primary">
                        {r.tempo_consolidado_hhmmss || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(r.valores_faixa?.hora_normal)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {formatCurrency(r.valores_faixa?.hora_extra)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(r.valores_faixa?.hora_extra_adicional_noturno)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {formatCurrency(r.valores_faixa?.hora_extra_domingos_feriados)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                      {formatCurrency(r.valores_faixa?.hora_extra_domingos_feriados_noturno)}
                    </td>
                    <td className="px-5 py-3 text-right relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === r.id ? null : r.id)}
                        className="p-2 rounded-md hover:bg-surface text-text-muted hover:text-text-primary transition-all"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openDropdown === r.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                          <div className="absolute right-5 top-10 w-48 bg-surface rounded-md shadow-lg z-20 border border-border-subtle overflow-hidden">
                            <div className="py-1 flex flex-col">
                              <button
                                onClick={() => openModal('view', r.id)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep w-full text-left transition-colors"
                              >
                                <Eye className="w-4 h-4" /> Visualizar
                              </button>
                              <button
                                onClick={() => openModal('edit', r.id)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep w-full text-left transition-colors"
                              >
                                <Edit2 className="w-4 h-4" /> Editar
                              </button>
                              <button
                                onClick={() => openHistory(r.id, r.nome_servico)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep w-full text-left transition-colors"
                              >
                                <History className="w-4 h-4 text-brand-primary" /> Histórico
                              </button>
                              <button
                                onClick={() => handleDeactivate(r.id, r.nome_servico)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-brand-danger hover:bg-brand-danger/10 w-full text-left transition-colors"
                              >
                                <Trash2 className="w-4 h-4" /> Inativar
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
      </div>

      {/* Modal */}
      {modal.open && (
        <OwnServicesModal
          mode={modal.mode}
          serviceId={modal.serviceId}
          onSuccess={handleSuccess}
          onClose={closeModal}
        />
      )}

      {/* Modal de Histórico */}
      <OwnServiceHistoryModal
        isOpen={historyModal.open}
        serviceId={historyModal.serviceId}
        serviceName={historyModal.serviceName}
        onClose={() => setHistoryModal({ open: false, serviceId: null, serviceName: '' })}
      />
    </div>
  );
};

export default OwnServicesDashboard;
