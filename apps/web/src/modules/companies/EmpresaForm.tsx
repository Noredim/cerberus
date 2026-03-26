import React, { useEffect, useState } from 'react';
import {
    Building2,
    MapPin,
    Hash,
    Briefcase,
    ShieldCheck,
    ChevronLeft,
    Save,
    Search,
    Loader2,
    AlertTriangle,
    XCircle,
    WifiOff,
    UploadCloud,
    Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { useCompanies } from './hooks/useCompanies';
import { api } from '../../services/api';
import type { CNPJLookupResult } from './types';
import { CnaeAutocomplete } from './components/CnaeAutocomplete';

interface State {
    id: string;
    sigla: string;
    nome: string;
}

interface Municipality {
    id: string;
    nome: string;
    state_id: string;
}

const EmpresaForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const isReadOnly = location.pathname.includes('/detalhes/');

    const { getCompany, saveCompany, lookupCNPJ, uploadLogo, getSalesParameters, saveSalesParameters, loading: apiLoading } = useCompanies();

    const [activeTab, setActiveTab] = useState('basic');
    const [loading, setLoading] = useState(false);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [cepLoading, setCepLoading] = useState(false);
    const [states, setStates] = useState<State[]>([]);
    const [cities, setCities] = useState<Municipality[]>([]);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [availableBenefits, setAvailableBenefits] = useState<any[]>([]);
    const [autoFilledFields, setAutoFilledFields] = useState<string[]>([]);
    const [lastLookupSource, setLastLookupSource] = useState<string>('');
    const [lastLookupDate, setLastLookupDate] = useState<string>('');
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [submitError, setSubmitError] = useState<string>('');

    // Initial state matching CompanyCreate backend schema requirements
    const [formData, setFormData] = useState<any>({
        cnpj: '',
        razao_social: '',
        nome_fantasia: '',
        natureza_juridica_codigo: '',
        natureza_juridica_descricao: '',
        data_abertura: '',
        situacao_cadastral: '',
        porte: '',
        capital_social: '',
        email: '',
        telefone: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cep: '',
        municipality_id: '',
        state_id: '',
        cnaes: [],
        benefits: [],
        qsa: [],
        flags: { simples: false, simei: false },
        initial_tax_profile: {
            vigencia_inicio: new Date().toISOString().split('T')[0],
            regime_tributario: '',
            contribuinte_icms: false,
            contribuinte_iss: true,
            regime_iss: 'FIXO',
            regime_icms: 'NAO_APLICA'
        },
        nomenclatura_orcamento: 'OV',
        numero_proposta: 1
    });

    const [salesParameters, setSalesParameters] = useState<any>({
        mkp_padrao: 0, despesa_administrativa: 0, comissionamento: 0,
        pis: 0, cofins: 0, csll: 0, irpj: 0, iss: 0, icms_interno: 0, icms_externo: 0,
        // Venda de Equipamentos e Serviços
        mkp_padrao_venda: 0, despesa_administrativa_venda: 0, comissionamento_venda: 0,
        pis_venda: 0, cofins_venda: 0, csll_venda: 0, irpj_venda: 0, iss_venda: 0,
        icms_interno_venda: 0, icms_externo_venda: 0,
        // Locação de Equipamentos
        mkp_padrao_locacao: 0, despesa_administrativa_locacao: 0, comissionamento_locacao: 0,
        pis_locacao: 0, cofins_locacao: 0, csll_locacao: 0, irpj_locacao: 0, iss_locacao: 0,
        icms_interno_locacao: 0, icms_externo_locacao: 0,
        // Comodato de Equipamentos
        mkp_padrao_comodato: 0, despesa_administrativa_comodato: 0, comissionamento_comodato: 0,
        pis_comodato: 0, cofins_comodato: 0, csll_comodato: 0, irpj_comodato: 0, iss_comodato: 0,
        icms_interno_comodato: 0, icms_externo_comodato: 0,
    });

    const tabs = [
        { id: 'basic', label: 'Dados Básicos', icon: Building2 },
        { id: 'address', label: 'Endereço', icon: MapPin },
        { id: 'cnae', label: 'CNAEs', icon: Briefcase },
        { id: 'tax', label: 'Regime & Benefícios', icon: ShieldCheck },
        { id: 'sales_params', label: 'Parâmetros de Venda', icon: Hash },
        { id: 'qsa', label: 'Quadro de Sócios', icon: Building2 },
    ];

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [statesRes, benefitsRes] = await Promise.all([
                    api.get('/catalog/states'),
                    api.get('/tax-benefits')
                ]);
                setStates(statesRes.data);
                setAvailableBenefits(benefitsRes.data);

                if (id) {
                    setLoading(true);
                    const company: any = await getCompany(id);

                    try {
                        const benefitsResult = await api.get(`/tax-benefits/companies/${id}/benefits`);
                        company.benefits = benefitsResult.data;
                    } catch (e) {
                        company.benefits = [];
                    }

                    // Hydrate tax status flags for UI
                    const activeProfile = company.tax_profiles?.find((p: any) => p.vigencia_fim === null);

                    setFormData((prev: any) => ({
                        ...company,
                        qsa: company.qsa || [], // Ensure QSA is at least an empty array for existing companies
                        // Hydrate if editing
                        state_id: company.state_id,
                        municipality_id: company.municipality_id,
                        initial_tax_profile: activeProfile ? {
                            vigencia_inicio: activeProfile.vigencia_inicio,
                            regime_tributario: activeProfile.regime_tributario,
                            contribuinte_icms: activeProfile.contribuinte_icms,
                            contribuinte_iss: activeProfile.contribuinte_iss,
                            regime_iss: activeProfile.regime_iss,
                            regime_icms: activeProfile.regime_icms
                        } : prev.initial_tax_profile,
                        flags: {
                            simples: activeProfile?.regime_tributario === 'SIMPLES_NACIONAL' || activeProfile?.regime_tributario === 'MEI',
                            simei: activeProfile?.regime_tributario === 'MEI'
                        }
                    }));
                    if (company.state_id) {
                        fetchCities(company.state_id);
                    }

                    // Load Sales Parameters
                    try {
                        const salesParams = await getSalesParameters(id);
                        if (salesParams) {
                            setSalesParameters(salesParams);
                        }
                    } catch (e) {
                        console.error('Failed to load sales parameters', e);
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [id, isReadOnly]);

    const fetchCities = async (stateId: string) => {
        try {
            const res = await api.get(`/catalog/cities?state_id=${stateId}&page_size=1000`);
            setCities(res.data.items || res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCepLookup = async () => {
        const cep = formData.cep.replace(/\D/g, '');
        if (cep.length !== 8) return;

        setCepLoading(true);
        try {
            const res = await api.get(`/utils/cep/${cep}`);
            const data = res.data;

            // Find state by signature
            const state = states.find(s => s.sigla === data.uf);

            if (state) {
                // Fetch cities for this state to find the ID
                const citiesRes = await api.get(`/catalog/cities?state_id=${state.id}`);
                const stateCities = citiesRes.data.items || citiesRes.data; // Handle paginated or list response
                setCities(stateCities);

                // Find city by IBGE code (number comparison)
                const city = stateCities.find((c: any) => String(c.ibge_id) === String(data.ibge));

                setFormData((prev: any) => ({
                    ...prev,
                    logradouro: prev.logradouro || data.logradouro,
                    bairro: prev.bairro || data.bairro,
                    state_id: state.id,
                    municipality_id: city?.id || ''
                }));
            }
        } catch (err: any) {
            console.error('Falha ao buscar CEP:', err);
            const detail = err.response?.data?.detail || err.message;
            alert(`Erro na busca de CEP: ${detail}`);
        } finally {
            setCepLoading(false);
        }
    };

    const handleCnpjLookup = async (forceRefresh: boolean = false) => {
        const cnpjStr = formData.cnpj?.replace(/\D/g, '') || '';
        if (cnpjStr.length < 14) return;
        setLookupLoading(true);
        try {
            const response: CNPJLookupResult = await lookupCNPJ(formData.cnpj, forceRefresh);

            if (!response.success) {
                alert('A consulta falhou ou retornou sem sucesso.');
                return;
            }

            const result = response.normalizedData;
            setLastLookupSource(response.source); // e.g. CACHE or RECEITAWS
            setLastLookupDate(new Date().toLocaleString('pt-BR'));

            // Map state acronym to ID
            const state = states.find(s => s.sigla === result.endereco?.uf);
            let cityId = '';

            if (state) {
                try {
                    const citiesRes = await api.get(`/catalog/cities?state_id=${state.id}`);
                    const stateCities = citiesRes.data.items || citiesRes.data;
                    setCities(stateCities);

                    // 1. Validação via CEP primeiro (Garante 100% de acerto via IBGE)
                    if (result.endereco?.cep) {
                        try {
                            const cepStr = result.endereco.cep.replace(/\D/g, '');
                            if (cepStr.length === 8) {
                                const cepRes = await api.get(`/utils/cep/${cepStr}`);
                                const ibge = cepRes.data.ibge;
                                if (ibge) {
                                    const cityByIbge = stateCities.find((c: any) => String(c.ibge_id) === String(ibge));
                                    if (cityByIbge) cityId = cityByIbge.id;
                                }
                            }
                        } catch (e) {
                            console.error('Falha na validação do CEP, tentando por nome...', e);
                        }
                    }

                    // 2. Fallback por nome caso a API de CEP falhe ou não encontre IBGE
                    if (!cityId) {
                        const city = stateCities.find((c: any) =>
                            c.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() ===
                            (result.endereco?.municipio || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim()
                        );
                        if (city) {
                            cityId = city.id;
                        }
                    }
                } catch (err) {
                    console.error('Falha ao buscar cidades no estado ' + state.sigla);
                }
            }

            let regime_tributario = formData.initial_tax_profile?.regime_tributario || '';
            let vigencia_inicio = formData.initial_tax_profile?.vigencia_inicio || new Date().toISOString().split('T')[0];

            if (result.simei?.optante) {
                regime_tributario = 'MEI';
                if ((result.simei as any).data_opcao) {
                    const d = String((result.simei as any).data_opcao).split('T')[0];
                    vigencia_inicio = d.includes('/') ? d.split('/').reverse().join('-') : d;
                }
            } else if (result.simples?.optante) {
                regime_tributario = 'SIMPLES_NACIONAL';
                if ((result.simples as any).data_opcao) {
                    const d = String((result.simples as any).data_opcao).split('T')[0];
                    vigencia_inicio = d.includes('/') ? d.split('/').reverse().join('-') : d;
                }
            } else if (result.simei?.optante === false && result.simples?.optante === false) {
                regime_tributario = ''; // Force user to choose
            }

            setFormData((prev: any) => ({
                ...prev,
                tipo: result.tipo || prev.tipo,
                razao_social: result.razaoSocial || prev.razao_social,
                nome_fantasia: result.nomeFantasia || prev.nome_fantasia,
                natureza_juridica_codigo: result.naturezaJuridica || prev.natureza_juridica_codigo,
                data_abertura: result.dataAbertura ? result.dataAbertura.split('/').reverse().join('-') : prev.data_abertura,
                porte: result.porte || prev.porte,
                capital_social: result.capitalSocial || prev.capital_social,
                situacao_cadastral: result.situacaoCadastral || prev.situacao_cadastral,
                email: result.email || prev.email,
                telefone: result.telefone || prev.telefone,
                logradouro: result.endereco?.logradouro || prev.logradouro,
                numero: result.endereco?.numero || prev.numero,
                complemento: result.endereco?.complemento || prev.complemento,
                bairro: result.endereco?.bairro || prev.bairro,
                cep: result.endereco?.cep || prev.cep,
                state_id: state?.id || prev.state_id,
                municipality_id: cityId || prev.municipality_id,
                cnaes: [
                    ...(result.atividadePrincipal || []).map(c => ({ cnae_codigo: c.codigo, tipo: 'PRIMARIO', descricao: c.descricao })),
                    ...(result.atividadesSecundarias || []).map(c => ({ cnae_codigo: c.codigo, tipo: 'SECUNDARIO', descricao: c.descricao }))
                ],
                qsa: result.qsa || [],
                flags: { simples: !!result.simples?.optante, simei: !!result.simei?.optante },
                initial_tax_profile: {
                    ...prev.initial_tax_profile,
                    regime_tributario: regime_tributario,
                    vigencia_inicio: vigencia_inicio
                }
            }));

            // Marcar campos preenchidos para highlight UI
            setAutoFilledFields([
                'tipo', 'razao_social', 'nome_fantasia', 'natureza_juridica_codigo', 'data_abertura', 'porte', 'capital_social', 'situacao_cadastral', 'email', 'telefone', 'logradouro', 'numero', 'complemento', 'bairro', 'cep', 'state_id', 'municipality_id', 'cnaes'
            ]);

        } catch (err) {
            alert('Falha ao consultar CNPJ na base pública.');
        } finally {
            setLookupLoading(false);
        }
    };

    const validateForm = (): Record<string, string> => {
        const errors: Record<string, string> = {};
        const cnpjStr = formData.cnpj?.replace(/\D/g, '') || '';

        if (cnpjStr.length < 14) {
            errors.cnpj = 'CNPJ é obrigatório (14 dígitos).';
        }
        if (!formData.razao_social?.trim()) {
            errors.razao_social = 'Razão Social é obrigatória.';
        }
        if (!formData.state_id) {
            errors.state_id = 'Estado (UF) é obrigatório.';
        }
        if (!formData.municipality_id) {
            errors.municipality_id = 'Município é obrigatório.';
        }

        const primaryCnaes = (formData.cnaes || []).filter((c: any) => c.tipo === 'PRIMARIO');
        if (primaryCnaes.length !== 1) {
            errors.cnaes = 'É necessário exatamente 1 CNAE Primário.';
        }

        const validRegimes = ['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI', 'OUTRO'];
        const initialRegime = formData.initial_tax_profile?.regime_tributario;
        const activeProfile = formData.tax_profiles?.find((p: any) => p.vigencia_fim === null);
        const currentRegime = activeProfile?.regime_tributario || initialRegime;

        if (!currentRegime || !validRegimes.includes(currentRegime)) {
            errors.regime_tributario = 'Regime Tributário é obrigatório.';
        }

        return errors;
    };

    const getTabForField = (field: string): string => {
        if (['cnpj', 'razao_social'].includes(field)) return 'basic';
        if (['state_id', 'municipality_id'].includes(field)) return 'address';
        if (field === 'cnaes') return 'cnae';
        if (field === 'regime_tributario') return 'tax';
        return 'basic';
    };

    const getTabErrors = (tabId: string): number => {
        return Object.keys(validationErrors).filter(f => getTabForField(f) === tabId).length;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');

        const errors = validateForm();
        setValidationErrors(errors);

        if (Object.keys(errors).length > 0) {
            const firstErrorTab = getTabForField(Object.keys(errors)[0]);
            setActiveTab(firstErrorTab);
            return;
        }

        try {
            const { flags, initial_tax_profile, ...rest } = formData;
            const payload = {
                ...rest,
                // Only send initial_tax_profile if it's a new company
                ...(id ? {} : { initial_tax_profile }),
                cnaes: (rest.cnaes || []).map(({ cnae_codigo, tipo }: any) => ({ cnae_codigo, tipo })),
                qsa: rest.qsa || []
            };

            const savedCompany = await saveCompany(payload);

            // Save Sales Parameters
            if (savedCompany && savedCompany.id) {
                await saveSalesParameters(savedCompany.id, salesParameters);
            }

            navigate('/empresas');
        } catch (err: any) {
            if (!err.response) {
                setSubmitError('Não foi possível conectar ao servidor. Verifique se a API está rodando em localhost:8000.');
                return;
            }

            const responseData = err.response.data;
            if (responseData?.mensagens && Array.isArray(responseData.mensagens)) {
                setSubmitError(responseData.mensagens.join(' • '));
            } else if (Array.isArray(responseData?.detail)) {
                const messages = responseData.detail.map((d: any) => `${d.loc?.slice(1).join('.')}: ${d.msg}`).join(' • ');
                setSubmitError(messages);
            } else {
                const msg = responseData?.detail || responseData?.erro || 'Erro inesperado ao salvar empresa.';
                setSubmitError(msg);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
        );
    }

    const getFieldClass = (fieldName: string, defaultClass: string = "w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm") => {
        if (validationErrors[fieldName]) {
            return `${defaultClass} border-red-500 ring-1 ring-red-500/30 bg-red-50/10`;
        }
        if (autoFilledFields.includes(fieldName)) {
            return `${defaultClass} bg-green-50/20 border-green-500/50 ring-1 ring-green-500/20 transition-all duration-1000`;
        }
        return defaultClass;
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !id) return;
        const file = e.target.files[0];
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            alert('Formato de imagem inválido. Use JPG ou PNG.');
            return;
        }

        setIsUploadingLogo(true);
        try {
            const updatedCompany = await uploadLogo(id, file);
            setFormData((prev: any) => ({ ...prev, logo_url: updatedCompany.logo_url }));
        } catch (err) {
            console.error('Falha no upload', err);
        } finally {
            setIsUploadingLogo(false);
        }
    };

    const FieldError: React.FC<{ field: string }> = ({ field }) => {
        if (!validationErrors[field]) return null;
        return <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{validationErrors[field]}</p>;
    };

    return (
        <div className="space-y-6 w-full pb-10">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/empresas')}
                        className="p-2 rounded-md hover:bg-bg-deep text-text-muted transition-colors cursor-pointer"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                                {isReadOnly ? 'Detalhes da' : id ? 'Editar' : 'Nova'} <span className="text-brand-primary">Empresa</span>
                            </h1>
                            {isReadOnly && id && (
                                <Link
                                    to={`/empresas/editar/${id}`}
                                    className="flex items-center gap-1.5 bg-brand-primary/10 text-brand-primary border border-brand-primary/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-primary/20 transition-all cursor-pointer"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    Editar
                                </Link>
                            )}
                        </div>
                        <p className="text-text-muted mt-1">Prencha os dados cadastrais e fiscais da unidade.</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    {!isReadOnly && (
                        <button
                            form="company-form"
                            type="submit"
                            disabled={apiLoading}
                            className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-md font-semibold hover:bg-brand-primary/90 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                        >
                            {apiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Salvar Empresa
                        </button>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Tabs Sidebar */}
                <div className="lg:col-span-1 space-y-2">
                    {tabs.map((tab) => {
                        const errorCount = getTabErrors(tab.id);
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 p-3.5 rounded-lg border transition-all cursor-pointer ${activeTab === tab.id
                                    ? 'bg-brand-primary/5 border-brand-primary text-brand-primary font-bold shadow-sm'
                                    : errorCount > 0
                                        ? 'bg-red-50/10 border-red-500/50 text-red-500 hover:border-red-500'
                                        : 'bg-surface border-border-subtle text-text-muted hover:border-brand-primary/30 hover:text-text-primary'
                                    }`}
                            >
                                <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-brand-primary' : errorCount > 0 ? 'text-red-500' : ''}`} />
                                <span className="text-[15px] flex-1 text-left">{tab.label}</span>
                                {errorCount > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                        {errorCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Form Panels */}
                <div className="lg:col-span-3 bg-surface rounded-lg border border-border-subtle shadow-sm p-8 min-h-[500px]">
                    <form id="company-form" onSubmit={handleSubmit} className="space-y-8">
                        <fieldset disabled={isReadOnly} className="space-y-8 min-w-0 w-full group">
                            {/* Error Banner */}
                            {(Object.keys(validationErrors).length > 0 || submitError) && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`p-4 rounded-lg border flex items-start gap-3 ${submitError && !Object.keys(validationErrors).length
                                        ? 'bg-amber-50/20 border-amber-500/30'
                                        : 'bg-red-50/20 border-red-500/30'
                                        }`}
                                >
                                    {submitError && !Object.keys(validationErrors).length ? (
                                        <WifiOff className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                    )}
                                    <div className="flex-1">
                                        {Object.keys(validationErrors).length > 0 && (
                                            <>
                                                <p className="text-sm font-bold text-red-500 mb-2">Campos obrigatórios não preenchidos:</p>
                                                <ul className="space-y-1">
                                                    {Object.entries(validationErrors).map(([field, msg]) => (
                                                        <li key={field} className="text-xs text-red-400 flex items-center gap-1.5">
                                                            <span className="w-1 h-1 bg-red-400 rounded-full shrink-0" />
                                                            {msg}
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveTab(getTabForField(field))}
                                                                className="text-red-500 underline hover:text-red-600 ml-1 font-medium"
                                                            >
                                                                Ir para aba
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                        {submitError && (
                                            <p className={`text-sm font-medium ${Object.keys(validationErrors).length > 0 ? 'text-red-400 mt-2 pt-2 border-t border-red-500/20' : 'text-amber-500'}`}>
                                                {submitError}
                                            </p>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                            <AnimatePresence mode="wait">
                                {activeTab === 'basic' && (
                                    <motion.div
                                        key="basic"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="space-y-6"
                                    >
                                        <div className="flex flex-col gap-2">
                                            <h2 className="text-xl font-bold text-text-primary">Identificação</h2>
                                            <p className="text-sm text-text-muted">Dados fundamentais da pessoa jurídica.</p>
                                        </div>

                                        {/* LOGO UPLOAD COMPONENT */}
                                        <div className="flex border border-border-subtle rounded-lg p-4 bg-bg-deep items-center gap-6">
                                            <div className="w-24 h-24 rounded-full bg-surface border border-border-subtle flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                                                {formData.logo_url ? (
                                                    <img src={`http://localhost:8000${formData.logo_url}`} alt="Logo" className="w-full h-full object-contain" />
                                                ) : (
                                                    <Building2 className="w-8 h-8 text-text-muted opacity-50" />
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <h3 className="text-sm font-bold text-text-primary">Logo da Empresa</h3>
                                                <p className="text-xs text-text-muted mb-3 max-w-sm">
                                                    Tipos aceitos: JPG, JPEG, PNG. {id ? 'A logo atualiza na hora e reflete nos documentos gerados.' : 'Salve a empresa primeiro para adicionar a logo.'}
                                                </p>
                                                <label
                                                    className={`flex items-center gap-2 w-fit px-4 py-2 rounded text-xs font-bold transition-all ${id && !isUploadingLogo
                                                        ? 'bg-surface border border-border-subtle text-text-primary hover:bg-brand-primary/5 hover:border-brand-primary/30 cursor-pointer shadow-sm'
                                                        : 'bg-bg-deep border border-border-subtle text-text-muted opacity-60 cursor-not-allowed'
                                                        }`}
                                                >
                                                    {isUploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                                                    {isUploadingLogo ? 'Enviando...' : 'Selecionar Imagem'}
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept=".png,.jpg,.jpeg"
                                                        onChange={handleLogoUpload}
                                                        disabled={!id || isUploadingLogo}
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">CNPJ (Somente números)</label>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                                                        <input
                                                            type="text"
                                                            maxLength={18}
                                                            value={formData.cnpj}
                                                            onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                                                            placeholder="00.000.000/0001-00"
                                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 pl-9 pr-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                                            required
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCnpjLookup(false)}
                                                        disabled={lookupLoading || (formData.cnpj?.replace(/\D/g, '') || '').length < 14}
                                                        className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-md hover:bg-brand-primary/20 transition-all text-sm font-semibold disabled:opacity-50 cursor-pointer border border-brand-primary/20"
                                                    >
                                                        {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                                        Consultar
                                                    </button>
                                                </div>

                                                <div className="flex flex-col gap-2 mt-2">
                                                    {!id && <p className="text-[10px] text-brand-info font-medium italic">* A consulta preenche automaticamente os dados da Receita.</p>}

                                                    {(lastLookupSource || lastLookupDate) && (
                                                        <div className="flex items-center justify-between bg-brand-primary/5 p-3 rounded border border-brand-primary/20">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-xs font-bold text-brand-primary">Status da Consulta</span>
                                                                <span className="text-[10px] text-text-muted">Atualizada em: {lastLookupDate || 'N/A'} (Origem: {lastLookupSource === 'CACHE' ? 'Cache Local' : 'ReceitaWS'})</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCnpjLookup(true)}
                                                                disabled={lookupLoading}
                                                                className="text-[10px] font-bold text-brand-primary hover:underline"
                                                            >
                                                                Atualizar Consulta
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Razão Social *</label>
                                                <input
                                                    type="text"
                                                    value={formData.razao_social}
                                                    onChange={e => { setFormData({ ...formData, razao_social: e.target.value }); setValidationErrors(prev => { const n = { ...prev }; delete n.razao_social; return n; }); }}
                                                    className={getFieldClass('razao_social')}
                                                    required
                                                />
                                                <FieldError field="razao_social" />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Nome Fantasia</label>
                                                <input
                                                    type="text"
                                                    value={formData.nome_fantasia}
                                                    onChange={e => setFormData({ ...formData, nome_fantasia: e.target.value })}
                                                    className={getFieldClass('nome_fantasia')}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 mt-8">
                                            <h2 className="text-xl font-bold text-text-primary">Demais Informações</h2>
                                            <p className="text-sm text-text-muted">Detalhes de contato e estruturação jurídica.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Tipo</label>
                                                <select
                                                    value={formData.tipo}
                                                    onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                                                    className={getFieldClass('tipo')}
                                                    disabled={autoFilledFields.includes('tipo')}
                                                >
                                                    <option value="MATRIZ">Matriz</option>
                                                    <option value="FILIAL">Filial</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Natureza Jurídica</label>
                                                <input
                                                    type="text"
                                                    value={formData.natureza_juridica_codigo || ''}
                                                    onChange={e => setFormData({ ...formData, natureza_juridica_codigo: e.target.value })}
                                                    className={getFieldClass('natureza_juridica_codigo')}
                                                    disabled={autoFilledFields.includes('natureza_juridica_codigo')}
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Data de Abertura</label>
                                                <input
                                                    type="date"
                                                    value={formData.data_abertura ? formData.data_abertura.split('T')[0] : ''}
                                                    onChange={e => setFormData({ ...formData, data_abertura: e.target.value })}
                                                    className={getFieldClass('data_abertura')}
                                                    disabled={autoFilledFields.includes('data_abertura')}
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Porte</label>
                                                <input
                                                    type="text"
                                                    value={formData.porte || ''}
                                                    onChange={e => setFormData({ ...formData, porte: e.target.value })}
                                                    className={getFieldClass('porte')}
                                                    disabled={autoFilledFields.includes('porte')}
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Capital Social</label>
                                                <input
                                                    type="text"
                                                    value={formData.capital_social ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(formData.capital_social)) : ''}
                                                    onChange={e => {
                                                        const value = e.target.value.replace(/\D/g, '');
                                                        setFormData({ ...formData, capital_social: value ? (Number(value) / 100).toFixed(2) : '' })
                                                    }}
                                                    className={getFieldClass('capital_social')}
                                                    disabled={autoFilledFields.includes('capital_social')}
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Situação Cadastral</label>
                                                <input
                                                    type="text"
                                                    value={formData.situacao_cadastral || formData.status}
                                                    onChange={e => setFormData({ ...formData, situacao_cadastral: e.target.value })}
                                                    className={getFieldClass('situacao_cadastral')}
                                                    disabled={autoFilledFields.includes('situacao_cadastral')}
                                                />
                                            </div>

                                            <div className="space-y-1.5 lg:col-span-2">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">E-mail</label>
                                                <input
                                                    type="email"
                                                    value={formData.email || ''}
                                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                    className={getFieldClass('email')}
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Telefone</label>
                                                <input
                                                    type="text"
                                                    value={formData.telefone || ''}
                                                    onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                                                    className={getFieldClass('telefone')}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {activeTab === 'address' && (
                                    <motion.div
                                        key="address"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="space-y-8"
                                    >
                                        <div className="space-y-6">
                                            <div className="flex flex-col gap-2">
                                                <h2 className="text-xl font-bold text-text-primary">Endereço</h2>
                                                <p className="text-sm text-text-muted">Localização física para determinação de competência tributária.</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                                                <div className="md:col-span-2 space-y-1.5">
                                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">CEP</label>
                                                    <div className="flex gap-2">
                                                        <div className="relative flex-1">
                                                            <input
                                                                type="text"
                                                                maxLength={9}
                                                                value={formData.cep}
                                                                onBlur={handleCepLookup}
                                                                onChange={e => setFormData({ ...formData, cep: e.target.value })}
                                                                placeholder="00000-000"
                                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={handleCepLookup}
                                                            disabled={cepLoading || formData.cep.replace(/\D/g, '').length < 8}
                                                            className="p-2 bg-brand-primary/10 text-brand-primary rounded-md hover:bg-brand-primary/20 transition-all border border-brand-primary/20 disabled:opacity-50 cursor-pointer"
                                                            title="Buscar CEP"
                                                        >
                                                            {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="md:col-span-4 space-y-1.5">
                                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Rua / Logradouro</label>
                                                    <input
                                                        type="text"
                                                        value={formData.logradouro}
                                                        onChange={e => setFormData({ ...formData, logradouro: e.target.value })}
                                                        className={getFieldClass('logradouro')}
                                                    />
                                                </div>
                                                <div className="md:col-span-1 space-y-1.5">
                                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Nº</label>
                                                    <input
                                                        type="text"
                                                        value={formData.numero}
                                                        onChange={e => setFormData({ ...formData, numero: e.target.value })}
                                                        className={getFieldClass('numero')}
                                                    />
                                                </div>
                                                <div className="md:col-span-2 space-y-1.5">
                                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Complemento</label>
                                                    <input
                                                        type="text"
                                                        value={formData.complemento}
                                                        onChange={e => setFormData({ ...formData, complemento: e.target.value })}
                                                        className={getFieldClass('complemento')}
                                                    />
                                                </div>
                                                <div className="md:col-span-3 space-y-1.5">
                                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Bairro</label>
                                                    <input
                                                        type="text"
                                                        value={formData.bairro}
                                                        onChange={e => setFormData({ ...formData, bairro: e.target.value })}
                                                        className={getFieldClass('bairro')}
                                                    />
                                                </div>
                                                <div className="md:col-span-2 space-y-1.5">
                                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Estado (UF) *</label>
                                                    <select
                                                        value={formData.state_id}
                                                        onChange={e => {
                                                            setFormData({ ...formData, state_id: e.target.value, municipality_id: '' });
                                                            setValidationErrors(prev => { const n = { ...prev }; delete n.state_id; return n; });
                                                            fetchCities(e.target.value);
                                                        }}
                                                        className={getFieldClass('state_id')}
                                                        required
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {states.map(s => <option key={s.id} value={s.id}>{s.sigla} - {s.nome}</option>)}
                                                    </select>
                                                    <FieldError field="state_id" />
                                                </div>
                                                <div className="md:col-span-4 space-y-1.5">
                                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Município *</label>
                                                    <select
                                                        value={formData.municipality_id}
                                                        onChange={e => { setFormData({ ...formData, municipality_id: e.target.value }); setValidationErrors(prev => { const n = { ...prev }; delete n.municipality_id; return n; }); }}
                                                        className={getFieldClass('municipality_id')}
                                                        disabled={!formData.state_id}
                                                        required
                                                    >
                                                        <option value="">Selecione primeiro o estado...</option>
                                                        {cities.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                                    </select>
                                                    <FieldError field="municipality_id" />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {activeTab === 'cnae' && (
                                    <motion.div
                                        key="cnae"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="space-y-6"
                                    >
                                        <div className="flex flex-col gap-2">
                                            <h2 className="text-xl font-bold text-text-primary">Atividades (CNAE)</h2>
                                            <p className="text-sm text-text-muted">Atividade Principal (CNPJ) e Secundárias.</p>
                                        </div>

                                        <div className="space-y-5">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-text-muted">CNAE Primário é obrigatório. Secundários são opcionais.</p>
                                                {!id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({
                                                            ...formData,
                                                            cnaes: [...formData.cnaes, { cnae_codigo: '', tipo: 'SECUNDARIO', descricao: '' }]
                                                        })}
                                                        className="flex items-center gap-1.5 text-sm text-brand-primary font-semibold hover:underline"
                                                    >
                                                        + Adicionar CNAE
                                                    </button>
                                                )}
                                            </div>

                                            {formData.cnaes.length === 0 && (
                                                <div className="p-10 border-2 border-dashed border-border-subtle rounded-lg text-center bg-bg-deep/50">
                                                    <Briefcase className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
                                                    <p className="text-text-muted font-medium">Nenhum CNAE vinculado.</p>
                                                    <p className="text-xs text-text-muted mt-2">
                                                        {id ? 'Os CNAEs são definidos no momento do cadastro.' : 'Clique em "+ Adicionar CNAE" ou consulte pelo CNPJ.'}
                                                    </p>
                                                </div>
                                            )}

                                            {formData.cnaes.map((c: any, idx: number) => (
                                                <div key={idx} className="p-4 bg-bg-deep border border-border-subtle rounded-md grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                                    <div className="md:col-span-1 space-y-1.5">
                                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Tipo</label>
                                                        <select
                                                            value={c.tipo}
                                                            disabled={!!id}
                                                            onChange={e => {
                                                                const updated = [...formData.cnaes];
                                                                updated[idx] = { ...updated[idx], tipo: e.target.value };
                                                                setFormData({ ...formData, cnaes: updated });
                                                            }}
                                                            className="w-full bg-surface border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary transition-colors text-sm"
                                                        >
                                                            <option value="PRIMARIO">Primário</option>
                                                            <option value="SECUNDARIO">Secundário</option>
                                                        </select>
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        {!id ? (
                                                            <CnaeAutocomplete
                                                                label="CNAE"
                                                                value={c.cnae_codigo}
                                                                displayValue={c.descricao ? `${c.cnae_codigo} - ${c.descricao}` : c.cnae_codigo}
                                                                onChange={(codigo, descricao) => {
                                                                    const updated = [...formData.cnaes];
                                                                    updated[idx] = { ...updated[idx], cnae_codigo: codigo, descricao };
                                                                    setFormData({ ...formData, cnaes: updated });
                                                                }}
                                                                placeholder="Buscar por código ou nome..."
                                                            />
                                                        ) : (
                                                            <div className="space-y-1.5">
                                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">CNAE</label>
                                                                <div className="bg-surface border border-border-subtle rounded-md py-2 px-3 text-sm font-mono text-text-primary truncate" title={`${c.cnae_codigo} ${c.descricao ? `- ${c.descricao}` : ''}`}>
                                                                    {c.cnae_codigo} {c.descricao ? `- ${c.descricao}` : ''}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!id && (
                                                        <div className="flex justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const updated = formData.cnaes.filter((_: any, i: number) => i !== idx);
                                                                    setFormData({ ...formData, cnaes: updated });
                                                                }}
                                                                className="text-red-500 hover:text-red-700 p-2 border border-border-subtle rounded-md bg-surface"
                                                            >
                                                                Remover
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {activeTab === 'tax' && (
                                    <motion.div
                                        key="tax"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="space-y-6"
                                    >
                                        <div className="flex flex-col gap-2">
                                            <h2 className="text-xl font-bold text-text-primary">Regime Tributário Inicial</h2>
                                            <p className="text-sm text-text-muted">Configuração de vigência e regras de benefícios para o cadastro novo.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Regime Tributário *</label>
                                                <select
                                                    value={id ? (formData.tax_profiles?.find((p: any) => p.vigencia_fim === null)?.regime_tributario || formData.initial_tax_profile.regime_tributario) : formData.initial_tax_profile.regime_tributario}
                                                    onChange={e => {
                                                        if (id) return;
                                                        setFormData({
                                                            ...formData,
                                                            initial_tax_profile: { ...formData.initial_tax_profile, regime_tributario: e.target.value }
                                                        }); setValidationErrors(prev => { const n = { ...prev }; delete n.regime_tributario; return n; });
                                                    }}
                                                    disabled={!!id}
                                                    className={validationErrors.regime_tributario ? 'w-full bg-bg-deep border border-red-500 ring-1 ring-red-500/30 rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm' : 'w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm'}
                                                >
                                                    <option value="">Selecione...</option>
                                                    <option value="SIMPLES_NACIONAL">Simples Nacional</option>
                                                    <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                                                    <option value="LUCRO_REAL">Lucro Real</option>
                                                    <option value="MEI">MEI</option>
                                                </select>
                                                <FieldError field="regime_tributario" />
                                                {id && (
                                                    <p className="text-[10px] text-text-muted mt-1 italic">Alteração de regime bloqueada nesta tela (use Histórico).</p>
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Início da Vigência</label>
                                                <input
                                                    type="date"
                                                    value={id ? (formData.tax_profiles?.find((p: any) => p.vigencia_fim === null)?.vigencia_inicio || formData.initial_tax_profile.vigencia_inicio) : formData.initial_tax_profile.vigencia_inicio}
                                                    onChange={e => {
                                                        if (id) return;
                                                        setFormData({
                                                            ...formData,
                                                            initial_tax_profile: { ...formData.initial_tax_profile, vigencia_inicio: e.target.value }
                                                        });
                                                    }}
                                                    disabled={!!id}
                                                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm disabled:opacity-70"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-8 pt-8 border-t border-border-subtle">
                                            <div className="flex flex-col gap-2 mb-6">
                                                <h2 className="text-xl font-bold text-text-primary">Benefícios Fiscais Habilitados</h2>
                                                <p className="text-sm text-text-muted">Vincule os benefícios fiscais tributários aplicáveis a esta empresa.</p>
                                            </div>

                                            <div className="space-y-4">
                                                {formData.benefits.map((b: any, bIdx: number) => {
                                                    return (
                                                        <div key={bIdx} className="p-4 bg-bg-deep border border-border-subtle rounded-md grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                                            <div className="md:col-span-2 space-y-1.5">
                                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Benefício</label>
                                                                <select
                                                                    value={b.benefit_id}
                                                                    onChange={e => {
                                                                        const newBenefits = [...formData.benefits];
                                                                        newBenefits[bIdx].benefit_id = e.target.value;
                                                                        setFormData({ ...formData, benefits: newBenefits });
                                                                    }}
                                                                    disabled={!!id} // Do not allow changing the benefit type on edit to avoid complexity for now
                                                                    className="w-full bg-surface border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                                                >
                                                                    <option value="">Selecione...</option>
                                                                    {availableBenefits.map(ab => (
                                                                        <option key={ab.id} value={ab.id}>{ab.nome} ({ab.esfera})</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Início Vigência</label>
                                                                <input
                                                                    type="date"
                                                                    value={b.vigencia_inicio}
                                                                    onChange={e => {
                                                                        const newBenefits = [...formData.benefits];
                                                                        newBenefits[bIdx].vigencia_inicio = e.target.value;
                                                                        setFormData({ ...formData, benefits: newBenefits });
                                                                    }}
                                                                    disabled={!!id}
                                                                    className="w-full bg-surface border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                                                />
                                                            </div>
                                                            {!id && (
                                                                <div className="flex justify-end">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newBenefits = formData.benefits.filter((_: any, idx: number) => idx !== bIdx);
                                                                            setFormData({ ...formData, benefits: newBenefits });
                                                                        }}
                                                                        className="text-red-500 hover:text-red-700 p-2 border border-border-subtle rounded-md bg-surface"
                                                                    >
                                                                        Remover
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {!id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({
                                                            ...formData,
                                                            benefits: [...formData.benefits, { benefit_id: '', vigencia_inicio: new Date().toISOString().split('T')[0], prioridade: 100, status: 'ATIVO' }]
                                                        })}
                                                        className="w-full py-3 border-2 border-dashed border-border-subtle rounded-lg text-brand-primary font-bold hover:bg-brand-primary/5 hover:border-brand-primary/30 transition-all cursor-pointer"
                                                    >
                                                        + Adicionar Benefício
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                    </motion.div>
                                )}

                                {activeTab === 'sales_params' && (
                                    <motion.div
                                        key="sales"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="space-y-6"
                                    >
                                        <div className="flex flex-col gap-2">
                                            <h2 className="text-xl font-bold text-text-primary">Controle de Oportunidades</h2>
                                            <p className="text-sm text-text-muted">Parâmetros de nomenclatura e numeração contínua para as propostas geradas.</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Nomenclatura Orçamento</label>
                                                <input
                                                    type="text"
                                                    maxLength={20}
                                                    value={formData.nomenclatura_orcamento || ''}
                                                    onChange={e => setFormData({ ...formData, nomenclatura_orcamento: e.target.value })}
                                                    disabled={isReadOnly}
                                                    className={getFieldClass('nomenclatura_orcamento')}
                                                    placeholder="Ex: OV"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Número de Proposta (Próximo)</label>
                                                <input
                                                    type="number"
                                                    value={formData.numero_proposta || 1}
                                                    onChange={e => setFormData({ ...formData, numero_proposta: parseInt(e.target.value) || 1 })}
                                                    disabled={isReadOnly}
                                                    className={getFieldClass('numero_proposta')}
                                                    placeholder="Ex: 1"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 mt-8 pt-8 border-t border-border-subtle">
                                            <h2 className="text-xl font-bold text-text-primary">Parâmetros Mínimos de Margem e Tributos</h2>
                                            <p className="text-sm text-text-muted">Parâmetros base por tipo de operação usados no motor de precificação desta empresa.</p>
                                        </div>

                                        {(() => {
                                            const PARAM_FIELDS = [
                                                { k: 'mkp_padrao',            label: 'MKP Padrão (Multiplicador)', step: '0.01' },
                                                { k: 'despesa_administrativa', label: 'Despesa Administrativa (%)', step: '0.01' },
                                                { k: 'comissionamento',       label: 'Comissionamento (%)', step: '0.01' },
                                                { k: 'pis',                   label: 'PIS (%)', step: '0.01' },
                                                { k: 'cofins',                label: 'COFINS (%)', step: '0.01' },
                                                { k: 'csll',                  label: 'CSLL (%)', step: '0.01' },
                                                { k: 'irpj',                  label: 'IRPJ (%)', step: '0.01' },
                                                { k: 'iss',                   label: 'ISS (%)', step: '0.01' },
                                                { k: 'icms_interno',          label: 'ICMS Interno (%)', step: '0.01' },
                                                { k: 'icms_externo',          label: 'ICMS Externo (%)', step: '0.01' },
                                            ];

                                            const MODAL_SECTIONS = [
                                                {
                                                    suffix: 'venda',
                                                    title: 'Venda de Equipamentos e Serviços',
                                                    color: 'text-brand-primary',
                                                    border: 'border-brand-primary/30',
                                                    bg: 'bg-brand-primary/5',
                                                },
                                                {
                                                    suffix: 'locacao',
                                                    title: 'Locação de Equipamentos',
                                                    color: 'text-brand-warning',
                                                    border: 'border-brand-warning/30',
                                                    bg: 'bg-brand-warning/5',
                                                },
                                                {
                                                    suffix: 'comodato',
                                                    title: 'Comodato de Equipamentos',
                                                    color: 'text-brand-success',
                                                    border: 'border-brand-success/30',
                                                    bg: 'bg-brand-success/5',
                                                },
                                            ];

                                            return (
                                                <div className="space-y-4">
                                                    {MODAL_SECTIONS.map(({ suffix, title, color, border, bg }) => (
                                                        <div key={suffix} className={`rounded-xl border ${border} ${bg} overflow-hidden`}>
                                                            <div className={`px-5 py-3 border-b ${border}`}>
                                                                <span className={`text-sm font-bold ${color} uppercase tracking-wide`}>{title}</span>
                                                            </div>
                                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 p-5">
                                                                {PARAM_FIELDS.map((field) => {
                                                                    const key = `${field.k}_${suffix}`;
                                                                    return (
                                                                        <div key={key} className="space-y-1.5">
                                                                            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider leading-tight block">{field.label}</label>
                                                                            <input
                                                                                type="number"
                                                                                step={field.step}
                                                                                value={salesParameters[key] ?? 0}
                                                                                onChange={(e) => setSalesParameters({ ...salesParameters, [key]: parseFloat(e.target.value) || 0 })}
                                                                                disabled={isReadOnly}
                                                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-1.5 px-3 outline-none focus:border-brand-primary transition-colors text-sm"
                                                                            />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}

                                    </motion.div>
                                )}

                                {activeTab === 'qsa' && (
                                    <motion.div
                                        key="qsa"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="space-y-6"
                                    >
                                        <div className="flex flex-col gap-2">
                                            <h2 className="text-xl font-bold text-text-primary">Quadro de Sócios e Administradores (QSA)</h2>
                                            <p className="text-sm text-text-muted">Lista de pessoas que representam o quadro societário da empresa.</p>
                                        </div>

                                        {formData.qsa.length === 0 ? (
                                            <div className="p-10 border-2 border-dashed border-border-subtle rounded-lg text-center bg-bg-deep/50">
                                                <p className="text-text-muted font-medium">Nenhum sócio ou administrador associado.</p>
                                                <p className="text-xs text-text-muted mt-2">Os dados serão automaticamente preenchidos após uma busca pelo CNPJ ativo.</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto border border-border-subtle rounded-lg font-mono text-sm bg-surface">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-bg-deep border-b border-border-subtle">
                                                            <th className="py-3 px-4 text-text-muted font-bold tracking-wider uppercase text-xs">Nome</th>
                                                            <th className="py-3 px-4 text-text-muted font-bold tracking-wider uppercase text-xs">Qualificação</th>
                                                            <th className="py-3 px-4 text-text-muted font-bold tracking-wider uppercase text-xs">Rep. Legal</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {formData.qsa.map((s: any, idx: number) => (
                                                            <tr key={idx} className="border-b border-border-subtle bg-green-50/10">
                                                                <td className="py-3 px-4 font-semibold text-text-primary border-l-4 border-green-500/50">{s.nome}</td>
                                                                <td className="py-3 px-4 text-text-muted">{s.qualificacao}</td>
                                                                <td className="py-3 px-4 text-text-muted">{s.nome_rep_legal || '-'} {s.qualificacao_rep_legal ? `(${s.qualificacao_rep_legal})` : ''}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </fieldset>
                    </form>
                </div>
            </div>
        </div >
    );
};

export default EmpresaForm;
