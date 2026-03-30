import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Edit2, Eye, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { ownServicesApi, formatMinutes } from '../../services/ownServicesApi';
import type { OwnServiceListItem } from '../../services/ownServicesApi';
import OwnServicesModal from './OwnServicesModal';

type ModalMode = 'create' | 'edit' | 'view';

interface ModalState {
  open: boolean;
  mode: ModalMode;
  serviceId: string | null;
}

const OwnServicesDashboard: React.FC = () => {
  const [records, setRecords] = useState<OwnServiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'create', serviceId: null });
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
            Cadastre e gerencie serviços internos com composição de cargos e tempos de execução.
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
      <div className="bg-surface rounded-lg border border-border-subtle shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8f9fa] dark:bg-bg-deep border-b border-border-subtle">
              <tr className="text-xs text-text-muted uppercase tracking-wider">
                <th className="px-5 py-3 font-semibold">Nome do Serviço</th>
                <th className="px-5 py-3 font-semibold">Vigência</th>
                <th className="px-5 py-3 font-semibold text-center">Qtd. Cargos</th>
                <th className="px-5 py-3 font-semibold text-center">Tempo Total</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-surface">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-text-muted animate-pulse">
                    Carregando registros...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-text-muted">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList className="w-8 h-8 opacity-30" />
                      <span>Nenhum serviço próprio cadastrado.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="group hover:bg-bg-deep transition-colors">
                    <td className="px-5 py-3 font-semibold text-text-primary">{r.nome_servico}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-brand-primary/10 text-brand-primary">
                        {r.vigencia}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-bg-deep text-text-primary border border-border-subtle">
                        {r.qt_cargos}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="font-mono text-sm font-semibold text-text-primary">
                        {formatMinutes(r.tempo_total_minutos)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === r.id ? null : r.id)}
                        className="p-2 rounded-md hover:bg-surface text-text-muted hover:text-text-primary transition-all"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openDropdown === r.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                          <div className="fixed right-8 w-44 bg-surface rounded-md shadow-lg z-20 border border-border-subtle">
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
    </div>
  );
};

export default OwnServicesDashboard;
