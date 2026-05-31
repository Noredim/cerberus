import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, ChevronLeft, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RentalAnalyticReport } from './components/RentalAnalyticReport';
import { SalesAnalyticReport } from './components/SalesAnalyticReport';

const KitAnalyticReport: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { userCompanies, activeCompanyId } = useAuth();
    const [kits, setKits] = useState<any[]>([]);
    const [selectedKitId, setSelectedKitId] = useState<string>(searchParams.get('kitId') || '');
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

    useEffect(() => {
        if (!loading && kitData && searchParams.get('print') === 'true') {
            setTimeout(() => {
                window.print();
            }, 800);
        }
    }, [loading, kitData, searchParams]);

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
                    @page { size: A4 portrait; margin: 10mm; }
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        background: white !important;
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
            {/* Header / Topbar - Hidden in Print or AutoPrint */}
            {searchParams.get('print') !== 'true' && (
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
                    <label htmlFor="select-opportunity-kit" className="sr-only">Selecionar Kit de Oportunidade</label>
                    <select
                        id="select-opportunity-kit"
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
            )}

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
                
                if (isRental) {
                    return (
                        <RentalAnalyticReport 
                            kitData={kitData} 
                            activeCompany={activeCompany} 
                            policies={policies}
                            formatCurrency={formatCurrency}
                            formatPercent={formatPercent}
                        />
                    );
                } else {
                    return (
                        <SalesAnalyticReport 
                            kitData={kitData} 
                            activeCompany={activeCompany} 
                            policies={policies}
                            formatCurrency={formatCurrency}
                            formatPercent={formatPercent}
                        />
                    );
                }
            })()}
        </div>
    );
};

export default KitAnalyticReport;
