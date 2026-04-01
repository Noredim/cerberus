import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Clock, Loader2, Minus, Plus, X } from 'lucide-react';
import type { OwnServiceResponse, OwnServiceItemCreate } from '../../services/ownServicesApi';
import { ownServicesApi, fatorToHHMMSS, calcFatorConsolidado } from '../../services/ownServicesApi';
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
  _key: string;
  role_id: string;
  fator: string; // decimal string input
}

interface FormErrors {
  nome_servico?: string;
  unidade?: string;
  vigencia?: string;
  items?: string;
  [key: string]: string | undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TITLE: Record<ModalMode, string> = {
  create: 'Novo Serviço Próprio',
  edit:   'Editar Serviço Próprio',
  view:   'Visualizar Serviço Próprio',
};

function newRow(): ItemRow {
  return { _key: crypto.randomUUID(), role_id: '', fator: '' };
}

function parseFator(v: string): number {
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// ── Component ─────────────────────────────────────────────────────────────────

const OwnServicesModal: React.FC<OwnServicesModalProps> = ({ mode, serviceId, onSuccess, onClose }) => {
  const isReadOnly = mode === 'view';
  const backdropRef = useRef<HTMLDivElement>(null);

  // Form state
  const [nomeServico, setNomeServico] = useState('');
  const [unidade, setUnidade] = useState('');
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

  // ── Load existing record ────────────────────────────────────────────────────
  useEffect(() => {
    if ((mode === 'edit' || mode === 'view') && serviceId) {
      setDataLoading(true);
      ownServicesApi
        .get(serviceId)
        .then((svc: OwnServiceResponse) => {
          setNomeServico(svc.nome_servico);
          setUnidade(svc.unidade || '');
          setVigencia(String(svc.vigencia));
          setDescricao(svc.descricao ?? '');
          setRows(
            svc.items.length > 0
              ? svc.items.map((i) => ({
                  _key: crypto.randomUUID(),
                  role_id: i.role_id,
                  // If fator exists use it; otherwise fall back to converting old tempo_minutos
                  fator: i.fator != null
                    ? String(i.fator)
                    : String(parseFloat((i.tempo_minutos / 60).toFixed(4))),
                }))
              : [newRow()],
          );
        })
        .catch(() => setApiError('Erro ao carregar dados do serviço.'))
        .finally(() => setDataLoading(false));
    }
  }, [mode, serviceId]);

  // ── Backdrop click ──────────────────────────────────────────────────────────
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

  // ── Computed consolidado ────────────────────────────────────────────────────
  const validFatores = rows
    .filter((r) => r.role_id)
    .map((r) => parseFator(r.fator))
    .filter((f) => f > 0);

  const consolidado = calcFatorConsolidado(validFatores);

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: FormErrors = {};

    if (!nomeServico.trim()) errs.nome_servico = 'Nome do serviço é obrigatório.';
    if (unidade.trim().length > 10) errs.unidade = 'Máximo de 10 caracteres.';

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
      const f = parseFator(r.fator);
      if (!r.fator || f <= 0) {
        errs[`row_${r._key}_fator`] = 'Fator deve ser > 0.';
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
        fator: parseFator(r.fator),
      }));

    const payload = {
      nome_servico: nomeServico.trim(),
      unidade: unidade.trim() || undefined,
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
  const inp    = `${inputBase} border-border-subtle`;
  const inpErr = `${inputBase} border-brand-danger bg-brand-danger/5`;
  const inpDis = `${inputBase} border-border-subtle bg-bg-deep text-text-muted cursor-not-allowed`;

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

                {/* Unidade */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Unidade <span className="text-xs text-text-muted font-normal normal-case">(opcional, máx 10)</span>
                  </label>
                  <input
                    id="own-service-unidade"
                    type="text"
                    maxLength={10}
                    placeholder="Ex: UN, H, KM"
                    value={unidade}
                    onChange={(e) => { setUnidade(e.target.value); setErrors((p) => ({ ...p, unidade: undefined })); }}
                    disabled={isReadOnly}
                    className={errors.unidade ? inpErr : isReadOnly ? inpDis : inp}
                  />
                  {errors.unidade && <p className="text-xs text-brand-danger">{errors.unidade}</p>}
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
                <div className="md:col-span-2 space-y-1">
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

              {/* ── Seção 2: Composição de Cargos ─────────────────────── */}
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

                {/* Grid de itens */}
                <div className="border border-border-subtle rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-bg-deep text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                      <tr>
                        <th className="px-3 py-2.5 text-center font-semibold w-14">ID</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Cargo</th>
                        <th className="px-3 py-2.5 text-center font-semibold w-36">
                          Fator <span className="font-normal normal-case">(horas)</span>
                        </th>
                        <th className="px-3 py-2.5 text-center font-semibold w-32">Tempo</th>
                        {!isReadOnly && <th className="w-10" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle bg-surface">
                      {rows.map((row, idx) => {
                        const f = parseFator(row.fator);
                        const hhmmss = f > 0 ? fatorToHHMMSS(f) : '—';
                        const rowRoleErr = errors[`row_${row._key}_role_id`];
                        const rowFatorErr = errors[`row_${row._key}_fator`];

                        const availableRoles = roles.filter(
                          (r) => r.id === row.role_id || !usedRoleIds.includes(r.id),
                        );

                        return (
                          <tr key={row._key} className="group">
                            {/* Sequential ID */}
                            <td className="px-3 py-2 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold font-mono bg-bg-deep border border-border-subtle text-text-muted">
                                C{idx + 1}
                              </span>
                            </td>
                            {/* Cargo */}
                            <td className="px-4 py-2">
                              <select
                                value={row.role_id}
                                onChange={(e) => updateRow(row._key, 'role_id', e.target.value)}
                                disabled={isReadOnly}
                                className={`w-full text-sm rounded-md px-2 py-1.5 border focus:outline-none focus:ring-2 focus:ring-brand-primary/40 bg-surface text-text-primary transition-all ${
                                  rowRoleErr
                                    ? 'border-brand-danger bg-brand-danger/5'
                                    : isReadOnly
                                    ? 'border-border-subtle bg-bg-deep text-text-muted cursor-not-allowed'
                                    : 'border-border-subtle'
                                }`}
                              >
                                <option value="">Selecione...</option>
                                {availableRoles.map((r) => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                              {rowRoleErr && <p className="text-xs text-brand-danger mt-0.5">{rowRoleErr}</p>}
                            </td>

                            {/* Fator decimal */}
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="Ex: 1.5"
                                value={row.fator}
                                onChange={(e) => updateRow(row._key, 'fator', e.target.value)}
                                disabled={isReadOnly}
                                className={`w-full text-center text-sm rounded-md px-2 py-1.5 border focus:outline-none focus:ring-2 focus:ring-brand-primary/40 bg-surface text-text-primary transition-all ${
                                  rowFatorErr
                                    ? 'border-brand-danger bg-brand-danger/5'
                                    : isReadOnly
                                    ? 'border-border-subtle bg-bg-deep text-text-muted cursor-not-allowed'
                                    : 'border-border-subtle'
                                }`}
                              />
                              {rowFatorErr && <p className="text-xs text-brand-danger mt-0.5">{rowFatorErr}</p>}
                            </td>

                            {/* Tempo convertido HH:MM:SS */}
                            <td className="px-3 py-2 text-center">
                              <span className="inline-flex items-center gap-1 font-mono text-sm text-text-muted">
                                <Clock className="w-3.5 h-3.5 opacity-50" />
                                {hhmmss}
                              </span>
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

                {/* Tempo Consolidado */}
                <div className="flex items-center justify-between pt-2 px-1">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                      Tempo Consolidado
                    </p>
                    <p className="text-xs text-text-muted">
                      Média dos fatores ({validFatores.length > 0 ? validFatores.length : '—'} cargo{validFatores.length !== 1 ? 's' : ''})
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {consolidado.fator > 0 && (
                      <span className="text-xs text-text-muted font-mono">
                        fator {consolidado.fator.toFixed(4)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary/10 border border-brand-primary/30 font-mono text-lg font-bold text-brand-primary tracking-widest">
                      <Clock className="w-4 h-4 opacity-70" />
                      {validFatores.length > 0 ? consolidado.hhmmss : '—'}
                    </span>
                  </div>
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
