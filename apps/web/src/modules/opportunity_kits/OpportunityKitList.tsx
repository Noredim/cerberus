import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface KitSummary {
  valor_mensal_kit: number;
  lucro_mensal_kit: number;
  margem_kit: number;
}

interface Kit {
  id: string;
  nome_kit: string;
  tipo_contrato: string;
  quantidade_kits: number;
  summary?: KitSummary;
}

export const OpportunityKitList = () => {
  const navigate = useNavigate();
  const { activeCompanyId } = useAuth();
  const [kits, setKits] = useState<Kit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="space-y-6">

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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-bg-deep/50 text-text-muted font-medium border-b border-border-subtle">
                <tr>
                  <th className="px-6 py-4">Nome do Kit</th>
                  <th className="px-6 py-4">Tipo Modalidade</th>
                  <th className="px-6 py-4 text-center">Qtd.</th>
                  <th className="px-6 py-4 text-right">Valor Mensal</th>
                  <th className="px-6 py-4 text-right">Lucro Mensal</th>
                  <th className="px-6 py-4 text-right">Margem</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {kits.map((kit) => (
                  <tr key={kit.id} className="hover:bg-bg-deep/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-text-primary">{kit.nome_kit}</td>
                    <td className="px-6 py-4 text-text-secondary">{kit.tipo_contrato}</td>
                    <td className="px-6 py-4 text-center text-text-secondary">{kit.quantidade_kits}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kit.summary?.valor_mensal_kit || 0)}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-brand-success font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kit.summary?.lucro_mensal_kit || 0)}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-brand-secondary font-medium">
                      {(kit.summary?.margem_kit !== undefined && kit.summary?.margem_kit !== null)
                        ? Number(kit.summary.margem_kit).toFixed(2)
                        : '0.00'}%
                    </td>
                    <td className="px-6 py-4 font-medium">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/cadastros/kits/${kit.id}`)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
