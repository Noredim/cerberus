import React, { useMemo } from 'react';
import { ReportLogo } from './ReportLogo';

interface RentalAnalyticReportProps {
    kitData: any;
    activeCompany: any;
    policies: any[];
    formatCurrency: (value: number | string | undefined) => string;
    formatPercent: (value: number | string | undefined) => string;
}

export const RentalAnalyticReport: React.FC<RentalAnalyticReportProps> = ({
    kitData,
    activeCompany,
    policies,
    formatCurrency,
    formatPercent
}) => {
    const prazo = kitData.prazo_contrato_meses || 1;
    
    const faturamentoTotal = ((Number(kitData.summary?.valor_mensal_kit) || 0) * prazo) + (Number(kitData.summary?.vlr_instal_calc) || 0);
    const impostoMensal = Number(kitData.summary?.valor_impostos) || 0;
    const impostoInstalacao = Number(kitData.summary?.imposto_instalacao) || 0;
    const impostosTotais = (impostoMensal * prazo);

    const comissaoValor = Number(kitData.summary?.valor_comissao_locacao) || 0;
    const comissaoPerc = Number(kitData.perc_comissao) || 0;

    const custoAquisicao = Number(kitData.summary?.custo_aquisicao_total) || 0;
    
    const block7TotalUnit = (kitData.monthly_costs || []).reduce((acc: number, cost: any) => acc + ((Number(cost.valor_unitario) || 0) * (Number(cost.quantidade) || 1)), 0);
    const custoOperacionalMensal = block7TotalUnit + (Number(kitData.custo_monitoramento_unitario) || 0);
    const custosOperacionaisTotais = custoOperacionalMensal * prazo;
    
    const custosTotais = custoAquisicao + impostosTotais + comissaoValor + custosOperacionaisTotais + impostoInstalacao;
    
    const lucroTotal = faturamentoTotal - custosTotais;
    const margemLucro = faturamentoTotal > 0 ? lucroTotal / faturamentoTotal : 0;

    const fatorAplicado = Number(kitData.fator_margem_locacao);
    const activePolicy = policies
        .filter((p: any) => Number(p.fator_limite) <= fatorAplicado + 0.00001)
        .sort((a: any, b: any) => Number(b.fator_limite) - Number(a.fator_limite))[0];
    const politicaVenda = activePolicy?.nome_politica || 'Padrão';

    const suppliersAggregation = useMemo(() => {
        if (!kitData?.item_summaries || !kitData?.items) return [];
        
        const aggregation: Record<string, number> = {};
        const totalAquisicao = Number(kitData.summary?.custo_aquisicao_total || 0);

        kitData.item_summaries.forEach((item: any) => {
            const originalItem = kitData.items.find((i: any) => i.id === item.id);
            if (!originalItem) return;
            
            let fornecedor = 'Desconhecido';
            if (item.tipo_item === 'SERVICO_PROPRIO') {
                fornecedor = 'Equipe Interna';
            } else {
                const fornecedorObj = originalItem?.product?.fornecedor_ultimo_preco || originalItem?.product?.suppliers?.[0]?.supplier;
                fornecedor = fornecedorObj?.nome_fantasia || fornecedorObj?.razao_social || 'Desconhecido';
            }

            const quantidade = originalItem?.quantidade_no_kit || 1;
            const custoBaseUnit = Number(item.custo_base_unitario_item || 0);
            const custoTotalItem = custoBaseUnit * quantidade;

            if (!aggregation[fornecedor]) aggregation[fornecedor] = 0;
            aggregation[fornecedor] += custoTotalItem;
        });

        return Object.entries(aggregation).map(([nome, valor]) => {
            const perc = totalAquisicao > 0 ? (valor / totalAquisicao) : 0;
            return { nome, valor, perc };
        }).sort((a, b) => b.valor - a.valor);
    }, [kitData]);

    const taxesAggregation = useMemo(() => {
        if (!kitData?.item_summaries || !kitData?.items) return { ipi: 0, frete: 0, difal: 0 };
        
        let ipi = 0;
        let frete = 0;
        let difal = 0;
        
        kitData.item_summaries.forEach((item: any) => {
            const originalItem = kitData.items.find((i: any) => i.id === item.id);
            if (!originalItem) return;
            
            const quantidade = originalItem?.quantidade_no_kit || 1;
            
            ipi += (Number(item.ipi_unit) || 0) * quantidade;
            frete += (Number(item.frete_cif_unit) || 0) * quantidade;
            difal += Number(item.difal_total_item) || 0;
        });
        
        if (difal === 0 && Number(kitData.summary?.total_difal_kit) > 0) {
            difal = Number(kitData.summary?.total_difal_kit);
        }
        
        return { ipi, frete, difal };
    }, [kitData]);

    const operacionaisRows = useMemo(() => {
        if (!kitData) return [];
        const rows = [];
        
        if (Number(kitData.custo_monitoramento_unitario) > 0) {
            const val = Number(kitData.custo_monitoramento_unitario);
            rows.push({ nome: 'Monitoramento', unitario: val, total: val * prazo });
        }
        
        if (kitData.monthly_costs && kitData.monthly_costs.length > 0) {
            kitData.monthly_costs.forEach((cost: any) => {
                const unit = (Number(cost.valor_unitario) || 0) * (Number(cost.quantidade) || 1);
                if (unit > 0) {
                    rows.push({ nome: cost.servico || cost.tipo_custo, unitario: unit, total: unit * prazo });
                }
            });
        }
        return rows;
    }, [kitData, prazo]);

    const taxData = useMemo(() => {
        if (!kitData) return null;
        
        const instalBase = Number(kitData.summary?.vlr_instal_calc) || 0;
        const locBase = Number(kitData.summary?.valor_mensal_locacao_base) || 0;
        const manutBase = Number(kitData.summary?.vlt_manut) || 0;
        const monBase = Number(kitData.summary?.venda_unit_monitoramento) || 0;

        const aliqPIS = Number(kitData.aliq_pis) || 0;
        const aliqCOFINS = Number(kitData.aliq_cofins) || 0;
        const aliqCSLL = Number(kitData.aliq_csll) || 0;
        const aliqIRPJ = Number(kitData.aliq_irpj) || 0;
        const aliqISS = Number(kitData.aliq_iss) || 0;

        const standardTaxes = [
            { nome: 'PIS', perc: aliqPIS },
            { nome: 'COFINS', perc: aliqCOFINS },
            { nome: 'CSLL', perc: aliqCSLL },
            { nome: 'IRPJ', perc: aliqIRPJ },
            { nome: 'ISS', perc: aliqISS },
        ].filter(t => t.perc > 0);

        const locTaxesList = [
            { nome: 'PIS', perc: aliqPIS },
            { nome: 'COFINS', perc: aliqCOFINS },
            { nome: 'CSLL', perc: aliqCSLL },
            { nome: 'IRPJ', perc: aliqIRPJ },
        ].filter(t => t.perc > 0);

        const instalTaxes = standardTaxes;
        const locTaxes = locTaxesList;
        const manutTaxes = standardTaxes;
        const monTaxes = standardTaxes;

        const instalPercSum = instalTaxes.reduce((a, b) => a + b.perc, 0);
        const instalValSum = instalBase * (instalPercSum / 100);

        const locPercSum = locTaxes.reduce((a, b) => a + b.perc, 0);
        const locValSumMensal = locBase * (locPercSum / 100);
        const locValSumTotal = locValSumMensal * prazo;

        const manutPercSum = manutTaxes.reduce((a, b) => a + b.perc, 0);
        const manutValSumMensal = manutBase * (manutPercSum / 100);
        const manutValSumTotal = manutValSumMensal * prazo;

        const monPercSum = monTaxes.reduce((a, b) => a + b.perc, 0);
        const monValSumMensal = monBase * (monPercSum / 100);
        const monValSumTotal = monValSumMensal * prazo;

        const matrixTaxes = [
            { nome: 'PIS', perc: aliqPIS, applyLoc: true },
            { nome: 'COFINS', perc: aliqCOFINS, applyLoc: true },
            { nome: 'CSLL', perc: aliqCSLL, applyLoc: true },
            { nome: 'IRPJ', perc: aliqIRPJ, applyLoc: true },
            { nome: 'ISS', perc: aliqISS, applyLoc: false },
        ].filter(t => t.perc > 0).map(t => {
            const iVal = instalBase * (t.perc / 100);
            const lVal = t.applyLoc ? (locBase * (t.perc / 100)) * prazo : 0;
            const mVal = (manutBase * (t.perc / 100)) * prazo;
            const moVal = (monBase * (t.perc / 100)) * prazo;
            return {
                nome: t.nome,
                perc: t.perc,
                instal: iVal,
                locacao: lVal,
                manutencao: mVal,
                monitoramento: moVal,
                total: iVal + lVal + mVal + moVal
            };
        });

        const matrixTotalInstal = matrixTaxes.reduce((a, b) => a + b.instal, 0);
        const matrixTotalLocacao = matrixTaxes.reduce((a, b) => a + b.locacao, 0);
        const matrixTotalManut = matrixTaxes.reduce((a, b) => a + b.manutencao, 0);
        const matrixTotalMon = matrixTaxes.reduce((a, b) => a + b.monitoramento, 0);
        const matrixTotalGeral = matrixTotalInstal + matrixTotalLocacao + matrixTotalManut + matrixTotalMon;

        return {
            prazo,
            instalBase, locBase, manutBase, monBase,
            instalTaxes, locTaxes, manutTaxes, monTaxes,
            instalPercSum, instalValSum,
            locPercSum, locValSumMensal, locValSumTotal,
            manutPercSum, manutValSumMensal, manutValSumTotal,
            monPercSum, monValSumMensal, monValSumTotal,
            matrixTaxes,
            matrixTotalInstal, matrixTotalLocacao, matrixTotalManut, matrixTotalMon, matrixTotalGeral
        };
    }, [kitData, prazo]);

    return (
        <div className="max-w-[297mm] mx-auto bg-white text-black p-8 print:p-0 print:m-0 print:shadow-none shadow-lg mt-8 rounded-lg overflow-hidden border border-slate-100 text-xs">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-brand-primary pb-4 mb-6">
                <div className="flex items-center gap-4">
                    <ReportLogo url={activeCompany.company_logo_url} />
                    <div className="flex flex-col">
                        <span className="font-bold text-lg text-slate-800 uppercase tracking-tight">{activeCompany.company_name}</span>
                        <span className="text-xs text-slate-400 font-mono">CNPJ: {activeCompany.company_cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") || 'N/A'}</span>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-bold text-brand-primary uppercase">Kit Analítico</h2>
                    <p className="text-xs text-slate-400 mt-1">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>

            {/* Identificação do Kit */}
            <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm mb-4">
                <h3 className="text-lg font-medium text-slate-800">{kitData.nome_kit || 'Kit Sem Nome'}</h3>
                {kitData.descricao_kit && (
                    <p className="text-xs text-slate-500 mt-0.5 mb-1.5">{kitData.descricao_kit}</p>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] font-medium tracking-wide text-brand-primary border border-brand-primary/20 bg-brand-primary/5 px-1.5 py-0.5 rounded-sm">
                        {kitData.tipo_contrato}
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="text-sm font-medium text-slate-600">{kitData.prazo_contrato_meses} Meses</span>
                    {kitData.margem_fator && (
                        <>
                            <span className="text-gray-400">|</span>
                            <span className="text-sm text-slate-500">Fator Aplicado: {kitData.margem_fator}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Seção 1: Consolidação */}
            <div className="mb-4">
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">1. Resumo Financeiro (Consolidação)</h4>
                
                <div className="mb-3">
                    <h5 className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 border-b border-gray-100 pb-1">1.1 Parâmetros</h5>
                    <div className="grid grid-cols-6 gap-1.5">
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Política de Venda">Política Venda</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5 uppercase truncate">{politicaVenda}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Fator Margem">Fator Margem</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{kitData.fator_margem_locacao}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Fator Monitoramento">Fator Monitoram.</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{kitData.fator_monitoramento || 'N/A'}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="% de Comissão">% Comissão</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{Number(comissaoPerc || 0).toFixed(2)}%</p>
                        </div>
                        {kitData.instalacao_inclusa && (
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="% de Instalação">% Instalação</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{Number(kitData.percentual_instalacao || 0).toFixed(2)}%</p>
                        </div>
                        )}
                        {kitData.manutencao_inclusa && (
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Taxa Manutenção a.a">Taxa Manut. a.a</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{Number(kitData.taxa_manutencao_anual || 0).toFixed(2)}%</p>
                        </div>
                        )}
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Taxa Juros a.m">Taxa Juros a.m</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{Number(kitData.taxa_juros_mensal || 0).toFixed(2)}%</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Taxa de Locação">Tx Loc</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{((Number(kitData.summary?.tx_locacao) || 0) * 100).toFixed(4)}%</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Taxa de Manutenção a.m">Tx Manut</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{((Number(kitData.taxa_manutencao_anual) || 0) / 12).toFixed(4)}%</p>
                        </div>
                    </div>
                </div>

                <div className="mb-2">
                    <h5 className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 border-b border-gray-100 pb-1">1.2 Valores</h5>
                    <div className="grid grid-cols-5 gap-1.5">
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Valor Instalação">Val. Instalação</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatCurrency(kitData.summary?.vlr_instal_calc || 0)}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Locação Mensal">Locação Mensal</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatCurrency(kitData.summary?.valor_mensal_locacao_base || 0)}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Valor Manutenção">Val. Manutenção</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatCurrency(kitData.summary?.vlt_manut || 0)}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Valor Monitoramento">Val. Monitoram.</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatCurrency(kitData.summary?.venda_unit_monitoramento || 0)}</p>
                        </div>
                        <div className="bg-emerald-50/50 border border-emerald-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-emerald-600 font-medium tracking-wide uppercase leading-tight" title="Faturamento Mensal">Faturam. (Mês)</p>
                            <p className="text-[8px] font-semibold text-emerald-700 mt-0.5">{formatCurrency(kitData.summary?.valor_mensal_kit || 0)}</p>
                        </div>
                    </div>
                </div>

                <div>
                    <h5 className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 border-b border-gray-100 pb-1">1.3 Fechamento</h5>
                    <div className="grid grid-cols-6 gap-1.5">
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Custo de Aquisição">Custo Aquisição</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatCurrency(custoAquisicao)}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Custos Operacionais">Custos Operacionais</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatCurrency(custosOperacionaisTotais)}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Comissão">Comissão</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5 flex items-end gap-1">
                                {formatCurrency(comissaoValor)}
                            </p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Impostos Instalação">Imp. Instalação</p>
                            <p className="text-[8px] font-semibold text-rose-600 mt-0.5">{formatCurrency(impostoInstalacao)}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Impostos Mensais">Imp. Mensais</p>
                            <p className="text-[8px] font-semibold text-rose-600 mt-0.5">{formatCurrency(impostoMensal)}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Impostos Totais">Imp. Totais</p>
                            <p className="text-[8px] font-semibold text-rose-700 mt-0.5">{formatCurrency(impostosTotais)}</p>
                        </div>
                        <div className="bg-amber-50/50 border border-amber-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-amber-600 font-medium tracking-wide uppercase leading-tight" title="Custos Totais">Custos Totais</p>
                            <p className="text-[8px] font-semibold text-amber-700 mt-0.5">{formatCurrency(custosTotais)}</p>
                        </div>

                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Faturamento Total">Faturam. Total</p>
                            <p className="text-[8px] font-semibold text-brand-primary mt-0.5">{formatCurrency(faturamentoTotal)}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Lucro Estimado">Lucro Estimado</p>
                            <p className="text-[8px] font-semibold text-emerald-600 mt-0.5">{formatCurrency(lucroTotal)}</p>
                        </div>
                        <div className="bg-brand-primary/5 border border-brand-primary/10 p-1.5 rounded-sm">
                            <p className="text-[7px] text-brand-primary/80 font-medium tracking-wide uppercase leading-tight" title="Margem Geral">Margem</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatPercent(margemLucro)}</p>
                        </div>
                        <div className="bg-brand-primary/5 border border-brand-primary/10 p-1.5 rounded-sm">
                            <p className="text-[7px] text-brand-primary/80 font-medium tracking-wide uppercase leading-tight" title="ROI (Meses)">ROI</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{kitData.summary?.roi_meses?.toFixed(1)} m</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Seção 2: Equipamentos + Serviços */}
            <div className="mb-6">
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">2. Composição de Itens (Equipamentos & Serviços)</h4>
                <table className="w-full text-left text-[9px] border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-y border-slate-200">
                            <th className="py-1 px-1.5 font-medium text-slate-600 w-1/3">Produto / Serviço</th>
                            <th className="py-1 px-1.5 font-medium text-slate-600 w-1/4">Fornecedor</th>
                            <th className="py-1 px-1.5 font-medium text-slate-600 text-center">Qtd</th>
                            <th className="py-1 px-1.5 font-medium text-slate-600 text-right">Custo Base</th>
                            <th className="py-1 px-1.5 font-medium text-slate-600 text-right">Difal</th>
                            <th className="py-1 px-1.5 font-medium text-slate-600 text-right">Custo Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {kitData.item_summaries?.map((item: any, idx: number) => {
                            const originalItem = kitData.items?.find((i: any) => i.id === item.id);
                            
                            const sku = originalItem?.product?.codigo || '-';
                            const nomeProduto = originalItem?.product?.nome || originalItem?.own_service?.nome_servico || originalItem?.descricao_item || 'Desconhecido';
                            
                            const fornecedorObj = originalItem?.product?.fornecedor_ultimo_preco || originalItem?.product?.suppliers?.[0]?.supplier;
                            const fornecedor = fornecedorObj?.nome_fantasia || fornecedorObj?.razao_social || '-';
                            
                            const quantidade = originalItem?.quantidade_no_kit || 1;
                            
                            return (
                            <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-1 px-1.5 text-slate-800 max-w-[180px] truncate" title={nomeProduto}>
                                    <div className="flex flex-col">
                                        <span className="truncate">{nomeProduto}</span>
                                        <span className="text-[8px] text-slate-400 uppercase mt-0.5 font-mono">SKU: {sku}</span>
                                    </div>
                                </td>
                                <td className="py-1 px-1.5 text-slate-500 truncate max-w-[120px]" title={fornecedor}>
                                    {item.tipo_item === 'SERVICO_PROPRIO' ? 'Equipe Interna' : fornecedor}
                                </td>
                                <td className="py-1.5 px-1.5 text-center text-slate-800">{quantidade}</td>
                                <td className="py-1.5 px-1.5 text-right text-slate-500 whitespace-nowrap">{formatCurrency(item.custo_base_unitario_item || 0)}</td>
                                <td className="py-1.5 px-1.5 text-right text-slate-500 whitespace-nowrap">{formatCurrency(item.difal_total_item || 0)}</td>
                                <td className="py-1.5 px-1.5 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(item.custo_total_item_no_kit || 0)}</td>
                            </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-50 border-y border-gray-300 font-bold">
                            <td colSpan={5} className="py-2 px-2 text-right text-slate-600">Total Equipamentos & Serviços:</td>
                            <td className="py-2 px-2 text-right text-brand-primary">{formatCurrency(kitData.summary?.custo_aquisicao_total)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Seção 3: Resumos Analíticos */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">2.1. Resumo por Origem/Fornecedor</h4>
                    <div className="border border-slate-100 rounded-md overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="py-2 px-3 font-medium text-slate-600">Fornecedor</th>
                                    <th className="py-2 px-3 font-medium text-slate-600 text-right">Custo Total</th>
                                    <th className="py-2 px-3 font-medium text-slate-600 text-right">% do Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {suppliersAggregation.map((sup, idx) => (
                                    <tr key={idx}>
                                        <td className="py-2 px-3 text-slate-600 max-w-[150px] truncate" title={sup.nome}>{sup.nome}</td>
                                        <td className="py-2 px-3 text-right text-slate-800 font-medium">{formatCurrency(sup.valor)}</td>
                                        <td className="py-2 px-3 text-right text-slate-400 text-[11px]">{formatPercent(sup.perc)}</td>
                                    </tr>
                                ))}
                                {suppliersAggregation.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="py-2 px-3 text-center text-slate-400 italic">Nenhum fornecedor encontrado.</td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-gray-100 font-bold border-t border-gray-300">
                                <tr>
                                    <td className="py-2 px-3 text-gray-800 text-right">Total:</td>
                                    <td className="py-2 px-3 text-right text-slate-800">{formatCurrency(suppliersAggregation.reduce((acc, sup) => acc + sup.valor, 0))}</td>
                                    <td className="py-2 px-3 text-right text-slate-800">{formatPercent(suppliersAggregation.reduce((acc, sup) => acc + sup.perc, 0))}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div>
                    <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">2.2. Impostos e Acréscimos (Aquisição)</h4>
                    <div className="border border-slate-100 rounded-md overflow-hidden bg-red-50/30">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="py-2 px-3 font-medium text-slate-600">Tipo</th>
                                    <th className="py-2 px-3 font-medium text-slate-600 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                <tr>
                                    <td className="py-2 px-3 text-slate-600">Total IPI</td>
                                    <td className="py-2 px-3 text-right text-red-600 font-medium">{formatCurrency(taxesAggregation.ipi)}</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-3 text-slate-600">Total Frete</td>
                                    <td className="py-2 px-3 text-right text-red-600 font-medium">{formatCurrency(taxesAggregation.frete)}</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-3 text-slate-600">DIFAL</td>
                                    <td className="py-2 px-3 text-right text-red-600 font-medium">{formatCurrency(taxesAggregation.difal)}</td>
                                </tr>
                            </tbody>
                            <tfoot className="bg-red-100 font-bold border-t border-red-200">
                                <tr>
                                    <td className="py-2 px-3 text-red-900 text-right">Total Acréscimos:</td>
                                    <td className="py-2 px-3 text-right text-red-900">{formatCurrency(taxesAggregation.ipi + taxesAggregation.frete + taxesAggregation.difal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            {/* Seção 2.3: ROI de Equipamento */}
            <div>
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">2.3. Retorno e Viabilidade (Equipamento)</h4>
                <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-md p-3 flex flex-col items-center">
                    <div className="text-center mb-3">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase">ROI de Equipamento Previsto</p>
                        <p className="text-3xl font-black text-brand-primary leading-none mt-1">
                            {kitData.summary?.roi_equipamento_meses?.toFixed(2) || 'N/A'} <span className="text-base font-bold text-slate-400">Meses</span>
                        </p>
                    </div>
                    
                    <div className="w-full max-w-2xl bg-white border border-slate-100 rounded p-2.5 text-[10px] font-mono text-slate-500 shadow-sm">
                        <p className="font-bold text-gray-800 border-b border-slate-100 pb-1.5 mb-1.5 uppercase text-[9px]">Memória de Cálculo (Comprovação Matemática)</p>
                        
                        <div className="flex justify-between py-0.5">
                            <span>(+) Custo de Aquisição (Equipamentos)</span>
                            <span>{formatCurrency(kitData.summary?.custo_aquisicao_total || 0)}</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                            <span>(+) Comissão</span>
                            <span>{formatCurrency(kitData.summary?.valor_comissao_locacao || kitData.summary?.vlt_comissao || 0)}</span>
                        </div>
                        <div className="flex justify-between py-0.5 font-medium text-slate-800 border-t border-dashed border-gray-300 mt-1 pt-1">
                            <span>(=) Total Investimento (A)</span>
                            <span>{formatCurrency((kitData.summary?.custo_aquisicao_total || 0) + (kitData.summary?.valor_comissao_locacao || kitData.summary?.vlt_comissao || 0))}</span>
                        </div>
                        
                        <div className="h-2"></div>
                        
                        <div className="flex justify-between py-0.5">
                            <span>(+) Locação Mensal</span>
                            <span>{formatCurrency(kitData.summary?.valor_mensal_locacao_base || 0)}</span>
                        </div>
                        <div className="flex justify-between py-0.5 text-red-600">
                            <span>(-) Imposto de Locação</span>
                            <span>- {formatCurrency(kitData.summary?.imposto_equip_loc || 0)}</span>
                        </div>
                        <div className="flex justify-between py-0.5 font-medium text-slate-800 border-t border-dashed border-gray-300 mt-1 pt-1">
                            <span>(=) Receita Líquida Mensal (B)</span>
                            <span>{formatCurrency((kitData.summary?.valor_mensal_locacao_base || 0) - (kitData.summary?.imposto_equip_loc || 0))}</span>
                        </div>
                        
                        <div className="h-2"></div>
                        
                        <div className="flex justify-between py-1 bg-slate-50 px-2 rounded border border-slate-100 font-bold text-brand-primary">
                            <span>Cálculo Final: (A) / (B)</span>
                            <span>{kitData.summary?.roi_equipamento_meses?.toFixed(2)} meses</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Seção 3: Custos Operacionais */}
            <div className="mb-3 mt-4">
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">3. Custos Operacionais</h4>
                <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-y border-slate-200">
                            <th className="py-1 px-2 font-medium text-slate-600">Descrição</th>
                            <th className="py-1 px-2 font-medium text-slate-600 text-right">Custo Mensal (Unitário)</th>
                            <th className="py-1 px-2 font-medium text-slate-600 text-right">Custo Total ({kitData.prazo_contrato_meses || 1} Meses)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {operacionaisRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-1 px-2 text-slate-800">{row.nome}</td>
                                <td className="py-1.5 px-2 text-right text-slate-500">{formatCurrency(row.unitario)}</td>
                                <td className="py-1.5 px-2 text-right font-medium text-slate-800">{formatCurrency(row.total)}</td>
                            </tr>
                        ))}
                        {operacionaisRows.length === 0 && (
                            <tr>
                                <td colSpan={3} className="py-4 text-center text-slate-400 italic">Nenhum custo operacional cadastrado.</td>
                            </tr>
                        )}
                    </tbody>
                    {operacionaisRows.length > 0 && (
                        <tfoot>
                            <tr className="bg-slate-50 border-y border-gray-300 font-bold">
                                <td className="py-1.5 px-2 text-right text-slate-600">Total Custos Operacionais:</td>
                                <td className="py-1.5 px-2 text-right text-slate-800">{formatCurrency(operacionaisRows.reduce((a, b) => a + b.unitario, 0))}</td>
                                <td className="py-1.5 px-2 text-right text-brand-primary">{formatCurrency(operacionaisRows.reduce((a, b) => a + b.total, 0))}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
            
            {/* Seção 4: Comissionamento */}
            {comissaoPerc > 0 && (
                <div className="mb-3 mt-4">
                    <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">4. Comissionamento</h4>
                    <div className="bg-white border border-slate-100 rounded-md p-3 flex flex-col items-center">
                        <div className="w-full max-w-2xl bg-slate-50 border border-slate-100 rounded p-2.5 text-[10px] font-mono text-slate-500 shadow-sm">
                            <p className="font-bold text-gray-800 border-b border-slate-100 pb-1.5 mb-1.5 uppercase text-[9px]">Memória de Cálculo (Comissão)</p>
                            
                            <div className="flex justify-between py-0.5">
                                <span>Fórmula Base</span>
                                <span className="text-slate-400 text-[9px]">comissão = (Valor Total Mercadoria × Fator Margem) × % Comissão</span>
                            </div>
                            
                            <div className="h-1"></div>
                            
                            <div className="flex justify-between py-0.5">
                                <span>(=) Valor Base</span>
                                <span>({formatCurrency(custoAquisicao)} × {fatorAplicado.toFixed(2)})</span>
                            </div>
                            
                            <div className="flex justify-between py-0.5">
                                <span>(=) Subtotal Base</span>
                                <span>{formatCurrency(custoAquisicao * fatorAplicado)}</span>
                            </div>
                            
                            <div className="flex justify-between py-0.5 text-brand-primary">
                                <span>(×) % de Comissionamento</span>
                                <span>{comissaoPerc.toFixed(2)}%</span>
                            </div>
                            
                            <div className="flex justify-between py-1 bg-white px-2 rounded border border-slate-100 font-bold text-brand-primary mt-1.5">
                                <span>(=) Comissão Final</span>
                                <span>{formatCurrency((custoAquisicao * fatorAplicado) * (comissaoPerc / 100))}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Seção 5: Impostos */}
            {taxData && (
                <div className="mb-6 mt-8 break-inside-avoid">
                    <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">5. Impostos (Serviços e Locação)</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                        {/* 5.1 Instalação */}
                        {taxData.instalBase > 0 && (
                        <div className="border border-slate-100 rounded-md overflow-hidden bg-white shadow-sm flex flex-col">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex justify-between items-center">
                                <h5 className="text-[10px] font-bold text-slate-600 uppercase">5.1 Instalação</h5>
                                <span className="text-[10px] font-medium text-slate-800">{formatCurrency(taxData.instalBase)}</span>
                            </div>
                            <div className="flex-1">
                                <table className="w-full text-left text-[10px]">
                                    <thead className="bg-slate-50/50 border-b border-slate-100">
                                        <tr>
                                            <th className="py-1.5 px-3 font-semibold text-slate-500">Imposto</th>
                                            <th className="py-1.5 px-3 font-semibold text-slate-500 text-right">%</th>
                                            <th className="py-1.5 px-3 font-semibold text-slate-500 text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {taxData.instalTaxes.map((tax, idx) => (
                                            <tr key={idx}>
                                                <td className="py-1.5 px-3 text-slate-600">{tax.nome}</td>
                                                <td className="py-1.5 px-3 text-right text-slate-500">{tax.perc.toFixed(2)}%</td>
                                                <td className="py-1.5 px-3 text-right font-medium text-red-600">{formatCurrency(taxData.instalBase * (tax.perc / 100))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 font-bold border-t border-slate-100">
                                        <tr>
                                            <td className="py-1.5 px-3 text-gray-800 text-right">Total:</td>
                                            <td className="py-1.5 px-3 text-right text-slate-800">{taxData.instalPercSum.toFixed(2)}%</td>
                                            <td className="py-1.5 px-3 text-right text-red-700">{formatCurrency(taxData.instalValSum)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                        )}
                        
                        {/* 5.2 Locação */}
                        <div className="border border-slate-100 rounded-md overflow-hidden bg-white shadow-sm flex flex-col">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex justify-between items-center">
                                <h5 className="text-[10px] font-bold text-slate-600 uppercase">5.2 Locação de Equipamento</h5>
                                <span className="text-[10px] font-medium text-slate-800">{formatCurrency(taxData.locBase)}</span>
                            </div>
                            <div className="flex-1">
                                <table className="w-full text-left text-[10px]">
                                    <thead className="bg-slate-50/50 border-b border-slate-100">
                                        <tr>
                                            <th className="py-1.5 px-3 font-semibold text-slate-500">Imposto</th>
                                            <th className="py-1.5 px-3 font-semibold text-slate-500 text-right">%</th>
                                            <th className="py-1.5 px-3 font-semibold text-slate-500 text-right">Valor Mensal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {taxData.locTaxes.map((tax, idx) => (
                                            <tr key={idx}>
                                                <td className="py-1.5 px-3 text-slate-600">{tax.nome}</td>
                                                <td className="py-1.5 px-3 text-right text-slate-500">{tax.perc.toFixed(2)}%</td>
                                                <td className="py-1.5 px-3 text-right font-medium text-red-600">{formatCurrency(taxData.locBase * (tax.perc / 100))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 font-bold border-t border-slate-100 divide-y divide-slate-100">
                                        <tr>
                                            <td className="py-1.5 px-3 text-gray-800 text-right">Total (Mensal):</td>
                                            <td className="py-1.5 px-3 text-right text-slate-800">{taxData.locPercSum.toFixed(2)}%</td>
                                            <td className="py-1.5 px-3 text-right text-red-700">{formatCurrency(taxData.locValSumMensal)}</td>
                                        </tr>
                                        <tr className="bg-red-50 text-red-900 border-t-2 border-red-100">
                                            <td colSpan={2} className="py-1.5 px-3 text-right">Total no Contrato ({taxData.prazo} meses):</td>
                                            <td className="py-1.5 px-3 text-right">{formatCurrency(taxData.locValSumTotal)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* 5.3 Manutenção */}
                        {taxData.manutBase > 0 && (
                        <div className="border border-slate-100 rounded-md overflow-hidden bg-white shadow-sm flex flex-col">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex justify-between items-center">
                                <h5 className="text-[10px] font-bold text-slate-600 uppercase">5.3 Manutenção</h5>
                                <span className="text-[10px] font-medium text-slate-800">{formatCurrency(taxData.manutBase)}</span>
                            </div>
                            <div className="flex-1">
                                <table className="w-full text-left text-[10px]">
                                    <thead className="bg-slate-50/50 border-b border-slate-100">
                                        <tr>
                                            <th className="py-1.5 px-3 font-semibold text-slate-500">Imposto</th>
                                            <th className="py-1.5 px-3 font-semibold text-slate-500 text-right">%</th>
                                            <th className="py-1.5 px-3 font-semibold text-slate-500 text-right">Valor Mensal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {taxData.manutTaxes.map((tax, idx) => (
                                            <tr key={idx}>
                                                <td className="py-1.5 px-3 text-slate-600">{tax.nome}</td>
                                                <td className="py-1.5 px-3 text-right text-slate-500">{tax.perc.toFixed(2)}%</td>
                                                <td className="py-1.5 px-3 text-right font-medium text-red-600">{formatCurrency(taxData.manutBase * (tax.perc / 100))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 font-bold border-t border-slate-100 divide-y divide-slate-100">
                                        <tr>
                                            <td className="py-1.5 px-3 text-gray-800 text-right">Total (Mensal):</td>
                                            <td className="py-1.5 px-3 text-right text-slate-800">{taxData.manutPercSum.toFixed(2)}%</td>
                                            <td className="py-1.5 px-3 text-right text-red-700">{formatCurrency(taxData.manutValSumMensal)}</td>
                                        </tr>
                                        <tr className="bg-red-50 text-red-900 border-t-2 border-red-100">
                                            <td colSpan={2} className="py-1.5 px-3 text-right">Total no Contrato ({taxData.prazo} meses):</td>
                                            <td className="py-1.5 px-3 text-right">{formatCurrency(taxData.manutValSumTotal)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                        )}

                        {/* 5.4 Monitoramento */}
                        {taxData.monBase > 0 && (
                        <div className="border border-slate-100 rounded-md overflow-hidden bg-white shadow-sm flex flex-col">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex justify-between items-center">
                                <h5 className="text-[10px] font-bold text-slate-600 uppercase">5.4 Monitoramento</h5>
                                <span className="text-[10px] font-medium text-slate-800">{formatCurrency(taxData.monBase)}</span>
                            </div>
                            <div className="flex-1">
                                <table className="w-full text-left text-[10px]">
                                    <thead className="bg-slate-50/50 border-b border-slate-100">
                                        <tr>
                                            <th className="py-1.5 px-3 font-semibold text-slate-500">Imposto</th>
                                            <th className="py-1.5 px-3 font-semibold text-slate-500 text-right">%</th>
                                            <th className="py-1.5 px-3 font-semibold text-slate-500 text-right">Valor Mensal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {taxData.monTaxes.map((tax, idx) => (
                                            <tr key={idx}>
                                                <td className="py-1.5 px-3 text-slate-600">{tax.nome}</td>
                                                <td className="py-1.5 px-3 text-right text-slate-500">{tax.perc.toFixed(2)}%</td>
                                                <td className="py-1.5 px-3 text-right font-medium text-red-600">{formatCurrency(taxData.monBase * (tax.perc / 100))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 font-bold border-t border-slate-100 divide-y divide-slate-100">
                                        <tr>
                                            <td className="py-1.5 px-3 text-gray-800 text-right">Total (Mensal):</td>
                                            <td className="py-1.5 px-3 text-right text-slate-800">{taxData.monPercSum.toFixed(2)}%</td>
                                            <td className="py-1.5 px-3 text-right text-red-700">{formatCurrency(taxData.monValSumMensal)}</td>
                                        </tr>
                                        <tr className="bg-red-50 text-red-900 border-t-2 border-red-100">
                                            <td colSpan={2} className="py-1.5 px-3 text-right">Total no Contrato ({taxData.prazo} meses):</td>
                                            <td className="py-1.5 px-3 text-right">{formatCurrency(taxData.monValSumTotal)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                        )}
                    </div>

                    {/* 5.5 Impostos Totais (Contrato) */}
                    <div className="mt-4 border border-slate-100 rounded-md overflow-hidden bg-white shadow-sm">
                        <div className="bg-slate-50 px-2 py-1.5 border-b border-slate-100">
                            <h5 className="text-[9px] font-bold text-slate-600 uppercase">5.5 Impostos Totais (Ao longo do contrato)</h5>
                        </div>
                        <table className="w-full text-left text-[8px]">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="py-1 px-2 font-semibold text-slate-500">Imposto</th>
                                    <th className="py-1 px-2 font-semibold text-slate-500 text-right">Instalação</th>
                                    <th className="py-1 px-2 font-semibold text-slate-500 text-right">Locação ({taxData.prazo}m)</th>
                                    <th className="py-1 px-2 font-semibold text-slate-500 text-right">Manutenção ({taxData.prazo}m)</th>
                                    <th className="py-1 px-2 font-semibold text-slate-500 text-right">Monitoramento ({taxData.prazo}m)</th>
                                    <th className="py-1 px-2 font-semibold text-red-700 text-right">Total Consolidado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {taxData.matrixTaxes.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="py-0.5 px-2 font-medium text-slate-600">{row.nome} <span className="text-[7px] text-gray-400 font-normal">({row.perc}%)</span></td>
                                        <td className="py-0.5 px-2 text-right text-slate-500">{row.instal > 0 ? formatCurrency(row.instal) : '-'}</td>
                                        <td className="py-0.5 px-2 text-right text-slate-500">{row.locacao > 0 ? formatCurrency(row.locacao) : '-'}</td>
                                        <td className="py-0.5 px-2 text-right text-slate-500">{row.manutencao > 0 ? formatCurrency(row.manutencao) : '-'}</td>
                                        <td className="py-0.5 px-2 text-right text-slate-500">{row.monitoramento > 0 ? formatCurrency(row.monitoramento) : '-'}</td>
                                        <td className="py-0.5 px-2 text-right font-bold text-red-600 bg-red-50/30">{formatCurrency(row.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 font-bold border-t border-gray-300">
                                <tr>
                                    <td className="py-1 px-2 text-gray-800">Custo Fiscal Total:</td>
                                    <td className="py-1 px-2 text-right text-slate-800">{formatCurrency(taxData.matrixTotalInstal)}</td>
                                    <td className="py-1 px-2 text-right text-slate-800">{formatCurrency(taxData.matrixTotalLocacao)}</td>
                                    <td className="py-1 px-2 text-right text-slate-800">{formatCurrency(taxData.matrixTotalManut)}</td>
                                    <td className="py-1 px-2 text-right text-slate-800">{formatCurrency(taxData.matrixTotalMon)}</td>
                                    <td className="py-1 px-2 text-right text-red-700 text-[9px] bg-red-100">{formatCurrency(taxData.matrixTotalGeral)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
            <div className="mt-2 break-inside-avoid border border-slate-100 rounded-md overflow-hidden bg-white shadow-sm">
                <div className="bg-brand-primary/5 px-2 py-1.5 border-b border-slate-100">
                    <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">
                        6. Detalhamento de ROI
                    </h4>
                </div>
                <div className="p-2">
                    <div className="grid grid-cols-3 gap-1.5">
                        {/* Investimento */}
                        <div className="border border-slate-100 rounded-md bg-slate-50 p-1.5 flex flex-col">
                            <h5 className="text-[9px] font-bold text-slate-600 uppercase mb-1 border-b border-slate-100 pb-0.5">1. Investimento Inicial</h5>
                            <div className="space-y-0.5 text-[9px] flex-1">
                                <div className="flex justify-between"><span className="text-slate-400">Aquisição:</span><span className="font-medium">{formatCurrency(custoAquisicao)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Impostos:</span><span className="font-medium text-red-600">{formatCurrency(impostoInstalacao)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Comissão:</span><span className="font-medium">{formatCurrency(comissaoValor)}</span></div>
                            </div>
                            <div className="flex justify-between mt-1 pt-1 border-t border-slate-100 font-bold text-[9px]">
                                <span className="text-gray-800">Total Investido:</span>
                                <span className="text-slate-800">{formatCurrency(custoAquisicao + impostoInstalacao + comissaoValor)}</span>
                            </div>
                        </div>

                        {/* Lucro Mensal */}
                        <div className="border border-slate-100 rounded-md bg-slate-50 p-1.5 flex flex-col">
                            <h5 className="text-[9px] font-bold text-slate-600 uppercase mb-1 border-b border-slate-100 pb-0.5">2. Lucro Líquido Mensal</h5>
                            <div className="space-y-0.5 text-[9px] flex-1">
                                <div className="flex justify-between"><span className="text-slate-400">Faturamento:</span><span className="font-medium text-green-600">{formatCurrency(Number(kitData.summary?.valor_mensal_kit) || 0)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Custos Op.:</span><span className="font-medium text-orange-600">-{formatCurrency(custoOperacionalMensal)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Impostos:</span><span className="font-medium text-red-600">-{formatCurrency(impostoMensal)}</span></div>
                            </div>
                            <div className="flex justify-between mt-1 pt-1 border-t border-slate-100 font-bold text-[9px]">
                                <span className="text-gray-800">Lucro Mensal Líquido:</span>
                                <span className="text-slate-800">{formatCurrency((Number(kitData.summary?.valor_mensal_kit) || 0) - custoOperacionalMensal - impostoMensal)}</span>
                            </div>
                        </div>

                        {/* Resultado ROI */}
                        <div className="border border-brand-primary/20 rounded-md bg-brand-primary/5 p-1 flex flex-col justify-center items-center text-center">
                            <h5 className="text-[9px] font-bold text-brand-primary uppercase mb-1">3. Prazo Estimado</h5>
                            <div className="text-xl font-display font-bold text-brand-primary my-0.5 flex items-baseline gap-1">
                                {kitData.summary?.roi_meses?.toFixed(1)} <span className="text-[9px] font-medium">meses</span>
                            </div>
                            <p className="text-[8px] text-slate-400 mt-0.5">
                                (Investimento ÷ Lucro)
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="mt-12 text-center text-xs text-gray-400 font-mono border-t border-slate-100 pt-4">
                Relatório gerado pelo sistema Cerberus. Documento estritamente confidencial.
            </div>
        </div>
    );
};
