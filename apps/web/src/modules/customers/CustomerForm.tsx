import React, { useEffect, useState } from 'react';
import {
    Users,
    MapPin,
    ChevronLeft,
    Save,
    Search,
    Loader2,
    XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useCompanies } from '../companies/hooks/useCompanies';
import { customerApi } from './api/customerApi';

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

const CustomerForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('basic');
    const [loading, setLoading] = useState(false);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [states, setStates] = useState<State[]>([]);
    const [cities, setCities] = useState<Municipality[]>([]);
    const [submitError, setSubmitError] = useState<string>('');

    const { lookupCNPJ } = useCompanies();

    const [formData, setFormData] = useState<any>({
        cnpj: '',
        razao_social: '',
        nome_fantasia: '',
        email: '',
        telefone: '',
        tipo: 'PRIVADO',
        esfera: '',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        municipality_id: '',
        state_id: '',
        active: true
    });

    const tabs = [
        { id: 'basic', label: 'Dados Básicos', icon: Users },
        { id: 'address', label: 'Endereço', icon: MapPin },
    ];

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const statesRes = await api.get('/catalog/states');
                setStates(statesRes.data);

                if (id) {
                    setLoading(true);
                    const customer = await customerApi.get(id);
                    setFormData(customer);
                    if (customer.state_id) {
                        fetchCities(customer.state_id);
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [id]);

    const fetchCities = async (stateId: string) => {
        try {
            const res = await api.get(`/catalog/cities?state_id=${stateId}&page_size=1000`);
            setCities(res.data.items || res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCepLookup = async (cepValue?: string) => {
        const cep = (cepValue || formData.cep).replace(/\D/g, '');
        if (cep.length !== 8) return;

        try {
            const res = await api.get(`/utils/cep/${cep}`);
            const data = res.data;

            const state = states.find(s => s.sigla === data.uf);

            if (state) {
                const citiesRes = await api.get(`/catalog/cities?state_id=${state.id}`);
                const stateCities = citiesRes.data.items || citiesRes.data;
                setCities(stateCities);

                const city = stateCities.find((c: any) => String(c.ibge_id) === String(data.ibge));

                setFormData((prev: any) => ({
                    ...prev,
                    logradouro: prev.logradouro || data.logradouro,
                    bairro: prev.bairro || data.bairro,
                    state_id: state.id,
                    municipality_id: city?.id || prev.municipality_id
                }));
            }
        } catch (err) {
            console.error('Falha ao buscar CEP:', err);
        }
    };

    const handleCnpjLookup = async () => {
        const cnpjStr = formData.cnpj?.replace(/\D/g, '') || '';
        if (cnpjStr.length < 14) return;
        setLookupLoading(true);
        try {
            const response = await lookupCNPJ(cnpjStr);

            if (!response.success) {
                alert('CNPJ não localizado.');
                return;
            }

            const result = response.normalizedData;
            const state = states.find(s => s.sigla === result.endereco?.uf);
            let cityId = '';

            if (state) {
                try {
                    const citiesRes = await api.get(`/catalog/cities?state_id=${state.id}`);
                    const stateCities = citiesRes.data.items || citiesRes.data;
                    setCities(stateCities);

                    if (result.endereco?.cep) {
                        const cepClean = result.endereco.cep.replace(/\D/g, '');
                        try {
                            const cepRes = await api.get(`/utils/cep/${cepClean}`);
                            const ibge = cepRes.data.ibge;
                            if (ibge) {
                                const cityByIbge = stateCities.find((c: any) => String(c.ibge_id) === String(ibge));
                                if (cityByIbge) cityId = cityByIbge.id;
                            }
                        } catch (e) { }
                    }

                    if (!cityId && result.endereco?.municipio) {
                        const cityMatch = stateCities.find((c: any) =>
                            c.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() ===
                            result.endereco.municipio.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim()
                        );
                        if (cityMatch) cityId = cityMatch.id;
                    }
                } catch (e) { }
            }

            setFormData((prev: any) => ({
                ...prev,
                razao_social: result.razaoSocial || prev.razao_social,
                nome_fantasia: result.nomeFantasia || prev.nome_fantasia,
                email: result.email || prev.email,
                telefone: result.telefone || prev.telefone,
                logradouro: result.endereco?.logradouro || prev.logradouro,
                numero: result.endereco?.numero || prev.numero,
                complemento: result.endereco?.complemento || prev.complemento,
                bairro: result.endereco?.bairro || prev.bairro,
                cep: result.endereco?.cep || prev.cep,
                state_id: state?.id || prev.state_id,
                municipality_id: cityId || prev.municipality_id
            }));

        } catch (err: any) {
            console.error('Lookup error:', err);
            alert('Falha ao consultar CNPJ.');
        } finally {
            setLookupLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');

        try {
            if (id) {
                await customerApi.update(id, formData);
            } else {
                await customerApi.create(formData);
            }
            navigate('/cadastros/clientes');
        } catch (err: any) {
            const msg = err.response?.data?.erro || err.response?.data?.detail || 'Erro ao salvar cliente.';
            setSubmitError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full pb-10">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/cadastros/clientes')}
                        className="p-2 rounded-md hover:bg-bg-deep text-text-muted transition-colors cursor-pointer"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                            {id ? 'Editar' : 'Novo'} <span className="text-brand-primary">Cliente</span>
                        </h1>
                        <p className="text-text-muted mt-1">Dados cadastrais de clientes.</p>
                    </div>
                </div>

                <button
                    form="customer-form"
                    type="submit"
                    className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-md font-semibold hover:bg-brand-primary/90 transition-colors shadow-md cursor-pointer"
                >
                    <Save className="w-5 h-5" />
                    Salvar Cliente
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 space-y-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 p-3.5 rounded-lg border transition-all cursor-pointer ${activeTab === tab.id
                                ? 'bg-brand-primary/5 border-brand-primary text-brand-primary font-bold shadow-sm'
                                : 'bg-surface border-border-subtle text-text-muted hover:border-brand-primary/30 hover:text-text-primary'
                                }`}
                        >
                            <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-brand-primary' : ''}`} />
                            <span className="text-[15px] flex-1 text-left">{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="lg:col-span-3 bg-surface rounded-lg border border-border-subtle shadow-sm p-8 min-h-[400px]">
                    <form id="customer-form" onSubmit={handleSubmit} className="space-y-6">
                        {submitError && (
                            <div className="p-4 bg-red-50/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-500 text-sm">
                                <XCircle className="w-5 h-5 shrink-0" />
                                {submitError}
                            </div>
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">CNPJ</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    maxLength={18}
                                                    value={formData.cnpj}
                                                    onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                                                    className="flex-1 bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleCnpjLookup}
                                                    disabled={lookupLoading || (formData.cnpj?.replace(/\D/g, '') || '').length < 14}
                                                    className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-md hover:bg-brand-primary/20 transition-all text-sm font-semibold disabled:opacity-50 cursor-pointer border border-brand-primary/20"
                                                >
                                                    {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                                    Consultar
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Razão Social</label>
                                            <input
                                                type="text"
                                                value={formData.razao_social}
                                                onChange={e => setFormData({ ...formData, razao_social: e.target.value })}
                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Tipo de Cliente</label>
                                            <select
                                                value={formData.tipo}
                                                onChange={e => setFormData({ ...formData, tipo: e.target.value, esfera: e.target.value === 'PRIVADO' ? '' : formData.esfera })}
                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                                required
                                            >
                                                <option value="PRIVADO">Privado</option>
                                                <option value="PUBLICO">Público</option>
                                            </select>
                                        </div>

                                        <AnimatePresence>
                                            {formData.tipo === 'PUBLICO' && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="space-y-1.5 overflow-hidden"
                                                >
                                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Esfera</label>
                                                    <select
                                                        value={formData.esfera}
                                                        onChange={e => setFormData({ ...formData, esfera: e.target.value })}
                                                        className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                                        required
                                                    >
                                                        <option value="">Selecione...</option>
                                                        <option value="MUNICIPAL">Municipal</option>
                                                        <option value="ESTADUAL">Estadual</option>
                                                        <option value="FEDERAL">Federal</option>
                                                        <option value="AUTARQUIA">Autarquia</option>
                                                    </select>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Nome Fantasia</label>
                                            <input
                                                type="text"
                                                value={formData.nome_fantasia}
                                                onChange={e => setFormData({ ...formData, nome_fantasia: e.target.value })}
                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">E-mail</label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Telefone</label>
                                            <input
                                                type="text"
                                                value={formData.telefone}
                                                onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
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
                                    className="space-y-6"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">CEP</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={formData.cep}
                                                    onChange={e => setFormData({ ...formData, cep: e.target.value.replace(/\D/g, '') })}
                                                    className="flex-1 bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleCepLookup()}
                                                    className="p-2 bg-brand-primary/10 text-brand-primary rounded-md hover:bg-brand-primary/20 transition-all cursor-pointer border border-brand-primary/20"
                                                >
                                                    <Search className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="md:col-span-2 space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Logradouro</label>
                                            <input
                                                type="text"
                                                value={formData.logradouro}
                                                onChange={e => setFormData({ ...formData, logradouro: e.target.value })}
                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Número</label>
                                            <input
                                                type="text"
                                                value={formData.numero}
                                                onChange={e => setFormData({ ...formData, numero: e.target.value })}
                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Complemento</label>
                                            <input
                                                type="text"
                                                value={formData.complemento}
                                                onChange={e => setFormData({ ...formData, complemento: e.target.value })}
                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Bairro</label>
                                            <input
                                                type="text"
                                                value={formData.bairro}
                                                onChange={e => setFormData({ ...formData, bairro: e.target.value })}
                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Estado (UF)</label>
                                            <select
                                                value={formData.state_id}
                                                onChange={e => {
                                                    setFormData({ ...formData, state_id: e.target.value, municipality_id: '' });
                                                    fetchCities(e.target.value);
                                                }}
                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                            >
                                                <option value="">Selecione...</option>
                                                {states.map(s => (
                                                    <option key={s.id} value={s.id}>{s.sigla} - {s.nome}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="md:col-span-2 space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Município</label>
                                            <select
                                                value={formData.municipality_id}
                                                onChange={e => setFormData({ ...formData, municipality_id: e.target.value })}
                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                            >
                                                <option value="">Selecione o estado primeiro...</option>
                                                {cities.map(c => (
                                                    <option key={c.id} value={c.id}>{c.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CustomerForm;
