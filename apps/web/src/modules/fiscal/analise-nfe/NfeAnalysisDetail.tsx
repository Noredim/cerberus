import React, { useEffect, useState } from 'react';
import {
    ArrowLeft,
    Loader2,
    CheckCircle2,
    DollarSign,
    Building2,
    CreditCard,
    Download,
    Copy,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    RefreshCw
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';

interface TaxDetail {
    CST?: string;
    orig?: string;
    vBC?: string;
    pICMS?: string;
    vICMS?: string;
    pIPI?: string;
    vIPI?: string;
    pPIS?: string;
    vPIS?: string;
    pCOFINS?: string;
    vCOFINS?: string;
    pIBS?: string;
    vIBS?: string;
    pCBS?: string;
    vCBS?: string;
    [key: string]: any;
}

interface NfeItem {
    id: string;
    nItem: number;
    cProd: string | null;
    xProd: string | null;
    NCM: string | null;
    CFOP: string | null;
    uCom: string | null;
    qCom: number | null;
    vUnCom: number | null;
    vProd: number | null;
    tributos: Record<string, any> | null;
}

interface NfeInstallment {
    id: string;
    nDup: string | null;
    dVenc: string | null;
    vDup: number | null;
}

interface NfePayment {
    id: string;
    tPag: string | null;
    vPag: number | null;
}

interface NfeAnalysis {
    id: string;
    name: string;
    file_name: string;
    xml_content: string;
    status: string;
    created_at: string;
    fiscal_document: {
        id: string;
        access_key: string;
        nNF: string | null;
        serie: string | null;
        mod: string | null;
        dhEmi: string | null;
        issuer_cnpj: string | null;
        issuer_name: string | null;
        recipient_cnpj: string | null;
        recipient_name: string | null;
        vProd: number | null;
        vNF: number | null;
        cStat: string | null;
        xMotivo: string | null;
        nProt: string | null;
        dhRecbto: string | null;
        xml_version: string | null;
        items: NfeItem[];
        installments: NfeInstallment[];
        payments: NfePayment[];
    } | null;
}

// Payment method mapping
const getPaymentMethodLabel = (code: string | null): string => {
    if (!code) return 'Não informado';
    const mapping: Record<string, string> = {
        '01': 'Dinheiro',
        '02': 'Cheque',
        '03': 'Cartão de Crédito',
        '04': 'Cartão de Débito',
        '05': 'Crédito Loja',
        '10': 'Vale Alimentação',
        '11': 'Vale Refeição',
        '12': 'Vale Presente',
        '13': 'Vale Combustível',
        '14': 'Duplicata Mercantil',
        '15': 'Boleto Bancário',
        '16': 'Depósito Bancário',
        '17': 'Pagamento Instantâneo (Pix)',
        '18': 'Transferência bancária, Carteira Digital',
        '19': 'Programa de fidelidade, Cashback, Crédito Virtual',
        '90': 'Sem pagamento',
        '99': 'Outros'
    };
    return mapping[code] || `Outros (${code})`;
};

const NfeAnalysisDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [analysis, setAnalysis] = useState<NfeAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'items' | 'finance' | 'xml' | 'purchase_taxes'>('items');
    const [expandedItem, setExpandedItem] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState(false);
    
    // Purchase Taxes Analysis states
    const [selectedTaxType, setSelectedTaxType] = useState<'DIFAL' | 'ICMS_ST'>('DIFAL');
    const [taxData, setTaxData] = useState<Record<string, { mvaPercent: number; bitFlag: boolean }>>({});
    const [loadingTaxData, setLoadingTaxData] = useState(false);
    const [expandedCalcItem, setExpandedCalcItem] = useState<string | null>(null);

    // Fetch analysis details
    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const response = await api.get(`/fiscal/analise-nfe/${id}`);
                setAnalysis(response.data);
            } catch (error) {
                console.error('Error fetching analysis details:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchDetail();
        }
    }, [id]);

    const getNatOp = () => {
        if (!analysis?.xml_content) return '-';
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(analysis.xml_content, 'text/xml');
            const natOpNodes = xmlDoc.getElementsByTagName('natOp');
            if (natOpNodes.length > 0) {
                return natOpNodes[0].textContent || '-';
            }
            const allElements = xmlDoc.getElementsByTagName('*');
            for (let i = 0; i < allElements.length; i++) {
                if (allElements[i].localName === 'natOp') {
                    return allElements[i].textContent || '-';
                }
            }
        } catch (e) {
            console.error('Error parsing natOp from XML:', e);
        }
        return '-';
    };

    const getUfFromXml = (section: 'emit' | 'dest'): string => {
        if (!analysis?.xml_content) return section === 'emit' ? 'SP' : 'MT';
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(analysis.xml_content, 'text/xml');
            const sectionNode = xmlDoc.getElementsByTagName(section)[0];
            if (sectionNode) {
                const ufNode = sectionNode.getElementsByTagName('UF')[0];
                if (ufNode) return ufNode.textContent?.trim().toUpperCase() || (section === 'emit' ? 'SP' : 'MT');
            }
            
            // Fallback for tags with namespaces
            const allElements = xmlDoc.getElementsByTagName('*');
            let inSection = false;
            for (let i = 0; i < allElements.length; i++) {
                const el = allElements[i];
                if (el.localName === section) {
                    inSection = true;
                } else if (inSection && el.localName === 'UF') {
                    return el.textContent?.trim().toUpperCase() || (section === 'emit' ? 'SP' : 'MT');
                } else if (inSection && el.localName === 'dest' && section === 'emit') {
                    break;
                }
            }
        } catch (e) {
            console.error(`Error parsing UF for ${section}:`, e);
        }
        return section === 'emit' ? 'SP' : 'MT';
    };

    const fetchTaxData = async (force = false) => {
        if (!analysis?.fiscal_document?.items) return;
        setLoadingTaxData(true);
        const companyId = sessionStorage.getItem('@Cerberus:companyId');
        const items = analysis.fiscal_document?.items || [];
        const uniqueNcms = Array.from(new Set(items.map(item => item.NCM).filter(Boolean))) as string[];
        
        const newTaxData = force ? {} : { ...taxData };
        
        try {
            await Promise.all(uniqueNcms.map(async (ncm) => {
                if (!force && newTaxData[ncm]) return; // Already cached
                
                let mvaPercent = 0;
                let bitFlag = false;
                
                try {
                    if (companyId) {
                        const mvaRes = await api.get(`/cadastro/produtos/mva-preview`, {
                            params: { ncm, company_id: companyId, finalidade: 'REVENDA' }
                        });
                        if (mvaRes.data?.found) {
                            mvaPercent = mvaRes.data.mva_percent || 0;
                        }
                    }
                } catch (e) {
                    console.error(`Error loading MVA for NCM ${ncm}:`, e);
                }
                
                try {
                    const benefitsRes = await api.get(`/ncm/check-benefits/${ncm}`);
                    if (Array.isArray(benefitsRes.data)) {
                        bitFlag = benefitsRes.data.some(b => (b.nome || '').toUpperCase().includes('BIT'));
                    }
                } catch (e) {
                    console.error(`Error loading benefits for NCM ${ncm}:`, e);
                }
                
                newTaxData[ncm] = { mvaPercent, bitFlag };
            }));
            
            setTaxData(newTaxData);
            if (force) {
                alert('Análise tributária reprocessada e atualizada com sucesso!');
            }
        } catch (err) {
            console.error('Error loading tax data:', err);
            if (force) {
                alert('Erro ao reprocessar dados tributários.');
            }
        } finally {
            setLoadingTaxData(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'purchase_taxes') {
            fetchTaxData(false);
        }
    }, [activeTab, analysis?.fiscal_document?.items]);

    if (loading) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-brand-primary" />
                Carregando espelho da nota fiscal...
            </div>
        );
    }

    if (!analysis || !analysis.fiscal_document) {
        return (
            <div className="space-y-4 max-w-md mx-auto text-center py-12">
                <AlertCircle className="w-12 h-12 text-brand-danger mx-auto" />
                <h2 className="text-xl font-bold text-text-primary">Análise Não Encontrada</h2>
                <p className="text-text-muted text-sm">A análise fiscal solicitada não existe ou foi excluída.</p>
                <button
                    onClick={() => navigate('/fiscal/analise-nfe')}
                    className="mt-2 inline-flex items-center gap-2 bg-bg-deep border border-border-subtle px-4 py-2 rounded-md hover:bg-bg-surface text-text-primary text-sm font-medium transition-colors cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar para a lista
                </button>
            </div>
        );
    }

    const doc = analysis.fiscal_document;

    // Helper to format values
    const formatCurrency = (val: number | null) => {
        if (val === null || val === undefined) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    // Helper to format quantites
    const formatNumber = (val: number | null, decimals = 2) => {
        if (val === null || val === undefined) return '0';
        return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);
    };

    // Copy access key to clipboard
    const copyAccessKey = () => {
        navigator.clipboard.writeText(doc.access_key);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    // Download XML file
    const downloadXml = () => {
        const blob = new Blob([analysis.xml_content], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = analysis.file_name || `${doc.access_key}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Calculate tax totals from JSONB fields on items
    const calculateTaxesSum = () => {
        let icmsSum = 0;
        let ipiSum = 0;
        let pisSum = 0;
        let cofinsSum = 0;
        let ibsSum = 0;
        let cbsSum = 0;

        doc.items.forEach(item => {
            if (item.tributos) {
                // ICMS sum
                const icms = item.tributos.ICMS;
                if (icms) {
                    // Extract vICMS if present in any of the nested ICMS groups
                    const inner = Object.values(icms)[0] as Record<string, any>;
                    if (inner && inner.vICMS) icmsSum += parseFloat(inner.vICMS) || 0;
                }

                // IPI sum
                const ipi = item.tributos.IPI;
                if (ipi) {
                    const ipiTrib = ipi.IPITrib;
                    if (ipiTrib && ipiTrib.vIPI) ipiSum += parseFloat(ipiTrib.vIPI) || 0;
                }

                // PIS sum
                const pis = item.tributos.PIS;
                if (pis) {
                    const inner = Object.values(pis)[0] as Record<string, any>;
                    if (inner && inner.vPIS) pisSum += parseFloat(inner.vPIS) || 0;
                }

                // COFINS sum
                const cofins = item.tributos.COFINS;
                if (cofins) {
                    const inner = Object.values(cofins)[0] as Record<string, any>;
                    if (inner && inner.vCOFINS) cofinsSum += parseFloat(inner.vCOFINS) || 0;
                }

                // IBS sum
                const ibscbs = item.tributos.IBSCBS || item.tributos.gIBSCBS || {};
                const gibscbs = ibscbs.gIBSCBS || {};
                const ibsVal = gibscbs.vIBS || ibscbs.vIBS || (gibscbs.gIBSUF && gibscbs.gIBSUF.vIBSUF) || (gibscbs.gIBS && gibscbs.gIBS.vIBS) || item.tributos.IBS?.vIBS || item.tributos.gIBS?.vIBS || item.tributos.vIBS;
                if (ibsVal) {
                    ibsSum += parseFloat(ibsVal) || 0;
                }

                // CBS sum
                const cbsVal = (gibscbs.gCBS && gibscbs.gCBS.vCBS) || item.tributos.CBS?.vCBS || item.tributos.gCBS?.vCBS || item.tributos.vCBS;
                if (cbsVal) {
                    cbsSum += parseFloat(cbsVal) || 0;
                }
            }
        });

        return { icmsSum, ipiSum, pisSum, cofinsSum, ibsSum, cbsSum };
    };

    const taxSums = calculateTaxesSum();

    return (
        <div className="space-y-6 w-full pb-12">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/fiscal/analise-nfe')}
                        className="p-2 border border-border-subtle bg-surface hover:bg-bg-deep rounded-md text-text-primary transition-colors cursor-pointer"
                        title="Voltar"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-text-primary flex items-center gap-2">
                            {analysis.name}
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                NF-e Mirror Generated
                            </span>
                        </h1>
                        <p className="text-text-muted text-xs font-mono mt-0.5">Arquivo: {analysis.file_name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={downloadXml}
                        className="flex items-center gap-1.5 border border-border-subtle bg-surface hover:bg-bg-deep text-text-primary px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer"
                    >
                        <Download className="w-4 h-4" /> Download XML
                    </button>
                </div>
            </header>

            {/* DANFE Mirror Card */}
            <div className="bg-surface rounded-lg border border-border-subtle shadow-sm overflow-hidden">
                {/* DANFE Header */}
                <div className="p-6 border-b border-border-subtle bg-bg-deep flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="text-xs font-bold text-brand-primary uppercase tracking-wider">Chave de Acesso</div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-bold text-text-primary tracking-wide">
                                {doc.access_key.replace(/(.{4})/g, '$1 ').trim()}
                            </span>
                            <button
                                onClick={copyAccessKey}
                                className={`p-1.5 rounded hover:bg-bg-surface transition-colors cursor-pointer text-text-muted hover:text-brand-primary ${copiedKey && 'text-emerald-500 hover:text-emerald-500'}`}
                                title="Copiar Chave"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="text-xs text-text-secondary mt-1">
                            Natureza da Operação: <strong className="text-text-primary">{getNatOp()}</strong>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm bg-surface p-3.5 rounded border border-border-subtle">
                        <div>
                            <span className="text-text-muted block text-[10px] font-bold uppercase">Modelo</span>
                            <span className="text-text-primary font-semibold">{doc.mod || '-'}</span>
                        </div>
                        <div className="w-px h-8 bg-border-subtle" />
                        <div>
                            <span className="text-text-muted block text-[10px] font-bold uppercase">Série</span>
                            <span className="text-text-primary font-semibold">{doc.serie || '-'}</span>
                        </div>
                        <div className="w-px h-8 bg-border-subtle" />
                        <div>
                            <span className="text-text-muted block text-[10px] font-bold uppercase">Número</span>
                            <span className="text-text-primary font-semibold">{doc.nNF || '-'}</span>
                        </div>
                        <div className="w-px h-8 bg-border-subtle" />
                        <div>
                            <span className="text-text-muted block text-[10px] font-bold uppercase">Data de Emissão</span>
                            <span className="text-text-primary font-semibold">
                                {doc.dhEmi ? new Date(doc.dhEmi).toLocaleDateString('pt-BR') : '-'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Parties Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
                    {/* Emitente */}
                    <div className="p-6 space-y-3 bg-surface">
                        <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-brand-primary" />
                            Emitente (Fornecedor)
                        </h3>
                        <div className="space-y-1">
                            <div className="text-sm font-bold text-text-primary">{doc.issuer_name || 'Razão Social não informada'}</div>
                            <div className="text-xs text-text-secondary flex items-center gap-2">
                                <span>CNPJ/CPF: <strong className="font-mono text-text-primary">{doc.issuer_cnpj || '-'}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Destinatário */}
                    <div className="p-6 space-y-3 bg-surface">
                        <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-brand-primary" />
                            Destinatário (Sua Empresa)
                        </h3>
                        <div className="space-y-1">
                            <div className="text-sm font-bold text-text-primary">{doc.recipient_name || 'Razão Social não informada'}</div>
                            <div className="text-xs text-text-secondary flex items-center gap-2">
                                <span>CNPJ/CPF: <strong className="font-mono text-text-primary">{doc.recipient_cnpj || '-'}</strong></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Protocol information footer */}
                {doc.nProt && (
                    <div className="px-6 py-3 border-t border-border-subtle bg-[#f8f9fa] dark:bg-bg-deep/60 text-xs text-text-secondary flex flex-wrap items-center justify-between gap-2">
                        <div>
                            Status SEFAZ: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{doc.cStat}</strong> - {doc.xMotivo}
                        </div>
                        <div>
                            Protocolo: <strong className="text-text-primary font-mono">{doc.nProt}</strong> ({doc.dhRecbto ? new Date(doc.dhRecbto).toLocaleString('pt-BR') : ''})
                        </div>
                    </div>
                )}
            </div>

            {/* Totals Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-surface rounded-lg p-4 border border-border-subtle shadow-sm">
                    <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider block">Produtos</span>
                    <span className="text-lg font-bold text-text-primary block mt-0.5">{formatCurrency(doc.vProd)}</span>
                </div>
                <div className="bg-surface rounded-lg p-4 border border-border-subtle shadow-sm">
                    <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider block">ICMS</span>
                    <span className="text-lg font-bold text-brand-primary block mt-0.5">{formatCurrency(taxSums.icmsSum)}</span>
                </div>
                <div className="bg-surface rounded-lg p-4 border border-border-subtle shadow-sm">
                    <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider block">IPI</span>
                    <span className="text-lg font-bold text-brand-primary block mt-0.5">{formatCurrency(taxSums.ipiSum)}</span>
                </div>
                <div className="bg-surface rounded-lg p-4 border border-border-subtle shadow-sm">
                    <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider block">IBS / CBS</span>
                    <span className="text-lg font-bold text-brand-primary block mt-0.5">{formatCurrency(taxSums.ibsSum + taxSums.cbsSum)}</span>
                </div>
                <div className="bg-surface rounded-lg p-4 border border-border-subtle shadow-sm col-span-2">
                    <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider block">Valor Total da Nota</span>
                    <span className="text-2xl font-bold text-brand-primary block mt-0.5">{formatCurrency(doc.vNF)}</span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-border-subtle gap-4">
                <button
                    onClick={() => setActiveTab('items')}
                    className={`py-2 px-1 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'items' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                >
                    Itens da Nota ({doc.items.length})
                </button>
                <button
                    onClick={() => setActiveTab('finance')}
                    className={`py-2 px-1 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'finance' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                >
                    Cobrança & Pagamento ({doc.installments.length + doc.payments.length})
                </button>
                <button
                    onClick={() => setActiveTab('xml')}
                    className={`py-2 px-1 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'xml' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                >
                    XML Original
                </button>
                <button
                    onClick={() => setActiveTab('purchase_taxes')}
                    className={`py-2 px-1 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'purchase_taxes' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                >
                    Análise de Impostos de Compra
                </button>
            </div>

            {/* Tab Contents */}
            <div>
                {/* ITEMS TAB */}
                {activeTab === 'items' && (
                    <div className="bg-surface rounded-lg border border-border-subtle shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-[#f8f9fa] dark:bg-bg-deep border-b border-border-subtle">
                                <tr className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                                    <th className="px-6 py-3 w-16 text-center">Item</th>
                                    <th className="px-6 py-3">Código / Descrição</th>
                                    <th className="px-6 py-3 text-center">NCM</th>
                                    <th className="px-6 py-3 text-center">CFOP</th>
                                    <th className="px-6 py-3 text-right">Qtd</th>
                                    <th className="px-6 py-3 text-right">Valor Unit</th>
                                    <th className="px-6 py-3 text-right">Total Item</th>
                                    <th className="px-6 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {doc.items.map((item) => {
                                    const isExpanded = expandedItem === item.id;
                                    return (
                                        <React.Fragment key={item.id}>
                                            <tr className="hover:bg-bg-deep/30 transition-colors text-sm">
                                                <td className="px-6 py-4 text-center text-text-secondary font-mono">
                                                    {item.nItem}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-text-primary">{item.xProd}</div>
                                                    <div className="text-xs text-text-muted">Cód: {item.cProd || '-'} | Un: {item.uCom || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono text-xs text-text-secondary">
                                                    {item.NCM || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono text-xs text-text-secondary">
                                                    {item.CFOP || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right text-text-secondary">
                                                    {formatNumber(item.qCom, 4)}
                                                </td>
                                                <td className="px-6 py-4 text-right text-text-secondary">
                                                    {formatNumber(item.vUnCom, 4)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-text-primary">
                                                    {formatCurrency(item.vProd)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                                                        className="p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer rounded hover:bg-bg-deep"
                                                        title={isExpanded ? "Ocultar Impostos" : "Exibir Impostos"}
                                                    >
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* Sub-panel displaying taxes */}
                                            {isExpanded && (
                                                <tr className="bg-bg-deep/45">
                                                    <td colSpan={8} className="px-8 py-4">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                                            {/* ICMS block */}
                                                            <div className="bg-surface rounded border border-border-subtle p-3 space-y-1">
                                                                <div className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">ICMS</div>
                                                                {item.tributos?.ICMS ? (() => {
                                                                    const inner = Object.values(item.tributos.ICMS)[0] as TaxDetail;
                                                                    return (
                                                                        <div className="text-xs space-y-0.5 text-text-secondary">
                                                                            <div>CST/CSOSN: <strong className="text-text-primary">{inner?.CST || inner?.CSOSN || '-'}</strong></div>
                                                                            <div>Base: <strong className="text-text-primary">{inner?.vBC ? formatCurrency(parseFloat(inner.vBC)) : '-'}</strong></div>
                                                                            <div>Alíq: <strong className="text-text-primary">{inner?.pICMS ? `${inner.pICMS}%` : '-'}</strong></div>
                                                                            <div>Valor: <strong className="text-text-primary">{inner?.vICMS ? formatCurrency(parseFloat(inner.vICMS)) : '-'}</strong></div>
                                                                        </div>
                                                                    );
                                                                })() : <div className="text-xs text-text-muted">Isento / Não tributado</div>}
                                                            </div>

                                                            {/* IPI block */}
                                                            <div className="bg-surface rounded border border-border-subtle p-3 space-y-1">
                                                                <div className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">IPI</div>
                                                                {item.tributos?.IPI ? (() => {
                                                                    const inner = item.tributos.IPI.IPITrib || item.tributos.IPI.IPINT;
                                                                    return (
                                                                        <div className="text-xs space-y-0.5 text-text-secondary">
                                                                            <div>CST: <strong className="text-text-primary">{inner?.CST || '-'}</strong></div>
                                                                            <div>Base: <strong className="text-text-primary">{inner?.vBC ? formatCurrency(parseFloat(inner.vBC)) : '-'}</strong></div>
                                                                            <div>Alíq: <strong className="text-text-primary">{inner?.pIPI ? `${inner.pIPI}%` : '-'}</strong></div>
                                                                            <div>Valor: <strong className="text-text-primary">{inner?.vIPI ? formatCurrency(parseFloat(inner.vIPI)) : '-'}</strong></div>
                                                                        </div>
                                                                    );
                                                                })() : <div className="text-xs text-text-muted">Isento / Não tributado</div>}
                                                            </div>

                                                            {/* PIS block */}
                                                            <div className="bg-surface rounded border border-border-subtle p-3 space-y-1">
                                                                <div className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">PIS</div>
                                                                {item.tributos?.PIS ? (() => {
                                                                    const inner = Object.values(item.tributos.PIS)[0] as TaxDetail;
                                                                    return (
                                                                        <div className="text-xs space-y-0.5 text-text-secondary">
                                                                            <div>CST: <strong className="text-text-primary">{inner?.CST || '-'}</strong></div>
                                                                            <div>Base: <strong className="text-text-primary">{inner?.vBC ? formatCurrency(parseFloat(inner.vBC)) : '-'}</strong></div>
                                                                            <div>Alíq: <strong className="text-text-primary">{inner?.pPIS ? `${inner.pPIS}%` : '-'}</strong></div>
                                                                            <div>Valor: <strong className="text-text-primary">{inner?.vPIS ? formatCurrency(parseFloat(inner.vPIS)) : '-'}</strong></div>
                                                                        </div>
                                                                    );
                                                                })() : <div className="text-xs text-text-muted">Isento / Não tributado</div>}
                                                            </div>

                                                            {/* COFINS block */}
                                                            <div className="bg-surface rounded border border-border-subtle p-3 space-y-1">
                                                                <div className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">COFINS</div>
                                                                {item.tributos?.COFINS ? (() => {
                                                                    const inner = Object.values(item.tributos.COFINS)[0] as TaxDetail;
                                                                    return (
                                                                        <div className="text-xs space-y-0.5 text-text-secondary">
                                                                            <div>CST: <strong className="text-text-primary">{inner?.CST || '-'}</strong></div>
                                                                            <div>Base: <strong className="text-text-primary">{inner?.vBC ? formatCurrency(parseFloat(inner.vBC)) : '-'}</strong></div>
                                                                            <div>Alíq: <strong className="text-text-primary">{inner?.pCOFINS ? `${inner.pCOFINS}%` : '-'}</strong></div>
                                                                            <div>Valor: <strong className="text-text-primary">{inner?.vCOFINS ? formatCurrency(parseFloat(inner.vCOFINS)) : '-'}</strong></div>
                                                                        </div>
                                                                    );
                                                                })() : <div className="text-xs text-text-muted">Isento / Não tributado</div>}
                                                            </div>

                                                            {/* IBS block */}
                                                            <div className="bg-surface rounded border border-border-subtle p-3 space-y-1">
                                                                <div className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">IBS (Reforma)</div>
                                                                {item.tributos?.IBSCBS || item.tributos?.gIBSCBS || item.tributos?.gIBS || item.tributos?.IBS ? (() => {
                                                                    const ibscbs = item.tributos?.IBSCBS || {};
                                                                    const gibscbs = ibscbs.gIBSCBS || item.tributos?.gIBSCBS || {};
                                                                    const gibs = gibscbs.gIBS || item.tributos?.gIBS || {};
                                                                    const ibsuf = gibscbs.gIBSUF || gibs.gIBSUF || {};
                                                                    
                                                                    const cst = ibscbs.CST || gibscbs.CST || item.tributos?.IBS?.CST || '-';
                                                                    const base = gibscbs.vBC || gibs.vBC || ibscbs.vBC || item.tributos?.IBS?.vBC || '-';
                                                                    const aliq = ibsuf.pIBSUF || gibscbs.pIBS || gibs.pIBS || item.tributos?.IBS?.pIBS || '-';
                                                                    const valor = gibscbs.vIBS || ibsuf.vIBSUF || gibs.vIBS || item.tributos?.IBS?.vIBS || '-';
                                                                    
                                                                    return (
                                                                        <div className="text-xs space-y-0.5 text-text-secondary">
                                                                            <div>CST: <strong className="text-text-primary">{cst}</strong></div>
                                                                            <div>Base: <strong className="text-text-primary">{base !== '-' ? formatCurrency(parseFloat(base)) : '-'}</strong></div>
                                                                            <div>Alíq: <strong className="text-text-primary">{aliq !== '-' ? `${parseFloat(aliq)}%` : '-'}</strong></div>
                                                                            <div>Valor: <strong className="text-text-primary">{valor !== '-' ? formatCurrency(parseFloat(valor)) : '-'}</strong></div>
                                                                        </div>
                                                                    );
                                                                })() : <div className="text-xs text-text-muted">Não configurado</div>}
                                                            </div>

                                                            {/* CBS block */}
                                                            <div className="bg-surface rounded border border-border-subtle p-3 space-y-1">
                                                                <div className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">CBS (Reforma)</div>
                                                                {item.tributos?.IBSCBS?.gIBSCBS?.gCBS || item.tributos?.gCBS || item.tributos?.CBS || (item.tributos?.IBSCBS?.gIBSCBS && item.tributos.IBSCBS.gIBSCBS.gCBS) ? (() => {
                                                                    const ibscbs = item.tributos?.IBSCBS || {};
                                                                    const gibscbs = ibscbs.gIBSCBS || {};
                                                                    const gcbs = gibscbs.gCBS || item.tributos?.gCBS || item.tributos?.CBS || {};
                                                                    
                                                                    const base = gcbs.vBC || gibscbs.vBC || ibscbs.vBC || '-';
                                                                    const aliq = gcbs.pCBS || '-';
                                                                    const valor = gcbs.vCBS || '-';
                                                                    
                                                                    return (
                                                                        <div className="text-xs space-y-0.5 text-text-secondary">
                                                                            <div>Base: <strong className="text-text-primary">{base !== '-' ? formatCurrency(parseFloat(base)) : '-'}</strong></div>
                                                                            <div>Alíq: <strong className="text-text-primary">{aliq !== '-' ? `${parseFloat(aliq)}%` : '-'}</strong></div>
                                                                            <div>Valor: <strong className="text-text-primary">{valor !== '-' ? formatCurrency(parseFloat(valor)) : '-'}</strong></div>
                                                                        </div>
                                                                    );
                                                                })() : <div className="text-xs text-text-muted">Não configurado</div>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* FINANCE TAB */}
                {activeTab === 'finance' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Duplicatas */}
                        <div className="bg-surface rounded-lg border border-border-subtle shadow-sm overflow-hidden flex flex-col">
                            <header className="px-6 py-4 border-b border-border-subtle bg-[#f8f9fa] dark:bg-bg-deep flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-brand-primary" />
                                <h3 className="font-bold text-text-primary">Duplicatas da Fatura</h3>
                            </header>
                            <div className="divide-y divide-border-subtle">
                                {doc.installments.length === 0 ? (
                                    <div className="p-6 text-center text-text-muted text-sm">
                                        Nenhuma duplicata mercantil informada nesta nota.
                                    </div>
                                ) : doc.installments.map((inst, i) => (
                                    <div key={inst.id} className="p-4 flex items-center justify-between text-sm">
                                        <div>
                                            <span className="font-semibold text-text-primary">Parcela {inst.nDup || i + 1}</span>
                                            {inst.dVenc && (
                                                <span className="text-xs text-text-muted block mt-0.5">Vencimento: {new Date(inst.dVenc + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                            )}
                                        </div>
                                        <div className="font-bold text-brand-primary">
                                            {formatCurrency(inst.vDup)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pagamentos */}
                        <div className="bg-surface rounded-lg border border-border-subtle shadow-sm overflow-hidden flex flex-col">
                            <header className="px-6 py-4 border-b border-border-subtle bg-[#f8f9fa] dark:bg-bg-deep flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-brand-primary" />
                                <h3 className="font-bold text-text-primary">Formas de Pagamento Registradas</h3>
                            </header>
                            <div className="divide-y divide-border-subtle">
                                {doc.payments.length === 0 ? (
                                    <div className="p-6 text-center text-text-muted text-sm">
                                        Nenhum pagamento detalhado no XML.
                                    </div>
                                ) : doc.payments.map((pay) => (
                                    <div key={pay.id} className="p-4 flex items-center justify-between text-sm">
                                        <div>
                                            <span className="font-semibold text-text-primary">{getPaymentMethodLabel(pay.tPag)}</span>
                                        </div>
                                        <div className="font-bold text-brand-primary">
                                            {formatCurrency(pay.vPag)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* XML TAB */}
                {activeTab === 'xml' && (
                    <div className="bg-surface rounded-lg border border-border-subtle shadow-sm p-4 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-text-muted font-mono">{analysis.file_name}</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(analysis.xml_content);
                                    alert('XML copiado para a área de transferência!');
                                }}
                                className="flex items-center gap-1 bg-bg-deep border border-border-subtle hover:bg-bg-surface text-text-primary text-xs px-2.5 py-1 rounded transition-colors cursor-pointer"
                            >
                                <Copy className="w-3.5 h-3.5" /> Copiar XML
                            </button>
                        </div>
                        <pre className="p-4 bg-bg-deep text-text-primary font-mono text-xs rounded border border-border-subtle overflow-auto max-h-[500px] whitespace-pre-wrap select-text custom-scrollbar">
                            {analysis.xml_content}
                        </pre>
                    </div>
                )}

                {/* PURCHASE TAXES TAB */}
                {activeTab === 'purchase_taxes' && (
                    <div className="space-y-6">
                        {/* Selector and Header */}
                        <div className="bg-surface rounded-lg border border-border-subtle p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h3 className="font-bold text-text-primary text-lg">Simulação Tributária de Compra</h3>
                                <p className="text-text-muted text-xs mt-1">
                                    Simule o impacto do Diferencial de Alíquota (DIFAL) ou da Substituição Tributária (ICMS ST) com base na origem ({getUfFromXml('emit')}) e destino ({getUfFromXml('dest')}).
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto">
                                <button
                                    onClick={() => fetchTaxData(true)}
                                    disabled={loadingTaxData}
                                    className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 border border-border-subtle bg-bg-deep hover:bg-bg-surface text-text-primary text-xs font-bold rounded cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Reprocessar Consultas Tributárias"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingTaxData ? 'animate-spin' : ''}`} />
                                    Reprocessar
                                </button>
                                <div className="flex bg-bg-deep rounded border border-border-subtle p-1">
                                    <button
                                        onClick={() => { setSelectedTaxType('DIFAL'); setExpandedCalcItem(null); }}
                                        className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded cursor-pointer transition-colors ${selectedTaxType === 'DIFAL' ? 'bg-surface text-brand-primary shadow-sm border border-border-subtle' : 'text-text-muted hover:text-text-primary'}`}
                                    >
                                        Cenário DIFAL (Uso/Consumo)
                                    </button>
                                    <button
                                        onClick={() => { setSelectedTaxType('ICMS_ST'); setExpandedCalcItem(null); }}
                                        className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded cursor-pointer transition-colors ${selectedTaxType === 'ICMS_ST' ? 'bg-surface text-brand-primary shadow-sm border border-border-subtle' : 'text-text-muted hover:text-text-primary'}`}
                                    >
                                        Cenário ICMS ST (Revenda)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {loadingTaxData ? (
                            <div className="bg-surface rounded-lg border border-border-subtle p-12 text-center text-text-muted">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-primary" />
                                Buscando MVAs e benefícios fiscais dos NCMs...
                            </div>
                        ) : (() => {
                            const ufOrigem = getUfFromXml('emit');
                            const ufDestino = getUfFromXml('dest');
                            const opInterestadual = ufOrigem !== ufDestino;
                            
                            // Let's run calculations and compile totals
                            let totalTaxAmount = 0;
                            let totalSimulatedCost = 0;

                            const calculatedItems = doc.items.map(item => {
                                const qty = parseFloat(item.qCom as any) || 0;
                                const unitValue = parseFloat(item.vUnCom as any) || 0;
                                
                                // Extract original IPI and Frete per item
                                const ipiTotal = parseFloat(item.tributos?.IPI?.IPITrib?.vIPI || item.tributos?.IPI?.vIPI || 0);
                                const ipiUnit = qty > 0 ? ipiTotal / qty : 0;
                                
                                const freteTotal = 0;
                                const freteUnit = qty > 0 ? freteTotal / qty : 0;

                                // Fetch MVA and BIT flags from caching state
                                const ncmData = taxData[item.NCM || ''] || { mvaPercent: 0, bitFlag: false };
                                const mvaPercent = ncmData.mvaPercent;
                                const bitFlag = ncmData.bitFlag;
                                const stFlag = mvaPercent > 0;

                                // ICMS rate of item
                                const icmsGroup = item.tributos?.ICMS ? Object.values(item.tributos.ICMS)[0] as Record<string, any> : null;
                                const aliquotaOrcamento = icmsGroup?.pICMS ? parseFloat(icmsGroup.pICMS) : 12;

                                // Constants
                                const ALIQ_INTERNA_DESTINO = 0.17;
                                const aliquotaInternaDestino = 17;
                                const FATOR_BIT = 0.4117;
                                const DESCONTO_CREDITO_OUTORGADO = 0.12;

                                // applyIcmsCap rule
                                const applyIcmsCap = (icmsRaw: number) => {
                                    if (icmsRaw <= 4) return icmsRaw;
                                    return 7;
                                };
                                const icmsEntradaEffective = applyIcmsCap(aliquotaOrcamento);

                                // Calculations
                                let calculatedTax = 0;
                                let formulaDetails: Record<string, any> = {};

                                if (selectedTaxType === 'DIFAL') {
                                    // DIFAL logic
                                    const baseComIpiEFrete = unitValue + ipiUnit + freteUnit;
                                    const c_icmsOrigem = baseComIpiEFrete * (aliquotaOrcamento / 100);
                                    const baseSemIcms = baseComIpiEFrete - c_icmsOrigem;
                                    const divisor = 1 - ALIQ_INTERNA_DESTINO;
                                    const c_baseCalculoDifal = divisor > 0 ? baseSemIcms / divisor : 0;
                                    const c_icmsDestino = c_baseCalculoDifal * ALIQ_INTERNA_DESTINO;
                                    const c_valorDifalBase = c_icmsDestino - c_icmsOrigem;
                                    const valorDifal = opInterestadual ? Math.max(0, c_valorDifalBase) : 0;
                                    
                                    calculatedTax = valorDifal;
                                    totalTaxAmount += valorDifal * qty;
                                    totalSimulatedCost += (unitValue + ipiUnit + freteUnit + valorDifal) * qty;

                                    formulaDetails = {
                                        opInterestadual,
                                        baseComIpiEFrete,
                                        c_icmsOrigem,
                                        baseSemIcms,
                                        c_baseCalculoDifal,
                                        c_icmsDestino,
                                        c_valorDifalBase,
                                        valorDifal,
                                        aliquotaOrcamento,
                                        aliquotaInternaDestino
                                    };
                                } else {
                                    // ICMS ST logic (REVENDA)
                                    const baseComMVA = (unitValue + ipiUnit) * (1 + mvaPercent / 100);
                                    const CRED = icmsEntradaEffective / 100;
                                    let calcIcmsStFinal = 0;
                                    
                                    if (stFlag && opInterestadual) {
                                        if (bitFlag) {
                                            const icmsStSaida = baseComMVA * FATOR_BIT * ALIQ_INTERNA_DESTINO;
                                            const icmsCredito = unitValue * FATOR_BIT * CRED;
                                            calcIcmsStFinal = Math.max(0, icmsStSaida - icmsCredito);
                                            formulaDetails = { bitFormula: true, baseComMVA, icmsStSaida, icmsCredito, calcIcmsStFinal, mvaPercent, bitFlag, stFlag };
                                        } else {
                                            const icmsStBruto = baseComMVA * ALIQ_INTERNA_DESTINO - unitValue * CRED;
                                            const icmsStProtegido = Math.max(0, icmsStBruto);
                                            calcIcmsStFinal = Math.max(0, icmsStProtegido * (1 - DESCONTO_CREDITO_OUTORGADO));
                                            formulaDetails = { bitFormula: false, baseComMVA, icmsStBruto, icmsStProtegido, calcIcmsStFinal, mvaPercent, bitFlag, stFlag };
                                        }
                                    } else {
                                        formulaDetails = { notEligible: true, stFlag, opInterestadual, mvaPercent };
                                    }

                                    calculatedTax = calcIcmsStFinal;
                                    totalTaxAmount += calcIcmsStFinal * qty;
                                    totalSimulatedCost += (unitValue + ipiUnit + freteUnit + calcIcmsStFinal) * qty;
                                }

                                return {
                                    item,
                                    qty,
                                    unitValue,
                                    ipiUnit,
                                    freteUnit,
                                    mvaPercent,
                                    bitFlag,
                                    stFlag,
                                    aliquotaOrcamento,
                                    icmsEntradaEffective,
                                    calculatedTax,
                                    formulaDetails
                                };
                            });

                            return (
                                <div className="space-y-6">
                                    {/* Totals Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-surface rounded-lg p-5 border border-border-subtle shadow-sm flex items-center justify-between">
                                            <div>
                                                <span className="text-text-muted text-xs font-bold uppercase tracking-wider block">Total de {selectedTaxType} Calculado</span>
                                                <span className="text-2xl font-bold text-brand-primary block mt-1">{formatCurrency(totalTaxAmount)}</span>
                                            </div>
                                            <div className="p-3 bg-brand-primary/10 rounded-full text-brand-primary">
                                                <DollarSign className="w-6 h-6" />
                                            </div>
                                        </div>
                                        <div className="bg-surface rounded-lg p-5 border border-border-subtle shadow-sm flex items-center justify-between">
                                            <div>
                                                <span className="text-text-muted text-xs font-bold uppercase tracking-wider block">Custo Total de Compra Simulado</span>
                                                <span className="text-2xl font-bold text-emerald-600 block mt-1">{formatCurrency(totalSimulatedCost)}</span>
                                                <span className="text-[10px] text-text-muted block mt-0.5">(Soma de Itens + IPI + Frete + Imposto Calculado)</span>
                                            </div>
                                            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-emerald-600">
                                                <CheckCircle2 className="w-6 h-6" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grid Table */}
                                    <div className="bg-surface rounded-lg border border-border-subtle shadow-sm overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-[#f8f9fa] dark:bg-bg-deep border-b border-border-subtle">
                                                    <tr className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                                                        <th className="px-6 py-3 w-16 text-center">Item</th>
                                                        <th className="px-6 py-3">Produto</th>
                                                        <th className="px-6 py-3 text-center">NCM</th>
                                                        {selectedTaxType === 'ICMS_ST' ? (
                                                            <>
                                                                <th className="px-6 py-3 text-center">MVA (%)</th>
                                                                <th className="px-6 py-3 text-center">BIT</th>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <th className="px-6 py-3 text-center">UF Origem</th>
                                                                <th className="px-6 py-3 text-center">UF Destino</th>
                                                            </>
                                                        )}
                                                        <th className="px-6 py-3 text-right">Qtd</th>
                                                        <th className="px-6 py-3 text-right">Valor Unit</th>
                                                        <th className="px-6 py-3 text-right">Aliq Origem (%)</th>
                                                        <th className="px-6 py-3 text-right">{selectedTaxType} Unit</th>
                                                        <th className="px-6 py-3 text-right">{selectedTaxType} Total</th>
                                                        <th className="px-6 py-3 text-right">Custo Total</th>
                                                        <th className="px-6 py-3"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border-subtle text-sm">
                                                    {calculatedItems.map(({ item, qty, unitValue, ipiUnit, freteUnit, mvaPercent, bitFlag, aliquotaOrcamento, icmsEntradaEffective, calculatedTax, formulaDetails }) => {
                                                        const isExpanded = expandedCalcItem === item.id;
                                                        return (
                                                            <React.Fragment key={item.id}>
                                                                <tr className="hover:bg-bg-deep/40 transition-colors">
                                                                    <td className="px-6 py-4 font-mono text-xs text-center text-text-muted">{item.nItem}</td>
                                                                    <td className="px-6 py-4">
                                                                        <div className="font-semibold text-text-primary">{item.xProd}</div>
                                                                        <div className="text-xs text-text-muted mt-0.5">Cód: {item.cProd}</div>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-center font-mono text-xs text-text-secondary">{item.NCM}</td>
                                                                    {selectedTaxType === 'ICMS_ST' ? (
                                                                        <>
                                                                            <td className="px-6 py-4 text-center font-semibold text-text-primary">{mvaPercent > 0 ? `${mvaPercent.toFixed(2)}%` : '-'}</td>
                                                                            <td className="px-6 py-4 text-center">
                                                                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${bitFlag ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'}`}>
                                                                                    {bitFlag ? 'SIM' : 'NÃO'}
                                                                                </span>
                                                                            </td>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <td className="px-6 py-4 text-center font-mono font-bold text-text-secondary">{ufOrigem}</td>
                                                                            <td className="px-6 py-4 text-center font-mono font-bold text-text-secondary">{ufDestino}</td>
                                                                        </>
                                                                    )}
                                                                    <td className="px-6 py-4 text-right font-mono">{formatNumber(qty)}</td>
                                                                    <td className="px-6 py-4 text-right font-semibold">{formatCurrency(unitValue)}</td>
                                                                    <td className="px-6 py-4 text-right font-mono">{aliquotaOrcamento}%</td>
                                                                    <td className="px-6 py-4 text-right text-brand-primary font-bold">{formatCurrency(calculatedTax)}</td>
                                                                    <td className="px-6 py-4 text-right text-brand-primary font-bold">{formatCurrency(calculatedTax * qty)}</td>
                                                                    <td className="px-6 py-4 text-right text-emerald-600 font-bold">{formatCurrency((unitValue + ipiUnit + freteUnit + calculatedTax) * qty)}</td>
                                                                    <td className="px-6 py-4 text-center">
                                                                        <button
                                                                            onClick={() => setExpandedCalcItem(isExpanded ? null : item.id)}
                                                                            className="p-1 border border-border-subtle rounded hover:bg-bg-deep cursor-pointer text-text-muted hover:text-text-primary transition-all flex items-center gap-1 text-xs"
                                                                            title="Memória de Cálculo"
                                                                        >
                                                                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                                            <span>Fórmula</span>
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                                {isExpanded && (
                                                                    <tr className="bg-bg-deep/30">
                                                                        <td colSpan={12} className="px-8 py-5 border-t border-b border-border-subtle">
                                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface p-5 rounded-lg border border-border-subtle shadow-inner">
                                                                                {/* Left Column: Calculation parameters and values */}
                                                                                <div className="space-y-3">
                                                                                    <h4 className="font-bold text-brand-primary text-xs uppercase tracking-wider flex items-center gap-1.5">
                                                                                        <span>Parâmetros de Entrada</span>
                                                                                    </h4>
                                                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-text-secondary">
                                                                                        <div>Valor Unitário: <strong className="text-text-primary">{formatCurrency(unitValue)}</strong></div>
                                                                                        <div>Quantidade: <strong className="text-text-primary">{formatNumber(qty)}</strong></div>
                                                                                        <div>Valor IPI Unit: <strong className="text-text-primary">{formatCurrency(ipiUnit)}</strong></div>
                                                                                        <div>Valor Frete Unit: <strong className="text-text-primary">{formatCurrency(freteUnit)}</strong></div>
                                                                                        <div>Alíq. Origem: <strong className="text-text-primary">{aliquotaOrcamento}%</strong></div>
                                                                                        {selectedTaxType === 'ICMS_ST' ? (
                                                                                            <>
                                                                                                <div>MVA Aplicado: <strong className="text-text-primary">{mvaPercent}%</strong></div>
                                                                                                <div>Enquadrado como BIT: <strong className="text-text-primary">{bitFlag ? 'SIM' : 'NÃO'}</strong></div>
                                                                                            </>
                                                                                        ) : (
                                                                                            <>
                                                                                                <div>UF Origem: <strong className="text-text-primary">{ufOrigem}</strong></div>
                                                                                                <div>UF Destino: <strong className="text-text-primary">{ufDestino}</strong></div>
                                                                                                <div>Alíq. Interna MT: <strong className="text-text-primary">17%</strong></div>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                {/* Right Column: Steps / Calculation Memory */}
                                                                                <div className="space-y-3 border-l border-border-subtle pl-6">
                                                                                    <h4 className="font-bold text-brand-primary text-xs uppercase tracking-wider flex items-center gap-1.5">
                                                                                        <span>Memória de Cálculo (Fórmula)</span>
                                                                                    </h4>
                                                                                    <div className="text-xs space-y-2 text-text-secondary text-left">
                                                                                        {selectedTaxType === 'DIFAL' ? (
                                                                                            (() => {
                                                                                                const fd = formulaDetails;
                                                                                                if (!fd.opInterestadual) {
                                                                                                    return <div className="text-amber-600 font-semibold">Operação interna (Origem = Destino). Isento de DIFAL.</div>;
                                                                                                }
                                                                                                return (
                                                                                                    <>
                                                                                                        <div>
                                                                                                            1. Base de Cálculo + IPI + Frete:<br/>
                                                                                                            <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                {unitValue.toFixed(2)} (Unit) + {ipiUnit.toFixed(2)} (IPI) + {freteUnit.toFixed(2)} (Frete) = {fd.baseComIpiEFrete.toFixed(2)}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        <div>
                                                                                                            2. ICMS de Origem:<br/>
                                                                                                            <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                {fd.baseComIpiEFrete.toFixed(2)} * {fd.aliquotaOrcamento}% = {fd.c_icmsOrigem.toFixed(2)}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        <div>
                                                                                                            3. Base sem ICMS (Base para divisão):<br/>
                                                                                                            <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                {fd.baseComIpiEFrete.toFixed(2)} - {fd.c_icmsOrigem.toFixed(2)} = {fd.baseSemIcms.toFixed(2)}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        <div>
                                                                                                            4. Base DIFAL por dentro (1 - {fd.aliquotaInternaDestino}%):<br/>
                                                                                                            <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                {fd.baseSemIcms.toFixed(2)} / {(1 - fd.aliquotaInternaDestino/100).toFixed(2)} = {fd.c_baseCalculoDifal.toFixed(2)}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        <div>
                                                                                                            5. ICMS Destino e Cálculo do DIFAL:<br/>
                                                                                                            <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                {fd.c_baseCalculoDifal.toFixed(2)} * 17% = {fd.c_icmsDestino.toFixed(2)}
                                                                                                            </span><br/>
                                                                                                            <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                DIFAL = {fd.c_icmsDestino.toFixed(2)} (Destino) - {fd.c_icmsOrigem.toFixed(2)} (Origem) = {fd.valorDifal.toFixed(2)}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    </>
                                                                                                );
                                                                                            })()
                                                                                        ) : (
                                                                                            (() => {
                                                                                                const fd = formulaDetails;
                                                                                                if (fd.notEligible) {
                                                                                                    return (
                                                                                                        <div className="text-amber-600 font-semibold">
                                                                                                            {!fd.opInterestadual ? 'Operação interna (Origem = Destino). Isento de ICMS ST.' : 'Sem MVA configurado para o NCM.'}
                                                                                                        </div>
                                                                                                    );
                                                                                                }
                                                                                                if (fd.bitFormula) {
                                                                                                    return (
                                                                                                        <>
                                                                                                            <div>
                                                                                                                1. Base com MVA:<br/>
                                                                                                                <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                    ({unitValue.toFixed(2)} + {ipiUnit.toFixed(2)}) * (1 + {fd.mvaPercent}%) = {fd.baseComMVA.toFixed(2)}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            <div>
                                                                                                                2. ICMS ST Saída (Fator BIT 41,17% e Alíquota MT 17%):<br/>
                                                                                                                <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                    {fd.baseComMVA.toFixed(2)} * 41,17% * 17% = {fd.icmsStSaida.toFixed(2)}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            <div>
                                                                                                                3. ICMS Crédito de Entrada:<br/>
                                                                                                                <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                    {unitValue.toFixed(2)} * 41,17% * {icmsEntradaEffective}% = {fd.icmsCredito.toFixed(2)}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            <div className="font-bold text-brand-primary">
                                                                                                                4. ICMS ST Final (Saída - Crédito):<br/>
                                                                                                                <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                    MAX(0, {fd.icmsStSaida.toFixed(2)} - {fd.icmsCredito.toFixed(2)}) = {fd.calcIcmsStFinal.toFixed(2)}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        </>
                                                                                                    );
                                                                                                } else {
                                                                                                    return (
                                                                                                        <>
                                                                                                            <div>
                                                                                                                1. Base com MVA:<br/>
                                                                                                                <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                    ({unitValue.toFixed(2)} + {ipiUnit.toFixed(2)}) * (1 + {fd.mvaPercent}%) = {fd.baseComMVA.toFixed(2)}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            <div>
                                                                                                                2. ICMS ST Bruto (Alíquota MT 17% - Crédito de Entrada):<br/>
                                                                                                                <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                    {fd.baseComMVA.toFixed(2)} * 17% - ({unitValue.toFixed(2)} * {icmsEntradaEffective}%) = {fd.icmsStBruto.toFixed(2)}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            <div>
                                                                                                                3. Aplicação do Crédito Outorgado (12% desconto):<br/>
                                                                                                                <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                    ST Protegido = {fd.icmsStProtegido.toFixed(2)}
                                                                                                                </span><br/>
                                                                                                                <span className="font-mono bg-bg-deep px-1 py-0.5 rounded text-text-primary">
                                                                                                                    ST Final = {fd.icmsStProtegido.toFixed(2)} * (1 - 12%) = {fd.calcIcmsStFinal.toFixed(2)}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        </>
                                                                                                    );
                                                                                                }
                                                                                            })()
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NfeAnalysisDetail;
