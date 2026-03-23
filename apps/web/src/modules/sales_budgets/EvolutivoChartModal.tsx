import { X } from 'lucide-react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Legend, ReferenceArea } from 'recharts';

interface EvolutivoChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartData: any[];
  prazoContrato: number;
  paybackMes: number | null;
  roiFinal: number;
  totals?: {
    investimento: number;
    faturamento: number;
    impostos: number;
    manutencao: number;
    comissao: number;
    lucro: number;
    margem: number;
  }
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    // Find SaldoAcumulado which is passed directly on payload[0].payload
    const rowData = payload[0].payload;
    const saldo = rowData.SaldoAcumulado;

    return (
       <div className="bg-bg-surface p-4 border border-border-subtle rounded-xl shadow-2xl text-sm min-w-[260px]">
         <p className="font-bold text-text-primary mb-3 border-b border-border-subtle pb-2 text-base">{label}</p>
         
         {payload.map((p: any) => {
           return (
             <div key={p.dataKey} className="flex justify-between gap-6 mb-2 text-xs items-center">
               <span style={{ color: p.color }} className="font-semibold uppercase tracking-wider">{p.name || p.dataKey}</span>
               <span className="font-bold text-text-primary">{p.value !== undefined ? fmt(p.value) : '—'}</span>
             </div>
           );
         })}

         <div className="mt-4 pt-3 border-t border-border-subtle flex justify-between gap-6 items-center">
            <span className="text-xs font-bold text-emerald-500 uppercase">Saldo Acum. do Investimento</span>
            <span className="text-sm font-black text-emerald-500">{fmt(saldo)}</span>
         </div>
       </div>
    );
  }
  return null;
};

export function EvolutivoChartModal({ isOpen, onClose, chartData, prazoContrato, paybackMes, roiFinal, totals }: EvolutivoChartModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-bg-deep border border-border-subtle w-full h-full max-h-[96vh] max-w-[98vw] 2xl:max-w-[1800px] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header Ribbon matches the exact mockup */}
        <div className="flex bg-[#1e293b] p-4 items-center justify-between border-b border-[#0f172a] shrink-0 relative">
          {totals ? (
            <div className="flex flex-wrap items-center gap-6 xl:gap-12 w-full justify-between pr-10">
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Investimento Total</p>
                 <p className="text-lg font-black text-orange-400">{fmt(totals.investimento)}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fat. Total Contrato</p>
                 <p className="text-lg font-black text-sky-400">{fmt(totals.faturamento)}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Impostos Totais</p>
                 <p className="text-lg font-black text-slate-200">{fmt(totals.impostos)}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Manut. + Suporte</p>
                 <p className="text-lg font-black text-amber-400">{fmt(totals.manutencao)}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Comissionamento</p>
                 <p className="text-lg font-black text-orange-400">{fmt(totals.comissao)}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lucro do Contrato</p>
                 <p className="text-lg font-black text-emerald-400">{fmt(totals.lucro)}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">% Margem</p>
                 <p className="text-lg font-black text-emerald-300">{(totals.margem).toFixed(2)}%</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payback</p>
                 <p className="text-lg font-black text-emerald-300">{paybackMes ? `${roiFinal.toFixed(1)} meses` : '-'}</p>
               </div>
            </div>
          ) : (
             <div className="flex items-center gap-4">
               <h2 className="text-xl font-bold text-white">Quadro Evolutivo do Contrato</h2>
             </div>
          )}
          
          <button onClick={onClose} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-bg-surface flex flex-col p-6">
          
          <div className="flex items-start justify-between mb-8">
             <div>
               <h3 className="text-xl font-bold text-text-primary mb-1">Evolução do Faturamento e Retorno do Investimento</h3>
               <p className="text-xs text-text-muted">Colunas empilhadas por mês: gastos operacionais, amortização do investimento e lucro livre — ao longo dos {prazoContrato} meses (prazo máximo dos itens).</p>
             </div>
             
             <div className="flex gap-3">
               {paybackMes && (
                 <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-full border border-emerald-500/20 flex items-center">
                   Payback no mês {paybackMes} ({roiFinal.toFixed(1)}m)
                 </div>
               )}
               {totals && (
                 <div className="px-3 py-1 bg-orange-500/10 text-orange-500 text-xs font-bold rounded-full border border-orange-500/20 flex items-center">
                   Investimento: {fmt(totals.investimento)}
                 </div>
               )}
             </div>
          </div>

          <div className="flex-1 min-h-[500px] w-full relative bg-transparent rounded-xl border border-border-subtle mt-4">
             <div className="absolute inset-0 p-4">
               <ResponsiveContainer width="100%" height="100%">
                 <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.4)" vertical={false} />
                   <XAxis dataKey="mesLabel" stroke="#94a3b8" fontSize={11} tickMargin={12} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                   <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(value) => `${Intl.NumberFormat('pt-BR', { notation: "compact", compactDisplay: "short" }).format(value)}`} axisLine={false} tickLine={false} />
                   
                   <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                   <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="square" />
                   
                   {paybackMes && <ReferenceArea x1={`M${paybackMes}`} x2={`M${paybackMes}`} fill="#e2e8f0" fillOpacity={0.5} />}
                   {paybackMes && <ReferenceLine x={`M${paybackMes}`} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={2} label={{ position: 'top', value: 'Payback', fill: '#22c55e', fontSize: 11, fontWeight: 'bold' }} />}
                   
                   <Bar name="Gastos Operacionais" dataKey="GastosOperacionais" stackId="a" fill="#94a3b8" barSize={32} />
                   <Bar name="Quitar Investimento" dataKey="QuitarInvestimento" stackId="a" fill="#f97316" barSize={32} />
                   <Bar name="Lucro Livre" dataKey="LucroLivre" stackId="a" fill="#22c55e" barSize={32} />
                   
                   <Line type="step" name="Fat." dataKey="Faturamento" stroke="#3b82f6" strokeWidth={2} strokeDasharray="3 3" dot={false} activeDot={false} legendType="none" />
                 </ComposedChart>
               </ResponsiveContainer>
             </div>
          </div>
          
          {/* Data Table */}
          <div className="mt-8 bg-bg-surface rounded-xl border border-border-subtle overflow-hidden shrink-0">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm whitespace-nowrap">
                <thead className="bg-[#1e293b] border-b border-[#0f172a] text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-left">Mês</th>
                    <th className="px-6 py-4 font-semibold text-sky-400">Faturamento</th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Gastos Operacionais</th>
                    <th className="px-6 py-4 font-semibold text-orange-400">Quitar Investimento</th>
                    <th className="px-6 py-4 font-semibold text-emerald-400">Lucro Livre</th>
                    <th className="px-6 py-4 font-semibold text-white">Saldo Acum.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {chartData.map((row, idx) => {
                    const isPayback = paybackMes === (idx + 1);
                    return (
                      <tr key={row.mesLabel} className={`hover:bg-white/5 transition-colors ${isPayback ? 'bg-emerald-500/10' : ''}`}>
                        <td className={`px-6 py-3 font-semibold text-left ${isPayback ? 'text-emerald-500' : 'text-text-primary'}`}>
                          {isPayback && <span className="mr-2">✓</span>}
                          {row.mesLabel}
                        </td>
                        <td className="px-6 py-3 text-sky-500 font-medium">{row.Faturamento > 0 ? fmt(row.Faturamento) : '—'}</td>
                        <td className="px-6 py-3 text-slate-400 font-medium">{row.GastosOperacionais > 0 ? fmt(row.GastosOperacionais) : '—'}</td>
                        <td className="px-6 py-3 text-orange-500 font-medium">{row.QuitarInvestimento > 0 ? fmt(row.QuitarInvestimento) : '—'}</td>
                        <td className="px-6 py-3 text-emerald-500 font-medium">{row.LucroLivre > 0 ? fmt(row.LucroLivre) : '—'}</td>
                        <td className={`px-6 py-3 font-bold ${row.SaldoAcumulado >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                          {row.SaldoAcumulado < 0 ? `-${fmt(Math.abs(row.SaldoAcumulado))}` : fmt(row.SaldoAcumulado)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="bg-[#1e293b] p-4 border-t border-[#0f172a] flex flex-wrap gap-8 justify-center text-xs text-slate-300">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-400 rounded-sm"></div> Impostos + Manut. + Comissão</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded-sm"></div> Amortização do investimento</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Lucro livre (pós payback)</div>
              <div className="flex items-center gap-2"><div className="w-4 h-0 border-t-2 border-dashed border-sky-400"></div> Linha de faturamento bruto</div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
