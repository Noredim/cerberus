import React, { useEffect, useState } from 'react';
import {
    ChevronLeft,
    Save,
    Loader2,
    Plus,
    Trash2,
    AlertTriangle,
    CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { FormaPagamento, FormaPagamentoParcela } from './FormasPagamentoList';

const FormasPagamentoForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    const [formData, setFormData] = useState<Partial<FormaPagamento>>({
        descricao: '',
        tipo_uso: 'VENDA',
        tipo_distribuicao: 'PERCENTUAL',
        ativo: true,
        observacao: '',
        parcelas: [
            { sequencia: 1, descricao: 'Parcela 1', intervalo_dias: 0, percentual: 100, valor_fixo: null }
        ]
    });

    useEffect(() => {
        if (!id) return;

        const loadForma = async () => {
            setLoading(true);
            try {
                const response = await api.get(`/cadastro/formas-pagamento/${id}`);
                const data = response.data;
                // Parse decimals if needed
                const parcelasParsed = (data.parcelas || []).map((p: any) => ({
                    ...p,
                    percentual: p.percentual !== null ? parseFloat(p.percentual) : null,
                    valor_fixo: p.valor_fixo !== null ? parseFloat(p.valor_fixo) : null,
                }));
                setFormData({
                    ...data,
                    parcelas: parcelasParsed
                });
            } catch (err) {
                console.error('Erro ao carregar forma de pagamento:', err);
                alert('Erro ao carregar forma de pagamento.');
                navigate('/cadastros/formas-pagamento');
            } finally {
                setLoading(false);
            }
        };

        loadForma();
    }, [id]);

    const handleHeaderChange = (field: keyof FormaPagamento, value: any) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            
            // Adjust defaults if tipo_distribuicao changes
            if (field === 'tipo_distribuicao') {
                const newDist = value as FormaPagamento['tipo_distribuicao'];
                const currentParcelas = prev.parcelas || [];
                
                updated.parcelas = currentParcelas.map((p, idx) => {
                    if (newDist === 'PERCENTUAL') {
                        return {
                            ...p,
                            percentual: idx === 0 ? 100 : 0,
                            valor_fixo: null
                        };
                    } else if (newDist === 'RATEIO_IGUAL') {
                        return {
                            ...p,
                            percentual: null,
                            valor_fixo: null
                        };
                    } else { // VALOR_FIXO
                        return {
                            ...p,
                            percentual: null,
                            valor_fixo: null // Null means "Saldo" balance
                        };
                    }
                });
            }
            return updated;
        });
    };

    const handleParcelaChange = (index: number, field: keyof FormaPagamentoParcela, value: any) => {
        setFormData(prev => {
            const current = [...(prev.parcelas || [])];
            current[index] = { ...current[index], [field]: value };
            return { ...prev, parcelas: current };
        });
    };

    const addParcela = () => {
        setFormData(prev => {
            const current = [...(prev.parcelas || [])];
            const nextSeq = current.length + 1;
            const newParcela: FormaPagamentoParcela = {
                sequencia: nextSeq,
                descricao: `Parcela ${nextSeq}`,
                intervalo_dias: current.length > 0 ? current[current.length - 1].intervalo_dias + 30 : 30,
                percentual: prev.tipo_distribuicao === 'PERCENTUAL' ? 0 : null,
                valor_fixo: null
            };
            return { ...prev, parcelas: [...current, newParcela] };
        });
    };

    const removeParcela = (index: number) => {
        setFormData(prev => {
            const current = [...(prev.parcelas || [])];
            if (current.length <= 1) return prev;
            
            // Remove item
            current.splice(index, 1);
            
            // Re-sequence
            const resequenced = current.map((p, i) => ({
                ...p,
                sequencia: i + 1,
                descricao: p.descricao.startsWith('Parcela ') ? `Parcela ${i + 1}` : p.descricao
            }));
            
            return { ...prev, parcelas: resequenced };
        });
    };

    // Calculate metrics
    const sumPercent = (formData.parcelas || []).reduce((acc, p) => acc + (p.percentual || 0), 0);
    const nullFixedCount = (formData.parcelas || []).filter(p => p.valor_fixo === null).length;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Frontend validations
        if (!formData.descricao?.trim()) {
            alert('A descrição é obrigatória.');
            return;
        }

        const parcelas = formData.parcelas || [];
        if (parcelas.length === 0) {
            alert('A forma de pagamento deve possuir ao menos uma parcela.');
            return;
        }

        if (formData.tipo_distribuicao === 'PERCENTUAL') {
            if (sumPercent !== 100) {
                alert(`A soma dos percentuais é ${sumPercent}%. Deve ser exatamente 100%.`);
                return;
            }
        } else if (formData.tipo_distribuicao === 'VALOR_FIXO') {
            if (nullFixedCount > 1) {
                alert('Apenas uma parcela pode ter o valor fixo vazio (definida como Saldo).');
                return;
            }
        }

        setSubmitting(true);
        try {
            const payload = {
                descricao: formData.descricao,
                tipo_uso: formData.tipo_uso,
                tipo_distribuicao: formData.tipo_distribuicao,
                ativo: formData.ativo,
                observacao: formData.observacao || null,
                parcelas: parcelas.map(p => ({
                    sequencia: p.sequencia,
                    descricao: p.descricao,
                    intervalo_dias: p.intervalo_dias,
                    percentual: formData.tipo_distribuicao === 'PERCENTUAL' ? p.percentual : null,
                    valor_fixo: formData.tipo_distribuicao === 'VALOR_FIXO' ? p.valor_fixo : null,
                }))
            };

            if (id) {
                await api.put(`/cadastro/formas-pagamento/${id}`, payload);
            } else {
                await api.post('/cadastro/formas-pagamento', payload);
            }
            navigate('/cadastros/formas-pagamento');
        } catch (err: any) {
            console.error('Erro ao salvar:', err);
            const msg = err.response?.data?.detail || 'Erro ao salvar forma de pagamento.';
            alert(msg);
        } finally {
            setSubmitting(false);
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
                        onClick={() => navigate('/cadastros/formas-pagamento')}
                        className="p-2 rounded-md hover:bg-bg-deep text-text-muted transition-colors cursor-pointer"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                            {id ? 'Editar' : 'Nova'} <span className="text-brand-primary">Forma de Pagamento</span>
                        </h1>
                        <p className="text-text-muted mt-1">Configure as regras de vencimento e distribuição de parcelas.</p>
                    </div>
                </div>

                <button
                    form="payment-method-form"
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-md font-semibold hover:bg-brand-primary/90 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Salvar Forma
                </button>
            </header>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
                {/* Main Form Area */}
                <div className="lg:col-span-2 space-y-6">
                    <form id="payment-method-form" onSubmit={handleSubmit} className="bg-surface rounded-lg border border-border-subtle shadow-sm p-8 space-y-8">
                        {/* Identidade / Cabeçalho */}
                        <section className="space-y-6">
                            <div className="flex flex-col gap-1">
                                <h3 className="font-bold text-text-primary text-lg">Definição Geral</h3>
                                <p className="text-xs text-text-muted">Como esta condição de pagamento será identificada e aplicada.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Descrição comercial</label>
                                    <input
                                        type="text"
                                        value={formData.descricao}
                                        onChange={e => handleHeaderChange('descricao', e.target.value)}
                                        placeholder="Ex: 30/60/90 Dias - Sem Juros"
                                        className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm font-semibold"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Tipo de Uso</label>
                                    <select
                                        value={formData.tipo_uso}
                                        onChange={e => handleHeaderChange('tipo_uso', e.target.value)}
                                        className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary transition-colors text-sm"
                                    >
                                        <option value="VENDA">Apenas Venda (Comercial)</option>
                                        <option value="COMPRA">Apenas Compra (Suprimentos)</option>
                                        <option value="AMBOS">Ambos (Venda e Compra)</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Tipo de Distribuição</label>
                                    <select
                                        value={formData.tipo_distribuicao}
                                        onChange={e => handleHeaderChange('tipo_distribuicao', e.target.value)}
                                        className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary transition-colors text-sm"
                                    >
                                        <option value="PERCENTUAL">Divisão por Percentual (%)</option>
                                        <option value="RATEIO_IGUAL">Rateio Igualitário</option>
                                        <option value="VALOR_FIXO">Valores Fixos / Saldo Restante</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Observações adicionais</label>
                                    <textarea
                                        value={formData.observacao || ''}
                                        onChange={e => handleHeaderChange('observacao', e.target.value)}
                                        placeholder="Regras de faturamento, condições de impostos..."
                                        rows={3}
                                        className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-4 outline-none focus:border-brand-primary transition-colors text-sm"
                                    />
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="ativo"
                                        checked={formData.ativo}
                                        onChange={e => handleHeaderChange('ativo', e.target.checked)}
                                        className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary"
                                    />
                                    <label htmlFor="ativo" className="text-sm font-semibold text-text-primary cursor-pointer">
                                        Forma de Pagamento Ativa
                                    </label>
                                </div>
                            </div>
                        </section>

                        {/* Grade de Parcelas */}
                        <section className="pt-6 border-t border-border-subtle space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                    <h3 className="font-bold text-text-primary text-lg">Parcelas da Condição</h3>
                                    <p className="text-xs text-text-muted">Defina a quantidade de parcelas, intervalos e regras financeiras.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={addParcela}
                                    className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-all px-4 py-2 rounded-md text-xs font-bold border border-brand-primary/20 cursor-pointer shadow-sm"
                                >
                                    <Plus className="w-4 h-4" /> Adicionar Parcela
                                </button>
                            </div>

                            <div className="space-y-3">
                                <AnimatePresence initial={false}>
                                    {(formData.parcelas || []).map((parcela, index) => (
                                        <motion.div
                                            key={parcela.sequencia}
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                            className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3 bg-bg-deep rounded-md border border-border-subtle"
                                        >
                                            {/* Sequencia */}
                                            <div className="md:col-span-1 text-center font-bold text-text-muted text-sm">
                                                #{parcela.sequencia}
                                            </div>

                                            {/* Descrição */}
                                            <div className="md:col-span-4">
                                                <input
                                                    type="text"
                                                    value={parcela.descricao}
                                                    onChange={e => handleParcelaChange(index, 'descricao', e.target.value)}
                                                    placeholder="Descrição (ex: 30 dias)"
                                                    className="w-full bg-surface border border-border-subtle rounded-md py-1.5 px-3 text-sm"
                                                    required
                                                />
                                            </div>

                                            {/* Intervalo de Dias */}
                                            <div className="md:col-span-3 flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={parcela.intervalo_dias}
                                                    onChange={e => handleParcelaChange(index, 'intervalo_dias', parseInt(e.target.value) || 0)}
                                                    placeholder="Dias"
                                                    min="0"
                                                    className="w-full bg-surface border border-border-subtle rounded-md py-1.5 px-3 text-sm text-center"
                                                    required
                                                />
                                                <span className="text-xs text-text-muted font-semibold whitespace-nowrap">dias</span>
                                            </div>

                                            {/* Percentual / Valor Fixo */}
                                            <div className="md:col-span-3">
                                                {formData.tipo_distribuicao === 'PERCENTUAL' && (
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            step="0.0001"
                                                            value={parcela.percentual ?? ''}
                                                            onChange={e => handleParcelaChange(index, 'percentual', parseFloat(e.target.value) || 0)}
                                                            placeholder="0"
                                                            className="w-full bg-surface border border-border-subtle rounded-md py-1.5 pr-6 pl-3 text-sm text-right font-bold text-brand-primary"
                                                            required
                                                        />
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">%</span>
                                                    </div>
                                                )}

                                                {formData.tipo_distribuicao === 'VALOR_FIXO' && (
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={parcela.valor_fixo ?? ''}
                                                            onChange={e => handleParcelaChange(index, 'valor_fixo', e.target.value ? parseFloat(e.target.value) : null)}
                                                            placeholder="Saldo"
                                                            className={`w-full bg-surface border border-border-subtle rounded-md py-1.5 pr-2 pl-6 text-sm text-right font-bold ${parcela.valor_fixo === null ? 'text-brand-success' : 'text-text-primary'}`}
                                                        />
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">$</span>
                                                    </div>
                                                )}

                                                {formData.tipo_distribuicao === 'RATEIO_IGUAL' && (
                                                    <div className="text-xs text-center text-text-muted py-2 bg-surface rounded border border-border-subtle border-dashed font-semibold">
                                                        Calculado
                                                    </div>
                                                )}
                                            </div>

                                            {/* Botão Remover */}
                                            <div className="md:col-span-1 text-center">
                                                <button
                                                    type="button"
                                                    disabled={(formData.parcelas || []).length <= 1}
                                                    onClick={() => removeParcela(index)}
                                                    className="p-1.5 rounded-md hover:bg-brand-danger/10 text-text-muted hover:text-brand-danger transition-colors disabled:opacity-30 cursor-pointer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </section>
                    </form>
                </div>

                {/* Sidebar Info/Metrics Area */}
                <div className="space-y-6">
                    <div className="bg-surface rounded-lg border border-border-subtle shadow-sm p-6 space-y-6">
                        <h4 className="font-bold text-text-primary text-base border-b border-border-subtle pb-2">Validação Matemática</h4>
                        
                        {formData.tipo_distribuicao === 'PERCENTUAL' && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm font-semibold">
                                    <span className="text-text-muted">Soma dos Percentuais:</span>
                                    <span className={sumPercent === 100 ? 'text-brand-success text-base font-bold' : 'text-brand-danger text-base font-bold'}>
                                        {sumPercent}%
                                    </span>
                                </div>
                                <div className="w-full bg-bg-deep rounded-full h-2">
                                    <div 
                                        className={`h-2 rounded-full transition-all duration-300 ${sumPercent === 100 ? 'bg-brand-success' : 'bg-brand-danger'}`} 
                                        style={{ width: `${Math.min(100, sumPercent)}%` }} 
                                    />
                                </div>

                                {sumPercent === 100 ? (
                                    <div className="flex items-start gap-2 text-xs text-brand-success bg-brand-success/5 border border-brand-success/15 p-3 rounded-md">
                                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>A soma fecha exatamente em 100%! Pronto para salvar.</span>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2 text-xs text-brand-danger bg-brand-danger/5 border border-brand-danger/15 p-3 rounded-md">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>Os percentuais devem somar 100%. Ajuste as parcelas.</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {formData.tipo_distribuicao === 'RATEIO_IGUAL' && (
                            <div className="space-y-2 text-sm text-text-muted">
                                <p><strong>Rateio Igualitário:</strong></p>
                                <p className="text-xs">O valor total da transação será dividido igualmente pelo número total de parcelas ({formData.parcelas?.length || 0}).</p>
                                <p className="text-xs">Diferenças de arredondamento de centavos serão somadas automaticamente na última parcela.</p>
                            </div>
                        )}

                        {formData.tipo_distribuicao === 'VALOR_FIXO' && (
                            <div className="space-y-3">
                                <div className="text-sm text-text-muted space-y-2">
                                    <p><strong>Configuração de Valores Fixos:</strong></p>
                                    <p className="text-xs">Permite fixar valores predefinidos em parcelas. Deixe uma parcela com o valor vazio para que ela receba automaticamente o "Saldo" restante da operação.</p>
                                </div>
                                
                                {nullFixedCount === 1 ? (
                                    <div className="flex items-start gap-2 text-xs text-brand-success bg-brand-success/5 border border-brand-success/15 p-3 rounded-md">
                                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>Uma única parcela configurada como "Saldo". Configuração válida!</span>
                                    </div>
                                ) : nullFixedCount > 1 ? (
                                    <div className="flex items-start gap-2 text-xs text-brand-danger bg-brand-danger/5 border border-brand-danger/15 p-3 rounded-md">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>Você possui {nullFixedCount} parcelas vazias. Defina apenas uma como Saldo.</span>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2 text-xs text-brand-warning bg-brand-warning/5 border border-brand-warning/15 p-3 rounded-md">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>Nenhuma parcela configurada como "Saldo". A soma dos valores fixos deve ser idêntica ao valor da oportunidade/compra.</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default FormasPagamentoForm;
