import React, { useState, useEffect } from 'react';
import Modal from '../../components/modals/Modal';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LeadConversionModalProps {
  lead: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (salesBudgetId: string, numeroOrcamento: string) => void;
}

export const LeadConversionModal: React.FC<LeadConversionModalProps> = ({
  lead,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [titulo, setTitulo] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && lead) {
      const defaultRazao = lead.razao_social || lead.nome_contato || '';
      setRazaoSocial(defaultRazao);
      setNomeFantasia(lead.nome_contato || '');
      setCnpj(lead.cpf_cnpj || '');
      setEmail(lead.email || '');
      setTelefone(lead.telefone || '');
      setTitulo(`Oportunidade - ${defaultRazao}`);
      setErrorMessage(null);
    }
  }, [isOpen, lead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cnpj.trim()) {
      setErrorMessage('O CNPJ ou CPF é obrigatório para converter o Lead em Oportunidade.');
      return;
    }
    if (!razaoSocial.trim()) {
      setErrorMessage('A Razão Social / Nome do Cliente é obrigatória.');
      return;
    }
    if (!titulo.trim()) {
      setErrorMessage('O Título da Oportunidade é obrigatório.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const payload = {
        titulo_oportunidade: titulo.trim(),
        cnpj: cnpj.trim(),
        razao_social: razaoSocial.trim(),
        nome_fantasia: nomeFantasia.trim() || null,
        email: email.trim() || null,
        telefone: telefone.trim() || null
      };

      const { data } = await api.post(`/leads/${lead.id}/convert`, payload);
      onSuccess(data.sales_budget_id, data.numero_orcamento);
      onClose();
    } catch (err: any) {
      console.error('Erro ao converter lead em oportunidade:', err);
      const detail = err.response?.data?.detail || 'Ocorreu um erro ao converter o lead.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Converter Lead em Oportunidade Comercial"
      description="Gere uma oportunidade oficial no Cerberus a partir deste lead qualificado."
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-xl flex items-start gap-3 text-brand-primary text-xs">
          <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm mb-0.5">Conversão Direta e Rastreável</span>
            <p className="text-text-secondary">
              O sistema criará o cadastro do Cliente (se ainda não existir) e abrirá uma Oportunidade oficial de venda vinculada à equipe do Lead.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Título da Oportunidade <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary font-medium"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              CNPJ ou CPF do Cliente <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Razão Social / Nome <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Nome Fantasia / Contato
            </label>
            <input
              type="text"
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Telefone
            </label>
            <input
              type="text"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Convertendo...' : 'Criar Oportunidade'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
