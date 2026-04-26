import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, ChevronLeft, Loader2, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

    if (!activeCompany) {
        return <div className="p-8">Selecione uma empresa primeiro.</div>;
    }

    return (
        <div className="w-full bg-surface min-h-screen pb-10 print:bg-white print:p-0">
            <style>{`
                @media print {
                    @page { size: A4 landscape; margin: 10mm; }
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
                
                const custoOperacionalMensal = (Number(kitData.summary?.custo_operacional_mensal_kit) || 0) + (Number(kitData.custo_monitoramento_unitario) || 0);
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
                            {(activeCompany as any).logo_url ? (
                                <img src={(activeCompany as any).logo_url} alt="Logo" className="h-12 object-contain" />
                            ) : (
                                <div className="h-12 w-12 bg-gray-100 rounded flex items-center justify-center font-bold text-gray-400">
                                    LOGO
                                </div>
                            )}
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
                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-md mb-6">
                        <h3 className="text-xl font-bold text-gray-900">{kitData.nome_kit || 'Kit Sem Nome'}</h3>
                        {kitData.descricao_kit && (
                            <p className="text-xs text-gray-600 mt-1 mb-2">{kitData.descricao_kit}</p>
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
                    <div className="mb-6">
                        <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">1. Resumo Financeiro (Consolidação)</h4>
                        
                        <div className="mb-4">
                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 pb-1">1.1 Parâmetros</h5>
                            <div className="grid grid-cols-6 gap-2">
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Política de Venda">Política Venda</p>
                                    <p className="text-[10px] font-bold text-gray-900 mt-1 uppercase truncate">{politicaVenda}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Fator Margem">Fator Margem</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{kitData.tipo_contrato === 'VENDA_DIRETA' ? kitData.fator_margem_servicos_produtos : kitData.fator_margem_locacao}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Fator Monitoramento">Fator Monitoram.</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{kitData.fator_monitoramento || 'N/A'}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="% de Comissão">% Comissão</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{comissaoPerc}%</p>
                                </div>
                                {kitData.instalacao_inclusa && (
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="% de Instalação">% Instalação</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{kitData.percentual_instalacao || 0}%</p>
                                </div>
                                )}
                                {kitData.manutencao_inclusa && (
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Taxa Manutenção a.a">Taxa Manut. a.a</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{Number(kitData.taxa_manutencao_anual || 0).toFixed(2)}%</p>
                                </div>
                                )}
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Taxa Juros a.m">Taxa Juros a.m</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{Number(kitData.taxa_juros_mensal || 0).toFixed(2)}%</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Taxa de Locação">Tx Loc</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{((Number(kitData.summary?.tx_locacao) || 0) * 100).toFixed(4)}%</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Taxa de Manutenção a.m">Tx Manut</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{((Number(kitData.taxa_manutencao_anual) || 0) / 12).toFixed(4)}%</p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 pb-1">1.2 Valores</h5>
                            <div className="grid grid-cols-5 gap-2">
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Valor Instalação">Val. Instalação</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(kitData.summary?.vlr_instal_calc || 0)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Locação Mensal">Locação Mensal</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(kitData.summary?.valor_mensal_locacao_base || 0)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Valor Manutenção">Val. Manutenção</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(kitData.summary?.vlt_manut || 0)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Valor Monitoramento">Val. Monitoram.</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(kitData.summary?.venda_unit_monitoramento || 0)}</p>
                                </div>
                                <div className="bg-green-500/5 border border-green-500/20 p-2 rounded-md">
                                    <p className="text-[8px] text-green-700 font-bold uppercase truncate" title="Faturamento Mensal">Faturam. (Mês)</p>
                                    <p className="text-sm font-bold text-green-700 mt-0.5">{formatCurrency(kitData.summary?.valor_mensal_kit || 0)}</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 pb-1">1.3 Fechamento</h5>
                            <div className="grid grid-cols-6 gap-2">
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Custo de Aquisição">Custo Aquisição</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(custoAquisicao)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Custos Operacionais">Custos Operacionais</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(custosOperacionaisTotais)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Comissão">Comissão</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5 flex items-end gap-1">
                                        {formatCurrency(comissaoValor)}
                                    </p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Impostos Instalação">Imp. Instalação</p>
                                    <p className="text-sm font-bold text-red-600 mt-0.5">{formatCurrency(impostoInstalacao)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Impostos Mensais">Imp. Mensais</p>
                                    <p className="text-sm font-bold text-red-600 mt-0.5">{formatCurrency(impostoMensal)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Impostos Totais">Imp. Totais</p>
                                    <p className="text-sm font-bold text-red-700 mt-0.5">{formatCurrency(impostosTotais)}</p>
                                </div>
                                <div className="bg-orange-500/5 border border-orange-500/20 p-2 rounded-md">
                                    <p className="text-[8px] text-orange-700 font-bold uppercase truncate" title="Custos Totais">Custos Totais</p>
                                    <p className="text-sm font-bold text-orange-700 mt-0.5">{formatCurrency(custosTotais)}</p>
                                </div>

                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Faturamento Total">Faturam. Total</p>
                                    <p className="text-sm font-bold text-brand-primary mt-0.5">{formatCurrency(faturamentoTotal)}</p>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase truncate" title="Lucro Estimado">Lucro Estimado</p>
                                    <p className="text-sm font-bold text-green-600 mt-0.5">{formatCurrency(lucroTotal)}</p>
                                </div>
                                <div className="bg-brand-primary/5 border border-brand-primary/20 p-2 rounded-md">
                                    <p className="text-[8px] text-brand-primary font-bold uppercase truncate" title="Margem Geral">Margem</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{formatPercent(margemLucro)}</p>
                                </div>
                                <div className="bg-brand-primary/5 border border-brand-primary/20 p-2 rounded-md">
                                    <p className="text-[8px] text-brand-primary font-bold uppercase truncate" title="ROI (Meses)">ROI</p>
                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{kitData.summary?.roi_meses?.toFixed(1)} m</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Seção 2: Equipamentos + Serviços */}
                    <div className="mb-6">
                        <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">2. Composição de Itens (Equipamentos & Serviços)</h4>
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-y border-gray-300">
                                    <th className="py-1.5 px-2 font-semibold text-gray-700">Produto / Serviço</th>
                                    <th className="py-1.5 px-2 font-semibold text-gray-700">Fornecedor</th>
                                    <th className="py-1.5 px-2 font-semibold text-gray-700 text-center">Qtd</th>
                                    <th className="py-1.5 px-2 font-semibold text-gray-700 text-right">Custo Base</th>
                                    <th className="py-1.5 px-2 font-semibold text-gray-700 text-right">Difal</th>
                                    <th className="py-1.5 px-2 font-semibold text-gray-700 text-right">Custo Total</th>
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
                                        <td className="py-1.5 px-2 text-gray-900 max-w-[300px] truncate" title={nomeProduto}>
                                            <div className="flex flex-col">
                                                <span>{nomeProduto}</span>
                                                <span className="text-[9px] text-gray-500 uppercase mt-0.5 font-mono">SKU: {sku}</span>
                                            </div>
                                        </td>
                                        <td className="py-1.5 px-2 text-gray-600 truncate max-w-[200px]" title={fornecedor}>
                                            {item.tipo_item === 'SERVICO_PROPRIO' ? 'Equipe Interna' : fornecedor}
                                        </td>
                                        <td className="py-2 px-2 text-center text-gray-900">{quantidade}</td>
                                        <td className="py-2 px-2 text-right text-gray-600">{formatCurrency(item.custo_base_unitario_item || 0)}</td>
                                        <td className="py-2 px-2 text-right text-gray-600">{formatCurrency(item.difal_total_item || 0)}</td>
                                        <td className="py-2 px-2 text-right font-medium text-gray-900">{formatCurrency(item.custo_total_item_no_kit || 0)}</td>
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
                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">3.1. Resumo por Origem/Fornecedor</h4>
                            <div className="border border-gray-200 rounded-md overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="py-2 px-3 font-semibold text-gray-700">Origem</th>
                                            <th className="py-2 px-3 font-semibold text-gray-700 text-right">Custo Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {/* Simplified aggregation logic for demonstration in frontend layout */}
                                        <tr>
                                            <td className="py-2 px-3 text-gray-700">Aquisição de Produtos</td>
                                            <td className="py-2 px-3 text-right text-gray-900 font-medium">{formatCurrency(kitData.summary?.venda_equipamentos_total || kitData.summary?.custo_equip_total_calc)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-3 text-gray-700">Serviços / Instalação</td>
                                            <td className="py-2 px-3 text-right text-gray-900 font-medium">{formatCurrency(kitData.summary?.imposto_instalacao || 0)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">3.2. Impostos e Acréscimos (Aquisição)</h4>
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
                                            <td className="py-2 px-3 text-right text-red-600">{formatCurrency(kitData.summary?.vlt_ipi || 0)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-3 text-gray-700">Total Frete</td>
                                            <td className="py-2 px-3 text-right text-red-600">{formatCurrency(kitData.summary?.vlt_frete_venda || 0)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-3 text-gray-700">Total Difal</td>
                                            <td className="py-2 px-3 text-right text-red-600">{formatCurrency(kitData.summary?.vlt_difal || 0)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Seção 4: ROI de Equipamento */}
                    {kitData.modalidade !== 'VENDA_DIRETA' && (
                        <div>
                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">4. Retorno e Viabilidade (Equipamento)</h4>
                            <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-md p-5 flex flex-col items-center">
                                <div className="text-center mb-6">
                                    <p className="text-sm font-semibold text-gray-500 uppercase">ROI de Equipamento Previsto</p>
                                    <p className="text-4xl font-black text-brand-primary mt-1">
                                        {kitData.summary?.roi_equipamento_meses?.toFixed(2) || 'N/A'} <span className="text-xl font-bold text-gray-500">Meses</span>
                                    </p>
                                </div>
                                
                                <div className="w-full max-w-2xl bg-white border border-gray-200 rounded p-4 text-sm font-mono text-gray-600 shadow-sm">
                                    <p className="font-bold text-gray-800 border-b border-gray-200 pb-2 mb-2 uppercase text-xs">Memória de Cálculo (Comprovação Matemática)</p>
                                    
                                    <div className="flex justify-between py-1">
                                        <span>(+) Custo de Aquisição (Equipamentos)</span>
                                        <span>{formatCurrency(kitData.summary?.custo_equip_total_calc || 0)}</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span>(+) Comissão</span>
                                        <span>{formatCurrency(kitData.summary?.valor_comissao_locacao || kitData.summary?.vlt_comissao || 0)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 font-bold text-gray-900 border-t border-dashed border-gray-300 mt-1 pt-1">
                                        <span>(=) Total Investimento (A)</span>
                                        <span>{formatCurrency((kitData.summary?.custo_equip_total_calc || 0) + (kitData.summary?.valor_comissao_locacao || kitData.summary?.vlt_comissao || 0))}</span>
                                    </div>
                                    
                                    <div className="h-4"></div>
                                    
                                    <div className="flex justify-between py-1">
                                        <span>(+) Locação Mensal</span>
                                        <span>{formatCurrency(kitData.summary?.valor_mensal_locacao_base || 0)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 text-red-600">
                                        <span>(-) Imposto de Locação</span>
                                        <span>- {formatCurrency(kitData.summary?.imposto_equip_loc || 0)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 font-bold text-gray-900 border-t border-dashed border-gray-300 mt-1 pt-1">
                                        <span>(=) Receita Líquida Mensal (B)</span>
                                        <span>{formatCurrency((kitData.summary?.valor_mensal_locacao_base || 0) - (kitData.summary?.imposto_equip_loc || 0))}</span>
                                    </div>
                                    
                                    <div className="h-4"></div>
                                    
                                    <div className="flex justify-between py-2 bg-gray-50 px-2 rounded border border-gray-200 font-bold text-brand-primary">
                                        <span>Cálculo Final: (A) / (B)</span>
                                        <span>{kitData.summary?.roi_equipamento_meses?.toFixed(2)} meses</span>
                                    </div>
                                </div>
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
