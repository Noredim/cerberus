import React, { useCallback, useEffect, useState } from 'react';
import { Clock, Edit2, Eye, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { manHoursApi } from '../../services/manHoursApi';
import type { ManHour } from '../../services/manHoursApi';
import ManHoursForm from './ManHoursForm';

type DrawerMode = 'create' | 'edit' | 'view';

interface DrawerState {
  open: boolean;
  mode: DrawerMode;
  record: ManHour | null;
}

const fmt = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));

const ManHoursDashboard: React.FC = () => {
  const [records, setRecords] = useState<ManHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, mode: 'create', record: null });
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await manHoursApi.list();
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

  const openDrawer = (mode: DrawerMode, record: ManHour | null = null) => {
    setOpenDropdown(null);
    setDrawer({ open: true, mode, record });
  };

  const closeDrawer = () => setDrawer((prev) => ({ ...prev, open: false }));

  const handleSuccess = () => {
    closeDrawer();
    load();
  };

  const handleDeactivate = async (id: string, roleName: string) => {
    setOpenDropdown(null);
    if (!window.confirm(`Deseja inativar o registro de hora/homem para "${roleName}"?`)) return;
    setDeleteError(null);
    try {
      await manHoursApi.remove(id);
      await load();
    } catch (err: any) {
      setDeleteError(
        err.response?.data?.detail || 'Hora/homem vinculada, impossível realizar a exclusão.'
      );
    }
  };

  return (
    <div className="p-6 md:p-8 w-full space-y-8 relative min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary flex items-center gap-3">
            <Clock className="w-8 h-8 text-brand-primary" />
            Hora/Homem
          </h1>
          <p className="text-text-muted max-w-2xl">
            Parametrize os valores de hora/homem por cargo e vigência anual.
          </p>
        </div>

        <button
          id="btn-novo-hora-homem"
          onClick={() => openDrawer('create')}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-primary/90 transition-all hover:scale-[1.02] shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Novo Hora/Homem
        </button>
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div className="p-3 rounded-md bg-brand-danger/10 border border-brand-danger/30 text-brand-danger text-sm">
          {deleteError}
        </div>
      )}

      {/* Grid */}
      <div className="bg-surface rounded-lg border border-border-subtle shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8f9fa] dark:bg-bg-deep">
              <tr className="text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                <th className="px-5 py-3 font-semibold">Cargo</th>
                <th className="px-5 py-3 font-semibold">Vigência</th>
                <th className="px-5 py-3 font-semibold">H. Normal</th>
                <th className="px-5 py-3 font-semibold">H. Extra</th>
                <th className="px-5 py-3 font-semibold">H.E. Ad. Noturno</th>
                <th className="px-5 py-3 font-semibold">H.E. Dom./Fer.</th>
                <th className="px-5 py-3 font-semibold">H.E. Dom./Fer. Not.</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-surface">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-text-muted animate-pulse">
                    Carregando registros...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-text-muted">
                    <div className="flex flex-col items-center gap-2">
                      <Clock className="w-8 h-8 opacity-30" />
                      <span>Nenhum registro de hora/homem cadastrado.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="group hover:bg-bg-deep transition-colors">
                    <td className="px-5 py-3 font-semibold text-text-primary capitalize">
                      {r.role_name ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-brand-primary/10 text-brand-primary">
                        {r.vigencia}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-text-primary tabular-nums">{fmt(r.hora_normal)}</td>
                    <td className="px-5 py-3 text-text-primary tabular-nums">{fmt(r.hora_extra)}</td>
                    <td className="px-5 py-3 text-text-primary tabular-nums">
                      {fmt(r.hora_extra_adicional_noturno)}
                    </td>
                    <td className="px-5 py-3 text-text-primary tabular-nums">
                      {fmt(r.hora_extra_domingos_feriados)}
                    </td>
                    <td className="px-5 py-3 text-text-primary tabular-nums">
                      {fmt(r.hora_extra_domingos_feriados_noturno)}
                    </td>
                    <td className="px-5 py-3 text-right relative">
                      <button
                        onClick={() =>
                          setOpenDropdown(openDropdown === r.id ? null : r.id)
                        }
                        className="p-2 rounded-md hover:bg-surface text-text-muted hover:text-text-primary transition-all cursor-pointer"
                        title="Ações"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openDropdown === r.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenDropdown(null)}
                          />
                          <div className="absolute right-8 top-10 mt-2 w-48 bg-surface rounded-md shadow-lg z-20 border border-border-subtle overflow-hidden">
                            <div className="py-1 flex flex-col">
                              <button
                                onClick={() => openDrawer('view', r)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep transition-colors w-full text-left"
                              >
                                <Eye className="w-4 h-4" /> Visualizar
                              </button>
                              <button
                                onClick={() => openDrawer('edit', r)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep transition-colors w-full text-left"
                              >
                                <Edit2 className="w-4 h-4" /> Editar
                              </button>
                              <button
                                onClick={() => handleDeactivate(r.id, r.role_name ?? r.role_id)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-brand-danger hover:bg-brand-danger/10 transition-colors w-full text-left"
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
      </div>

      {/* Side Drawer */}
      {drawer.open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-bg-deep/80 backdrop-blur-sm"
            onClick={closeDrawer}
          />
          <div className="relative w-full max-w-xl bg-surface h-full shadow-2xl border-l border-border-subtle flex flex-col">
            <ManHoursForm
              mode={drawer.mode}
              record={drawer.record}
              onSuccess={handleSuccess}
              onCancel={closeDrawer}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ManHoursDashboard;
