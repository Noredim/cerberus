import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, ChevronLeft, Loader2, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ReportLogo = ({ url }: { url?: string | null }) => {
    const [error, setError] = useState(false);
    
    if (!url || error) {
        return (
            <div className="h-12 w-12 bg-gray-100 rounded flex items-center justify-center font-bold text-gray-400">
                LOGO
            </div>
        );
    }
    
    const fullUrl = url.startsWith('http') ? url : `${api.defaults.baseURL || 'http://localhost:8000'}${url}`;
    
    return (
        <img 
            src={fullUrl} 
            alt="Logo" 
            className="h-12 object-contain"
            onError={() => setError(true)}
        />
    );
};

const KitAnalyticReport: React.FC = () => {
    const navigate = useNavigate();
    const { userCompanies, activeCompanyId } = useAuth();
    const [kits, setKits] = useState<any[]>([]);
    const [selectedKitId, setSelectedKitId] = useState<string>('');
    const [kitData, setKitData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [policies, setPolicies] = useState<any[]>([]);
    
    const activeCompany = useMemo(() => {
        return userCompanies.find(c => c.company_id === activeCompanyId);
    }, [userCompanies, activeCompanyId]);

    useEffect(() => {
        const fetchPolicies = async () => {
            if (!activeCompanyId) return;
            try {
                const response = await api.get('/companies/commercial-policies/me');
                setPolicies(response.data);
            } catch (err) {
                console.error("Erro ao buscar politicas", err);
            }
        };
        fetchPolicies();
    }, [activeCompanyId]);

    // Fetch available kits for dropdown
    useEffect(() => {
        const fetchKits = async () => {
            if (!activeCompanyId) return;
            try {
                const response = await api.get(`/opportunity-kits/company/${activeCompanyId}`);
                setKits(response.data);
            } catch (error) {
                console.error('Failed to fetch opportunity kits:', error);
            }
        };
        fetchKits();
    }, [activeCompanyId]);

    // Fetch specific kit details when selected
    useEffect(() => {
        if (!selectedKitId) {
            setKitData(null);
            return;
        }
        
        const fetchKitDetails = async () => {
            setLoading(true);
            try {
                const response = await api.get(`/opportunity-kits/${selectedKitId}`);
                setKitData(response.data);
            } catch (error) {
                console.error('Failed to fetch kit details:', error);
            } finally {
                setLoading(false);
            }
        };
        
        fetchKitDetails();
    }, [selectedKitId]);

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (value: number | string | undefined) => {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0);
    };
    
    const formatPercent = (value: number | string | undefined) => {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);
    };

    const suppliersAggregation = React.useMemo(() => {
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

    const taxesAggregation = React.useMemo(() => {
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
        
        // Fallback for difal if item-level is 0 but kit has it.
        if (difal === 0 && Number(kitData.summary?.total_difal_kit) > 0) {
            difal = Number(kitData.summary?.total_difal_kit);
        }
        
        return { ipi, frete, difal };
    }, [kitData]);

    const operacionaisRows = React.useMemo(() => {
        if (!kitData) return [];
        const rows = [];
        const prazo = kitData.prazo_contrato_meses || 1;
        
        // Monitoramento
        if (Number(kitData.custo_monitoramento_unitario) > 0) {
            const val = Number(kitData.custo_monitoramento_unitario);
            rows.push({
                nome: 'Monitoramento',
                unitario: val,
                total: val * prazo
            });
        }
        
        // Bloco 7 (monthly_costs)
        if (kitData.monthly_costs && kitData.monthly_costs.length > 0) {
            kitData.monthly_costs.forEach((cost: any) => {
                const unit = (Number(cost.valor_unitario) || 0) * (Number(cost.quantidade) || 1);
                if (unit > 0) {
                    rows.push({
                        nome: cost.servico || cost.tipo_custo,
                        unitario: unit,
                        total: unit * prazo
                    });
                }
            });
        }
        
        return rows;
    }, [kitData]);

    const taxData = React.useMemo(() => {
        if (!kitData) return null;
        
        const instalBase = Number(kitData.summary?.vlr_instal_calc) || 0;
        const locBase = Number(kitData.summary?.valor_mensal_locacao_base) || 0;
        const manutBase = Number(kitData.summary?.vlt_manut) || 0;
        const monBase = Number(kitData.summary?.venda_unit_monitoramento) || 0;
        const prazo = kitData.prazo_contrato_meses || 1;

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

        // Matrix for 5.5
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
    }, [kitData]);

    if (!activeCompany) {
        return <div className="p-8">Selecione uma empresa primeiro.</div>;
    }

    return (
        <div className="w-full bg-surface min-h-screen pb-10 print:bg-white print:p-0">
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 10mm; }
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    table, tr, tbody, thead, tfoot, .break-inside-avoid {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    * {
                        /* Slight reduction in print to fit A4 portrait comfortably */
                        font-size: 0.98em;
                    }
                }
            `}</style>
            {/* Header / Topbar - Hidden in Print */}
            <div className="flex items-center justify-between p-6 border-b border-border-subtle bg-surface print:hidden sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-bg-deep rounded-md text-text-muted transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-text-primary">Relatório: Kit Analítico</h1>
                        <p className="text-sm text-text-muted">Gere um documento PDF com a viabilidade executiva de um kit de oportunidade.</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <select
                        value={selectedKitId}
                        onChange={(e) => setSelectedKitId(e.target.value)}
                        className="bg-bg-deep border border-border-subtle text-text-primary rounded-md py-2 px-4 outline-none focus:border-brand-primary min-w-[300px]"
                    >
                        <option value="">-- Selecione um Kit de Oportunidade --</option>
                        {kits.map(k => (
                            <option key={k.id} value={k.id}>
                                {k.nome_kit || `Kit #${k.id.split('-')[0]}`} ({k.tipo_contrato})
                            </option>
                        ))}
                    </select>
                    
                    <button 
                        onClick={handlePrint}
                        disabled={!kitData || loading}
                        className="flex items-center gap-2 bg-brand-primary text-white px-5 py-2 rounded-md font-medium hover:bg-brand-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <Printer className="w-5 h-5" />
                        Imprimir / Salvar PDF
                    </button>
                </div>
            </div>

            {loading && (
                <div className="flex flex-col items-center justify-center py-32 text-brand-primary">
                    <Loader2 className="w-10 h-10 animate-spin mb-4" />
                    <p className="text-text-muted font-medium">Buscando inteligência financeira do kit...</p>
                </div>
            )}
            
            {!loading && !kitData && selectedKitId && (
                <div className="flex flex-col items-center justify-center py-32 text-brand-danger">
                    <AlertTriangle className="w-10 h-10 mb-4" />
                    <p className="font-medium">Falha ao carregar os dados deste kit.</p>
                </div>
            )}
            
            {!loading && !kitData && !selectedKitId && (
                <div className="flex flex-col items-center justify-center py-32 text-text-muted">
                    <FileText className="w-16 h-16 mb-4 opacity-20" />
                    <p className="font-medium text-lg">Selecione um Kit acima para gerar o relatório.</p>
                </div>
            )}

            {!loading && kitData && (() => {
                const isRental = kitData.tipo_contrato === 'LOCACAO' || kitData.tipo_contrato === 'COMODATO';
                const prazo = kitData.prazo_contrato_meses || 1;
                
                const faturamentoTotal = isRental 
                    ? (Number(kitData.summary?.valor_mensal_kit) || 0) * prazo 
                    : (Number(kitData.summary?.faturamento_total_venda) || 0);
                
                const investimentoTotal = isRental
                    ? (Number(kitData.summary?.custo_aquisicao_total) || 0) + (Number(kitData.summary?.valor_comissao_locacao) || 0)
                    : (Number(kitData.summary?.custo_aquisicao_total) || 0);
                    
                const impostoMensal = isRental ? (Number(kitData.summary?.valor_impostos) || 0) : 0;
                const impostoInstalacao = Number(kitData.summary?.imposto_instalacao) || 0;
                const impostosTotais = isRental ? ((impostoMensal * prazo) + impostoInstalacao) : ((Number(kitData.summary?.imposto_equip_venda) || 0) + impostoInstalacao);

                const comissaoValor = Number(kitData.summary?.valor_comissao_locacao) || Number(kitData.summary?.vlt_comissao) || 0;
                const comissaoPerc = Number(kitData.perc_comissao) || 0;

                const custoAquisicao = Number(kitData.summary?.custo_aquisicao_total) || 0;
                
                const block7TotalUnit = (kitData.monthly_costs || []).reduce((acc: number, cost: any) => acc + ((Number(cost.valor_unitario) || 0) * (Number(cost.quantidade) || 1)), 0);
                const custoOperacionalMensal = block7TotalUnit + (Number(kitData.custo_monitoramento_unitario) || 0);
                const custosOperacionaisTotais = isRental ? custoOperacionalMensal * prazo : 0;
                
                const custosTotais = custoAquisicao + impostosTotais + comissaoValor + custosOperacionaisTotais;
                
                const lucroTotal = faturamentoTotal - custosTotais;
                const margemLucro = faturamentoTotal > 0 ? lucroTotal / faturamentoTotal : 0;

                const fatorAplicado = isRental ? Number(kitData.fator_margem_locacao) : Number(kitData.fator_margem_servicos_produtos);
                const activePolicy = policies
                    .filter((p: any) => Number(p.fator_limite) <= fatorAplicado + 0.00001)
                    .sort((a: any, b: any) => Number(b.fator_limite) - Number(a.fator_limite))[0];
                const politicaVenda = activePolicy?.nome_politica || 'Padrão';

                return (
                <div className="max-w-[297mm] mx-auto bg-white text-black p-8 print:p-0 print:m-0 print:shadow-none shadow-lg mt-8 rounded-lg overflow-hidden border border-gray-200 text-xs">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between border-b-2 border-brand-primary pb-4 mb-6">
                        <div className="flex items-center gap-4">
                            <ReportLogo url={activeCompany.company_logo_url} />
                            <div className="flex flex-col">
                                <span className="font-bold text-lg text-gray-900 uppercase tracking-tight">{activeCompany.company_name}</span>
                                <span className="text-xs text-gray-500 font-mono">CNPJ: {activeCompany.company_cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") || 'N/A'}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold text-brand-primary uppercase">Kit Analítico</h2>
                            <p className="text-xs text-gray-500 mt-1">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
                        </div>
                    </div>

                    {/* Identificação do Kit */}
                    <div className="bg-gray-50 border border-gray-200 p-2 rounded-md mb-4">
                        <h3 className="text-lg font-bold text-gray-900">{kitData.nome_kit || 'Kit Sem Nome'}</h3>
                        {kitData.descricao_kit && (
                            <p className="text-xs text-gray-600 mt-0.5 mb-1.5">{kitData.descricao_kit}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm font-semibold uppercase tracking-wider text-brand-primary border border-brand-primary/30 bg-brand-primary/5 px-2 py-0.5 rounded">
                                {kitData.tipo_contrato}
                            </span>
                            <span className="text-gray-400">|</span>
                            <span className="text-sm font-semibold text-gray-700">{kitData.prazo_contrato_meses} Meses</span>
                            {kitData.margem_fator && (
                                <>
                                    <span className="text-gray-400">|</span>
                                    <span className="text-sm text-gray-600">Fator Aplicado: {kitData.margem_fator}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Seção 1: Consolidação */}
                    <div className="mb-4">
                        <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">1. Resumo Financeiro (Consolidação)</h4>
                        
                        <div className="mb-3">
                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 border-b border-gray-100 pb-1">1.1 Parâmetros</h5>
                            <div className="grid grid-cols-6 gap-2">
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Política de Venda">Política Venda</p>
                                    <p className="text-[10px] font-bold text-gray-900 mt-1 uppercase truncate">{politicaVenda}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Fator Margem">Fator Margem</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{kitData.tipo_contrato === 'VENDA_DIRETA' ? kitData.fator_margem_servicos_produtos : kitData.fator_margem_locacao}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Fator Monitoramento">Fator Monitoram.</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{kitData.fator_monitoramento || 'N/A'}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="% de Comissão">% Comissão</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{Number(comissaoPerc || 0).toFixed(2)}%</p>
                                </div>
                                {kitData.instalacao_inclusa && (
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="% de Instalação">% Instalação</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{Number(kitData.percentual_instalacao || 0).toFixed(2)}%</p>
                                </div>
                                )}
                                {kitData.manutencao_inclusa && (
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Taxa Manutenção a.a">Taxa Manut. a.a</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{Number(kitData.taxa_manutencao_anual || 0).toFixed(2)}%</p>
                                </div>
                                )}
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Taxa Juros a.m">Taxa Juros a.m</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{Number(kitData.taxa_juros_mensal || 0).toFixed(2)}%</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Taxa de Locação">Tx Loc</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{((Number(kitData.summary?.tx_locacao) || 0) * 100).toFixed(4)}%</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Taxa de Manutenção a.m">Tx Manut</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{((Number(kitData.taxa_manutencao_anual) || 0) / 12).toFixed(4)}%</p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-2">
                            <h5 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 border-b border-gray-100 pb-1">1.2 Valores</h5>
                            <div className="grid grid-cols-5 gap-2">
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Valor Instalação">Val. Instalação</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{formatCurrency(kitData.summary?.vlr_instal_calc || 0)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Locação Mensal">Locação Mensal</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{formatCurrency(kitData.summary?.valor_mensal_locacao_base || 0)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Valor Manutenção">Val. Manutenção</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{formatCurrency(kitData.summary?.vlt_manut || 0)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Valor Monitoramento">Val. Monitoram.</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{formatCurrency(kitData.summary?.venda_unit_monitoramento || 0)}</p>
                                </div>
                                <div className="bg-green-500/5 border border-green-500/20 p-1.5 rounded-md">
                                    <p className="text-[7px] text-green-700 font-bold uppercase leading-tight" title="Faturamento Mensal">Faturam. (Mês)</p>
                                    <p className="text-xs font-bold text-green-700 mt-0.5">{formatCurrency(kitData.summary?.valor_mensal_kit || 0)}</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h5 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 border-b border-gray-100 pb-1">1.3 Fechamento</h5>
                            <div className="grid grid-cols-6 gap-2">
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Custo de Aquisição">Custo Aquisição</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{formatCurrency(custoAquisicao)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Custos Operacionais">Custos Operacionais</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{formatCurrency(custosOperacionaisTotais)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Comissão">Comissão</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5 flex items-end gap-1">
                                        {formatCurrency(comissaoValor)}
                                    </p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Impostos Instalação">Imp. Instalação</p>
                                    <p className="text-xs font-bold text-red-600 mt-0.5">{formatCurrency(impostoInstalacao)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Impostos Mensais">Imp. Mensais</p>
                                    <p className="text-xs font-bold text-red-600 mt-0.5">{formatCurrency(impostoMensal)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Impostos Totais">Imp. Totais</p>
                                    <p className="text-xs font-bold text-red-700 mt-0.5">{formatCurrency(impostosTotais)}</p>
                                </div>
                                <div className="bg-orange-500/5 border border-orange-500/20 p-1.5 rounded-md">
                                    <p className="text-[7px] text-orange-700 font-bold uppercase leading-tight" title="Custos Totais">Custos Totais</p>
                                    <p className="text-xs font-bold text-orange-700 mt-0.5">{formatCurrency(custosTotais)}</p>
                                </div>

                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Faturamento Total">Faturam. Total</p>
                                    <p className="text-xs font-bold text-brand-primary mt-0.5">{formatCurrency(faturamentoTotal)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-md">
                                    <p className="text-[7px] text-gray-500 font-bold uppercase leading-tight" title="Lucro Estimado">Lucro Estimado</p>
                                    <p className="text-xs font-bold text-green-600 mt-0.5">{formatCurrency(lucroTotal)}</p>
                                </div>
                                <div className="bg-brand-primary/5 border border-brand-primary/20 p-1.5 rounded-md">
                                    <p className="text-[7px] text-brand-primary font-bold uppercase leading-tight" title="Margem Geral">Margem</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{formatPercent(margemLucro)}</p>
                                </div>
                                <div className="bg-brand-primary/5 border border-brand-primary/20 p-1.5 rounded-md">
                                    <p className="text-[7px] text-brand-primary font-bold uppercase leading-tight" title="ROI (Meses)">ROI</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{kitData.summary?.roi_meses?.toFixed(1)} m</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Seção 2: Equipamentos + Serviços */}
                    <div className="mb-6">
                        <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">2. Composição de Itens (Equipamentos & Serviços)</h4>
                        <table className="w-full text-left text-[9px] border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-y border-gray-300">
                                    <th className="py-1 px-1.5 font-semibold text-gray-700 w-1/3">Produto / Serviço</th>
                                    <th className="py-1 px-1.5 font-semibold text-gray-700 w-1/4">Fornecedor</th>
                                    <th className="py-1 px-1.5 font-semibold text-gray-700 text-center">Qtd</th>
                                    <th className="py-1 px-1.5 font-semibold text-gray-700 text-right">Custo Base</th>
                                    <th className="py-1 px-1.5 font-semibold text-gray-700 text-right">Difal</th>
                                    <th className="py-1 px-1.5 font-semibold text-gray-700 text-right">Custo Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {kitData.item_summaries?.map((item: any, idx: number) => {
                                    const originalItem = kitData.items?.find((i: any) => i.id === item.id);
                                    
                                    const sku = originalItem?.product?.codigo || '-';
                                    const nomeProduto = originalItem?.product?.nome || originalItem?.own_service?.nome_servico || originalItem?.descricao_item || 'Desconhecido';
                                    
                                    const fornecedorObj = originalItem?.product?.fornecedor_ultimo_preco || originalItem?.product?.suppliers?.[0]?.supplier;
                                    const fornecedor = fornecedorObj?.nome_fantasia || fornecedorObj?.razao_social || '-';
                                    
                                    const quantidade = originalItem?.quantidade_no_kit || 1;
                                    
                                    return (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="py-1 px-1.5 text-gray-900 max-w-[180px] truncate" title={nomeProduto}>
                                            <div className="flex flex-col">
                                                <span className="truncate">{nomeProduto}</span>
                                                <span className="text-[8px] text-gray-500 uppercase mt-0.5 font-mono">SKU: {sku}</span>
                                            </div>
                                        </td>
                                        <td className="py-1 px-1.5 text-gray-600 truncate max-w-[120px]" title={fornecedor}>
                                            {item.tipo_item === 'SERVICO_PROPRIO' ? 'Equipe Interna' : fornecedor}
                                        </td>
                                        <td className="py-1.5 px-1.5 text-center text-gray-900">{quantidade}</td>
                                        <td className="py-1.5 px-1.5 text-right text-gray-600 whitespace-nowrap">{formatCurrency(item.custo_base_unitario_item || 0)}</td>
                                        <td className="py-1.5 px-1.5 text-right text-gray-600 whitespace-nowrap">{formatCurrency(item.difal_total_item || 0)}</td>
                                        <td className="py-1.5 px-1.5 text-right font-medium text-gray-900 whitespace-nowrap">{formatCurrency(item.custo_total_item_no_kit || 0)}</td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-50 border-y border-gray-300 font-bold">
                                    <td colSpan={5} className="py-2 px-2 text-right text-gray-700">Total Equipamentos & Serviços:</td>
                                    <td className="py-2 px-2 text-right text-brand-primary">{formatCurrency(kitData.summary?.custo_aquisicao_total)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Seção 3: Resumos Analíticos */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">2.1. Resumo por Origem/Fornecedor</h4>
                            <div className="border border-gray-200 rounded-md overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="py-2 px-3 font-semibold text-gray-700">Fornecedor</th>
                                            <th className="py-2 px-3 font-semibold text-gray-700 text-right">Custo Total</th>
                                            <th className="py-2 px-3 font-semibold text-gray-700 text-right">% do Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {suppliersAggregation.map((sup, idx) => (
                                            <tr key={idx}>
                                                <td className="py-2 px-3 text-gray-700 max-w-[150px] truncate" title={sup.nome}>{sup.nome}</td>
                                                <td className="py-2 px-3 text-right text-gray-900 font-medium">{formatCurrency(sup.valor)}</td>
                                                <td className="py-2 px-3 text-right text-gray-500 text-[11px]">{formatPercent(sup.perc)}</td>
                                            </tr>
                                        ))}
                                        {suppliersAggregation.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="py-2 px-3 text-center text-gray-500 italic">Nenhum fornecedor encontrado.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot className="bg-gray-100 font-bold border-t border-gray-300">
                                        <tr>
                                            <td className="py-2 px-3 text-gray-800 text-right">Total:</td>
                                            <td className="py-2 px-3 text-right text-gray-900">{formatCurrency(suppliersAggregation.reduce((acc, sup) => acc + sup.valor, 0))}</td>
                                            <td className="py-2 px-3 text-right text-gray-900">{formatPercent(suppliersAggregation.reduce((acc, sup) => acc + sup.perc, 0))}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">2.2. Impostos e Acréscimos (Aquisição)</h4>
                            <div className="border border-gray-200 rounded-md overflow-hidden bg-red-50/30">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="py-2 px-3 font-semibold text-gray-700">Tipo</th>
                                            <th className="py-2 px-3 font-semibold text-gray-700 text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        <tr>
                                            <td className="py-2 px-3 text-gray-700">Total IPI</td>
                                            <td className="py-2 px-3 text-right text-red-600 font-medium">{formatCurrency(taxesAggregation.ipi)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-3 text-gray-700">Total Frete</td>
                                            <td className="py-2 px-3 text-right text-red-600 font-medium">{formatCurrency(taxesAggregation.frete)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-3 text-gray-700">DIFAL</td>
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
                    {kitData.modalidade !== 'VENDA_DIRETA' && (
                        <div>
                            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">2.3. Retorno e Viabilidade (Equipamento)</h4>
                            <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-md p-3 flex flex-col items-center">
                                <div className="text-center mb-3">
                                    <p className="text-[10px] font-semibold text-gray-500 uppercase">ROI de Equipamento Previsto</p>
                                    <p className="text-3xl font-black text-brand-primary leading-none mt-1">
                                        {kitData.summary?.roi_equipamento_meses?.toFixed(2) || 'N/A'} <span className="text-base font-bold text-gray-500">Meses</span>
                                    </p>
                                </div>
                                
                                <div className="w-full max-w-2xl bg-white border border-gray-200 rounded p-2.5 text-[10px] font-mono text-gray-600 shadow-sm">
                                    <p className="font-bold text-gray-800 border-b border-gray-200 pb-1.5 mb-1.5 uppercase text-[9px]">Memória de Cálculo (Comprovação Matemática)</p>
                                    
                                    <div className="flex justify-between py-0.5">
                                        <span>(+) Custo de Aquisição (Equipamentos)</span>
                                        <span>{formatCurrency(kitData.summary?.custo_aquisicao_total || 0)}</span>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                        <span>(+) Comissão</span>
                                        <span>{formatCurrency(kitData.summary?.valor_comissao_locacao || kitData.summary?.vlt_comissao || 0)}</span>
                                    </div>
                                    <div className="flex justify-between py-0.5 font-bold text-gray-900 border-t border-dashed border-gray-300 mt-1 pt-1">
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
                                    <div className="flex justify-between py-0.5 font-bold text-gray-900 border-t border-dashed border-gray-300 mt-1 pt-1">
                                        <span>(=) Receita Líquida Mensal (B)</span>
                                        <span>{formatCurrency((kitData.summary?.valor_mensal_locacao_base || 0) - (kitData.summary?.imposto_equip_loc || 0))}</span>
                                    </div>
                                    
                                    <div className="h-2"></div>
                                    
                                    <div className="flex justify-between py-1 bg-gray-50 px-2 rounded border border-gray-200 font-bold text-brand-primary">
                                        <span>Cálculo Final: (A) / (B)</span>
                                        <span>{kitData.summary?.roi_equipamento_meses?.toFixed(2)} meses</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Seção 3: Custos Operacionais */}
                    {isRental && (
                        <div className="mb-3 mt-4">
                            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">3. Custos Operacionais</h4>
                            <table className="w-full text-left text-[10px] border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 border-y border-gray-300">
                                        <th className="py-1 px-2 font-semibold text-gray-700">Descrição</th>
                                        <th className="py-1 px-2 font-semibold text-gray-700 text-right">Custo Mensal (Unitário)</th>
                                        <th className="py-1 px-2 font-semibold text-gray-700 text-right">Custo Total ({kitData.prazo_contrato_meses || 1} Meses)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {operacionaisRows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="py-1 px-2 text-gray-900">{row.nome}</td>
                                            <td className="py-1.5 px-2 text-right text-gray-600">{formatCurrency(row.unitario)}</td>
                                            <td className="py-1.5 px-2 text-right font-medium text-gray-900">{formatCurrency(row.total)}</td>
                                        </tr>
                                    ))}
                                    {operacionaisRows.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="py-4 text-center text-gray-500 italic">Nenhum custo operacional cadastrado.</td>
                                        </tr>
                                    )}
                                </tbody>
                                {operacionaisRows.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-50 border-y border-gray-300 font-bold">
                                            <td className="py-1.5 px-2 text-right text-gray-700">Total Custos Operacionais:</td>
                                            <td className="py-1.5 px-2 text-right text-gray-900">{formatCurrency(operacionaisRows.reduce((a, b) => a + b.unitario, 0))}</td>
                                            <td className="py-1.5 px-2 text-right text-brand-primary">{formatCurrency(operacionaisRows.reduce((a, b) => a + b.total, 0))}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}
                    
                    {/* Seção 4: Comissionamento */}
                    {comissaoPerc > 0 && (
                        <div className="mb-3 mt-4">
                            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">4. Comissionamento</h4>
                            <div className="bg-white border border-gray-200 rounded-md p-3 flex flex-col items-center">
                                <div className="w-full max-w-2xl bg-gray-50 border border-gray-200 rounded p-2.5 text-[10px] font-mono text-gray-600 shadow-sm">
                                    <p className="font-bold text-gray-800 border-b border-gray-200 pb-1.5 mb-1.5 uppercase text-[9px]">Memória de Cálculo (Comissão)</p>
                                    
                                    <div className="flex justify-between py-0.5">
                                        <span>Fórmula Base</span>
                                        <span className="text-gray-500 text-[9px]">comissão = (Valor Total Mercadoria × Fator Margem) × % Comissão</span>
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
                                    
                                    <div className="flex justify-between py-1 bg-white px-2 rounded border border-gray-200 font-bold text-brand-primary mt-1.5">
                                        <span>(=) Comissão Final</span>
                                        <span>{formatCurrency((custoAquisicao * fatorAplicado) * (comissaoPerc / 100))}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Seção 5: Impostos */}
                    {isRental && taxData && (
                        <div className="mb-6 mt-8 break-inside-avoid">
                            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">5. Impostos (Serviços e Locação)</h4>
                            
                            <div className="grid grid-cols-2 gap-4">
                                {/* 5.1 Instalação */}
                                {taxData.instalBase > 0 && (
                                <div className="border border-gray-200 rounded-md overflow-hidden bg-white shadow-sm flex flex-col">
                                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                                        <h5 className="text-[10px] font-bold text-gray-700 uppercase">5.1 Instalação</h5>
                                        <span className="text-[10px] font-bold text-gray-900">{formatCurrency(taxData.instalBase)}</span>
                                    </div>
                                    <div className="flex-1">
                                        <table className="w-full text-left text-[10px]">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="py-1.5 px-3 font-semibold text-gray-600">Imposto</th>
                                                    <th className="py-1.5 px-3 font-semibold text-gray-600 text-right">%</th>
                                                    <th className="py-1.5 px-3 font-semibold text-gray-600 text-right">Valor</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {taxData.instalTaxes.map((tax, idx) => (
                                                    <tr key={idx}>
                                                        <td className="py-1.5 px-3 text-gray-700">{tax.nome}</td>
                                                        <td className="py-1.5 px-3 text-right text-gray-600">{tax.perc.toFixed(2)}%</td>
                                                        <td className="py-1.5 px-3 text-right font-medium text-red-600">{formatCurrency(taxData.instalBase * (tax.perc / 100))}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                                                <tr>
                                                    <td className="py-1.5 px-3 text-gray-800 text-right">Total:</td>
                                                    <td className="py-1.5 px-3 text-right text-gray-900">{taxData.instalPercSum.toFixed(2)}%</td>
                                                    <td className="py-1.5 px-3 text-right text-red-700">{formatCurrency(taxData.instalValSum)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                                )}
                                
                                {/* 5.2 Locação */}
                                <div className="border border-gray-200 rounded-md overflow-hidden bg-white shadow-sm flex flex-col">
                                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                                        <h5 className="text-[10px] font-bold text-gray-700 uppercase">5.2 Locação de Equipamento</h5>
                                        <span className="text-[10px] font-bold text-gray-900">{formatCurrency(taxData.locBase)}</span>
                                    </div>
                                    <div className="flex-1">
                                        <table className="w-full text-left text-[10px]">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="py-1.5 px-3 font-semibold text-gray-600">Imposto</th>
                                                    <th className="py-1.5 px-3 font-semibold text-gray-600 text-right">%</th>
                                                    <th className="py-1.5 px-3 font-semibold text-gray-600 text-right">Valor Mensal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {taxData.locTaxes.map((tax, idx) => (
                                                    <tr key={idx}>
                                                        <td className="py-1.5 px-3 text-gray-700">{tax.nome}</td>
                                                        <td className="py-1.5 px-3 text-right text-gray-600">{tax.perc.toFixed(2)}%</td>
                                                        <td className="py-1.5 px-3 text-right font-medium text-red-600">{formatCurrency(taxData.locBase * (tax.perc / 100))}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 font-bold border-t border-gray-200 divide-y divide-gray-200">
                                                <tr>
                                                    <td className="py-1.5 px-3 text-gray-800 text-right">Total (Mensal):</td>
                                                    <td className="py-1.5 px-3 text-right text-gray-900">{taxData.locPercSum.toFixed(2)}%</td>
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
                                <div className="border border-gray-200 rounded-md overflow-hidden bg-white shadow-sm flex flex-col">
                                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                                        <h5 className="text-[10px] font-bold text-gray-700 uppercase">5.3 Manutenção</h5>
                                        <span className="text-[10px] font-bold text-gray-900">{formatCurrency(taxData.manutBase)}</span>
                                    </div>
                                    <div className="flex-1">
                                        <table className="w-full text-left text-[10px]">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="py-1.5 px-3 font-semibold text-gray-600">Imposto</th>
                                                    <th className="py-1.5 px-3 font-semibold text-gray-600 text-right">%</th>
                                                    <th className="py-1.5 px-3 font-semibold text-gray-600 text-right">Valor Mensal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {taxData.manutTaxes.map((tax, idx) => (
                                                    <tr key={idx}>
                                                        <td className="py-1.5 px-3 text-gray-700">{tax.nome}</td>
                                                        <td className="py-1.5 px-3 text-right text-gray-600">{tax.perc.toFixed(2)}%</td>
                                                        <td className="py-1.5 px-3 text-right font-medium text-red-600">{formatCurrency(taxData.manutBase * (tax.perc / 100))}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 font-bold border-t border-gray-200 divide-y divide-gray-200">
                                                <tr>
                                                    <td className="py-1.5 px-3 text-gray-800 text-right">Total (Mensal):</td>
                                                    <td className="py-1.5 px-3 text-right text-gray-900">{taxData.manutPercSum.toFixed(2)}%</td>
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
                                <div className="border border-gray-200 rounded-md overflow-hidden bg-white shadow-sm flex flex-col">
                                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                                        <h5 className="text-[10px] font-bold text-gray-700 uppercase">5.4 Monitoramento</h5>
                                        <span className="text-[10px] font-bold text-gray-900">{formatCurrency(taxData.monBase)}</span>
                                    </div>
                                    <div className="flex-1">
                                        <table className="w-full text-left text-[10px]">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="py-1.5 px-3 font-semibold text-gray-600">Imposto</th>
                                                    <th className="py-1.5 px-3 font-semibold text-gray-600 text-right">%</th>
                                                    <th className="py-1.5 px-3 font-semibold text-gray-600 text-right">Valor Mensal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {taxData.monTaxes.map((tax, idx) => (
                                                    <tr key={idx}>
                                                        <td className="py-1.5 px-3 text-gray-700">{tax.nome}</td>
                                                        <td className="py-1.5 px-3 text-right text-gray-600">{tax.perc.toFixed(2)}%</td>
                                                        <td className="py-1.5 px-3 text-right font-medium text-red-600">{formatCurrency(taxData.monBase * (tax.perc / 100))}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 font-bold border-t border-gray-200 divide-y divide-gray-200">
                                                <tr>
                                                    <td className="py-1.5 px-3 text-gray-800 text-right">Total (Mensal):</td>
                                                    <td className="py-1.5 px-3 text-right text-gray-900">{taxData.monPercSum.toFixed(2)}%</td>
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
                            <div className="mt-6 border border-gray-200 rounded-md overflow-hidden bg-white shadow-sm">
                                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                                    <h5 className="text-[10px] font-bold text-gray-700 uppercase">5.5 Impostos Totais (Ao longo do contrato)</h5>
                                </div>
                                <table className="w-full text-left text-[10px]">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="py-2 px-3 font-semibold text-gray-600">Imposto</th>
                                            <th className="py-2 px-3 font-semibold text-gray-600 text-right">Instalação</th>
                                            <th className="py-2 px-3 font-semibold text-gray-600 text-right">Locação ({taxData.prazo}m)</th>
                                            <th className="py-2 px-3 font-semibold text-gray-600 text-right">Manutenção ({taxData.prazo}m)</th>
                                            <th className="py-2 px-3 font-semibold text-gray-600 text-right">Monitoramento ({taxData.prazo}m)</th>
                                            <th className="py-2 px-3 font-semibold text-red-700 text-right">Total Consolidado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {taxData.matrixTaxes.map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="py-1.5 px-3 font-medium text-gray-700">{row.nome} <span className="text-[9px] text-gray-400 font-normal">({row.perc}%)</span></td>
                                                <td className="py-1.5 px-3 text-right text-gray-600">{row.instal > 0 ? formatCurrency(row.instal) : '-'}</td>
                                                <td className="py-1.5 px-3 text-right text-gray-600">{row.locacao > 0 ? formatCurrency(row.locacao) : '-'}</td>
                                                <td className="py-1.5 px-3 text-right text-gray-600">{row.manutencao > 0 ? formatCurrency(row.manutencao) : '-'}</td>
                                                <td className="py-1.5 px-3 text-right text-gray-600">{row.monitoramento > 0 ? formatCurrency(row.monitoramento) : '-'}</td>
                                                <td className="py-1.5 px-3 text-right font-bold text-red-600 bg-red-50/30">{formatCurrency(row.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 font-bold border-t border-gray-300">
                                        <tr>
                                            <td className="py-2 px-3 text-gray-800">Custo Fiscal Total:</td>
                                            <td className="py-2 px-3 text-right text-gray-900">{formatCurrency(taxData.matrixTotalInstal)}</td>
                                            <td className="py-2 px-3 text-right text-gray-900">{formatCurrency(taxData.matrixTotalLocacao)}</td>
                                            <td className="py-2 px-3 text-right text-gray-900">{formatCurrency(taxData.matrixTotalManut)}</td>
                                            <td className="py-2 px-3 text-right text-gray-900">{formatCurrency(taxData.matrixTotalMon)}</td>
                                            <td className="py-2 px-3 text-right text-red-700 text-[11px] bg-red-100">{formatCurrency(taxData.matrixTotalGeral)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                    
                    <div className="mt-12 text-center text-xs text-gray-400 font-mono border-t border-gray-200 pt-4">
                        Relatório gerado pelo sistema Cerberus. Documento estritamente confidencial.
                    </div>
                </div>
                );
            })()}
        </div>
    );
};

export default KitAnalyticReport;
