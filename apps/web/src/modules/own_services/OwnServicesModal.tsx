import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Minus, Plus, X } from 'lucide-react';
import type { OwnServiceResponse, OwnServiceItemCreate } from '../../services/ownServicesApi';
import { ownServicesApi, formatMinutes } from '../../services/ownServicesApi';
import { api } from '../../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Role {
  id: string;
  name: string;
}

type ModalMode = 'create' | 'edit' | 'view';

interface OwnServicesModalProps {
  mode: ModalMode;
  serviceId: string | null;
  onSuccess: () => void;
  onClose: () => void;
}

interface ItemRow {
  _key: string; // internal stable key
  role_id: string;
  tempo_horas: string;
  tempo_minutos: string;
}

interface FormErrors {
  nome_servico?: string;
  vigencia?: string;
  items?: string;
  [key: string]: string | undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TITLE: Record<ModalMode, string> = {
  create: 'Novo Serviço Próprio',
  edit: 'Editar Serviço Próprio',
  view: 'Visualizar Serviço Próprio',
};

function newRow(): ItemRow {
  return { _key: crypto.randomUUID(), role_id: '', tempo_horas: '0', tempo_minutos: '0' };
}

function calcTotal(rows: ItemRow[]): number {
  return rows.reduce((acc, r) => {
    const h = parseInt(r.tempo_horas || '0', 10) || 0;
    const m = parseInt(r.tempo_minutos || '0', 10) || 0;
    return acc + h * 60 + m;
  }, 0);
}

// ── Component ─────────────────────────────────────────────────────────────────

const OwnServicesModal: React.FC<OwnServicesModalProps> = ({ mode, serviceId, onSuccess, onClose }) => {
  const isReadOnly = mode === 'view';
  const backdropRef = useRef<HTMLDivElement>(null);

  // Form state
  const [nomeServico, setNomeServico] = useState('');
  const [vigencia, setVigencia] = useState('');
  const [descricao, setDescricao] = useState('');
  const [rows, setRows] = useState<ItemRow[]>([newRow()]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);

  // Remote data
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  // ── Load roles ──────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/roles').then((r: any) => setRoles(r.data)).catch(() => setRoles([]));
  }, []);

  // ── Load existing record for edit/view ─────────────────────────────────────
  useEffect(() => {
    if ((mode === 'edit' || mode === 'view') && serviceId) {
      setDataLoading(true);
      ownServicesApi
        .get(serviceId)
        .then((svc: OwnServiceResponse) => {
          setNomeServico(svc.nome_servico);
          setVigencia(String(svc.vigencia));
          setDescricao(svc.descricao ?? '');
          setRows(
            svc.items.length > 0
              ? svc.items.map((i) => ({
                  _key: crypto.randomUUID(),
                  role_id: i.role_id,
                  tempo_horas: String(i.tempo_horas),
                  tempo_minutos: String(i.tempo_minutos),
                }))
              : [newRow()],
          );
        })
        .catch(() => setApiError('Erro ao carregar dados do serviço.'))
        .finally(() => setDataLoading(false));
    }
  }, [mode, serviceId]);

  // ── Close on backdrop click ─────────────────────────────────────────────────
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  // ── Row management ──────────────────────────────────────────────────────────

  const usedRoleIds = rows.map((r) => r.role_id).filter(Boolean);

  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const removeRow = (key: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r._key !== key) : prev));

  const updateRow = (key: string, field: keyof Omit<ItemRow, '_key'>, value: string) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
    setErrors((prev) => ({ ...prev, items: undefined, [`row_${key}_${field}`]: undefined }));
    setApiError(null);
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errs: FormErrors = {};

    if (!nomeServico.trim()) errs.nome_servico = 'Nome do serviço é obrigatório.';

    const year = parseInt(vigencia, 10);
    if (!vigencia) {
      errs.vigencia = 'Vigência é obrigatória.';
    } else if (isNaN(year) || year < 2000 || year > 2099 || String(year).length !== 4) {
      errs.vigencia = 'Informe um ano válido (ex: 2026).';
    }

    const validRows = rows.filter((r) => r.role_id);
    if (validRows.length === 0) {
      errs.items = 'Adicione ao menos um cargo à composição.';
    }

    rows.forEach((r) => {
      if (!r.role_id) {
        errs[`row_${r._key}_role_id`] = 'Selecione um cargo.';
      }
      const m = parseInt(r.tempo_minutos, 10);
      if (isNaN(m) || m < 0 || m > 59) {
        errs[`row_${r._key}_tempo_minutos`] = 'Minutos: 0–59.';
      }
      const h = parseInt(r.tempo_horas, 10);
      if (isNaN(h) || h < 0) {
        errs[`row_${r._key}_tempo_horas`] = 'Horas: >= 0.';
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setApiError(null);

    const items: OwnServiceItemCreate[] = rows
      .filter((r) => r.role_id)
      .map((r) => ({
        role_id: r.role_id,
        tempo_horas: parseInt(r.tempo_horas, 10) || 0,
        tempo_minutos: parseInt(r.tempo_minutos, 10) || 0,
      }));

    const payload = {
      nome_servico: nomeServico.trim(),
      vigencia: parseInt(vigencia, 10),
      descricao: descricao.trim() || undefined,
      items,
    };

    try {
      if (mode === 'create') {
        await ownServicesApi.create(payload);
      } else if (mode === 'edit' && serviceId) {
        await ownServicesApi.update(serviceId, payload);
      }
      onSuccess();
    } catch (err: any) {
      setApiError(err.response?.data?.detail || 'Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const inputBase =
    'w-full px-3 py-2 text-sm rounded-md border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40 transition-all';
  const inp = `${inputBase} border-border-subtle`;
  const inpErr = `${inputBase} border-brand-danger bg-brand-danger/5`;
  const inpDis = `${inputBase} border-border-subtle bg-bg-deep text-text-muted cursor-not-allowed`;

  const totalMinutes = calcTotal(rows);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-deep/80 backdrop-blur-sm p-4"
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-surface rounded-xl shadow-2xl border border-border-subtle flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle shrink-0">
          <h2 className="text-lg font-bold text-text-primary">{TITLE[mode]}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-bg-deep text-text-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {dataLoading ? (
            <div className="flex justify-center py-10 text-text-muted">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              {apiError && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-brand-danger/10 border border-brand-danger/30 text-brand-danger text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}

              {/* ── Seção 1: Cabeçalho ─────────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nome */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Nome do Serviço <span className="text-brand-danger">*</span>
                  </label>
                  <input
                    id="own-service-nome"
                    type="text"
                    placeholder="Ex: Instalação de câmeras"
                    value={nomeServico}
                    onChange={(e) => { setNomeServico(e.target.value); setErrors((p) => ({ ...p, nome_servico: undefined })); }}
                    disabled={isReadOnly}
                    className={errors.nome_servico ? inpErr : isReadOnly ? inpDis : inp}
                  />
                  {errors.nome_servico && <p className="text-xs text-brand-danger">{errors.nome_servico}</p>}
                </div>

                {/* Vigência */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Vigência (Ano) <span className="text-brand-danger">*</span>
                  </label>
                  <input
                    id="own-service-vigencia"
                    type="number"
                    min={2000}
                    max={2099}
                    placeholder="Ex: 2026"
                    value={vigencia}
                    onChange={(e) => { setVigencia(e.target.value); setErrors((p) => ({ ...p, vigencia: undefined })); }}
                    disabled={isReadOnly}
                    className={errors.vigencia ? inpErr : isReadOnly ? inpDis : inp}
                  />
                  {errors.vigencia && <p className="text-xs text-brand-danger">{errors.vigencia}</p>}
                </div>

                {/* Descrição */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Descrição <span className="text-xs text-text-muted font-normal normal-case">(opcional)</span>
                  </label>
                  <textarea
                    id="own-service-descricao"
                    rows={2}
                    placeholder="Descrição do serviço..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    disabled={isReadOnly}
                    className={`${isReadOnly ? inpDis : inp} resize-none`}
                  />
                </div>
              </div>

              {/* ── Seção 2: Composição ────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Composição de Cargos <span className="text-brand-danger">*</span>
                  </p>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={addRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-primary border border-brand-primary/40 rounded-md hover:bg-brand-primary/10 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar Cargo
                    </button>
                  )}
                </div>

                {errors.items && (
                  <p className="text-xs text-brand-danger">{errors.items}</p>
                )}

                {/* Item rows */}
                <div className="border border-border-subtle rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-bg-deep text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold">Cargo</th>
                        <th className="px-3 py-2.5 text-center font-semibold w-24">Horas</th>
                        <th className="px-3 py-2.5 text-center font-semibold w-24">Minutos</th>
                        <th className="px-3 py-2.5 text-center font-semibold w-20">Total</th>
                        {!isReadOnly && <th className="w-10" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle bg-surface">
                      {rows.map((row) => {
                        const rowH = parseInt(row.tempo_horas, 10) || 0;
                        const rowM = parseInt(row.tempo_minutos, 10) || 0;
                        const rowTotal = formatMinutes(rowH * 60 + rowM);
                        const rowRoleErr = errors[`row_${row._key}_role_id`];
                        const rowHErr = errors[`row_${row._key}_tempo_horas`];
                        const rowMErr = errors[`row_${row._key}_tempo_minutos`];

                        // Roles available: exclude those already selected in OTHER rows
                        const availableRoles = roles.filter(
                          (r) => r.id === row.role_id || !usedRoleIds.includes(r.id),
                        );

                        return (
                          <tr key={row._key} className="group">
                            <td className="px-4 py-2">
                              <select
                                value={row.role_id}
                                onChange={(e) => updateRow(row._key, 'role_id', e.target.value)}
                                disabled={isReadOnly}
                                className={`w-full text-sm rounded-md px-2 py-1.5 border focus:outline-none focus:ring-2 focus:ring-brand-primary/40 bg-surface text-text-primary transition-all ${rowRoleErr ? 'border-brand-danger bg-brand-danger/5' : isReadOnly ? 'border-border-subtle bg-bg-deep text-text-muted cursor-not-allowed' : 'border-border-subtle'}`}
                              >
                                <option value="">Selecione...</option>
                                {availableRoles.map((r) => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                              {rowRoleErr && <p className="text-xs text-brand-danger mt-0.5">{rowRoleErr}</p>}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                value={row.tempo_horas}
                                onChange={(e) => updateRow(row._key, 'tempo_horas', e.target.value)}
                                disabled={isReadOnly}
                                className={`w-full text-center text-sm rounded-md px-2 py-1.5 border focus:outline-none focus:ring-2 focus:ring-brand-primary/40 bg-surface text-text-primary transition-all ${rowHErr ? 'border-brand-danger' : isReadOnly ? 'border-border-subtle bg-bg-deep text-text-muted cursor-not-allowed' : 'border-border-subtle'}`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                max={59}
                                value={row.tempo_minutos}
                                onChange={(e) => updateRow(row._key, 'tempo_minutos', e.target.value)}
                                disabled={isReadOnly}
                                className={`w-full text-center text-sm rounded-md px-2 py-1.5 border focus:outline-none focus:ring-2 focus:ring-brand-primary/40 bg-surface text-text-primary transition-all ${rowMErr ? 'border-brand-danger' : isReadOnly ? 'border-border-subtle bg-bg-deep text-text-muted cursor-not-allowed' : 'border-border-subtle'}`}
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="font-mono text-sm text-text-muted">{rowTotal}</span>
                            </td>
                            {!isReadOnly && (
                              <td className="px-2 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeRow(row._key)}
                                  className="p-1 rounded-md text-text-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-colors"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Total time highlight */}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Tempo Total do Serviço
                  </span>
                  <span className="inline-flex items-center px-4 py-1.5 rounded-lg bg-brand-primary/10 border border-brand-primary/30 font-mono text-lg font-bold text-brand-primary tracking-widest">
                    {formatMinutes(totalMinutes)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-md border border-border-subtle text-text-primary hover:bg-bg-deep transition-colors"
          >
            {isReadOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-brand-primary rounded-md hover:bg-brand-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnServicesModal;
