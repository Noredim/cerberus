import React, { useEffect, useState } from 'react';
import {
    Save,
    ChevronLeft,
    Loader2,
    Calendar,
    Hash,
    Type,
    FileCode,
    Edit2,
    Zap,
    ExternalLink
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ncmApi } from './api/ncmApi';
import type { Ncm, TaxBenefit } from './types';

const NcmForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const isReadOnly = location.pathname.includes('/detalhes/');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [formData, setFormData] = useState<Partial<Ncm>>({
        codigo: '',
        descricao: '',
        data_inicio: '',
        data_fim: '',
        tipo_ato_ini: '',
        numero_ato_ini: '',
        ano_ato_ini: ''
    });
    const [linkedBenefits, setLinkedBenefits] = useState<TaxBenefit[]>([]);
    const [loadingBenefits, setLoadingBenefits] = useState(false);

    useEffect(() => {
        if (id) {
            fetchNcm();
        }
    }, [id]);

    const fetchNcm = async () => {
        setFetching(true);
        try {
            const data = await ncmApi.getById(id!);
            setFormData(data);
            fetchBenefits(id!);
        } catch (error) {
            console.error('Error fetching NCM:', error);
            alert('Erro ao carregar NCM.');
            navigate('/ncms');
        } finally {
            setFetching(false);
        }
    };

    const fetchBenefits = async (ncmId: string) => {
        setLoadingBenefits(true);
        try {
            const benefits = await ncmApi.getLinkedBenefits(ncmId);
            setLinkedBenefits(benefits);
        } catch (error) {
            console.error('Error fetching linked benefits:', error);
        } finally {
            setLoadingBenefits(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await ncmApi.save(formData);
            navigate('/ncms');
        } catch (error: any) {
            const msg = error.response?.data?.detail || 'Erro ao salvar NCM.';
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
                <p className="text-text-muted">Carregando dados...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/ncms')}
                        className="p-2 hover:bg-bg-deep rounded-full transition-colors cursor-pointer text-text-muted"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-display font-bold text-text-primary">
                                {isReadOnly ? 'Detalhes' : id ? 'Editar' : 'Novo'} <span className="text-brand-primary">NCM</span>
                            </h1>
                            {isReadOnly && id && (
                                <button
                                    type="button"
                                    onClick={() => navigate(`/ncms/editar/${id}`)}
                                    className="flex items-center gap-1.5 bg-brand-primary/10 text-brand-primary border border-brand-primary/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-primary/20 transition-all cursor-pointer"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    Editar
                                </button>
                            )}
                        </div>
                        <p className="text-text-muted">
                            {isReadOnly ? 'Visualização dos dados da nomenclatura.' : id ? 'Atualize as informações da nomenclatura.' : 'Cadastre uma nova nomenclatura manualmente.'}
                        </p>
                    </div>
                </div>

                {!isReadOnly && (
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Salvar NCM
                    </button>
                )}
            </header>

            <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSubmit}
                className="bg-surface rounded-xl border border-border-subtle shadow-sm overflow-hidden"
            >
                <div className="p-8 space-y-8">
                    {/* Primary Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                                <Hash className="w-4 h-4 text-brand-primary" />
                                Código NCM
                            </label>
                            <input
                                required
                                disabled={isReadOnly}
                                type="text"
                                placeholder="Ex: 0101.21.00"
                                value={formData.codigo}
                                onChange={(e) => setFormData(p => ({ ...p, codigo: e.target.value }))}
                                className="w-full bg-bg-deep border border-border-subtle rounded-lg px-4 py-2.5 text-text-primary focus:border-brand-primary outline-none transition-all font-mono disabled:opacity-75"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-brand-primary" />
                                Vigência (Início / Fim)
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    required
                                    disabled={isReadOnly}
                                    type="date"
                                    value={formData.data_inicio}
                                    onChange={(e) => setFormData(p => ({ ...p, data_inicio: e.target.value }))}
                                    className="bg-bg-deep border border-border-subtle rounded-lg px-4 py-2 text-text-primary focus:border-brand-primary outline-none transition-all text-sm disabled:opacity-75"
                                />
                                <input
                                    required
                                    disabled={isReadOnly}
                                    type="date"
                                    value={formData.data_fim}
                                    onChange={(e) => setFormData(p => ({ ...p, data_fim: e.target.value }))}
                                    className="bg-bg-deep border border-border-subtle rounded-lg px-4 py-2 text-text-primary focus:border-brand-primary outline-none transition-all text-sm disabled:opacity-75"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                            <Type className="w-4 h-4 text-brand-primary" />
                            Descrição
                        </label>
                        <textarea
                            required
                            disabled={isReadOnly}
                            rows={4}
                            placeholder="Descrição completa da nomenclatura..."
                            value={formData.descricao}
                            onChange={(e) => setFormData(p => ({ ...p, descricao: e.target.value }))}
                            className="w-full bg-bg-deep border border-border-subtle rounded-lg px-4 py-3 text-text-primary focus:border-brand-primary outline-none transition-all resize-none leading-relaxed disabled:opacity-75"
                        />
                    </div>

                    {/* Legal Info */}
                    <div className="pt-6 border-t border-border-subtle">
                        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-6 flex items-center gap-2">
                            <FileCode className="w-4 h-4" />
                            Informações do Ato Legal
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-text-muted">Tipo Ato</label>
                                <input
                                    disabled={isReadOnly}
                                    type="text"
                                    placeholder="Ex: Resolução"
                                    value={formData.tipo_ato_ini}
                                    onChange={(e) => setFormData(p => ({ ...p, tipo_ato_ini: e.target.value }))}
                                    className="w-full bg-bg-deep border border-border-subtle rounded-lg px-4 py-2 text-text-primary focus:border-brand-primary outline-none transition-all disabled:opacity-75"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-text-muted">Número Ato</label>
                                <input
                                    disabled={isReadOnly}
                                    type="text"
                                    placeholder="Ex: 123"
                                    value={formData.numero_ato_ini}
                                    onChange={(e) => setFormData(p => ({ ...p, numero_ato_ini: e.target.value }))}
                                    className="w-full bg-bg-deep border border-border-subtle rounded-lg px-4 py-2 text-text-primary focus:border-brand-primary outline-none transition-all disabled:opacity-75"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-text-muted">Ano</label>
                                <input
                                    disabled={isReadOnly}
                                    type="text"
                                    maxLength={4}
                                    placeholder="Ex: 2023"
                                    value={formData.ano_ato_ini}
                                    onChange={(e) => setFormData(p => ({ ...p, ano_ato_ini: e.target.value }))}
                                    className="w-full bg-bg-deep border border-border-subtle rounded-lg px-4 py-2 text-text-primary focus:border-brand-primary outline-none transition-all disabled:opacity-75"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-8 py-4 bg-bg-deep border-t border-border-subtle flex justify-end">
                    <button
                        type="button"
                        onClick={() => navigate('/ncms')}
                        className="px-6 py-2 text-sm font-medium text-text-muted hover:text-text-primary cursor-pointer"
                    >
                        {isReadOnly ? 'Voltar' : 'Cancelar'}
                    </button>
                    {!isReadOnly && (
                        <button
                            type="submit"
                            disabled={loading}
                            className="ml-4 bg-surface border border-border-subtle px-6 py-2 rounded-lg text-sm font-bold text-text-primary hover:border-brand-primary transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            Salvar e Voltar
                        </button>
                    )}
                </div>
            </motion.form>

            {/* Linked Benefits Section */}
            {id && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-surface rounded-xl border border-border-subtle shadow-sm overflow-hidden"
                >
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                <Zap className="w-5 h-5 text-brand-primary" />
                                Benefícios Fiscais Vinculados
                            </h3>
                            <span className="px-2.5 py-0.5 bg-bg-deep text-text-muted rounded-full text-xs font-bold border border-border-subtle">
                                {linkedBenefits.length}
                            </span>
                        </div>

                        {loadingBenefits ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
                            </div>
                        ) : linkedBenefits.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                                {linkedBenefits.map(benefit => (
                                    <div
                                        key={benefit.id}
                                        className="flex items-center justify-between p-4 bg-bg-deep rounded-lg border border-border-subtle hover:border-brand-primary/50 transition-all group"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-text-primary text-sm">{benefit.nome}</h4>
                                                {!benefit.ativo && (
                                                    <span className="px-1.5 py-0.5 bg-brand-danger/10 text-brand-danger rounded text-[10px] font-bold uppercase">
                                                        Inativo
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-text-muted line-clamp-1">{benefit.descricao || 'Sem descrição.'}</p>
                                            <div className="flex items-center gap-3 text-[10px] uppercase font-bold tracking-wider">
                                                <span className="text-brand-primary">{benefit.tributo_alvo}</span>
                                                <span className="text-text-muted">•</span>
                                                <span className="text-text-muted">{benefit.esfera}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/beneficios/editar/${benefit.id}`)}
                                            className="p-2 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                            title="Ver Benefício"
                                        >
                                            <ExternalLink className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-bg-deep/50 rounded-lg border border-dashed border-border-subtle">
                                <p className="text-sm text-text-muted">Nenhum benefício fiscal utiliza este NCM atualmente.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default NcmForm;
