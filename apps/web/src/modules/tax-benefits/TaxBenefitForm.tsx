import React, { useEffect, useState } from 'react';
import {
    ChevronLeft,
    Save,
    Loader2,
    Info,
    AlertTriangle,
    Layers,
    Target,
    Zap,
    Code,
    X,
    Calendar,
    Percent,
    UploadCloud,
    Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useTaxBenefits } from './hooks/useTaxBenefits';
import { api } from '../../services/api';
import type { TaxBenefit } from './types';

const TaxBenefitForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getBenefit, saveBenefit, loading: apiLoading } = useTaxBenefits();

    const [loading, setLoading] = useState(false);
    const [states, setStates] = useState<{ id: string, nome: string, sigla: string }[]>([]);
    const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual');
    const [ncmLookup, setNcmLookup] = useState<{ loading: boolean, results: any[], isValid: boolean | null }>({
        loading: false,
        results: [],
        isValid: null
    });
    const [ncmInputValue, setNcmInputValue] = useState('');
    const [ncmLocalFilter, setNcmLocalFilter] = useState('');
    const [formData, setFormData] = useState<Partial<TaxBenefit>>({
        nome: '',
        descricao: '',
        esfera: 'MUNICIPAL',
        tributo_alvo: 'ISS',
        tipo_beneficio: 'REDUCAO_ALIQUOTA',
        regra_json: {
            condicoes: {
                uf: [],
                municipio_ibge: [],
                cnae_incluir: [],
                cnae_excluir: [],
                ncm_incluir: [],
                ncm_excluir: [],
                operacao: [],
                cliente_tipo: []
            },
            efeitos: {
                reducao_percentual: 0,
                aliquota_nova: undefined,
                base_reduzida_percentual: undefined,
                credito_percentual: undefined
            },
            vigencia: {
                inicio: new Date().toISOString().split('T')[0]
            },
            prioridade: 100
        },
        requer_habilitacao: false,
        ativo: true
    });

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                // Fetch states directly from API
                const statesResponse = await api.get('/catalog/states');
                setStates(statesResponse.data);

                // Fetch benefit if editing
                if (id) {
                    const data = await getBenefit(id);
                    setFormData(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [id, getBenefit]);

    const updateRegraField = (path: string, value: any) => {
        const newData = { ...formData };
        if (!newData.regra_json) newData.regra_json = {} as any;

        const keys = path.split('.');
        let current: any = newData.regra_json;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        setFormData(newData);
    };

    const handleCnaeTagAdd = (field: 'cnae_incluir' | 'cnae_excluir', value: string) => {
        const condicoes = formData.regra_json?.condicoes;
        if (!condicoes) return;

        const current = (condicoes as any)[field] || [];
        if (value && !current.includes(value)) {
            updateRegraField(`condicoes.${field}`, [...current, value]);
        }
    };

    const removeTag = (field: 'cnae_incluir' | 'cnae_excluir' | 'uf' | 'ncm_incluir', value: string) => {
        const condicoes = formData.regra_json?.condicoes;
        if (!condicoes) return;

        const current = (condicoes as any)[field] || [];
        updateRegraField(`condicoes.${field}`, current.filter((v: string) => v !== value));
    };

    const handleNcmTagAdd = (value: string) => {
        let clean = value.replace(/\D/g, '');
        if (clean.length === 8) {
            const masked = `${clean.slice(0, 4)}.${clean.slice(4, 6)}.${clean.slice(6, 8)}`;
            const current = formData.regra_json?.condicoes?.ncm_incluir || [];
            if (!current.includes(masked)) {
                updateRegraField('condicoes.ncm_incluir', [...current, masked]);
            }
        }
    };

    const handleNcmInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 8) value = value.slice(0, 8);
        if (value.length > 6) {
            value = `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
        } else if (value.length > 4) {
            value = `${value.slice(0, 4)}.${value.slice(4, 6)}`;
        }
        setNcmInputValue(value);
        if (ncmLookup.results.length > 0) setNcmLookup({ loading: false, results: [], isValid: null });
    };

    const handleNcmSearch = async () => {
        const clean = ncmInputValue.replace(/\D/g, '');
        if (clean.length < 4) return;

        setNcmLookup({ loading: true, results: [], isValid: null });
        try {
            const res = await api.get(`/ncm/?codigo=${clean}&limit=10`);
            const items = res.data.items || [];

            if (items.length > 0) {
                setNcmLookup({
                    loading: false,
                    results: items,
                    isValid: true
                });
            } else {
                setNcmLookup({
                    loading: false,
                    results: [],
                    isValid: false
                });
            }
        } catch (err) {
            setNcmLookup({
                loading: false,
                results: [],
                isValid: false
            });
        }
    };

    const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const csvData = event.target?.result as string;
            // Handle both windows \r\n and linux \n
            const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                alert('O arquivo CSV parece estar vazio ou não possui dados além do cabeçalho.');
                return;
            }

            // Detect delimiter (common in BR Excel exports to use semicolon)
            const delimiter = lines[0].includes(';') ? ';' : ',';

            // Clean headers (remove quotes and spaces)
            const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
            const codigoIdx = headers.indexOf('codigo');
            const ativoIdx = headers.indexOf('ativo');

            if (codigoIdx === -1) {
                alert(`CSV inválido. Coluna "codigo" não encontrada. Colunas detectadas: ${headers.join(', ')}`);
                return;
            }

            const currentNcms = new Set(formData.regra_json?.condicoes?.ncm_incluir || []);
            let addedCount = 0;

            const truthyValues = ['true', '1', 'sim', 's', 'y', 'yes', 't', 'ativo', 'v', 'verdadeiro'];

            // Fast regex to split by delimiter but ignore delimiters inside quotes (if needed, though standard split usually works for simple codes)
            // For NCMs, simple split is usually enough if there are no quotes containing the delimiter.
            for (let i = 1; i < lines.length; i++) {
                // Split and clean quotes and spaces from each cell
                const row = lines[i].split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''));
                if (row.length <= codigoIdx) continue;

                // If 'ativo' column exists, check against truthy values. Otherwise assume true.
                let isAtivo = true;
                if (ativoIdx !== -1) {
                    const ativoValue = row[ativoIdx]?.toLowerCase() || '';
                    isAtivo = truthyValues.includes(ativoValue);
                }

                if (isAtivo) {
                    let rawCode = row[codigoIdx]?.replace(/\D/g, '');
                    // Only process exactly 8 digits NCM codes
                    if (rawCode && rawCode.length === 8) {
                        const maskedCode = `${rawCode.slice(0, 4)}.${rawCode.slice(4, 6)}.${rawCode.slice(6, 8)}`;
                        if (!currentNcms.has(maskedCode)) {
                            currentNcms.add(maskedCode);
                            addedCount++;
                        }
                    }
                }
            }

            if (addedCount > 0) {
                updateRegraField('condicoes.ncm_incluir', Array.from(currentNcms));
                alert(`${addedCount} novos NCMs importados com sucesso.`);
            } else {
                alert('Nenhum NCM novo e ativo encontrado no arquivo. Verifique se os códigos possuem 8 dígitos e se a coluna "ativo" (caso exista) está preenchida corretamente (ex: sim, 1, true).');
            }
            e.target.value = ''; // Reset input
        };
        reader.readAsText(file);
    };

    const renderNcmTags = () => {
        const ncms = formData.regra_json?.condicoes?.ncm_incluir || [];
        const filtered = ncmLocalFilter
            ? ncms.filter((n: string) => n.replace(/\D/g, '').includes(ncmLocalFilter.replace(/\D/g, '')))
            : ncms;

        const limit = ncmLocalFilter ? filtered.length : 50;
        const visibleNcms = filtered.slice(0, limit);
        const hiddenCount = filtered.length - limit;

        if (ncms.length === 0) return null;

        return (
            <div className={`mt-4 space-y-3 ${ncms.length > 20 ? 'max-h-60 overflow-y-auto pr-2 custom-scrollbar' : ''}`}>
                <div className="flex flex-wrap gap-2">
                    {visibleNcms.map((tag: string) => (
                        <span key={tag} className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-primary/10 text-brand-primary rounded-md text-[10px] font-bold border border-brand-primary/20 hover:bg-brand-primary/20 transition-all cursor-default">
                            {tag}
                            <X
                                className="w-3 h-3 cursor-pointer hover:text-brand-danger transition-colors"
                                onClick={() => removeTag('ncm_incluir', tag)}
                            />
                        </span>
                    ))}
                    {hiddenCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-deep border border-border-subtle text-text-muted rounded-md text-[10px] font-bold">
                            + {hiddenCount} NCMs adicionais {ncmLocalFilter ? 'encontrados' : 'ocultos'}
                        </span>
                    )}
                </div>
                {ncmLocalFilter && filtered.length === 0 && (
                    <p className="text-[10px] text-text-muted italic bg-bg-deep p-3 rounded-md border border-dashed border-border-subtle">
                        Nenhum NCM adicionado corresponde ao filtro "{ncmLocalFilter}".
                    </p>
                )}
            </div>
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Clean empty effects for backend Pydantic optimization
            const cleanedData = JSON.parse(JSON.stringify(formData));
            const efeitos = cleanedData.regra_json.efeitos;
            Object.keys(efeitos).forEach(key => {
                if (efeitos[key] === undefined || efeitos[key] === null || efeitos[key] === '') {
                    delete efeitos[key];
                }
            });

            await saveBenefit(cleanedData);
            navigate('/beneficios');
        } catch (err) {
            alert('Erro ao salvar benefício. Verifique os campos obrigatórios.');
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
                        onClick={() => navigate('/beneficios')}
                        className="p-2 rounded-md hover:bg-bg-deep text-text-muted transition-colors cursor-pointer"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                            {id ? 'Editar' : 'Novo'} <span className="text-brand-primary">Benefício</span>
                        </h1>
                        <p className="text-text-muted mt-1">Configure as regras lógicas e o tipo de benefício fiscal.</p>
                    </div>
                </div>

                <button
                    form="benefit-form"
                    type="submit"
                    disabled={apiLoading}
                    className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-md font-semibold hover:bg-brand-primary/90 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                >
                    {apiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Salvar Regra
                </button>
            </header>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
                <div className="lg:col-span-2 space-y-6">
                    <form id="benefit-form" onSubmit={handleSubmit} className="bg-surface rounded-lg border border-border-subtle shadow-sm p-8 space-y-8">
                        {/* Identidade */}
                        <section className="space-y-6">
                            <div className="flex flex-col gap-1">
                                <h3 className="font-bold text-text-primary text-lg">Definição Geral</h3>
                                <p className="text-xs text-text-muted">Como este benefício será identificado no sistema.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Nome do Benefício</label>
                                    <input
                                        type="text"
                                        value={formData.nome}
                                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                        placeholder="Ex: Redução Base de Cálculo Art. 123"
                                        className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm font-semibold"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                            <Layers className="w-3 h-3" /> Esfera
                                        </label>
                                        <select
                                            value={formData.esfera}
                                            onChange={e => setFormData({ ...formData, esfera: e.target.value as any })}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary transition-colors text-xs"
                                        >
                                            <option value="MUNICIPAL">Municipal</option>
                                            <option value="ESTADUAL">Estadual</option>
                                            <option value="FEDERAL">Federal</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                            <Target className="w-3 h-3" /> Tributo
                                        </label>
                                        <select
                                            value={formData.tributo_alvo}
                                            onChange={e => setFormData({ ...formData, tributo_alvo: e.target.value as any })}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary transition-colors text-xs"
                                        >
                                            <option value="ISS">ISS</option>
                                            <option value="ICMS">ICMS</option>
                                            <option value="IPI">IPI</option>
                                            <option value="PIS">PIS</option>
                                            <option value="COFINS">COFINS</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                            <Percent className="w-3 h-3" /> Tipo
                                        </label>
                                        <select
                                            value={formData.tipo_beneficio}
                                            onChange={e => setFormData({ ...formData, tipo_beneficio: e.target.value as any })}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary transition-colors text-xs"
                                        >
                                            <option value="REDUCAO_ALIQUOTA">Redução Alíquota</option>
                                            <option value="ISENCAO">Isenção Total</option>
                                            <option value="DIFERIMENTO">Diferimento</option>
                                            <option value="BASE_CALCULO_REDUZIDA">Redução Base</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Editor Visual vs JSON */}
                        <section className="pt-6 border-t border-border-subtle space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                    <h3 className="font-bold text-text-primary text-lg">Regras de Cálculo</h3>
                                    <p className="text-xs text-text-muted">Defina quanto e quando aplicar este benefício.</p>
                                </div>
                                <div className="flex bg-bg-deep p-1 rounded-lg border border-border-subtle">
                                    <button
                                        type="button"
                                        onClick={() => setEditorMode('visual')}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${editorMode === 'visual' ? 'bg-brand-primary text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                                    >
                                        <Zap className="w-3 h-3" /> Visual
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditorMode('json')}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${editorMode === 'json' ? 'bg-brand-primary text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                                    >
                                        <Code className="w-3 h-3" /> JSON
                                    </button>
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                {editorMode === 'visual' ? (
                                    <motion.div
                                        key="visual"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="space-y-8"
                                    >
                                        {/* Efeitos */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4 p-5 bg-brand-primary/5 rounded-lg border border-brand-primary/10">
                                                <h4 className="text-sm font-bold text-brand-primary flex items-center gap-2">
                                                    <Zap className="w-4 h-4" /> Efeito Financeiro
                                                </h4>

                                                {formData.tipo_beneficio === 'REDUCAO_ALIQUOTA' && (
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-text-muted uppercase">Percentual de Redução (%)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.regra_json?.efeitos?.reducao_percentual || ''}
                                                            onChange={e => updateRegraField('efeitos.reducao_percentual', parseFloat(e.target.value))}
                                                            placeholder="Ex: 41.17"
                                                            className="w-full bg-surface border border-border-subtle rounded-md py-2 px-4 focus:border-brand-primary outline-none transition-colors text-sm font-bold text-brand-primary"
                                                        />
                                                    </div>
                                                )}

                                                {formData.tipo_beneficio === 'BASE_CALCULO_REDUZIDA' && (
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-text-muted uppercase">Base Reduzida p/ (%)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.regra_json?.efeitos?.base_reduzida_percentual || ''}
                                                            onChange={e => updateRegraField('efeitos.base_reduzida_percentual', parseFloat(e.target.value))}
                                                            placeholder="Ex: 10.00"
                                                            className="w-full bg-surface border border-border-subtle rounded-md py-2 px-4 focus:border-brand-primary outline-none transition-colors text-sm font-bold text-brand-primary"
                                                        />
                                                    </div>
                                                )}

                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-text-muted uppercase">Prioridade de Execução</label>
                                                    <input
                                                        type="number"
                                                        value={formData.regra_json?.prioridade || 100}
                                                        onChange={e => updateRegraField('prioridade', parseInt(e.target.value))}
                                                        className="w-full bg-surface border border-border-subtle rounded-md py-2 px-4 focus:border-brand-primary outline-none transition-colors text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-4 p-5 bg-bg-deep rounded-lg border border-border-subtle">
                                                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                                    <Calendar className="w-4 h-4" /> Vigência
                                                </h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-text-muted uppercase">Início</label>
                                                        <input
                                                            type="date"
                                                            value={formData.regra_json?.vigencia?.inicio || ''}
                                                            onChange={e => updateRegraField('vigencia.inicio', e.target.value)}
                                                            className="w-full bg-surface border border-border-subtle rounded-md py-2 px-3 text-xs"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-text-muted uppercase">Fim (Opcional)</label>
                                                        <input
                                                            type="date"
                                                            value={formData.regra_json?.vigencia?.fim || ''}
                                                            onChange={e => updateRegraField('vigencia.fim', e.target.value)}
                                                            className="w-full bg-surface border border-border-subtle rounded-md py-2 px-3 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Condições */}
                                        <div className="space-y-6">
                                            <h4 className="text-sm font-bold text-text-primary border-b border-border-subtle pb-2">Filtros de Aplicação (Condições)</h4>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">CNAEs Permitidos</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Digito o código..."
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleCnaeTagAdd('cnae_incluir', (e.target as HTMLInputElement).value);
                                                                    (e.target as HTMLInputElement).value = '';
                                                                }
                                                            }}
                                                            className="flex-1 bg-bg-deep border border-border-subtle rounded-md py-2 px-4 text-sm focus:border-brand-primary outline-none"
                                                        />
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {formData.regra_json?.condicoes?.cnae_incluir?.map((tag: string) => (
                                                            <span key={tag} className="inline-flex items-center gap-1.5 px-2 py-1 bg-brand-primary/10 text-brand-primary rounded text-[10px] font-bold border border-brand-primary/20">
                                                                {tag}
                                                                <X className="w-3 h-3 cursor-pointer hover:text-brand-danger" onClick={() => removeTag('cnae_incluir', tag)} />
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Estados (UF)</label>
                                                    <div className="flex gap-2">
                                                        <select
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    const current = formData.regra_json?.condicoes?.uf || [];
                                                                    if (!current.includes(e.target.value)) {
                                                                        updateRegraField('condicoes.uf', [...current, e.target.value]);
                                                                    }
                                                                    e.target.value = '';
                                                                }
                                                            }}
                                                            className="flex-1 bg-bg-deep border border-border-subtle rounded-md py-2 px-4 text-sm focus:border-brand-primary outline-none"
                                                        >
                                                            <option value="">Adicionar UF...</option>
                                                            {states.map(s => (
                                                                <option key={s.id} value={s.sigla}>{s.nome} ({s.sigla})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {formData.regra_json?.condicoes?.uf?.map((tag: string) => (
                                                            <span key={tag} className="inline-flex items-center gap-1.5 px-2 py-1 bg-brand-primary/10 text-brand-primary rounded text-[10px] font-bold border border-brand-primary/20">
                                                                {tag}
                                                                <X className="w-3 h-3 cursor-pointer hover:text-brand-danger" onClick={() => removeTag('uf', tag)} />
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-6 pt-4 border-t border-border-subtle">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                                            NCMs Permitidos
                                                        </label>
                                                        <p className="text-[10px] text-text-muted">Consulte na base global ou filtre os já adicionados.</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="flex items-center gap-1.5 text-xs font-bold text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 transition-colors px-3 py-1.5 rounded-md cursor-pointer border border-brand-primary/20 shadow-sm">
                                                            <UploadCloud className="w-3.5 h-3.5" />
                                                            Importar CSV
                                                            <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
                                                        </label>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 relative">
                                                    <div className="relative flex-1 group">
                                                        <div className={`absolute inset-0 bg-brand-primary/5 rounded-md transition-opacity opacity-0 group-focus-within:opacity-100 -m-1 pointer-events-none`} />
                                                        <input
                                                            type="text"
                                                            placeholder="Consultar ou Filtrar NCM..."
                                                            value={ncmInputValue}
                                                            onChange={(e) => {
                                                                handleNcmInputChange(e);
                                                                setNcmLocalFilter(e.target.value);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    if (ncmLookup.results.length > 0) {
                                                                        handleNcmTagAdd(ncmLookup.results[0].codigo);
                                                                        setNcmInputValue('');
                                                                        setNcmLocalFilter('');
                                                                    } else if (ncmInputValue.replace(/\D/g, '').length === 8) {
                                                                        handleNcmTagAdd(ncmInputValue);
                                                                        setNcmInputValue('');
                                                                        setNcmLocalFilter('');
                                                                    } else if (ncmInputValue.replace(/\D/g, '').length >= 4) {
                                                                        handleNcmSearch();
                                                                    }
                                                                }
                                                            }}
                                                            className={`relative w-full bg-bg-deep border rounded-md py-2.5 px-4 text-sm outline-none transition-all ${ncmLookup.isValid === true ? 'border-brand-success/50 focus:border-brand-success' : ncmLookup.isValid === false ? 'border-brand-danger/50 focus:border-brand-danger' : 'border-border-subtle focus:border-brand-primary'}`}
                                                        />
                                                        <AnimatePresence>
                                                            {ncmLookup.loading && (
                                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute right-3 top-1/2 -translate-y-1/2">
                                                                    <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleNcmSearch}
                                                        disabled={ncmLookup.loading || ncmInputValue.replace(/\D/g, '').length < 4}
                                                        className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-5 py-2.5 rounded-md hover:bg-brand-primary/20 transition-all text-xs font-bold disabled:opacity-50 cursor-pointer border border-brand-primary/20 shrink-0 shadow-sm"
                                                    >
                                                        <Search className="w-3.5 h-3.5" />
                                                        Consultar Global
                                                    </button>

                                                    {/* Modern Search Results Dropdown */}
                                                    <AnimatePresence>
                                                        {ncmLookup.results.length > 0 && (
                                                            <motion.div
                                                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                                                className="absolute top-full left-0 right-0 z-[60] mt-3 bg-surface border border-border-subtle rounded-xl shadow-2xl overflow-hidden glass-morphism border-brand-primary/10"
                                                            >
                                                                <div className="bg-bg-deep/50 px-4 py-2 border-b border-border-subtle flex justify-between items-center">
                                                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Resultados da Base NCM</span>
                                                                    <button onClick={() => setNcmLookup({ ...ncmLookup, results: [] })}>
                                                                        <X className="w-3 h-3 text-text-muted hover:text-brand-danger transition-colors cursor-pointer" />
                                                                    </button>
                                                                </div>
                                                                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                                                    {ncmLookup.results.map((ncm: any) => {
                                                                        const isAlreadyAdded = formData.regra_json?.condicoes?.ncm_incluir?.includes(ncm.codigo);
                                                                        return (
                                                                            <button
                                                                                key={ncm.id}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    if (!isAlreadyAdded) handleNcmTagAdd(ncm.codigo);
                                                                                    setNcmInputValue('');
                                                                                    setNcmLocalFilter('');
                                                                                    setNcmLookup({ loading: false, results: [], isValid: true });
                                                                                }}
                                                                                className={`w-full text-left p-4 hover:bg-brand-primary/[0.03] border-b border-border-subtle last:border-0 transition-all flex items-start gap-4 group ${isAlreadyAdded ? 'opacity-60 cursor-default grayscale-[0.5]' : 'cursor-pointer'}`}
                                                                            >
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="flex items-center justify-between mb-1">
                                                                                        <span className="text-sm font-black text-brand-primary group-hover:scale-105 transition-transform origin-left">{ncm.codigo}</span>
                                                                                        {isAlreadyAdded ? (
                                                                                            <span className="text-[9px] bg-brand-success/10 text-brand-success px-2 py-0.5 rounded-full font-bold border border-brand-success/20">Já Permitido</span>
                                                                                        ) : (
                                                                                            <span className="text-[9px] bg-bg-deep text-text-muted px-2 py-0.5 rounded-full font-bold group-hover:bg-brand-primary group-hover:text-white transition-colors">Clique p/ Permitir</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2 uppercase group-hover:text-text-primary transition-colors">
                                                                                        {ncm.descricao}
                                                                                    </p>
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>

                                                {ncmLookup.isValid === false && (
                                                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 text-brand-danger mt-2 px-1">
                                                        <X className="w-3.5 h-3.5" />
                                                        <span className="text-[10px] font-bold uppercase tracking-tight">Nenhum NCM localizado com este código.</span>
                                                    </motion.div>
                                                )}

                                                {renderNcmTags()}
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="json"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="space-y-4"
                                    >
                                        <div className="bg-[#1e1e1e] rounded-md p-4 font-mono text-sm border border-brand-primary/20">
                                            <textarea
                                                value={JSON.stringify(formData.regra_json, null, 2)}
                                                onChange={e => {
                                                    try {
                                                        const parsed = JSON.parse(e.target.value);
                                                        setFormData({ ...formData, regra_json: parsed } as any);
                                                    } catch (err) { /* invalid json */ }
                                                }}
                                                rows={15}
                                                className="w-full bg-transparent text-emerald-400 outline-none resize-none scrollbar-hide"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 p-3 bg-brand-info/5 rounded border border-brand-info/10">
                                            <Info className="w-4 h-4 text-brand-info" />
                                            <p className="text-[11px] text-brand-info font-medium italic">Edite diretamente o JSON para configurações avançadas não disponíveis no editor visual.</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </section>
                    </form>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="bg-surface p-6 rounded-lg border border-border-subtle shadow-sm space-y-4">
                        <h3 className="font-bold text-text-primary text-sm">Resumo da Regra</h3>
                        <div className="p-5 bg-bg-deep rounded border border-border-subtle space-y-4">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-text-muted">Impacto</span>
                                <span className="text-brand-primary font-bold uppercase tracking-widest">{formData.tipo_beneficio?.replace('_', ' ')}</span>
                            </div>

                            {formData.regra_json?.efeitos?.reducao_percentual! > 0 && (
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-text-muted">Valor</span>
                                    <span className="text-brand-success font-black text-lg">-{formData.regra_json!.efeitos.reducao_percentual}%</span>
                                </div>
                            )}

                            <div className="pt-3 border-t border-border-subtle space-y-2">
                                <p className="text-[10px] font-bold text-text-muted uppercase">Aplica-se a:</p>
                                <div className="flex flex-wrap gap-1">
                                    {formData.regra_json?.condicoes?.uf!?.length > 0 ? (
                                        formData.regra_json!.condicoes.uf.map((u: string) => (
                                            <span key={u} className="px-1.5 py-0.5 bg-brand-info/10 text-brand-info rounded text-[8px] font-bold">{u}</span>
                                        ))
                                    ) : (
                                        <span className="text-[10px] text-text-muted italic">Qualquer UF</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-brand-warning/5 p-6 rounded-lg border border-brand-warning/20 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-brand-warning">
                            <AlertTriangle className="w-5 h-5" />
                            <h3 className="font-bold text-xs">Atenção Crítica</h3>
                        </div>
                        <p className="text-[11px] text-brand-warning/80 leading-relaxed font-medium">
                            Benefícios fiscais requerem base legal explícita. O Cerberus registra o `timestamp` e o `user_id` para auditoria fiscal em caso de fiscalização.
                        </p>
                    </div>
                </div>
            </motion.div >
        </div >
    );
};

export default TaxBenefitForm;
