import React, { useEffect, useState } from 'react';
import {
    Package,
    ChevronLeft,
    Save,
    Search,
    Loader2,
    Activity,
    Info,
    CheckCircle2,
    AlertCircle,
    FileText,
    Edit2,
    ShieldCheck,
    Truck,
    Plus,
    Trash2,
    Calculator
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { productApi } from './api/productApi';
import { api } from '../../services/api';
import type { MvaLookupResult, ProductSupplier, ProductFormData } from './types';

import { ProductPriceFormation } from './components/ProductPriceFormation';

const ProductForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const isReadOnly = location.pathname.includes('/detalhes/');
    const isEditMode = !!id && !isReadOnly;
    const lockCoreFields = isReadOnly || isEditMode;

    const [activeTab, setActiveTab] = useState('identification');
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(false);
    const [companies, setCompanies] = useState<any[]>([]);
    const [mvaResult, setMvaResult] = useState<MvaLookupResult | null>(null);
    const [mvaLoading, setMvaLoading] = useState(false);
    const [benefits, setBenefits] = useState<any[]>([]);
    const [benefitsLoading, setBenefitsLoading] = useState(false);
    const [budgets, setBudgets] = useState<any[]>([]);

    // Suppliers State
    const [supplierList, setSupplierList] = useState<any[]>([]); // For the autocomplete lookup
    const [newSupplier, setNewSupplier] = useState<Partial<ProductSupplier>>({
        supplier_id: '',
        codigo_externo: '',
        unidade: '',
        fator_conversao: '1'
    });

    const [formData, setFormData] = useState<ProductFormData>({
        company_id: '',
        nome: '',
        descricao: '',
        tipo: 'EQUIPAMENTO',
        finalidade: 'REVENDA',
        unidade: 'UN',
        categoria: '',
        marca: '',
        modelo: '',
        part_number: '',
        ncm_codigo: '',
        cest_codigo: '',
        cmt_codigo: '',
        ativo: true,
        suppliers: []
    });

    const [sku, setSku] = useState<string>('');

    const tabs = [
        { id: 'identification', label: 'Identificação', icon: Info },
        { id: 'fiscal', label: 'Fiscal & Impostos', icon: FileText },
        { id: 'pricing', label: 'Formação de Preço', icon: Calculator },
        { id: 'suppliers', label: 'Fornecedores', icon: Truck },
    ];

    if (budgets.length > 0) {
        tabs.push({ id: 'budgets', label: 'Orçamentos', icon: FileText });
    }

    useEffect(() => {
        const fetchData = async () => {
            setPageLoading(true);
            try {
                const cmpRes = await api.get('/companies');
                setCompanies(cmpRes.data);

                const supRes = await api.get('/cadastro/fornecedores');
                setSupplierList(supRes.data);

                if (id) {
                    const product = await productApi.get(id);
                    setFormData({
                        company_id: product.company_id,
                        nome: product.nome,
                        descricao: product.descricao || '',
                        tipo: product.tipo,
                        finalidade: product.finalidade,
                        unidade: product.unidade || '',
                        categoria: product.categoria || '',
                        marca: product.marca || '',
                        modelo: product.modelo || '',
                        part_number: product.part_number || '',
                        ncm_codigo: product.ncm_codigo || '',
                        cest_codigo: product.cest_codigo || '',
                        cmt_codigo: product.cmt_codigo || '',
                        ativo: product.ativo,
                        suppliers: product.suppliers || []
                    });
                    setSku(product.codigo);

                    if (product.ncm_codigo) {
                        checkMva(product.ncm_codigo, product.company_id, 'REVENDA');
                        checkBenefits(product.ncm_codigo);
                    }

                    try {
                        const budgetsData = await productApi.getBudgets(id);
                        const mappedBudgets = budgetsData.map((b: any) => ({
                            id: b.id,
                            quantidade: 1, 
                            valor_unitario: b.valor_unitario,
                            ipi_percentual: b.ipi_percent,
                            icms_percentual: b.icms_percent,
                            created_at: b.created_at,
                            budget: {
                                numero_orcamento: b.budget?.numero_orcamento,
                                data_cotacao: b.budget?.data_orcamento,
                                supplier: {
                                    nome_fantasia: b.budget?.supplier_nome_fantasia || 'Fornecedor',
                                    razao_social: b.budget?.supplier_razao_social || 'Fornecedor',
                                    uf: 'SP'
                                }
                            }
                        }));
                        setBudgets(mappedBudgets);
                    } catch(err) {
                        console.error('Error fetching product budgets:', err);
                    }
                }
            } catch (err) {
                console.error('Initial fetch error:', err);
            } finally {
                setPageLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const checkMva = async (ncm: string, company_id: string, finalidade: string) => {
        if (!ncm || ncm.length < 4 || !company_id || finalidade !== 'REVENDA') {
            setMvaResult(null);
            return;
        }
        setMvaLoading(true);
        try {
            const res = await productApi.previewMva(ncm, company_id, finalidade);
            setMvaResult(res);
        } catch (err) {
            console.error('MVA logic error:', err);
            setMvaResult(null);
        } finally {
            setMvaLoading(false);
        }
    };

    const checkBenefits = async (ncm: string) => {
        if (!ncm || ncm.length < 4) {
            setBenefits([]);
            return;
        }
        setBenefitsLoading(true);
        try {
            const res = await productApi.checkBenefits(ncm);
            setBenefits(res);
        } catch (err) {
            console.error('Benefit lookup error:', err);
            setBenefits([]);
        } finally {
            setBenefitsLoading(false);
        }
    };



    useEffect(() => {
        if (formData.ncm_codigo && formData.company_id) {
            const timer = setTimeout(() => {
                checkMva(formData.ncm_codigo!, formData.company_id, 'REVENDA');
                checkBenefits(formData.ncm_codigo!);
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setMvaResult(null);
            setBenefits([]);
        }
    }, [formData.ncm_codigo, formData.company_id, formData.finalidade]);

    const handleAddSupplier = () => {
        if (!newSupplier.supplier_id || !newSupplier.codigo_externo || !newSupplier.unidade || !newSupplier.fator_conversao) {
            alert("Preencha todos os campos do fornecedor.");
            return;
        }

        const isDuplicate = formData.suppliers?.some((s: any) => s.supplier_id === newSupplier.supplier_id && s.codigo_externo === newSupplier.codigo_externo);
        if (isDuplicate) {
            alert("Este fornecedor com este código externo já está vinculado a este produto.");
            return;
        }

        setFormData((prev: any) => ({
            ...prev,
            suppliers: [...(prev.suppliers || []), newSupplier as ProductSupplier]
        }));

        // Reset inputs
        setNewSupplier({
            supplier_id: '',
            codigo_externo: '',
            unidade: '',
            fator_conversao: '1'
        });
    };

    const handleRemoveSupplier = (index: number) => {
        const updated = [...(formData.suppliers || [])];
        updated.splice(index, 1);
        setFormData({ ...formData, suppliers: updated });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly) return;
        setLoading(true);
        try {
            // Strip API-response-only fields (id, product_id, etc.) — backend only accepts supplier_id, codigo_externo, unidade, fator_conversao
            const cleanedSuppliers = (formData.suppliers || []).map(s => ({
                supplier_id: s.supplier_id,
                codigo_externo: s.codigo_externo,
                unidade: s.unidade,
                fator_conversao: String(s.fator_conversao)
            }));
            const payload = { ...formData, suppliers: cleanedSuppliers };

            if (id) {
                await productApi.update(id, payload);
            } else {
                await productApi.create(formData);
            }
            navigate('/cadastro/produtos');
        } catch (err: any) {
            console.error('Save error:', err);
            alert('Falha ao salvar produto: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    if (pageLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-text-muted">
                <Loader2 className="w-10 h-10 animate-spin text-brand-primary mb-4" />
                <p>Carregando dados do produto...</p>
            </div>
        );
    }

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-6 w-full pb-10">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => navigate('/cadastro/produtos')}
                            className="p-2 rounded-md hover:bg-bg-deep text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-display font-bold text-text-primary tracking-tight">
                                    {id ? (isReadOnly ? 'Detalhes do' : 'Editar') : 'Novo'} <span className="text-brand-primary">Produto</span>
                                </h1>
                                {isReadOnly && id && (
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/cadastro/produtos/editar/${id}`)}
                                        className="flex items-center gap-1.5 bg-brand-primary/10 text-brand-primary border border-brand-primary/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-primary/20 transition-all cursor-pointer"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Editar
                                    </button>
                                )}
                            </div>
                            <p className="text-text-muted text-sm capitalize">
                                {id ? `SKU: ${sku}` : 'Criação de novo item no inventário'}
                            </p>
                        </div>
                    </div>

                    {!isReadOnly && (
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-md font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Salvar Produto
                        </button>
                    )}
                </header>

                <nav className="flex gap-1 border-b border-border-subtle p-1 bg-surface rounded-t-lg">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-bold transition-all cursor-pointer ${activeTab === tab.id
                                ? 'bg-brand-primary/5 text-brand-primary border-b-2 border-brand-primary rounded-b-none'
                                : 'text-text-muted hover:bg-bg-deep'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </nav>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="bg-surface rounded-b-lg border border-t-0 border-border-subtle p-8 shadow-sm"
                    >
                        {activeTab === 'identification' && (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Nome do Produto *</label>
                                        <input
                                            type="text"
                                            required
                                            readOnly={lockCoreFields}
                                            value={formData.nome}
                                            onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
                                            placeholder="Ex: Servidor PowerEdge R740"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Empresa Vinculada *</label>
                                        <select
                                            required
                                            disabled={lockCoreFields}
                                            value={formData.company_id}
                                            onChange={e => setFormData({ ...formData, company_id: e.target.value })}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary appearance-none cursor-pointer h-11"
                                        >
                                            <option value="">Selecione uma empresa...</option>
                                            {companies.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.nome_fantasia || c.razao_social} ({c.cnpj})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Tipo de Item</label>
                                        <div className="flex bg-bg-deep p-1 rounded-md border border-border-subtle h-11">
                                            <button
                                                type="button"
                                                disabled={lockCoreFields}
                                                onClick={() => setFormData({ ...formData, tipo: 'EQUIPAMENTO' })}
                                                className={`flex-1 flex items-center justify-center gap-2 rounded-md transition-all text-xs font-bold ${formData.tipo === 'EQUIPAMENTO'
                                                    ? 'bg-surface text-brand-primary shadow-sm'
                                                    : 'text-text-muted hover:text-text-primary'
                                                    }`}
                                            >
                                                <Package className="w-4 h-4" /> EQUIPAMENTO
                                            </button>
                                            <button
                                                type="button"
                                                disabled={lockCoreFields}
                                                onClick={() => setFormData({ ...formData, tipo: 'SERVICO' })}
                                                className={`flex-1 flex items-center justify-center gap-2 rounded-md transition-all text-xs font-bold ${formData.tipo === 'SERVICO'
                                                    ? 'bg-surface text-brand-primary shadow-sm'
                                                    : 'text-text-muted hover:text-text-primary'
                                                    }`}
                                            >
                                                <Activity className="w-4 h-4" /> SERVIÇO
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Moved from Classification Tab */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-border-subtle">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Unidade de Medida</label>
                                        <input
                                            type="text"
                                            readOnly={lockCoreFields}
                                            value={formData.unidade}
                                            onChange={e => setFormData({ ...formData, unidade: e.target.value })}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 h-11 text-sm focus:border-brand-primary outline-none transition-colors"
                                            placeholder="Ex: UN, PC, KG, M2"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Categoria</label>
                                        <input
                                            type="text"
                                            readOnly={lockCoreFields}
                                            value={formData.categoria}
                                            onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 h-11 text-sm focus:border-brand-primary outline-none transition-colors"
                                            placeholder="Ex: Hardware"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Marca</label>
                                        <input
                                            type="text"
                                            readOnly={lockCoreFields}
                                            value={formData.marca}
                                            onChange={e => setFormData({ ...formData, marca: e.target.value })}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 h-11 text-sm focus:border-brand-primary outline-none transition-colors"
                                            placeholder="Ex: Dell"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Modelo</label>
                                        <input
                                            type="text"
                                            readOnly={lockCoreFields}
                                            value={formData.modelo}
                                            onChange={e => setFormData({ ...formData, modelo: e.target.value })}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 h-11 text-sm focus:border-brand-primary outline-none transition-colors"
                                            placeholder="Ex: PowerEdge R740"
                                        />
                                    </div>
                                    <div className="space-y-1.5 lg:col-span-2">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">PartNumber</label>
                                        <input
                                            type="text"
                                            readOnly={lockCoreFields}
                                            value={formData.part_number}
                                            onChange={e => setFormData({ ...formData, part_number: e.target.value })}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 h-11 text-sm focus:border-brand-primary outline-none transition-colors"
                                            placeholder="Ex: R740-1234-A/B"
                                            maxLength={20}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-border-subtle">
                                    <div className="space-y-1.5 md:col-span-3">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Descrição Detalhada</label>
                                        <textarea
                                            readOnly={isReadOnly}
                                            value={formData.descricao}
                                            onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-3 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary min-h-[120px] resize-none"
                                            placeholder="Informações técnicas complementares..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'fiscal' && (
                            <div className="space-y-8">
                                <div className="bg-brand-primary/5 p-4 rounded-lg flex items-start gap-3 border border-brand-primary/10 mb-2">
                                    <div className="p-2 bg-brand-primary/10 rounded-md text-brand-primary">
                                        <ShieldCheck className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-text-primary">Inteligência Fiscal Ativa</h4>
                                        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                                            Ao preencher o NCM, o sistema tentará localizar automaticamente regras de **Substituição Tributária (ST)**
                                            e **MVA** baseadas na UF da empresa vinculada.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {formData.tipo === 'EQUIPAMENTO' ? (
                                        <>
                                            <div className="space-y-1.5 lg:col-span-2">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">NCM (Código Fiscal)</label>
                                                <div className="relative group">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4 group-focus-within:text-brand-primary transition-colors" />
                                                    <input
                                                        type="text"
                                                        readOnly={lockCoreFields}
                                                        value={formData.ncm_codigo}
                                                        onChange={e => setFormData({ ...formData, ncm_codigo: e.target.value })}
                                                        className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 pl-10 pr-4 h-11 text-sm focus:border-brand-primary outline-none transition-colors font-mono tracking-wide"
                                                        placeholder="Com ou sem pontos (Ex: 8517.62.39)"
                                                    />
                                                    {mvaLoading && (
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                            <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                                                        </div>
                                                    )}
                                                </div>

                                                {mvaResult?.found ? (
                                                    <div className="mt-4 p-4 bg-brand-success/5 border border-brand-success/20 rounded-lg flex gap-3">
                                                        <div className="p-1.5 bg-brand-success/10 rounded-full text-brand-success self-start">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-brand-success uppercase tracking-wider">Regra Localizada: NCM {mvaResult.ncm_base}</span>
                                                                <span className="px-1.5 py-0.5 bg-brand-success text-white text-[10px] font-bold rounded">ST ATIVO</span>
                                                            </div>
                                                            <p className="text-xs text-text-primary font-medium">{mvaResult.description}</p>
                                                            <div className="flex items-center gap-4 mt-1">
                                                                <span className="text-sm font-black text-text-primary">MVA CALCULADO: {mvaResult.mva_percent}%</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (formData.ncm_codigo && formData.ncm_codigo.length >= 4 && !mvaLoading) ? (
                                                    <div className="mt-2 text-xs text-text-muted italic flex items-center gap-1.5">
                                                        <AlertCircle className="w-3 h-3" /> Nenhuma regra de ST específica encontrada para este NCM nesta UF.
                                                    </div>
                                                ) : null}

                                                {/* Novos Benefícios Fiscais Detectados */}
                                                {benefits.length > 0 && (
                                                    <div className="mt-4 space-y-2">
                                                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Benefícios Fiscais Aplicáveis (NCM Matching)</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {benefits.map(benefit => (
                                                                <div
                                                                    key={benefit.id}
                                                                    className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-3 py-1.5 rounded-md border border-brand-primary/20 shadow-sm"
                                                                >
                                                                    <ShieldCheck className="w-3.5 h-3.5" />
                                                                    <span className="text-xs font-bold uppercase tracking-tight">{benefit.nome}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {benefitsLoading && (
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <Loader2 className="w-3 h-3 animate-spin text-brand-primary" />
                                                        <span className="text-[10px] text-text-muted italic">Consultando benefícios aplicáveis...</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">CEST</label>
                                                <input
                                                    type="text"
                                                    readOnly={lockCoreFields}
                                                    value={formData.cest_codigo}
                                                    onChange={e => setFormData({ ...formData, cest_codigo: e.target.value })}
                                                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 h-11 text-sm focus:border-brand-primary outline-none transition-colors"
                                                    placeholder="Código CEST"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="space-y-1.5 lg:col-span-3">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">CMT (Código Municipal Tributário)</label>
                                            <input
                                                type="text"
                                                readOnly={lockCoreFields}
                                                value={formData.cmt_codigo}
                                                onChange={e => setFormData({ ...formData, cmt_codigo: e.target.value })}
                                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 h-11 text-sm focus:border-brand-primary outline-none transition-colors"
                                                placeholder="Ex: 01.01 ou 14.02"
                                            />
                                            <p className="text-[10px] text-text-muted">Utilizado para determinar a alíquota de ISS e regras de retenção municipal.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'pricing' && (
                            <ProductPriceFormation
                                basePrice={0}
                                stFlag={!!mvaResult?.found}
                                bitFlag={benefits.some(b => b.nome?.toUpperCase().includes('BIT'))}
                                importadoFlag={false}
                                mvaFromProduct={mvaResult?.mva_percent ?? 0}
                                budgets={budgets}
                            />
                        )}

                        {activeTab === 'suppliers' && (
                            <div className="space-y-6">
                                {/* Add supplier form */}
                                {!isReadOnly && (
                                    <div className="bg-surface border border-border-subtle rounded-xl p-6 space-y-4">
                                        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                            <Truck className="w-4 h-4 text-brand-primary" />
                                            Vincular Fornecedor ao Produto
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="space-y-1.5 md:col-span-2">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Fornecedor *</label>
                                                <select
                                                    value={newSupplier.supplier_id}
                                                    onChange={e => setNewSupplier({ ...newSupplier, supplier_id: e.target.value })}
                                                    className="w-full bg-bg-deep border border-border-subtle rounded-lg py-2.5 px-3 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary"
                                                >
                                                    <option value="">— Selecione o fornecedor —</option>
                                                    {supplierList.map(s => (
                                                        <option key={s.id} value={s.id}>
                                                            {s.nome_fantasia || s.razao_social} ({s.cnpj})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Cód. Externo *</label>
                                                <input
                                                    type="text"
                                                    value={newSupplier.codigo_externo}
                                                    onChange={e => setNewSupplier({ ...newSupplier, codigo_externo: e.target.value })}
                                                    className="w-full bg-bg-deep border border-border-subtle rounded-lg py-2.5 px-3 outline-none focus:border-brand-primary transition-colors text-sm"
                                                    placeholder="Ex: REF123"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Un. Compra *</label>
                                                <select
                                                    value={newSupplier.unidade}
                                                    onChange={e => setNewSupplier({ ...newSupplier, unidade: e.target.value })}
                                                    className="w-full bg-bg-deep border border-border-subtle rounded-lg py-2.5 px-3 outline-none focus:border-brand-primary transition-colors text-sm"
                                                >
                                                    <option value="">Selecione...</option>
                                                    {['UND', 'UN', 'MT', 'ROLO', 'CAIXA'].map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider leading-tight">Fator Conversão *</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="0.01"
                                                    value={newSupplier.fator_conversao}
                                                    onChange={e => setNewSupplier({ ...newSupplier, fator_conversao: e.target.value })}
                                                    className="w-full bg-bg-deep border border-border-subtle rounded-lg py-2.5 px-3 outline-none focus:border-brand-primary transition-colors text-sm"
                                                    placeholder="Ex: 12"
                                                />
                                            </div>
                                        </div>

                                        {/* Clearly labeled Add button */}
                                        <div className="flex justify-end pt-2">
                                            <button
                                                type="button"
                                                onClick={handleAddSupplier}
                                                className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary border border-brand-primary/30 px-5 py-2.5 rounded-lg font-bold hover:bg-brand-primary/20 transition-all cursor-pointer text-sm"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Adicionar à Lista
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Suppliers list */}
                                {formData.suppliers && formData.suppliers.length > 0 ? (
                                    <div className="border border-border-subtle rounded-xl overflow-hidden">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-bg-deep border-b border-border-subtle text-xs uppercase tracking-wider text-text-muted">
                                                    <th className="p-3 font-bold">Fornecedor</th>
                                                    <th className="p-3 font-bold">Cód. Externo</th>
                                                    <th className="p-3 font-bold text-center">Un. Compra</th>
                                                    <th className="p-3 font-bold text-center">Conversão</th>
                                                    {!isReadOnly && <th className="p-3 font-bold text-center w-16">Ação</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm divide-y divide-border-subtle bg-surface">
                                                {formData.suppliers.map((sup: any, idx: number) => {
                                                    const sName = supplierList.find(s => s.id === sup.supplier_id)?.nome_fantasia
                                                        || supplierList.find(s => s.id === sup.supplier_id)?.razao_social
                                                        || 'Carregando...';
                                                    return (
                                                        <tr key={idx} className="hover:bg-bg-deep/50 transition-colors">
                                                            <td className="p-3 font-medium text-text-primary">{sName}</td>
                                                            <td className="p-3 font-mono text-brand-primary">{sup.codigo_externo}</td>
                                                            <td className="p-3 text-center">{sup.unidade}</td>
                                                            <td className="p-3 text-center bg-bg-deep/30 font-mono">
                                                                1 {sup.unidade} = {sup.fator_conversao} {formData.unidade || 'UN'}
                                                            </td>
                                                            {!isReadOnly && (
                                                                <td className="p-3 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveSupplier(idx)}
                                                                        className="text-brand-danger/70 hover:text-brand-danger transition-colors cursor-pointer p-1"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center p-8 bg-bg-deep border border-dashed border-border-subtle rounded-xl text-text-muted text-sm">
                                        Nenhum fornecedor vinculado. Use o formulário acima para adicionar.
                                    </div>
                                )}

                                {/* Save button visible directly in this tab */}
                                {!isReadOnly && (
                                    <div className="flex justify-end pt-2 border-t border-border-subtle">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex items-center gap-2 bg-brand-primary text-white px-8 py-2.5 rounded-lg font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 cursor-pointer disabled:opacity-50 text-sm"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Salvar Produto
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'budgets' && budgets.length > 0 && (
                            <div className="space-y-6">
                                <div className="border border-border-subtle rounded-xl overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-bg-deep border-b border-border-subtle text-xs uppercase tracking-wider text-text-muted">
                                                <th className="p-3 font-bold">Num. Cotação</th>
                                                <th className="p-3 font-bold">Data</th>
                                                <th className="p-3 font-bold">Fornecedor</th>
                                                <th className="p-3 font-bold text-right">Valor Unitário</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm divide-y divide-border-subtle bg-surface">
                                            {budgets.map((b: any, idx: number) => {
                                                const sName = b.budget?.supplier?.nome_fantasia || b.budget?.supplier?.razao_social || 'N/A';
                                                
                                                return (
                                                    <tr key={b.id} className="hover:bg-bg-deep/50 transition-colors">
                                                        <td className="p-3 font-medium text-text-primary">
                                                            {b.budget?.numero_orcamento || 'N/A'}
                                                        </td>
                                                        <td className="p-3 text-text-muted">
                                                            {new Date(b.budget?.data_cotacao || b.created_at).toLocaleDateString('pt-BR')}
                                                        </td>
                                                        <td className="p-3 font-medium text-text-primary">
                                                            {sName}
                                                        </td>
                                                        <td className="p-3 text-right font-mono text-text-primary font-bold">
                                                            <div className="flex items-center justify-end gap-3">
                                                                {idx === 0 && (
                                                                    <span className="px-2 py-0.5 bg-brand-success/10 text-brand-success text-[10px] uppercase font-bold tracking-wider rounded border border-brand-success/20">
                                                                        Vigente
                                                                    </span>
                                                                )}
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(b.valor_unitario || 0)}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                    </motion.div>
                </AnimatePresence>

                {
                    isReadOnly && (
                        <div className="flex justify-end pt-4 gap-4 border-t border-border-subtle">
                            <button
                                type="button"
                                onClick={() => navigate(`/cadastro/produtos/editar/${id}`)}
                                className="flex items-center gap-2 bg-surface border border-border-subtle text-text-primary px-6 py-2.5 rounded-md font-bold hover:bg-bg-deep transition-all cursor-pointer"
                            >
                                <Edit2 className="w-4 h-4" />
                                Habilitar Edição
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/cadastro/produtos')}
                                className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-md font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 cursor-pointer"
                            >
                                Voltar para Listagem
                            </button>
                        </div>
                    )
                }
            </form >

        </>
    );
};

export default ProductForm;
