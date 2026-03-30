import React, { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { manHoursApi } from '../../services/manHoursApi';
import type { ManHour, ManHourCreate } from '../../services/manHoursApi';
import { api } from '../../services/api';

interface Role {
  id: string;
  name: string;
  company_id: string;
}

type FormMode = 'create' | 'edit' | 'view';

interface ManHoursFormProps {
  mode: FormMode;
  record: ManHour | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const MONETARY_FIELDS = [
  { key: 'hora_normal', label: 'Hora Normal' },
  { key: 'hora_extra', label: 'Hora Extra' },
  { key: 'hora_extra_adicional_noturno', label: 'Hora Extra com Adicional Noturno' },
  { key: 'hora_extra_domingos_feriados', label: 'Hora Extra Dom. e Feriados' },
  { key: 'hora_extra_domingos_feriados_noturno', label: 'Hora Extra Dom. e Feriados Noturno' },
] as const;

type MonetaryKey = (typeof MONETARY_FIELDS)[number]['key'];

interface FormValues {
  role_id: string;
  vigencia: string;
  hora_normal: string;
  hora_extra: string;
  hora_extra_adicional_noturno: string;
  hora_extra_domingos_feriados: string;
  hora_extra_domingos_feriados_noturno: string;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function parseCurrency(raw: string): string {
  // Keep only digits and comma/dot, then normalize to JS number string
  return raw.replace(/[^\d,]/g, '').replace(',', '.');
}

const TITLE_MAP: Record<FormMode, string> = {
  create: 'Novo Hora/Homem',
  edit: 'Editar Hora/Homem',
  view: 'Visualizar Hora/Homem',
};

const ManHoursForm: React.FC<ManHoursFormProps> = ({ mode, record, onSuccess, onCancel }) => {
  const isReadOnly = mode === 'view';

  const emptyForm: FormValues = {
    role_id: '',
    vigencia: '',
    hora_normal: '',
    hora_extra: '',
    hora_extra_adicional_noturno: '',
    hora_extra_domingos_feriados: '',
    hora_extra_domingos_feriados_noturno: '',
  };

  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Load roles for the active company
  useEffect(() => {
    setRolesLoading(true);
    api
      .get('/roles')
      .then((res: any) => setRoles(res.data))
      .catch(() => setRoles([]))
      .finally(() => setRolesLoading(false));
  }, []);

  // Populate form when editing or viewing
  useEffect(() => {
    if (record && (mode === 'edit' || mode === 'view')) {
      setValues({
        role_id: record.role_id,
        vigencia: String(record.vigencia),
        hora_normal: formatCurrency(Number(record.hora_normal)),
        hora_extra: formatCurrency(Number(record.hora_extra)),
        hora_extra_adicional_noturno: formatCurrency(Number(record.hora_extra_adicional_noturno)),
        hora_extra_domingos_feriados: formatCurrency(Number(record.hora_extra_domingos_feriados)),
        hora_extra_domingos_feriados_noturno: formatCurrency(
          Number(record.hora_extra_domingos_feriados_noturno)
        ),
      });
    }
  }, [record, mode]);

  const handleChange = (field: keyof FormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    setApiError(null);
  };

  const handleMonetaryChange = (field: MonetaryKey, value: string) => {
    // Allow only numbers and separators
    const cleaned = value.replace(/[^\d,.]/g, '');
    handleChange(field, cleaned);
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!values.role_id) newErrors.role_id = 'Cargo é obrigatório.';

    const year = parseInt(values.vigencia, 10);
    if (!values.vigencia) {
      newErrors.vigencia = 'Vigência é obrigatória.';
    } else if (isNaN(year) || year < 2000 || year > 2099 || String(year).length !== 4) {
      newErrors.vigencia = 'Informe um ano válido (ex: 2024).';
    }

    MONETARY_FIELDS.forEach(({ key, label }) => {
      const raw = values[key];
      if (!raw) {
        newErrors[key] = `${label} é obrigatório.`;
      } else {
        const num = parseFloat(parseCurrency(raw));
        if (isNaN(num)) {
          newErrors[key] = `${label} inválido.`;
        } else if (num < 0) {
          newErrors[key] = `${label} não pode ser negativo.`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError(null);

    const payload: ManHourCreate = {
      role_id: values.role_id,
      vigencia: parseInt(values.vigencia, 10),
      hora_normal: parseFloat(parseCurrency(values.hora_normal)),
      hora_extra: parseFloat(parseCurrency(values.hora_extra)),
      hora_extra_adicional_noturno: parseFloat(parseCurrency(values.hora_extra_adicional_noturno)),
      hora_extra_domingos_feriados: parseFloat(parseCurrency(values.hora_extra_domingos_feriados)),
      hora_extra_domingos_feriados_noturno: parseFloat(
        parseCurrency(values.hora_extra_domingos_feriados_noturno)
      ),
    };

    try {
      if (mode === 'create') {
        await manHoursApi.create(payload);
      } else if (mode === 'edit' && record) {
        await manHoursApi.update(record.id, payload);
      }
      onSuccess();
    } catch (err: any) {
      setApiError(err.response?.data?.detail || 'Erro ao salvar registro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    'w-full px-3 py-2 text-sm rounded-md border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all';
  const inputNormal = `${inputBase} border-border-subtle`;
  const inputError = `${inputBase} border-brand-danger bg-brand-danger/5`;
  const inputDisabled = `${inputBase} border-border-subtle bg-bg-deep text-text-muted cursor-not-allowed`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle shrink-0">
        <h2 className="text-lg font-bold text-text-primary">{TITLE_MAP[mode]}</h2>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-md hover:bg-bg-deep text-text-muted transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {apiError && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-brand-danger/10 border border-brand-danger/30 text-brand-danger text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Cargo */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Cargo <span className="text-brand-danger">*</span>
          </label>
          {rolesLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando cargos...
            </div>
          ) : (
            <select
              id="man-hour-role"
              value={values.role_id}
              onChange={(e) => handleChange('role_id', e.target.value)}
              disabled={isReadOnly}
              className={errors.role_id ? inputError : isReadOnly ? inputDisabled : inputNormal}
            >
              <option value="">Selecione um cargo</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          {errors.role_id && <p className="text-xs text-brand-danger">{errors.role_id}</p>}
        </div>

        {/* Vigência */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Vigência (Ano) <span className="text-brand-danger">*</span>
          </label>
          <input
            id="man-hour-vigencia"
            type="number"
            min={2000}
            max={2099}
            placeholder="Ex: 2024"
            value={values.vigencia}
            onChange={(e) => handleChange('vigencia', e.target.value)}
            disabled={isReadOnly}
            className={errors.vigencia ? inputError : isReadOnly ? inputDisabled : inputNormal}
          />
          {errors.vigencia && <p className="text-xs text-brand-danger">{errors.vigencia}</p>}
        </div>

        {/* Valores monetários */}
        <div className="pt-2 border-t border-border-subtle">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
            Valores por Tipo de Hora
          </p>
          <div className="space-y-4">
            {MONETARY_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {label} <span className="text-brand-danger">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted font-semibold">
                    R$
                  </span>
                  <input
                    id={`man-hour-${key}`}
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={values[key]}
                    onChange={(e) => handleMonetaryChange(key, e.target.value)}
                    disabled={isReadOnly}
                    className={`${errors[key] ? inputError : isReadOnly ? inputDisabled : inputNormal} pl-9`}
                  />
                </div>
                {errors[key] && <p className="text-xs text-brand-danger">{errors[key]}</p>}
              </div>
            ))}
          </div>
        </div>
      </form>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-3 shrink-0">
        <button
          type="button"
          onClick={onCancel}
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
  );
};

export default ManHoursForm;
