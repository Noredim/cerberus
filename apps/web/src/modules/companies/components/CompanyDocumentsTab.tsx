import { useState, useEffect, useCallback } from 'react';
import { FileText, FileSignature, CheckCircle, Save, Trash2, AlertCircle, Loader2, Link2, Unlink } from 'lucide-react';
import { api } from '../../../services/api';

interface SalesTeam {
    id: string;
    nome: string;
    ativo: boolean;
}

interface DocumentTemplate {
    id: string;
    nome: string;
    tipo_documento: string;
    modulo_origem: string;
    status: string;
    versao: number;
}

interface DocumentRule {
    id: string;
    company_id: string;
    tipo_documento: string;
    sales_team_id: string;
    sales_team_nome?: string;
    document_template_id?: string;
    document_template_nome?: string;
}

interface Props {
    companyId: string;
    isReadOnly: boolean;
}

export function CompanyDocumentsTab({ companyId, isReadOnly }: Props) {
    const [selectedDocType, setSelectedDocType] = useState<'PROPOSTA_COMERCIAL' | 'CONTRATO_CLIENTE'>('PROPOSTA_COMERCIAL');
    const [teams, setTeams] = useState<SalesTeam[]>([]);
    const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
    const [rules, setRules] = useState<DocumentRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingTeamId, setSavingTeamId] = useState<string | null>(null);
    const [selectedTemplatesMap, setSelectedTemplatesMap] = useState<Record<string, string>>({});
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const loadData = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        setErrorMsg('');
        try {
            const [teamsRes, templatesRes, rulesRes] = await Promise.all([
                api.get(`/companies/${companyId}/sales-teams`),
                api.get('/document-templates?status=VIGENTE'),
                api.get(`/companies/${companyId}/document-rules`)
            ]);

            setTeams(teamsRes.data);
            setTemplates(templatesRes.data);
            setRules(rulesRes.data);

            // Populate initial selected templates map
            const initialMap: Record<string, string> = {};
            rulesRes.data.forEach((r: DocumentRule) => {
                const key = `${r.tipo_documento}_${r.sales_team_id}`;
                if (r.document_template_id) {
                    initialMap[key] = r.document_template_id;
                }
            });
            setSelectedTemplatesMap(initialMap);
        } catch (err: any) {
            console.error('Erro ao carregar configurações de documentos:', err);
            setErrorMsg('Erro ao carregar dados de equipes ou modelos de documentos.');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSaveRule = async (teamId: string) => {
        const key = `${selectedDocType}_${teamId}`;
        const templateId = selectedTemplatesMap[key] || null;

        setSavingTeamId(teamId);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            await api.post(`/companies/${companyId}/document-rules`, {
                tipo_documento: selectedDocType,
                sales_team_id: teamId,
                document_template_id: templateId || null
            });
            setSuccessMsg('Modelo de documento vinculado com sucesso!');
            await loadData();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err: any) {
            console.error('Erro ao salvar regra de documento:', err);
            const msg = err.response?.data?.detail || 'Erro ao salvar vínculo de documento.';
            setErrorMsg(msg);
        } finally {
            setSavingTeamId(null);
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        if (!window.confirm('Deseja realmente remover este vínculo de modelo?')) return;
        setLoading(true);
        try {
            await api.delete(`/companies/${companyId}/document-rules/${ruleId}`);
            setSuccessMsg('Vínculo removido.');
            await loadData();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            console.error('Erro ao excluir regra:', err);
            setErrorMsg('Erro ao excluir vínculo de documento.');
        } finally {
            setLoading(false);
        }
    };

    if (loading && teams.length === 0) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Description */}
            <div className="bg-surface rounded-lg border border-border-subtle p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-text-primary text-lg flex items-center gap-2">
                            <FileText className="w-5 h-5 text-brand-primary" />
                            Modelos de Documentos por Equipe de Venda
                        </h3>
                        <p className="text-xs text-text-muted mt-1">
                            Vincule modelos de documento específicos para cada equipe de vendas da unidade. Os vendedores emitirão propostas e contratos respeitando os modelos aqui atribuídos.
                        </p>
                    </div>
                </div>
            </div>

            {/* Document Type Selector Sub-Tabs */}
            <div className="flex gap-3 border-b border-border-subtle pb-3">
                <button
                    onClick={() => setSelectedDocType('PROPOSTA_COMERCIAL')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedDocType === 'PROPOSTA_COMERCIAL'
                            ? 'bg-brand-primary text-white shadow-sm'
                            : 'bg-surface hover:bg-bg-deep text-text-muted border border-border-subtle'
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    Proposta Comercial
                </button>
                <button
                    onClick={() => setSelectedDocType('CONTRATO_CLIENTE')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedDocType === 'CONTRATO_CLIENTE'
                            ? 'bg-brand-primary text-white shadow-sm'
                            : 'bg-surface hover:bg-bg-deep text-text-muted border border-border-subtle'
                    }`}
                >
                    <FileSignature className="w-4 h-4" />
                    Contrato de Cliente
                </button>
            </div>

            {/* Success and Error Alerts */}
            {successMsg && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-md text-green-600 dark:text-green-400 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {successMsg}
                </div>
            )}
            {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {errorMsg}
                </div>
            )}

            {/* Rules Matrix Table */}
            <div className="bg-surface rounded-lg border border-border-subtle shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border-subtle bg-bg-deep/50 flex items-center justify-between">
                    <h4 className="font-bold text-text-primary text-sm uppercase tracking-wider flex items-center gap-2">
                        <span>Configuração: {selectedDocType === 'PROPOSTA_COMERCIAL' ? 'Propostas Comerciais' : 'Contratos de Clientes'}</span>
                    </h4>
                    <span className="text-xs text-text-muted">
                        Total de Equipes: {teams.length}
                    </span>
                </div>

                {teams.length === 0 ? (
                    <div className="p-8 text-center text-text-muted text-sm space-y-2">
                        <p>Nenhuma equipe de vendas cadastrada para esta empresa.</p>
                        <p className="text-xs text-text-muted">Cadastre primeiro uma equipe na aba <strong>Equipes de Venda</strong> para configurar modelos de documentos.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border-subtle">
                        {teams.map((team) => {
                            const key = `${selectedDocType}_${team.id}`;
                            const currentRule = rules.find(r => r.tipo_documento === selectedDocType && r.sales_team_id === team.id);
                            const selectedTemplateId = selectedTemplatesMap[key] || '';
                            const isSaving = savingTeamId === team.id;

                            // Filter templates by tipo_documento or show all active
                            const filteredTemplates = templates.filter(t => 
                                selectedDocType === 'PROPOSTA_COMERCIAL' 
                                    ? (t.tipo_documento === 'PROPOSTA_COMERCIAL' || t.modulo_origem === 'OPORTUNIDADE')
                                    : (t.tipo_documento === 'CONTRATO_CLIENTE' || t.tipo_documento === 'CONTRATO' || t.modulo_origem === 'CONTRATO')
                            );
                            const displayTemplates = filteredTemplates.length > 0 ? filteredTemplates : templates;

                            return (
                                <div key={team.id} className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-bg-deep/30 transition-colors">
                                    <div className="space-y-1 min-w-[220px]">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-text-primary text-sm">{team.nome}</span>
                                            {team.ativo ? (
                                                <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 font-bold px-2 py-0.5 rounded-full border border-green-500/20">
                                                    Ativa
                                                </span>
                                            ) : (
                                                <span className="text-[10px] bg-gray-500/10 text-gray-500 font-bold px-2 py-0.5 rounded-full border border-gray-500/20">
                                                    Inativa
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-text-muted flex items-center gap-1.5">
                                            {currentRule && currentRule.document_template_id ? (
                                                <span className="text-brand-primary font-semibold flex items-center gap-1">
                                                    <Link2 className="w-3.5 h-3.5" /> Vinculado: {currentRule.document_template_nome}
                                                </span>
                                            ) : (
                                                <span className="text-text-muted flex items-center gap-1">
                                                    <Unlink className="w-3.5 h-3.5" /> Sem modelo específico (Usa Modelo Padrão da Empresa)
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Select Box & Actions */}
                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <select
                                            disabled={isReadOnly || isSaving}
                                            value={selectedTemplateId}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSelectedTemplatesMap(prev => ({ ...prev, [key]: val }));
                                            }}
                                            className="w-full md:w-80 bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary text-xs text-text-primary disabled:opacity-50"
                                        >
                                            <option value="">-- Selecione o Modelo de Documento --</option>
                                            {displayTemplates.map(t => (
                                                <option key={t.id} value={t.id}>
                                                    {t.nome} (v{t.versao}) [{t.tipo_documento}]
                                                </option>
                                            ))}
                                        </select>

                                        {!isReadOnly && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleSaveRule(team.id)}
                                                    disabled={isSaving}
                                                    title="Salvar vínculo para esta equipe"
                                                    className="flex items-center gap-1.5 bg-brand-primary text-white text-xs font-semibold px-3 py-2 rounded-md hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                                                >
                                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                    Salvar
                                                </button>

                                                {currentRule && (
                                                    <button
                                                        onClick={() => handleDeleteRule(currentRule.id)}
                                                        disabled={isSaving}
                                                        title="Remover vínculo de documento"
                                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
