import React, { useState, useMemo, useEffect } from 'react';
import { X, AlertCircle, BarChart2, Zap, Save } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ReferenceLine, Cell
} from 'recharts';

const STORAGE_KEY = 'cerberus_roi_taxa_mensal';

interface RentalROIAnalysisProps {
  custoAquisicaoTotal: number;
  valorLocacaoMensal: number;
  prazoContratoMeses: number;
  roiFinalMeses: number;
  saldoContratoReal: number;
}

const fmt = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const fmtK = (val: number) => {
  if (Math.abs(val) >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
  if (Math.abs(val) >= 1000) return `R$ ${(val / 1000).toFixed(0)}k`;
  return fmt(val);
};

// Custom tooltip style for charts
const ChartTooltipStyle = {
  backgroundColor: '#0d0d0d',
  borderColor: '#3a3a3a',
  borderRadius: '6px',
  border: '1px solid #3a3a3a',
  boxShadow: '0 8px 32px rgba(0,0,0,0.9)',
  opacity: 1,
};

const AxisStyle = { fill: '#6b7280', fontSize: 11, fontFamily: 'monospace' };

export const RentalROIAnalysis: React.FC<RentalROIAnalysisProps> = ({
  custoAquisicaoTotal,
  valorLocacaoMensal,
  prazoContratoMeses,
  roiFinalMeses,
  saldoContratoReal
}) => {
  // Persist taxa across navigation using localStorage
  const [taxaMensalPct, setTaxaMensalPct] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? Number(stored) : 1.0;
    } catch {
      return 1.0;
    }
  });
  const [savedRate, setSavedRate] = useState<number>(taxaMensalPct);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Reflect saved rate on first render
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const n = Number(stored);
        setTaxaMensalPct(n);
        setSavedRate(n);
      }
    } catch {/* ignore */}
  }, []);

  const handleSaveRate = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(taxaMensalPct));
      setSavedRate(taxaMensalPct);
    } catch {/* ignore */}
  };

  const isDirty = taxaMensalPct !== savedRate;

  const taxaMensal = taxaMensalPct / 100;
  const payback = roiFinalMeses;

  const validRoiMeses = isNaN(roiFinalMeses) || roiFinalMeses <= 0 ? 0 : roiFinalMeses;

  // FINANCIAL return: compound interest on invested capital over contract period
  const lucroFinanceiro = custoAquisicaoTotal * Math.pow(1 + taxaMensal, prazoContratoMeses) - custoAquisicaoTotal;

  // CONTRACT result: real net profit (from Consolidação Diretoria)
  const saldoCTT = saldoContratoReal;

  // ROI ratios
  const roiContrato = custoAquisicaoTotal > 0 ? saldoCTT / custoAquisicaoTotal : 0;
  const roiFinanceiro = custoAquisicaoTotal > 0 ? lucroFinanceiro / custoAquisicaoTotal : 0;

  // Decision: contract vs financial application
  const isContratoBetter = saldoCTT >= lucroFinanceiro;
  const melhorDecisao = saldoCTT === lucroFinanceiro ? 'INDIFERENTE' : isContratoBetter ? 'CONTRATO COM O CLIENTE' : 'APLICAÇÃO FINANCEIRA';

  const valorMaior = Math.max(saldoCTT, lucroFinanceiro);
  const valorMenor = Math.min(saldoCTT, lucroFinanceiro);
  const deltaReais = Math.abs(saldoCTT - lucroFinanceiro);
  const deltaPercentual = valorMenor > 0 ? ((valorMaior / valorMenor) - 1) * 100 : 0;

  const chartsData = useMemo(() => {
    const maxMeses = Math.ceil(Math.max(validRoiMeses, prazoContratoMeses, payback * 1.2 || 12));
    const step = Math.max(1, Math.ceil(maxMeses / 60));

    const growthData: { mes: number; aplicacao: number; faturamento: number }[] = [];
    const cashflowData: { mes: number; faturamento: number; investimento: number }[] = [];

    for (let mes = 0; mes <= maxMeses; mes += step) {
      growthData.push({
        mes,
        aplicacao: custoAquisicaoTotal * Math.pow(1 + taxaMensal, mes),
        faturamento: valorLocacaoMensal * mes,
      });
      cashflowData.push({
        mes,
        faturamento: valorLocacaoMensal * mes,
        investimento: custoAquisicaoTotal,
      });
    }

    const barData = [
      { name: 'Contrato', lucro: Math.max(0, saldoCTT) },
      { name: 'Aplicação Fin.', lucro: Math.max(0, lucroFinanceiro) },
    ];

    return { growthData, cashflowData, barData };
  }, [custoAquisicaoTotal, valorLocacaoMensal, prazoContratoMeses, validRoiMeses, taxaMensal, saldoCTT, lucroFinanceiro, payback]);

  const getInsightText = () => {
    if (custoAquisicaoTotal <= 0) return 'Preencha os dados para gerar a decisão inteligente.';
    if (isContratoBetter) {
      return `O contrato gera ${deltaPercentual.toFixed(1)}% a mais de retorno, equivalente a +${fmt(deltaReais)} em relação à aplicação financeira (${taxaMensalPct.toFixed(2)}% a.m.). Vale mais operar o contrato com o cliente.`;
    }
    return `A aplicação financeira gera ${deltaPercentual.toFixed(1)}% a mais de retorno, equivalente a +${fmt(deltaReais)} em relação ao resultado do contrato. Revise a precificação ou os custos operacionais.`;
  };

  const hasInvalidData = custoAquisicaoTotal <= 0 || valorLocacaoMensal <= 0 || prazoContratoMeses <= 0;

  if (hasInvalidData) {
    return (
      <div className="mt-8 border border-dashed border-border-subtle bg-surface/30 rounded-xl p-8 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-8 h-8 text-text-muted mb-3" />
        <h3 className="font-semibold text-text-primary text-sm uppercase tracking-widest">Comparativo Indisponível</h3>
        <p className="text-sm text-text-muted mt-2 max-w-md">Preencha investimento, locação mensal e prazo do contrato para habilitar o motor de decisão.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-10 mb-6 bg-surface border-y md:border border-border-subtle md:rounded-xl overflow-hidden shadow-sm">

        {/* Header Ribbon */}
        <div className="bg-bg-deep px-5 py-3 border-b border-border-subtle flex items-center justify-between">
          <h2 className="font-black text-text-primary text-[11px] uppercase tracking-[0.2em] flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-brand-primary" fill="currentColor" />
            Análise de Rentabilidade de Capital
          </h2>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-primary hover:text-brand-primary-hover transition-colors px-2 py-1 bg-brand-primary/10 hover:bg-brand-primary/20 rounded-sm"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Análise Avançada
          </button>
        </div>

        {/* Decision Card */}
        <div className="p-6 md:p-8 bg-surface">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-3">Melhor Decisão Financeira</p>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <h1 className={`text-4xl md:text-5xl font-black tracking-tighter uppercase ${isContratoBetter ? 'text-teal-400' : 'text-amber-400'}`}>
              {melhorDecisao}
            </h1>
            <div className="flex flex-col md:items-end">
              <span className="font-bold text-xl md:text-2xl tracking-tighter shrink-0 text-brand-primary">
                +{deltaPercentual.toFixed(1)}% mais rentável
              </span>
              <span className="text-sm font-semibold text-text-muted">(+{fmt(deltaReais)} vs alternativa)</span>
            </div>
          </div>
          {/* Subtexto */}
          <p className="mt-4 text-sm text-text-muted leading-relaxed max-w-2xl">
            {isContratoBetter
              ? `Este contrato gera um resultado líquido de ${fmt(saldoCTT)}, superior ao retorno financeiro de ${fmt(lucroFinanceiro)} (taxa ${taxaMensalPct.toFixed(2)}% a.m.).`
              : `O retorno financeiro de ${fmt(lucroFinanceiro)} (taxa ${taxaMensalPct.toFixed(2)}% a.m.) supera o resultado do contrato de ${fmt(saldoCTT)}.`
            }
          </p>
        </div>

        {/* 3 KPI Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-y border-border-subtle bg-bg-deep divide-y md:divide-y-0 md:divide-x divide-border-subtle">
          <div className="p-5 flex flex-col justify-center">
            <span className="text-[9px] font-bold text-text-muted tracking-widest uppercase opacity-70 mb-1">Resultado Líquido do CTT</span>
            <span className="text-2xl font-black text-text-primary">{fmt(saldoContratoReal)}</span>
          </div>
          <div className="p-5 flex flex-col justify-center">
            <span className="text-[9px] font-bold text-text-muted tracking-widest uppercase opacity-70 mb-1">Receita Mensal Fixada</span>
            <span className="text-2xl font-black text-teal-500">{fmt(valorLocacaoMensal)}</span>
          </div>
          <div className="p-5 flex flex-col justify-center">
            <span className="text-[9px] font-bold text-text-muted tracking-widest uppercase opacity-70 mb-1">Tempo Recuperação (Payback)</span>
            <span className="text-2xl font-black text-brand-secondary">{payback.toFixed(1)} <span className="text-xs uppercase tracking-widest ml-0.5 opacity-60">Meses</span></span>
          </div>
        </div>

        {/* Comparative Table: Contract vs Financial Application */}
        <div className="p-0 overflow-x-auto bg-surface">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-bg-deep border-b border-border-subtle">
              <tr className="text-[10px] font-bold text-text-muted tracking-[0.1em] uppercase">
                <th className="px-5 py-3">Cenário</th>
                <th className="px-5 py-3 text-right">Prazo</th>
                <th className="px-5 py-3 text-right">Investimento</th>
                <th className="px-5 py-3 text-right">Resultado / Lucro</th>
                <th className="px-5 py-3 text-right">ROI (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {/* Contract row */}
              <tr className={`hover:bg-bg-deep/50 transition-colors ${isContratoBetter ? 'bg-teal-500/5' : ''}`}>
                <td className="px-5 py-3 font-semibold text-text-primary">
                  <span className="flex items-center gap-2">
                    {isContratoBetter && <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />}
                    Contrato com o Cliente
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-text-muted">{prazoContratoMeses}m</td>
                <td className="px-5 py-3 text-right text-text-muted">{fmt(custoAquisicaoTotal)}</td>
                <td className={`px-5 py-3 text-right font-bold ${isContratoBetter ? 'text-teal-400' : 'text-text-primary'}`}>{fmt(saldoCTT)}</td>
                <td className={`px-5 py-3 text-right font-bold ${isContratoBetter ? 'text-teal-400' : 'text-text-muted'}`}>{(roiContrato * 100).toFixed(1)}%</td>
              </tr>
              {/* Financial application row */}
              <tr className={`hover:bg-bg-deep/50 transition-colors ${!isContratoBetter ? 'bg-amber-400/5' : ''}`}>
                <td className="px-5 py-3 font-semibold text-text-primary">
                  <span className="flex items-center gap-2">
                    {!isContratoBetter && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                    Aplicação Financeira ({taxaMensalPct.toFixed(2)}% a.m.)
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-text-muted">{prazoContratoMeses}m</td>
                <td className="px-5 py-3 text-right text-text-muted">{fmt(custoAquisicaoTotal)}</td>
                <td className={`px-5 py-3 text-right font-bold ${!isContratoBetter ? 'text-amber-400' : 'text-text-primary'}`}>{fmt(lucroFinanceiro)}</td>
                <td className={`px-5 py-3 text-right font-bold ${!isContratoBetter ? 'text-amber-400' : 'text-text-muted'}`}>{(roiFinanceiro * 100).toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Advanced Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-6xl h-full max-h-[90vh] bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e] bg-[#0a0a0a]">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Análise Avançada de Rentabilidade</h3>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mt-1">Cenário Multivariável de Capitalização</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 bg-[#111] hover:bg-[#1a1a1a] text-gray-400 hover:text-white rounded-lg transition-colors border border-[#1e1e1e]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto flex flex-col md:flex-row min-h-0">

              {/* Left Sidebar */}
              <div className="w-full md:w-72 bg-[#090909] border-b md:border-b-0 md:border-r border-[#1e1e1e] p-6 flex flex-col gap-6 shrink-0">

                {/* Rate Control */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Taxa de Juros (a.m)</label>
                    <span className="text-lg font-black text-brand-primary">{taxaMensalPct.toFixed(2)}%</span>
                  </div>

                  <input
                    type="range"
                    min="0.1" max="5.0" step="0.1"
                    value={taxaMensalPct}
                    onChange={(e) => setTaxaMensalPct(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#1e1e1e] rounded-lg appearance-none cursor-pointer accent-brand-primary"
                  />

                  <div className="relative">
                    <input
                      type="number"
                      min="0.1" max="5.0" step="0.1"
                      value={taxaMensalPct}
                      onChange={(e) => setTaxaMensalPct(Number(e.target.value))}
                      className="w-full bg-[#111] border border-[#1e1e1e] focus:border-brand-primary focus:ring-1 focus:ring-brand-primary rounded-lg px-4 py-2.5 text-white font-bold text-center outline-none transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
                  </div>

                  {/* Save Rate Button */}
                  <button
                    type="button"
                    onClick={handleSaveRate}
                    disabled={!isDirty}
                    className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border ${
                      isDirty
                        ? 'bg-brand-primary/10 border-brand-primary text-brand-primary hover:bg-brand-primary/20'
                        : 'bg-transparent border-[#1e1e1e] text-gray-600 cursor-default'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isDirty ? 'Salvar Taxa' : `Taxa Salva (${savedRate.toFixed(2)}%)`}
                  </button>
                </div>

                {/* Summary KPIs */}
                <div className="border border-[#1e1e1e] rounded-lg divide-y divide-[#1e1e1e]">
                  {[
                    { label: 'Investimento', val: fmt(custoAquisicaoTotal), color: 'text-red-400' },
                    { label: 'Resultado Contrato', val: fmt(saldoCTT), color: 'text-teal-400' },
                    { label: 'Lucro Aplicação', val: fmt(lucroFinanceiro), color: 'text-amber-400' },
                    { label: 'Payback', val: `${payback.toFixed(1)} meses`, color: 'text-brand-primary' },
                  ].map(item => (
                    <div key={item.label} className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{item.label}</span>
                      <span className={`text-xs font-bold font-mono ${item.color}`}>{item.val}</span>
                    </div>
                  ))}
                </div>

                {/* Insight */}
                <div className="bg-brand-primary/[0.07] border border-brand-primary/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-brand-primary" fill="currentColor" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">Insight da IA</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{getInsightText()}</p>
                </div>
              </div>

              {/* Charts Area */}
              <div className="flex-1 p-5 flex flex-col gap-5 overflow-y-auto min-h-0 bg-[#0d0d0d]">

                {/* Chart 1: Growth Curve */}
                <div className="border border-[#1e1e1e] bg-[#0a0a0a] rounded-xl p-5 shrink-0" style={{ height: 300 }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">
                    Curva de Capitalização — Valor Futuro vs. Faturamento
                  </p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartsData.growthData} margin={{ top: 36, right: 20, left: 10, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                      <XAxis
                        dataKey="mes"
                        tick={AxisStyle}
                        tickLine={false}
                        axisLine={{ stroke: '#2a2a2a' }}
                        label={{ value: 'Meses', position: 'insideBottom', offset: -4, fill: '#4b5563', fontSize: 10 }}
                      />
                      <YAxis
                        tick={AxisStyle}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={fmtK}
                        width={70}
                      />
                      <RechartsTooltip
                        contentStyle={ChartTooltipStyle}
                        wrapperStyle={{ backgroundColor: '#0d0d0d', zIndex: 9999, opacity: 1 }}
                        labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                        formatter={(value: any, name: any) => [fmt(Number(value)), name]}
                        labelFormatter={(label) => `Mês ${label}`}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Line
                        type="monotone"
                        dataKey="aplicacao"
                        stroke="#0ea5e9"
                        strokeWidth={2.5}
                        dot={false}
                        name="Capitalização (Juros)"
                        activeDot={{ r: 5, fill: '#0ea5e9' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="faturamento"
                        stroke="#14b8a6"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="6 3"
                        name="Fat. Acumulado"
                        activeDot={{ r: 5, fill: '#14b8a6' }}
                      />
                      {/* Horizontal: resultado real do contrato */}
                      {saldoCTT > 0 && (
                        <ReferenceLine
                          y={saldoCTT}
                          stroke="#eab308"
                          strokeDasharray="5 3"
                          strokeWidth={1.5}
                          label={{ position: 'insideTopRight', value: `Saldo CTT ${fmtK(saldoCTT)}`, fill: '#eab308', fontSize: 10 }}
                        />
                      )}
                      {validRoiMeses > 0 && (
                        <ReferenceLine
                          x={Math.floor(validRoiMeses)}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{ position: 'insideTopRight', value: `ROI ${validRoiMeses.toFixed(0)}m`, fill: '#f59e0b', fontSize: 10 }}
                        />
                      )}
                      {prazoContratoMeses > 0 && (
                        <ReferenceLine 
                          x={prazoContratoMeses} 
                          stroke="#0ea5e9" 
                          strokeDasharray="3 3"
                          label={{ position: 'insideTopLeft', value: `Ctt ${prazoContratoMeses}m`, fill: '#0ea5e9', fontSize: 10 }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Charts 2 + 3 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 shrink-0" style={{ height: 260 }}>

                  {/* Bar: Lucro Comparativo */}
                  <div className="border border-[#1e1e1e] bg-[#0a0a0a] rounded-xl p-5 flex flex-col">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Lucro Financeiro Final</p>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartsData.barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={44}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                          <XAxis dataKey="name" tick={AxisStyle} tickLine={false} axisLine={{ stroke: '#2a2a2a' }} />
                          <YAxis tick={AxisStyle} tickLine={false} axisLine={false} tickFormatter={fmtK} width={65} />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: '#0d0d0d', border: '1px solid #3a3a3a', borderRadius: '6px', padding: '8px 12px' }}
                            wrapperStyle={{ backgroundColor: '#0d0d0d', borderRadius: '6px', boxShadow: '0 8px 32px rgba(0,0,0,0.95)', zIndex: 9999, opacity: 1 }}
                            itemStyle={{ color: '#e5e7eb', fontWeight: 700, fontSize: 13 }}
                            labelStyle={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}
                            formatter={(value: any) => [fmt(Number(value)), 'Lucro']}
                            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                          />
                          <Bar dataKey="lucro" radius={[3, 3, 0, 0]}>
                            {chartsData.barData.map((_: unknown, index: number) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? '#eab308' : '#22d3ee'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Line: Cashflow */}
                  <div className="border border-[#1e1e1e] bg-[#0a0a0a] rounded-xl p-5 flex flex-col">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Fluxo de Caixa — Payback Visual</p>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartsData.cashflowData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                          <XAxis
                            dataKey="mes"
                            tick={AxisStyle}
                            tickLine={false}
                            axisLine={{ stroke: '#2a2a2a' }}
                          />
                          <YAxis tick={AxisStyle} tickLine={false} axisLine={false} tickFormatter={fmtK} width={65} />
                          <RechartsTooltip
                            contentStyle={ChartTooltipStyle}
                            labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                            formatter={(value: any, name: any) => [fmt(Number(value)), typeof name === 'string' ? name : String(name)]}
                            labelFormatter={(label) => `Mês ${label}`}
                          />
                          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                          <Line type="monotone" dataKey="faturamento" stroke="#22d3ee" strokeWidth={2} dot={false} name="Fat. Acumulado" activeDot={{ r: 4 }} />
                          <Line type="stepAfter" dataKey="investimento" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 4" dot={false} name="Investimento (Fixo)" />
                          {payback > 0 && (
                            <ReferenceLine
                              x={Math.floor(payback)}
                              stroke="#f59e0b"
                              strokeDasharray="4 4"
                              strokeWidth={1.5}
                              label={{ value: 'Payback', position: 'top', fill: '#f59e0b', fontSize: 10 }}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
