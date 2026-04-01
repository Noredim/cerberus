import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Building2, Search, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../services/api';
import { useCompanies } from '../../modules/companies/hooks/useCompanies';

interface State {
  id: string;
  sigla: string;
  nome: string;
}

interface Municipality {
  id: string;
  nome: string;
}

interface QuickSupplierCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (supplier: any) => void;
}

export function QuickSupplierCreateModal({
  isOpen,
  onClose,
  onSuccess,
}: QuickSupplierCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState('');
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<Municipality[]>([]);

  const { lookupCNPJ } = useCompanies();

  const [formData, setFormData] = useState({
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    email: '',
    telefone: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipality_id: '',
    state_id: '',
  });

  // Fetch states on mount
  useEffect(() => {
    if (!isOpen) return;
    api.get('/catalog/states').then(res => setStates(res.data)).catch(console.error);
  }, [isOpen]);

  const fetchCities = async (stateId: string) => {
    if (!stateId) { setCities([]); return; }
    try {
      const res = await api.get(`/catalog/cities?state_id=${stateId}&page_size=1000`);
      setCities(res.data.items || res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStateChange = (stateId: string) => {
    setFormData(prev => ({ ...prev, state_id: stateId, municipality_id: '' }));
    fetchCities(stateId);
  };

  const handleCnpjLookup = async () => {
    const cnpjStr = formData.cnpj?.replace(/\D/g, '') || '';
    if (cnpjStr.length < 14) return;

    setLookupLoading(true);
    setError('');

    try {
      const response = await lookupCNPJ(cnpjStr);

      if (!response.success) {
        setError('CNPJ não localizado.');
        return;
      }

      const result = response.normalizedData;

      // Resolve state and municipality IDs from lookup data
      const state = states.find(s => s.sigla === result.endereco?.uf);
      let cityId = '';

      if (state) {
        try {
          const citiesRes = await api.get(`/catalog/cities?state_id=${state.id}&page_size=1000`);
          const stateCities = citiesRes.data.items || citiesRes.data;
          setCities(stateCities);

          // 1. Try by CEP IBGE code
          if (result.endereco?.cep) {
            const cepClean = result.endereco.cep.replace(/\D/g, '');
            try {
              const cepRes = await api.get(`/utils/cep/${cepClean}`);
              const ibge = cepRes.data.ibge;
              if (ibge) {
                const cityByIbge = stateCities.find((c: any) => String(c.ibge_id) === String(ibge));
                if (cityByIbge) cityId = cityByIbge.id;
              }
            } catch (e) {
              console.error('Falha na validação do CEP no lookup de CNPJ');
            }
          }

          // 2. Fallback by municipality name
          if (!cityId && result.endereco?.municipio) {
            const normalize = (s: string) =>
              s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
            const cityMatch = stateCities.find(
              (c: any) => normalize(c.nome) === normalize(result.endereco.municipio)
            );
            if (cityMatch) cityId = cityMatch.id;
          }
        } catch (e) {
          console.error('Erro ao buscar cidades para o estado selecionado');
        }
      }

      setFormData(prev => ({
        ...prev,
        razao_social: result.razaoSocial || prev.razao_social,
        nome_fantasia: result.nomeFantasia || prev.nome_fantasia,
        email: result.email || prev.email,
        telefone: result.telefone || prev.telefone,
        logradouro: result.endereco?.logradouro || prev.logradouro,
        numero: result.endereco?.numero || prev.numero,
        complemento: result.endereco?.complemento || prev.complemento,
        bairro: result.endereco?.bairro || prev.bairro,
        cep: result.endereco?.cep || prev.cep,
        state_id: state?.id || prev.state_id,
        municipality_id: cityId || prev.municipality_id,
      }));

    } catch (err: any) {
      console.error('Lookup error:', err);
      setError('Falha ao consultar CNPJ. Verifique a conexão ou tente novamente.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cnpj || !formData.razao_social) return;

    setError('');
    setLoading(true);

    try {
      const payload: Record<string, any> = { ...formData, active: true };

      if (!payload.municipality_id) delete payload.municipality_id;
      if (!payload.state_id) delete payload.state_id;

      const res = await api.post('/cadastro/fornecedores', payload);
      onSuccess(res.data);
      onClose();

      setFormData({
        cnpj: '',
        razao_social: '',
        nome_fantasia: '',
        email: '',
        telefone: '',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        municipality_id: '',
        state_id: '',
      });
      setCities([]);
    } catch (err: any) {
      console.error('Save error:', err);
      setError('Falha ao salvar fornecedor: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
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
        className="relative w-full max-w-xl bg-surface rounded-2xl shadow-xl overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-border-subtle bg-bg-deep flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-text-primary tracking-tight">Novo Fornecedor</h2>
              <p className="text-xs text-text-muted">Cadastro rápido pelo CNPJ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-brand-danger/10 border border-brand-danger/20 rounded-lg text-xs text-brand-danger">
              {error}
            </div>
          )}

          {/* CNPJ */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">CNPJ *</label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={18}
                required
                value={formData.cnpj}
                onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                className="flex-1 bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
                placeholder="00.000.000/0000-00"
              />
              <button
                type="button"
                onClick={handleCnpjLookup}
                disabled={lookupLoading || (formData.cnpj?.replace(/\D/g, '') || '').length < 14}
                className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-md hover:bg-brand-primary/20 transition-all text-sm font-semibold disabled:opacity-50 cursor-pointer h-11 border border-brand-primary/20"
              >
                {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </button>
            </div>
          </div>

          {/* Razão Social */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Razão Social *</label>
            <input
              type="text"
              required
              value={formData.razao_social}
              onChange={e => setFormData({ ...formData, razao_social: e.target.value })}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
            />
          </div>

          {/* Nome Fantasia */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Nome Fantasia (Opcional)</label>
            <input
              type="text"
              value={formData.nome_fantasia}
              onChange={e => setFormData({ ...formData, nome_fantasia: e.target.value })}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 text-sm focus:border-brand-primary outline-none transition-colors h-11"
            />
          </div>

          {/* Email + Telefone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">E-mail (Opcional)</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 text-sm focus:border-brand-primary outline-none transition-colors h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Telefone (Opcional)</label>
              <input
                type="text"
                value={formData.telefone}
                onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 text-sm focus:border-brand-primary outline-none transition-colors h-11"
              />
            </div>
          </div>

          {/* Endereço divider */}
          <div className="flex items-center gap-2 pt-1">
            <MapPin className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Endereço (Opcional)</span>
            <div className="flex-1 h-px bg-border-subtle" />
          </div>

          {/* Estado + Município */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Estado (UF)</label>
              <select
                value={formData.state_id}
                onChange={e => handleStateChange(e.target.value)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors h-11"
              >
                <option value="">Selecione...</option>
                {states.map(s => (
                  <option key={s.id} value={s.id}>{s.sigla} – {s.nome}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Município</label>
              <select
                value={formData.municipality_id}
                onChange={e => setFormData({ ...formData, municipality_id: e.target.value })}
                disabled={!formData.state_id}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors h-11 disabled:opacity-50"
              >
                <option value="">{formData.state_id ? 'Selecione...' : 'Selecione o estado primeiro...'}</option>
                {cities.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg font-bold text-text-muted hover:bg-bg-deep transition-colors cursor-pointer text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.cnpj || !formData.razao_social}
              className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 cursor-pointer text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Cadastrar
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
