import React, { useState, useEffect } from 'react';
import Modal from '../../components/modals/Modal';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { UserCheck, Users, HelpCircle, AlertCircle } from 'lucide-react';

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ORIGENS = [
  { value: 'LIGACAO', label: 'Ligação Telefônica' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'VISITA', label: 'Visita Presencial' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'REDES_SOCIAIS', label: 'Redes Sociais' },
  { value: 'POS_VISITA', label: 'Pós-visita' },
  { value: 'INDICACAO', label: 'Indicação' },
  { value: 'SITE', label: 'Site / Formulário Web' },
  { value: 'OUTROS', label: 'Outros' },
];

export const LeadFormModal: React.FC<LeadFormModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { activeCompanyId } = useAuth();

  const [salesTeams, setSalesTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [nomeContato, setNomeContato] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cargoContato, setCargoContato] = useState('');
  const [origem, setOrigem] = useState('LIGACAO');
  const [canal, setCanal] = useState('');
  const [salesTeamId, setSalesTeamId] = useState('');
  const [tipoDistribuicao, setTipoDistribuicao] = useState('ROUND_ROBIN');
  const [vendedorEspecificoId, setVendedorEspecificoId] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (isOpen && activeCompanyId) {
      loadSalesTeams();
      resetForm();
    }
  }, [isOpen, activeCompanyId]);

  useEffect(() => {
    if (salesTeamId) {
      const selected = salesTeams.find(t => t.id === salesTeamId);
      if (selected && selected.members) {
        setTeamMembers(selected.members.filter((m: any) => m.cargo === 'VENDEDOR'));
      } else {
        setTeamMembers([]);
      }
    } else {
      setTeamMembers([]);
    }
  }, [salesTeamId, salesTeams]);

  const loadSalesTeams = async () => {
    try {
      const { data } = await api.get(`/companies/${activeCompanyId}/sales-teams`);
      const teams = data || [];
      setSalesTeams(teams);
      if (teams.length > 0) {
        setSalesTeamId(teams[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar equipes de vendas:', err);
    }
  };

  const resetForm = () => {
    setNomeContato('');
    setRazaoSocial('');
    setCpfCnpj('');
    setEmail('');
    setTelefone('');
    setCargoContato('');
    setOrigem('LIGACAO');
    setCanal('');
    setTipoDistribuicao('ROUND_ROBIN');
    setVendedorEspecificoId('');
    setObservacoes('');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeContato.trim()) {
      setErrorMessage('O Nome do Contato é obrigatório.');
      return;
    }
    if (!salesTeamId) {
      setErrorMessage('Selecione uma Equipe de Vendas para o Lead.');
      return;
    }
    if (tipoDistribuicao === 'DIRECIONADO_MANUAL' && !vendedorEspecificoId) {
      setErrorMessage('Selecione o consultor específico para o direcionamento.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const payload = {
        nome_contato: nomeContato.trim(),
        razao_social: razaoSocial.trim() || null,
        cpf_cnpj: cpfCnpj.trim() || null,
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        cargo_contato: cargoContato.trim() || null,
        origem,
        canal: canal.trim() || null,
        sales_team_id: salesTeamId,
        tipo_distribuicao: tipoDistribuicao,
        vendedor_especifico_id: tipoDistribuicao === 'DIRECIONADO_MANUAL' ? vendedorEspecificoId : null,
        observacoes: observacoes.trim() || null
      };

      await api.post('/leads', payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao cadastrar lead:', err);
      const detail = err.response?.data?.detail || 'Ocorreu um erro ao cadastrar o lead.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Novo Lead Comercial"
      description="Cadastre um potencial cliente para distribuição e atendimento comercial."
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Informações Básicas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Nome do Contato <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Carlos Silva"
              value={nomeContato}
              onChange={(e) => setNomeContato(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Razão Social / Empresa
            </label>
            <input
              type="text"
              placeholder="Ex: Construtora Alfa Ltda"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              CNPJ ou CPF (opcional no cadastro)
            </label>
            <input
              type="text"
              placeholder="00.000.000/0000-00"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Cargo do Contato
            </label>
            <input
              type="text"
              placeholder="Ex: Diretor de Obras / Comprador"
              value={cargoContato}
              onChange={(e) => setCargoContato(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Telefone / WhatsApp
            </label>
            <input
              type="text"
              placeholder="(00) 00000-0000"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              E-mail
            </label>
            <input
              type="email"
              placeholder="contato@empresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            />
          </div>
        </div>

        {/* Origem e Equipe */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border-subtle">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Origem do Lead <span className="text-rose-500">*</span>
            </label>
            <select
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            >
              {ORIGENS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Canal / Detalhe
            </label>
            <input
              type="text"
              placeholder="Ex: Campanha Instagram, Indicação Sr. João"
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Equipe Comercial <span className="text-rose-500">*</span>
            </label>
            <select
              value={salesTeamId}
              onChange={(e) => setSalesTeamId(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            >
              {salesTeams.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Modo de Distribuição */}
        <div className="p-3 bg-bg-deep rounded-xl border border-border-subtle space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-text-muted">
            Distribuição do Lead
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
              tipoDistribuicao === 'ROUND_ROBIN'
                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-bold'
                : 'border-border-subtle hover:bg-bg-surface text-text-secondary'
            }`}>
              <input
                type="radio"
                name="dist"
                value="ROUND_ROBIN"
                checked={tipoDistribuicao === 'ROUND_ROBIN'}
                onChange={() => setTipoDistribuicao('ROUND_ROBIN')}
                className="sr-only"
              />
              <Users className="w-4 h-4 shrink-0" />
              <span>Fila Automática</span>
            </label>

            <label className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
              tipoDistribuicao === 'DIRECIONADO_MANUAL'
                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-bold'
                : 'border-border-subtle hover:bg-bg-surface text-text-secondary'
            }`}>
              <input
                type="radio"
                name="dist"
                value="DIRECIONADO_MANUAL"
                checked={tipoDistribuicao === 'DIRECIONADO_MANUAL'}
                onChange={() => setTipoDistribuicao('DIRECIONADO_MANUAL')}
                className="sr-only"
              />
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>Consultor Solicitado</span>
            </label>

            <label className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
              tipoDistribuicao === 'DIRETA_VENDEDOR'
                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-bold'
                : 'border-border-subtle hover:bg-bg-surface text-text-secondary'
            }`}>
              <input
                type="radio"
                name="dist"
                value="DIRETA_VENDEDOR"
                checked={tipoDistribuicao === 'DIRETA_VENDEDOR'}
                onChange={() => setTipoDistribuicao('DIRETA_VENDEDOR')}
                className="sr-only"
              />
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>Meu Lead Direto</span>
            </label>
          </div>

          {tipoDistribuicao === 'DIRECIONADO_MANUAL' && (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Selecione o Consultor Solicitado <span className="text-rose-500">*</span>
              </label>
              <select
                value={vendedorEspecificoId}
                onChange={(e) => setVendedorEspecificoId(e.target.value)}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
              >
                <option value="">Selecione um vendedor da equipe...</option>
                {teamMembers.map((m: any) => (
                  <option key={m.user_id} value={m.user_id}>{m.user_name || m.user?.name || m.user_email || m.user_id}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Observações */}
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Observações / Contexto Inicial
          </label>
          <textarea
            rows={2}
            placeholder="Informações relevantes sobre a necessidade do cliente, equipamentos pretendidos ou histórico inicial..."
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Cadastrando...' : 'Cadastrar Lead'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
