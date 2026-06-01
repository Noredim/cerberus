import React, { useMemo } from 'react';
import { ReportLogo } from './ReportLogo';

interface SalesAnalyticReportProps {
    kitData: any;
    activeCompany: any;
    policies: any[];
    formatCurrency: (value: number | string | undefined) => string;
    formatPercent: (value: number | string | undefined) => string;
}

export const SalesAnalyticReport: React.FC<SalesAnalyticReportProps> = ({
    kitData,
    activeCompany,
    policies,
    formatCurrency,
    formatPercent
}) => {
    const prazo = kitData.prazo_contrato_meses || 1;

    // Faturamentos
    const faturamentoProdutos = Number(kitData.summary?.faturamento_total_venda) || 0;

    const faturamentoInstalacao = Number(kitData.summary?.vlr_instal_calc) || 0;
    const faturamentoTotalExibicao = faturamentoProdutos + faturamentoInstalacao;

    // Manutenção e Monitoramento avulsos, se houver
    // const custoOperacionalMensal = (kitData.monthly_costs || []).reduce(...) + monitoramento;
    const faturamentoManutencao = kitData.havera_manutencao ? (Number(kitData.summary?.vlt_manut) || 0) * prazo : 0;
    const faturamentoMonitoramento = (Number(kitData.summary?.venda_unit_monitoramento) || 0) * prazo;

    // const faturamentoTotal = faturamentoProdutos + faturamentoInstalacao + faturamentoManutencao + faturamentoMonitoramento;

    // Custos e Aquisição
    const custoAquisicao = Number(kitData.summary?.custo_aquisicao_total) || 0;

    // Impostos e Acréscimos de Compra
    const taxesAggregation = useMemo(() => {
        if (!kitData?.item_summaries || !kitData?.items) return { ipi: 0, frete: 0, icms_st: 0, icmsAbatido: 0 };

        let ipi = 0;
        let frete = 0;
        let icms_st = 0;
        let icmsAbatido = 0;

        kitData.item_summaries.forEach((item: any) => {
            const originalItem = kitData.items.find((i: any) => i.id === item.id);
            if (!originalItem) return;

            const quantidade = originalItem?.quantidade_no_kit || 1;

            ipi += (Number(item.ipi_unit) || 0) * quantidade;
            frete += (Number(item.frete_cif_unit) || 0) * quantidade;
            icms_st += Number(item.icms_st_total) || 0;
            icmsAbatido += Number(item.icms_abatido_total) || (Number(item.icms_abatido || 0) * quantidade);
        });

        return { ipi, frete, icms_st, icmsAbatido };
    }, [kitData]);

    /*
    const totalsBlock2 = useMemo(() => {
        let custoTotal = 0;
        let vendaTotal = 0;
        kitData.item_summaries?.forEach((item: any) => {
            custoTotal += Number(item.custo_total_item_no_kit || 0);
            vendaTotal += Number(item.venda_total_item || 0);
        });
        return { custoTotal, vendaTotal };
    }, [kitData]);
    */

    const supplierCosts = useMemo(() => {
        if (!kitData?.item_summaries || !kitData?.items) return [];
        const costsBySupplier: Record<string, number> = {};
        let totalCost = 0;

        kitData.item_summaries.forEach((item: any) => {
            const originalItem = kitData.items.find((i: any) => i.id === item.id);
            if (!originalItem) return;

            const fornecedorObj = originalItem?.product?.fornecedor_ultimo_preco || originalItem?.product?.suppliers?.[0]?.supplier;
            const fornecedor = item.tipo_item === 'SERVICO_PROPRIO' ? 'Equipe Interna' : (fornecedorObj?.nome_fantasia || fornecedorObj?.razao_social || 'Desconhecido');

            const cost = Number(item.custo_total_item_no_kit || 0);

            if (!costsBySupplier[fornecedor]) {
                costsBySupplier[fornecedor] = 0;
            }
            costsBySupplier[fornecedor] += cost;
            totalCost += cost;
        });

        return Object.entries(costsBySupplier)
            .map(([fornecedor, custo]) => ({
                fornecedor,
                custo,
                perc: totalCost > 0 ? (custo / totalCost) * 100 : 0
            }))
            .sort((a, b) => b.custo - a.custo);
    }, [kitData]);

    const acréscimosCompra = taxesAggregation.ipi + taxesAggregation.frete + taxesAggregation.icms_st;
    // O custo de aquisição do kit já engloba todos os acréscimos de compra da nota fiscal de entrada
    const custoAquisicaoComAcrescimos = custoAquisicao;

    // Impostos de Venda
    const totalAliqVenda = (Number(kitData.aliq_pis || 0) + Number(kitData.aliq_cofins || 0) + Number(kitData.aliq_csll || 0) + Number(kitData.aliq_irpj || 0) + Number(kitData.aliq_icms || 0) + Number(kitData.aliq_iss || 0)) / 100;
    const impostoVendaEquipamentos = Number(kitData.summary?.imposto_equip_venda) || (faturamentoProdutos * totalAliqVenda);
    // Custos Operacionais
    const operacionaisRows = useMemo(() => {
        if (!kitData) return [];
        const rows: { nome: string; unitario: number; total: number; }[] = [];

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

    const custosOperacionaisTotais = operacionaisRows.reduce((a, b) => a + b.total, 0);

    // Comissão e Despesas Adm
    const comissaoPerc = Number(kitData.perc_comissao || 0);
    const comissaoValor = Number(kitData.summary?.vlt_comissao) || (faturamentoProdutos > 0 ? faturamentoProdutos * (comissaoPerc / 100) : 0);
    const percDespesasAdm = Number(kitData.perc_despesas_adm || kitData.perc_despesas_administrativas || 0);
    const despesaAdministrativaValor = Number(kitData.summary?.vlt_desp_adm) || (faturamentoProdutos > 0 ? faturamentoProdutos * (percDespesasAdm / 100) : 0);
    const freteVenda = Number(kitData.summary?.vlt_frete) || (faturamentoProdutos > 0 ? faturamentoProdutos * (Number(kitData.perc_frete_venda || 0) / 100) : 0);

    const creditoIcms = taxesAggregation.icmsAbatido > 0 ? taxesAggregation.icmsAbatido : (Number(kitData.summary?.credito_icms_compra_total) || 0);

    const totalCustos13 = custoAquisicaoComAcrescimos + comissaoValor + impostoVendaEquipamentos + despesaAdministrativaValor - creditoIcms;

    // Lucro
    // const custosTotais = custoAquisicaoComAcrescimos + impostosTotais + comissaoValor + custosOperacionaisTotais + faturamentoInstalacao; // Se instalação não é embutida, é repassada
    const lucroTotal = faturamentoProdutos - custoAquisicaoComAcrescimos + creditoIcms - impostoVendaEquipamentos - despesaAdministrativaValor - freteVenda - comissaoValor;
    const margemLucro = faturamentoProdutos > 0 ? lucroTotal / faturamentoProdutos : 0;

    // Politica
    const fatorAplicado = Number(kitData.fator_margem_servicos_produtos);
    const activePolicy = policies
        .filter((p: any) => Number(p.fator_limite) <= fatorAplicado + 0.00001)
        .sort((a: any, b: any) => Number(b.fator_limite) - Number(a.fator_limite))[0];
    const politicaVenda = activePolicy?.nome_politica || 'Padrão';

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
                    <h2 className="text-xl font-bold text-brand-primary uppercase">Kit Analítico de Venda</h2>
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
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">1. Resumo Financeiro (Venda Direta)</h4>

                <div className="mb-3">
                    <h5 className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 border-b border-gray-100 pb-1">1.1 Parâmetros Comerciais</h5>
                    <div className="grid grid-cols-6 gap-1.5">
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Política de Venda">Política Venda</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5 uppercase truncate">{politicaVenda}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Fator Margem">Fator Margem</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{fatorAplicado}</p>
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
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="% Despesas Adm">% Desp. Adm</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{percDespesasAdm.toFixed(2)}%</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="% Frete Venda">% Frete Venda</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{Number(kitData.perc_frete_venda || 0).toFixed(2)}%</p>
                        </div>
                    </div>
                </div>

                <div className="mb-2">
                    <h5 className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 border-b border-gray-100 pb-1">1.2 Faturamentos da Proposta</h5>
                    <div className="grid grid-cols-5 gap-1.5">
                        <div className="bg-brand-primary/5 border border-brand-primary/10 p-1.5 rounded-sm">
                            <p className="text-[7px] text-brand-primary/80 font-medium tracking-wide uppercase leading-tight" title="Faturamento Total">Faturam. Total</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatCurrency(faturamentoTotalExibicao)}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Faturamento de Equipamentos">Faturam. Equipamentos</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatCurrency(faturamentoProdutos)}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Valor Instalação">Faturam. Instalação</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatCurrency(faturamentoInstalacao)} {kitData.instalacao_inclusa ? "(Embutida)" : ""}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Valor Manutenção">Faturam. Manutenção</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatCurrency(faturamentoManutencao)}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Valor Monitoramento">Faturam. Monitoram.</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatCurrency(faturamentoMonitoramento)}</p>
                        </div>
                    </div>
                </div>

                <div>
                    <h5 className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 border-b border-gray-100 pb-1">1.3 Fechamento (Equipamentos)</h5>
                    <div className="grid grid-cols-7 gap-1.5">
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Custo de Aquisição">Custo Aquisição</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatCurrency(custoAquisicao)}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Acréscimos de Compra">Acréscimos Compra</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatCurrency(acréscimosCompra)}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Comissão">Comissão</p>
                            <p className="text-[8px] font-semibold text-slate-800 mt-0.5 flex items-end gap-1">
                                {formatCurrency(comissaoValor)}
                            </p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-slate-400 font-medium tracking-wide uppercase leading-tight" title="Impostos de Venda">Impostos Incidentes</p>
                            <p className="text-[8px] font-semibold text-rose-600 mt-0.5">{formatCurrency(impostoVendaEquipamentos)}</p>
                        </div>

                        <div className="bg-rose-50/50 border border-rose-100 p-1.5 rounded-sm">
                            <p className="text-[7px] text-rose-500 font-medium tracking-wide uppercase leading-tight" title="Total de Custos">Total Custos</p>
                            <p className="text-[8px] font-semibold text-rose-700 mt-0.5">{formatCurrency(totalCustos13)}</p>
                        </div>

                        <div className="bg-brand-primary/5 border border-brand-primary/10 p-1.5 rounded-sm col-span-2 flex justify-between items-center">
                            <div>
                                <p className="text-[7px] text-brand-primary/80 font-medium tracking-wide uppercase leading-tight" title="Margem Geral">Margem de Lucro</p>
                                <p className="text-[8px] font-semibold text-slate-800 mt-0.5">{formatPercent(margemLucro)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[7px] text-brand-primary/80 font-medium tracking-wide uppercase leading-tight" title="Lucro Estimado">Lucro Estimado</p>
                                <p className="text-[9px] font-semibold text-emerald-700 mt-0.5">{formatCurrency(lucroTotal)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Seção 2: Equipamentos + Serviços */}
            <div className="mb-6">
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">2. Composição de Itens (Equipamentos)</h4>
                <table className="w-full text-left text-[9px] border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-y border-slate-200">
                            <th className="py-1 px-1 font-medium text-slate-600 w-[16%]">Produto</th>
                            <th className="py-1 px-1 font-medium text-slate-600 text-center">Quantidade</th>
                            <th className="py-1 px-1 font-medium text-slate-600 text-right">Custo Un.</th>
                            <th className="py-1 px-1 font-medium text-slate-600 text-right">Custo Total</th>
                            <th className="py-1 px-1 font-medium text-slate-600 text-center">Fator</th>
                            <th className="py-1 px-1 font-medium text-slate-600 text-right">Venda Un.</th>
                            <th className="py-1 px-1 font-medium text-slate-600 text-right">Frete Un.</th>
                            <th className="py-1 px-1 font-medium text-slate-600 text-right">Impostos Un.</th>
                            <th className="py-1 px-1 font-medium text-slate-600 text-right">Desp. Adm Un.</th>
                            <th className="py-1 px-1 font-medium text-slate-600 text-right">Comissão Un.</th>
                            <th className="py-1 px-1 font-medium text-slate-600 text-right">Lucro Un.</th>
                            <th className="py-1 px-1 font-medium text-slate-600 text-right">Margem</th>
                            <th className="py-1 px-1 font-medium text-slate-600 text-right">Venda Total</th>
                            <th className="py-1 px-1 font-medium text-slate-600 text-right">Lucro Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {kitData.item_summaries?.map((item: any, idx: number) => {
                            const originalItem = kitData.items?.find((i: any) => i.id === item.id);
                            const sku = originalItem?.product?.codigo || '-';
                            const nomeProduto = originalItem?.product?.nome || originalItem?.own_service?.nome_servico || originalItem?.descricao_item || 'Desconhecido';
                            const quantidade = originalItem?.quantidade_no_kit || 1;

                            const custoTotalItem = Number(item.custo_total_item_no_kit || 0);
                            const custoUn = custoTotalItem / quantidade;
                            const vendaTotalItem = Number(item.venda_total_item || 0);
                            const vendaUn = vendaTotalItem / quantidade;

                            const fatorDisplay = Number(item.fator_item) || (custoTotalItem > 0 ? (vendaTotalItem / custoTotalItem) : 0);

                            // Distribuição proporcional exata dos totais consolidados no backend
                            const shareFaturamento = faturamentoProdutos > 0 ? (vendaTotalItem / faturamentoProdutos) : 0;

                            const impostosItem = item.imposto_venda_item != null ? Number(item.imposto_venda_item) : (impostoVendaEquipamentos * shareFaturamento);
                            const despAdmItem = item.desp_adm_item != null ? Number(item.desp_adm_item) : (despesaAdministrativaValor * shareFaturamento);
                            const freteItem = item.frete_venda_item != null ? Number(item.frete_venda_item) : (freteVenda * shareFaturamento);
                            const comissaoItem = item.comissao_item != null ? Number(item.comissao_item) : (comissaoValor * shareFaturamento);

                            let icmsAbatidoItem = item.icms_abatido_total != null ? Number(item.icms_abatido_total) : (Number(item.icms_abatido || 0) * quantidade);
                            if (icmsAbatidoItem === 0 && creditoIcms > 0 && custoAquisicao > 0) {
                                icmsAbatidoItem = (custoTotalItem / custoAquisicao) * creditoIcms;
                            }

                            // Calcula valores unitários para exibição correta e matemática exata no grid
                            const impostoLiquidoTotal = impostosItem - icmsAbatidoItem;

                            const freteUnItem = quantidade > 0 ? freteItem / quantidade : 0;
                            const impostosUnItem = quantidade > 0 ? impostoLiquidoTotal / quantidade : 0;
                            const despAdmUnItem = quantidade > 0 ? despAdmItem / quantidade : 0;
                            const comissaoUnItem = quantidade > 0 ? comissaoItem / quantidade : 0;

                            // O cálculo explícito e unitário que bate 100% com a visão visual
                            const lucroUnItem = vendaUn - custoUn - freteUnItem - impostosUnItem - despAdmUnItem - comissaoUnItem;
                            const lucroTotalItem = lucroUnItem * quantidade;
                            const margemItem = vendaTotalItem > 0 ? (lucroTotalItem / vendaTotalItem) * 100 : 0;

                            return (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="py-1.5 px-1 text-slate-800 truncate max-w-[120px]" title={nomeProduto}>
                                        <div className="flex flex-col">
                                            <span className="truncate font-medium">{nomeProduto}</span>
                                            <span className="text-[7px] text-gray-400 uppercase mt-0.5 font-mono">SKU: {sku}</span>
                                        </div>
                                    </td>
                                    <td className="py-1.5 px-1 text-center text-slate-600 bg-slate-50/50 border border-gray-100 rounded my-1 font-mono">{quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
                                    <td className="py-1.5 px-1 text-right text-slate-500 border-b border-dashed border-slate-100">{formatCurrency(custoUn)}</td>
                                    <td className="py-1.5 px-1 text-right text-gray-800 font-medium">{formatCurrency(custoTotalItem)}</td>
                                    <td className="py-1.5 px-1 text-center text-slate-400">{fatorDisplay.toFixed(2)}</td>
                                    <td className="py-1.5 px-1 text-right text-gray-800">{formatCurrency(vendaUn)}</td>
                                    <td className="py-1.5 px-1 text-right text-slate-400">{formatCurrency(freteUnItem)}</td>
                                    <td className="py-1.5 px-1 text-right text-slate-400 border-b border-dashed border-slate-100">{formatCurrency(impostosUnItem)}</td>
                                    <td className="py-1.5 px-1 text-right text-slate-400">{formatCurrency(despAdmUnItem)}</td>
                                    <td className="py-1.5 px-1 text-right text-slate-400">{formatCurrency(comissaoUnItem)}</td>
                                    <td className="py-1.5 px-1 text-right text-slate-500 font-semibold">{formatCurrency(lucroUnItem)}</td>
                                    <td className="py-1.5 px-1 text-right text-green-600 font-medium">{margemItem.toFixed(2)}%</td>
                                    <td className="py-1.5 px-1 text-right font-bold text-brand-primary">{formatCurrency(vendaTotalItem)}</td>
                                    <td className="py-1.5 px-1 text-right font-bold text-green-600">{formatCurrency(lucroTotalItem)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        {(() => {
                            let totalCusto = 0;
                            let totalFrete = 0;
                            let totalImpostos = 0;
                            let totalDespAdm = 0;
                            let totalComissao = 0;
                            let totalVenda = 0;
                            let totalLucro = 0;

                            kitData.item_summaries?.forEach((item: any) => {
                                const originalItem = kitData.items?.find((i: any) => i.id === item.id);
                                const quantidade = originalItem?.quantidade_no_kit || 1;
                                const custoTotalItem = Number(item.custo_total_item_no_kit || 0);
                                const vendaTotalItem = Number(item.venda_total_item || 0);

                                const shareFaturamento = faturamentoProdutos > 0 ? (vendaTotalItem / faturamentoProdutos) : 0;

                                const impostosItem = item.imposto_venda_item != null ? Number(item.imposto_venda_item) : (impostoVendaEquipamentos * shareFaturamento);
                                const despAdmItem = item.desp_adm_item != null ? Number(item.desp_adm_item) : (despesaAdministrativaValor * shareFaturamento);
                                const freteItem = item.frete_venda_item != null ? Number(item.frete_venda_item) : (freteVenda * shareFaturamento);
                                const comissaoItem = item.comissao_item != null ? Number(item.comissao_item) : (comissaoValor * shareFaturamento);

                                let icmsAbatidoItem = item.icms_abatido_total != null ? Number(item.icms_abatido_total) : (Number(item.icms_abatido || 0) * quantidade);
                                if (icmsAbatidoItem === 0 && creditoIcms > 0 && custoAquisicao > 0) {
                                    icmsAbatidoItem = (custoTotalItem / custoAquisicao) * creditoIcms;
                                }

                                const impostoLiquidoTotal = impostosItem - icmsAbatidoItem;

                                // Recalcula o total com base no Unitário * Qtd para garantir exatidão
                                const freteUnItem = quantidade > 0 ? freteItem / quantidade : 0;
                                const impostosUnItem = quantidade > 0 ? impostoLiquidoTotal / quantidade : 0;
                                const despAdmUnItem = quantidade > 0 ? despAdmItem / quantidade : 0;
                                const comissaoUnItem = quantidade > 0 ? comissaoItem / quantidade : 0;

                                const custoUnItem = quantidade > 0 ? custoTotalItem / quantidade : 0;
                                const vendaUnItem = quantidade > 0 ? vendaTotalItem / quantidade : 0;

                                const lucroUnItem = vendaUnItem - custoUnItem - freteUnItem - impostosUnItem - despAdmUnItem - comissaoUnItem;
                                const lucroTotalItem = lucroUnItem * quantidade;

                                totalCusto += custoTotalItem;
                                totalFrete += (freteUnItem * quantidade);
                                totalImpostos += (impostosUnItem * quantidade);
                                totalDespAdm += (despAdmUnItem * quantidade);
                                totalComissao += (comissaoUnItem * quantidade);
                                totalVenda += vendaTotalItem;
                                totalLucro += lucroTotalItem;
                            });

                            return (
                                <tr className="bg-slate-50 border-y border-gray-300 font-bold">
                                    <td colSpan={3} className="py-2 px-1 text-right text-slate-400 uppercase">Totais (Equip.):</td>
                                    <td className="py-2 px-1 text-right text-slate-800">{formatCurrency(totalCusto)}</td>
                                    <td></td>
                                    <td></td>
                                    <td className="py-2 px-1 text-right text-slate-800">{formatCurrency(totalFrete)}</td>
                                    <td className="py-2 px-1 text-right text-slate-800">{formatCurrency(totalImpostos)}</td>
                                    <td className="py-2 px-1 text-right text-slate-800">{formatCurrency(totalDespAdm)}</td>
                                    <td className="py-2 px-1 text-right text-slate-800">{formatCurrency(totalComissao)}</td>
                                    <td></td>
                                    <td></td>
                                    <td className="py-2 px-1 text-right text-brand-primary">{formatCurrency(totalVenda)}</td>
                                    <td className="py-2 px-1 text-right text-green-600">{formatCurrency(totalLucro)}</td>
                                </tr>
                            );
                        })()}
                    </tfoot>
                </table>
            </div>

            {/* Seção 2.1 e 2.2: Impostos da Operação */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">2.1. Acréscimos de Compra</h4>
                    <div className="border border-slate-100 rounded-md overflow-hidden bg-red-50/30">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="py-2 px-3 font-medium text-slate-600">Tipo</th>
                                    <th className="py-2 px-3 font-medium text-slate-600 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {taxesAggregation.ipi > 0 && (
                                    <tr>
                                        <td className="py-2 px-3 text-slate-600">IPI Incidente</td>
                                        <td className="py-2 px-3 text-right text-red-600 font-medium">{formatCurrency(taxesAggregation.ipi)}</td>
                                    </tr>
                                )}
                                {taxesAggregation.frete > 0 && (
                                    <tr>
                                        <td className="py-2 px-3 text-slate-600">Frete CIF</td>
                                        <td className="py-2 px-3 text-right text-red-600 font-medium">{formatCurrency(taxesAggregation.frete)}</td>
                                    </tr>
                                )}
                                {taxesAggregation.icms_st > 0 && (
                                    <tr>
                                        <td className="py-2 px-3 text-slate-600">ICMS ST</td>
                                        <td className="py-2 px-3 text-right text-red-600 font-medium">{formatCurrency(taxesAggregation.icms_st)}</td>
                                    </tr>
                                )}
                                {taxesAggregation.icmsAbatido > 0 && (
                                    <tr>
                                        <td className="py-2 px-3 text-slate-600 text-[10px]">(ICMS Abatido no Custo)</td>
                                        <td className="py-2 px-3 text-right text-green-600 font-medium text-[10px]">- {formatCurrency(taxesAggregation.icmsAbatido)}</td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-red-100 font-bold border-t border-red-200">
                                <tr>
                                    <td className="py-2 px-3 text-red-900 text-right">Total Acréscimos:</td>
                                    <td className="py-2 px-3 text-right text-red-900">{formatCurrency(acréscimosCompra)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div>
                    <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">2.2. Impostos de Venda / Desp. Administrativa (Saída)</h4>
                    <div className="border border-slate-100 rounded-md overflow-hidden bg-white shadow-sm flex flex-col">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="py-2 px-3 font-semibold text-slate-500">Incidência</th>
                                    <th className="py-2 px-3 font-semibold text-slate-500 text-right">%</th>
                                    <th className="py-2 px-3 font-semibold text-slate-500 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {(() => {
                                    const baseCalc = faturamentoProdutos;
                                    const creditoIcms = taxesAggregation.icmsAbatido > 0 ? taxesAggregation.icmsAbatido : (Number(kitData.summary?.credito_icms_compra_total) || 0);

                                    const saleTaxesAndExpenses = [
                                        { nome: 'PIS', perc: Number(kitData.aliq_pis || 0), val: baseCalc * (Number(kitData.aliq_pis || 0) / 100) },
                                        { nome: 'COFINS', perc: Number(kitData.aliq_cofins || 0), val: baseCalc * (Number(kitData.aliq_cofins || 0) / 100) },
                                        { nome: 'CSLL', perc: Number(kitData.aliq_csll || 0), val: baseCalc * (Number(kitData.aliq_csll || 0) / 100) },
                                        { nome: 'IRPJ', perc: Number(kitData.aliq_irpj || 0), val: baseCalc * (Number(kitData.aliq_irpj || 0) / 100) },
                                        { nome: 'ICMS', perc: Number(kitData.aliq_icms || 0), val: baseCalc * (Number(kitData.aliq_icms || 0) / 100) },
                                        { nome: 'ISS', perc: Number(kitData.aliq_iss || 0), val: baseCalc * (Number(kitData.aliq_iss || 0) / 100) },
                                        { nome: 'Desp. Administrativa', perc: percDespesasAdm, val: baseCalc * (percDespesasAdm / 100) }
                                    ].filter(t => t.perc > 0);

                                    const totalImpostosEDespesas = saleTaxesAndExpenses.reduce((sum, t) => sum + t.val, 0);

                                    if (saleTaxesAndExpenses.length === 0) {
                                        return (
                                            <>
                                                <tr>
                                                    <td className="py-2 px-3 text-slate-600">Impostos / Despesas</td>
                                                    <td className="py-2 px-3 text-right text-slate-500">{Number(kitData.perc_impostos_total || 0).toFixed(2)}%</td>
                                                    <td className="py-2 px-3 text-right font-medium text-red-600">{formatCurrency(impostoVendaEquipamentos + despesaAdministrativaValor)}</td>
                                                </tr>
                                                {creditoIcms > 0 && (
                                                    <tr className="bg-green-50/50">
                                                        <td className="py-2 px-3 text-green-700">Crédito de ICMS (Compra)</td>
                                                        <td className="py-2 px-3 text-right text-green-600">-</td>
                                                        <td className="py-2 px-3 text-right font-medium text-green-600">- {formatCurrency(creditoIcms)}</td>
                                                    </tr>
                                                )}
                                                <tr className="bg-slate-50 font-bold border-t border-slate-100">
                                                    <td className="py-2 px-3 text-gray-800 text-right" colSpan={2}>Total Incidentes + Despesas:</td>
                                                    <td className="py-2 px-3 text-right text-red-700">{formatCurrency(impostoVendaEquipamentos + despesaAdministrativaValor - creditoIcms)}</td>
                                                </tr>
                                            </>
                                        );
                                    }

                                    return (
                                        <>
                                            {saleTaxesAndExpenses.map((tax: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td className="py-2 px-3 text-slate-600">{tax.nome}</td>
                                                    <td className="py-2 px-3 text-right text-slate-500">{tax.perc.toFixed(2)}%</td>
                                                    <td className="py-2 px-3 text-right font-medium text-red-600">{formatCurrency(tax.val)}</td>
                                                </tr>
                                            ))}
                                            {creditoIcms > 0 && (
                                                <tr className="bg-green-50/50">
                                                    <td className="py-2 px-3 text-green-700">Crédito de ICMS (Compra)</td>
                                                    <td className="py-2 px-3 text-right text-green-600">-</td>
                                                    <td className="py-2 px-3 text-right font-medium text-green-600">- {formatCurrency(creditoIcms)}</td>
                                                </tr>
                                            )}
                                            <tr className="bg-slate-50 font-bold border-t border-slate-100">
                                                <td className="py-2 px-3 text-gray-800 text-right" colSpan={2}>Total Incidentes + Despesas:</td>
                                                <td className="py-2 px-3 text-right text-red-700">{formatCurrency(totalImpostosEDespesas - creditoIcms)}</td>
                                            </tr>
                                        </>
                                    );
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Seção 3: Fornecedores */}
            <div className="mb-6">
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">3. Fornecedores</h4>
                <div className="border border-slate-100 rounded-md overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left text-[10px] border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-y border-slate-200">
                                <th className="py-1.5 px-3 font-medium text-slate-600 w-1/2">Fornecedor</th>
                                <th className="py-1.5 px-3 font-medium text-slate-600 text-right">Valor Total de Custo</th>
                                <th className="py-1.5 px-3 font-medium text-slate-600 text-right">%</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {supplierCosts.map((sup, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="py-1.5 px-3 text-slate-800">{sup.fornecedor}</td>
                                    <td className="py-1.5 px-3 text-right text-slate-500 font-medium">{formatCurrency(sup.custo)}</td>
                                    <td className="py-1.5 px-3 text-right text-slate-400">{sup.perc.toFixed(2)}%</td>
                                </tr>
                            ))}
                            {supplierCosts.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-3 text-center text-slate-400 italic">Nenhum dado de fornecedor encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                        {supplierCosts.length > 0 && (
                            <tfoot>
                                <tr className="bg-slate-50 border-y border-gray-300 font-bold">
                                    <td className="py-2 px-3 text-right text-slate-600">Total:</td>
                                    <td className="py-2 px-3 text-right text-slate-800">{formatCurrency(supplierCosts.reduce((a, b) => a + b.custo, 0))}</td>
                                    <td className="py-2 px-3 text-right text-slate-800">100.00%</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Seção 4: Custos Operacionais e Comissionamento */}
            <div className="grid grid-cols-2 gap-8 mb-6">
                {(operacionaisRows.length > 0 || kitData.havera_manutencao) && (
                    <div>
                        <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">4.1. Custos Operacionais (Ao Longo do Contrato)</h4>
                        <table className="w-full text-left text-[10px] border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-y border-slate-200">
                                    <th className="py-1 px-2 font-medium text-slate-600">Descrição</th>
                                    <th className="py-1 px-2 font-medium text-slate-600 text-right">Custo Mensal</th>
                                    <th className="py-1 px-2 font-medium text-slate-600 text-right">Total ({prazo} Meses)</th>
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
                                        <td className="py-1.5 px-2 text-right text-slate-600" colSpan={2}>Total Custos Operacionais:</td>
                                        <td className="py-1.5 px-2 text-right text-brand-primary">{formatCurrency(custosOperacionaisTotais)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}

                {comissaoPerc > 0 && (
                    <div>
                        <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">4.2. Comissionamento</h4>
                        <div className="bg-white border border-slate-100 rounded-md p-3 flex flex-col items-center">
                            <div className="w-full bg-slate-50 border border-slate-100 rounded p-2.5 text-[10px] font-mono text-slate-500 shadow-sm">
                                <p className="font-bold text-gray-800 border-b border-slate-100 pb-1.5 mb-1.5 uppercase text-[9px]">Memória de Cálculo (Comissão)</p>

                                <div className="flex justify-between py-0.5">
                                    <span>Faturamento Base de Venda</span>
                                    <span>{formatCurrency(faturamentoProdutos)}</span>
                                </div>
                                <div className="flex justify-between py-0.5 text-brand-primary">
                                    <span>(×) % de Comissionamento</span>
                                    <span>{comissaoPerc.toFixed(2)}%</span>
                                </div>

                                <div className="flex justify-between py-1 bg-white px-2 rounded border border-slate-100 font-bold text-brand-primary mt-1.5">
                                    <span>(=) Comissão Final</span>
                                    <span>{formatCurrency(comissaoValor)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Seção 5: Formação do Preço */}
            <div className="mt-2 break-inside-avoid border border-slate-100 rounded-md overflow-hidden bg-white shadow-sm">
                <div className="bg-brand-primary/5 px-2 py-1.5 border-b border-slate-100">
                    <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">
                        5. Detalhamento de Formação do Preço (Markup)
                    </h4>
                </div>
                <div className="p-2">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Fórmula Bottom-Up */}
                        <div className="border border-slate-100 rounded-md bg-slate-50 p-2 flex flex-col">
                            <h5 className="text-[10px] font-bold text-slate-600 uppercase mb-2 border-b border-slate-100 pb-1">Composição do Markup Divisor</h5>

                            <div className="space-y-1 text-[10px] flex-1 font-mono">
                                <div className="flex justify-between"><span className="text-slate-500">Base</span><span className="font-medium">100.00%</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">(-) Impostos</span><span className="font-medium text-red-600">{Number(kitData.perc_impostos_total || 0).toFixed(2)}%</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">(-) Despesas Administrativas</span><span className="font-medium text-red-600">{percDespesasAdm.toFixed(2)}%</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">(-) Frete de Venda</span><span className="font-medium text-red-600">{Number(kitData.perc_frete_venda || 0).toFixed(2)}%</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">(-) Comissão</span><span className="font-medium text-red-600">{Number(kitData.perc_comissao || 0).toFixed(2)}%</span></div>
                                <div className="flex justify-between border-t border-dashed border-gray-300 pt-1 mt-1"><span className="text-slate-500">(=) Fator Resumo (sem margem)</span><span className="font-medium">{(100 - Number(kitData.perc_impostos_total || 0) - percDespesasAdm - Number(kitData.perc_frete_venda || 0) - Number(kitData.perc_comissao || 0)).toFixed(2)}%</span></div>
                            </div>
                        </div>

                        {/* Conta de Lucro (Top-Down) */}
                        <div className="border border-slate-100 rounded-md bg-white p-2 flex flex-col shadow-sm">
                            <h5 className="text-[10px] font-bold text-slate-600 uppercase mb-2 border-b border-slate-100 pb-1">Demonstrativo de Resultado da Venda (DRE)</h5>
                            <div className="space-y-1 text-[10px] flex-1">
                                <div className="flex justify-between font-bold text-gray-800"><span className="">Faturamento Bruto:</span><span className="text-brand-primary">{formatCurrency(faturamentoProdutos)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">(-) Custo Aquisição Total:</span><span className="font-medium text-red-600">-{formatCurrency(custoAquisicaoComAcrescimos)}</span></div>
                                {creditoIcms > 0 && <div className="flex justify-between"><span className="text-slate-400">(+) Crédito ICMS (Compra):</span><span className="font-medium text-green-600">+{formatCurrency(creditoIcms)}</span></div>}
                                <div className="flex justify-between"><span className="text-slate-400">(-) Impostos de Venda:</span><span className="font-medium text-red-600">-{formatCurrency(impostoVendaEquipamentos)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">(-) Despesas Administrativas:</span><span className="font-medium text-red-600">-{formatCurrency(despesaAdministrativaValor)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">(-) Frete de Venda:</span><span className="font-medium text-red-600">-{formatCurrency(freteVenda)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">(-) Comissões:</span><span className="font-medium text-red-600">-{formatCurrency(comissaoValor)}</span></div>
                            </div>
                            <div className="flex justify-between mt-2 pt-2 border-t-2 border-slate-100 font-bold text-[11px] bg-green-50 p-1 rounded">
                                <span className="text-gray-800">Lucro Líquido Final:</span>
                                <span className="text-green-700">{formatCurrency(lucroTotal)}</span>
                            </div>
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
