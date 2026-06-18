import { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Award, CheckSquare, 
  ListTodo, History, Users, AlertCircle, 
  Layers, Package, ShieldAlert, Wrench, Loader2
} from 'lucide-react';
import { api } from '../../../services/api';
import { motion } from 'framer-motion';

interface DashboardData {
  resumo: {
    numero_edital: string;
    cliente?: string | null;
    status: string;
    data_publicacao?: string | null;
    data_licitacao?: string | null;
    po_responsavel?: string | null;
    qtd_analistas: number;
    qtd_lotes: number;
    qtd_itens: number;
    qtd_kits: number;
    qtd_orcamentos: number;
  };
  financeiro: {
    total_custo: number;
    total_venda: number;
    lucro_estimado: number;
    margem_geral: number;
  };
  checklist: {
    total: number;
    pendentes: number;
    em_andamento: number;
    concluidos: number;
    nao_aplicaveis: number;
    percentual: number;
  };
  tarefas: {
    total: number;
    pendentes: number;
    em_andamento: number;
    pausadas: number;
    concluidas: number;
    canceladas: number;
    percentual: number;
  };
  distribuicao_analistas: Array<{
    usuario_id: string;
    nome?: string | null;
    prazo_entrega: string;
    tarefas_pendentes: number;
    tarefas_em_andamento: number;
    tarefas_pausadas: number;
    tarefas_concluidas: number;
    tarefas_atrasadas: number;
    checklist_atribuidos: number;
    status_indicador: string;
  }>;
  ultimos_andamentos: Array<{
    data: string;
    usuario?: string | null;
    descricao: string;
  }>;
  resumo_lotes: {
    qtd_lotes: number;
    qtd_itens: number;
    qtd_kits: number;
    qtd_produtos: number;
    qtd_servicos: number;
  };
  alertas: Array<{
    tipo: string;
    mensagem: string;
    nivel: string;
  }>;
}

export function LicitacaoDashboard({ licitacaoId }: { licitacaoId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const res = await api.get(`/licitacoes/${licitacaoId}/dashboard-summary`);
        setData(res.data);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.detail || 'Erro ao carregar o dashboard.');
      } finally {
        setLoading(false);
      }
    }
    if (licitacaoId) {
      loadDashboard();
    }
  }, [licitacaoId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-text-muted space-y-4 animate-pulse">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        <span>Carregando painel consolidado da licitação...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center text-rose-600 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center gap-2">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
        <span>{error || 'Erro ao carregar os dados do dashboard.'}</span>
      </div>
    );
  }

  const { resumo, financeiro, checklist, tarefas, distribuicao_analistas, ultimos_andamentos, resumo_lotes, alertas } = data;

  // Circular Progress calculations
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (checklist.percentual / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* 1. Alertas Panel */}
      {alertas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alertas.map((alerta, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${
                alerta.nivel === 'Vermelho'
                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400'
              }`}
            >
              <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${
                alerta.nivel === 'Vermelho' ? 'text-rose-600' : 'text-amber-500'
              }`} />
              <div className="space-y-1">
                <span className="font-bold text-xs uppercase block tracking-wider">
                  Alerta {alerta.nivel}
                </span>
                <p className="text-sm font-medium">{alerta.mensagem}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 2. Resumo Superior */}
      <div className="bg-bg-deep/15 border border-border-subtle/50 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Órgão / Cliente</span>
          <span className="text-sm font-bold text-text-primary block truncate" title={resumo.cliente || 'Não associado'}>
            {resumo.cliente || 'Não associado'}
          </span>
        </div>
        <div className="space-y-1 border-l-0 md:border-l border-border-subtle/30 md:pl-6">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">P.O. Responsável</span>
          <span className="text-sm font-bold text-text-primary block">{resumo.po_responsavel || 'Não definido'}</span>
        </div>
        <div className="space-y-1 border-l-0 lg:border-l border-border-subtle/30 lg:pl-6">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Modalidade / Status</span>
          <span className="text-sm font-bold text-text-primary block">
            {resumo.numero_edital} — <span className="text-xs font-semibold text-brand-primary">{resumo.status}</span>
          </span>
        </div>
        <div className="space-y-1 border-l-0 lg:border-l border-border-subtle/30 lg:pl-6">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Data do Certame</span>
          <span className="text-sm font-bold text-text-primary block">
            {resumo.data_licitacao ? new Date(resumo.data_licitacao).toLocaleDateString('pt-BR') : '—'}
          </span>
        </div>
      </div>

      {/* 3. Financeiro KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Venda */}
        <div className="p-5 bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-brand-primary/10 rounded-lg text-brand-primary shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block">Total de Venda</span>
            <span className="text-lg font-bold text-text-primary mt-1 block tabular-nums">
              {Number(financeiro.total_venda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        {/* Custo */}
        <div className="p-5 bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-slate-500/10 rounded-lg text-slate-500 shrink-0">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block">Total de Custo</span>
            <span className="text-lg font-bold text-text-primary mt-1 block tabular-nums">
              {Number(financeiro.total_custo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        {/* Lucro */}
        <div className="p-5 bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block">Lucro Estimado</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 block tabular-nums">
              {Number(financeiro.lucro_estimado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        {/* Margem */}
        <div className="p-5 bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block">Margem Geral</span>
            <span className="text-lg font-bold text-brand-primary mt-1 block tabular-nums">
              {Number(financeiro.margem_geral).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* 4. Checklist e Tarefas (Metodologia de Carga) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Checklist Progress Card */}
        <div className="bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide flex items-center gap-2 border-b border-border-subtle/40 pb-2">
            <CheckSquare className="w-4 h-4 text-brand-primary" />
            Status do Checklist
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
            <div className="relative w-24 h-24 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={radius} className="text-slate-100 dark:text-slate-800" strokeWidth="6" stroke="currentColor" fill="transparent" />
                <circle
                  cx="40" cy="40" r={radius}
                  className="text-brand-primary"
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-bold text-text-primary">{Number(checklist.percentual).toFixed(0)}%</span>
                <span className="text-[8px] text-text-muted uppercase font-bold">concluído</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 flex-1 w-full text-xs">
              <div className="space-y-1">
                <span className="text-text-muted font-semibold block">Concluídos</span>
                <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {checklist.concluidos}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-text-muted font-semibold block">Em Andamento</span>
                <span className="text-sm font-bold text-blue-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  {checklist.em_andamento}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-text-muted font-semibold block">Pendentes</span>
                <span className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  {checklist.pendentes}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-text-muted font-semibold block">Não Aplicáveis</span>
                <span className="text-sm font-bold text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  {checklist.nao_aplicaveis}
                </span>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-text-muted bg-bg-deep/10 p-3 rounded-lg border border-border-subtle/30 text-center font-medium">
            Excluindo itens Não Aplicáveis, <span className="font-bold text-text-primary">{checklist.concluidos} de {checklist.total - checklist.nao_aplicaveis}</span> itens concluídos.
          </div>
        </div>

        {/* Tarefas Progress Card */}
        <div className="bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide flex items-center gap-2 border-b border-border-subtle/40 pb-2">
            <ListTodo className="w-4 h-4 text-brand-primary" />
            Situação das Tarefas
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-baseline text-xs">
                <span className="font-semibold text-text-muted">Progresso das Atividades</span>
                <span className="font-extrabold text-brand-primary">{Number(tarefas.percentual).toFixed(0)}% ({tarefas.concluidas} de {tarefas.total - tarefas.canceladas} concluídas)</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${(tarefas.concluidas / (tarefas.total || 1)) * 100}%` }} title="Concluídas" />
                <div className="bg-blue-500 h-full" style={{ width: `${(tarefas.em_andamento / (tarefas.total || 1)) * 100}%` }} title="Em Andamento" />
                <div className="bg-amber-500 h-full" style={{ width: `${(tarefas.pausadas / (tarefas.total || 1)) * 100}%` }} title="Pausadas" />
                <div className="bg-slate-400 h-full" style={{ width: `${(tarefas.pendentes / (tarefas.total || 1)) * 100}%` }} title="Pendentes" />
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs pt-1">
              <div className="bg-bg-deep/10 p-2 rounded-lg border border-border-subtle/20">
                <span className="text-text-muted font-medium block text-[9px] uppercase">Pendente</span>
                <span className="text-xs font-bold text-text-primary">{tarefas.pendentes}</span>
              </div>
              <div className="bg-bg-deep/10 p-2 rounded-lg border border-border-subtle/20">
                <span className="text-text-muted font-medium block text-[9px] uppercase">Em And.</span>
                <span className="text-xs font-bold text-blue-500">{tarefas.em_andamento}</span>
              </div>
              <div className="bg-bg-deep/10 p-2 rounded-lg border border-border-subtle/20">
                <span className="text-text-muted font-medium block text-[9px] uppercase">Pausada</span>
                <span className="text-xs font-bold text-amber-500">{tarefas.pausadas}</span>
              </div>
              <div className="bg-bg-deep/10 p-2 rounded-lg border border-border-subtle/20">
                <span className="text-text-muted font-medium block text-[9px] uppercase">Concluída</span>
                <span className="text-xs font-bold text-emerald-600">{tarefas.concluidas}</span>
              </div>
              <div className="bg-bg-deep/10 p-2 rounded-lg border border-border-subtle/20">
                <span className="text-text-muted font-medium block text-[9px] uppercase">Cancelada</span>
                <span className="text-xs font-bold text-slate-400">{tarefas.canceladas}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Distribuição por Analista */}
      <div className="bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide flex items-center gap-2 border-b border-border-subtle/40 pb-2">
          <Users className="w-4 h-4 text-brand-primary" />
          Distribuição por Analista
        </h3>

        {distribuicao_analistas.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-6">Nenhum analista alocado na equipe.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-bg-deep/35 border-b border-border-subtle/60 text-text-muted font-bold">
                  <th className="py-3 px-4">Indicador</th>
                  <th className="py-3 px-4">Analista</th>
                  <th className="py-3 px-4 text-center">Checklists Atribuídos</th>
                  <th className="py-3 px-4 text-center">Pendente</th>
                  <th className="py-3 px-4 text-center">Em Andamento</th>
                  <th className="py-3 px-4 text-center">Pausada</th>
                  <th className="py-3 px-4 text-center">Concluída</th>
                  <th className="py-3 px-4 text-center">Atrasada</th>
                  <th className="py-3 px-4">Previsão Entrega</th>
                </tr>
              </thead>
              <tbody>
                {distribuicao_analistas.map((an, idx) => (
                  <tr key={idx} className="border-b border-border-subtle/30 hover:bg-slate-50/25">
                    <td className="py-3 px-4">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full shadow-sm ${
                        an.status_indicador === 'Vermelho' ? 'bg-rose-500 animate-pulse' :
                        an.status_indicador === 'Amarelo' ? 'bg-amber-400' : 'bg-emerald-500'
                      }`} title={an.status_indicador} />
                    </td>
                    <td className="py-3 px-4 font-semibold text-text-primary">{an.nome || 'Analista'}</td>
                    <td className="py-3 px-4 text-center text-text-muted font-bold">{an.checklist_atribuidos}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">{an.tarefas_pendentes}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">{an.tarefas_em_andamento}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">{an.tarefas_pausadas}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">{an.tarefas_concluidas}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {an.tarefas_atrasadas > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-extrabold">{an.tarefas_atrasadas}</span>
                      ) : (
                        <span className="text-text-muted/50">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-brand-primary">
                      {new Date(an.prazo_entrega).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Lotes Summary & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lotes Card Summary */}
        <div className="lg:col-span-1 bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide flex items-center gap-2 border-b border-border-subtle/40 pb-2">
            <Layers className="w-4 h-4 text-brand-primary" />
            Resumo dos Lotes
          </h3>
          <div className="space-y-3.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-border-subtle/30">
              <span className="font-semibold text-text-muted flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-text-muted" /> Lotes</span>
              <span className="font-extrabold text-text-primary text-sm">{resumo_lotes.qtd_lotes}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border-subtle/30">
              <span className="font-semibold text-text-muted flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-text-muted" /> Itens Totais</span>
              <span className="font-extrabold text-text-primary text-sm">{resumo_lotes.qtd_itens}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border-subtle/30">
              <span className="font-semibold text-text-muted flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-text-muted" /> Kits Montados</span>
              <span className="font-extrabold text-text-primary text-sm">{resumo_lotes.qtd_kits}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border-subtle/30">
              <span className="font-semibold text-text-muted flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-text-muted" /> Produtos em Kits</span>
              <span className="font-extrabold text-brand-primary text-sm">{Number(resumo_lotes.qtd_produtos)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="font-semibold text-text-muted flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5 text-text-muted" /> Serviços em Kits</span>
              <span className="font-extrabold text-brand-primary text-sm">{Number(resumo_lotes.qtd_servicos)}</span>
            </div>
          </div>
        </div>

        {/* Timeline (Last 10 history logs) */}
        <div className="lg:col-span-2 bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide flex items-center gap-2 border-b border-border-subtle/40 pb-2">
            <History className="w-4 h-4 text-brand-primary" />
            Últimos Andamentos
          </h3>

          {ultimos_andamentos.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-6">Nenhum andamento registrado ainda.</p>
          ) : (
            <div className="relative pl-5 border-l border-border-subtle space-y-4 max-h-[220px] overflow-y-auto pr-2">
              {ultimos_andamentos.map((h, idx) => (
                <div key={idx} className="relative">
                  <span className="absolute -left-[24.5px] top-1 w-1.5 h-1.5 rounded-full bg-brand-primary border border-bg-surface" />
                  <div className="text-[10px] text-text-muted">
                    {new Date(h.data).toLocaleDateString('pt-BR')} {new Date(h.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — <span className="font-bold text-text-primary">{h.usuario || 'Sistema'}</span>
                  </div>
                  <p className="text-xs text-text-primary mt-1 font-medium bg-bg-deep/10 p-2.5 rounded border border-border-subtle/30">
                    {h.descricao}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
