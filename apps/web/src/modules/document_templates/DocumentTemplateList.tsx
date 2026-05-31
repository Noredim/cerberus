import React, { useEffect, useState } from 'react';
import {
    FileText,
    Search,
    MoreVertical,
    Plus,
    CheckCircle2,
    XCircle,
    Loader2,
    Edit2,
    Copy,
    Eye,
    Check,
    PowerOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export interface DocumentVariable {
    id: string;
    modelo_id: string;
    nome: string;
    origem: string;
    campo: string;
    tipo: string;
    obrigatoria: boolean;
}

export interface DocumentTemplate {
    id: string;
    nome: string;
    tipo_documento: string;
    modulo_origem: string;
    status: 'RASCUNHO' | 'VIGENTE' | 'INATIVO';
    versao: number;
    conteudo_html: string;
    descricao?: string | null;
    created_at: string;
    updated_at: string;
    variables: DocumentVariable[];
}

const DocumentTemplateList: React.FC = () => {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [originFilter, setOriginFilter] = useState<string>('ALL');
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const loadTemplates = React.useCallback(async () => {
        setLoading(true);
        try {
            const params: { status?: string; modulo?: string } = {};
            if (statusFilter !== 'ALL') params.status = statusFilter;
            if (originFilter !== 'ALL') params.modulo = originFilter;
            
            const response = await api.get('/document-templates', { params });
            setTemplates(response.data);
        } catch (err) {
            console.error('Erro ao buscar modelos de documentos:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, originFilter]);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const handleDuplicate = async (id: string, name: string) => {
        if (!window.confirm(`Deseja criar uma cópia/nova versão do modelo "${name}"?`)) return;
        try {
            const response = await api.post(`/document-templates/${id}/duplicate`);
            const clone = response.data;
            alert('Modelo duplicado com sucesso! Redirecionando para a edição do rascunho.');
            navigate(`/cadastros/modelos-documentos/${clone.id}`);
        } catch (err) {
            console.error(err);
            const axiosError = err as { response?: { data?: { detail?: string } } };
            const errorMsg = axiosError.response?.data?.detail || 'Erro ao duplicar modelo.';
            alert(errorMsg);
        }
    };

    const handlePublish = async (id: string, name: string) => {
        if (!window.confirm(`Deseja publicar o modelo "${name}"? Ao publicar, a versão atual ficará ativa (VIGENTE) e a versão anterior será inativada automaticamente.`)) return;
        try {
            await api.post(`/document-templates/${id}/publish`);
            alert('Modelo publicado com sucesso!');
            loadTemplates();
        } catch (err) {
            console.error(err);
            const axiosError = err as { response?: { data?: { detail?: string } } };
            const errorMsg = axiosError.response?.data?.detail || 'Erro ao publicar modelo.';
            alert(errorMsg);
        }
    };

    const handleDeactivate = async (id: string, name: string) => {
        if (!window.confirm(`Deseja inativar o modelo "${name}"? Modelos inativos não poderão ser utilizados para emissão de novos documentos.`)) return;
        try {
            await api.post(`/document-templates/${id}/deactivate`);
            alert('Modelo inativado com sucesso!');
            loadTemplates();
        } catch (err) {
            console.error(err);
            const axiosError = err as { response?: { data?: { detail?: string } } };
            const errorMsg = axiosError.response?.data?.detail || 'Erro ao inativar modelo.';
            alert(errorMsg);
        }
    };

    const filteredTemplates = templates.filter(t => 
        t.nome.toLowerCase().includes(search.toLowerCase()) ||
        t.tipo_documento.toLowerCase().includes(search.toLowerCase()) ||
        t.modulo_origem.toLowerCase().includes(search.toLowerCase())
    );

    const getStatusBadge = (status: 'RASCUNHO' | 'VIGENTE' | 'INATIVO') => {
        switch (status) {
            case 'VIGENTE':
                return (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md w-fit bg-brand-success/10 text-brand-success">
                        <CheckCircle2 className="w-3 h-3" />
                        VIGENTE
                    </span>
                );
            case 'INATIVO':
                return (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md w-fit bg-brand-danger/10 text-brand-danger">
                        <XCircle className="w-3 h-3" />
                        INATIVO
                    </span>
                );
            default:
                return (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md w-fit bg-amber-500/10 text-amber-500">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        RASCUNHO
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6 w-full">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                        Modelos de <span className="text-brand-primary">Documentos</span>
                    </h1>
                    <p className="text-text-muted mt-1">Gerencie modelos de CGF, Contratos e Propostas com variáveis dinâmicas.</p>
                </div>

                <button
                    onClick={() => navigate('/cadastros/modelos-documentos/novo')}
                    className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md font-medium hover:bg-brand-primary/90 transition-colors min-h-[40px] cursor-pointer shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    Novo Modelo
                </button>
            </header>

            <div className="bg-surface rounded-lg border border-border-subtle shadow-sm flex flex-col">
                {/* Filtros */}
                <div className="p-5 border-b border-border-subtle flex flex-wrap items-center justify-between bg-surface gap-4">
                    <div className="relative flex-1 min-w-[280px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, tipo de documento..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-1.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-text-muted font-medium">Módulo:</span>
                            <select
                                value={originFilter}
                                onChange={(e) => setOriginFilter(e.target.value)}
                                className="bg-bg-deep border border-border-subtle rounded-md py-1.5 px-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors"
                            >
                                <option value="ALL">Todos</option>
                                <option value="OPORTUNIDADE">Oportunidade</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-text-muted font-medium">Status:</span>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-bg-deep border border-border-subtle rounded-md py-1.5 px-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors"
                            >
                                <option value="ALL">Todos</option>
                                <option value="RASCUNHO">Rascunho</option>
                                <option value="VIGENTE">Vigente</option>
                                <option value="INATIVO">Inativo</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="min-h-[200px] overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-[#f8f9fa] dark:bg-bg-deep">
                            <tr className="text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                                <th className="px-6 py-3 font-semibold">Nome / Descrição</th>
                                <th className="px-6 py-3 font-semibold">Tipo de Documento</th>
                                <th className="px-6 py-3 font-semibold">Origem</th>
                                <th className="px-6 py-3 font-semibold">Versão</th>
                                <th className="px-6 py-3 font-semibold">Status</th>
                                <th className="px-6 py-3 font-semibold">Última Modificação</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle bg-surface">
                            <AnimatePresence mode='popLayout'>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-10 text-center text-text-muted">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-primary" />
                                            Carregando modelos de documentos...
                                        </td>
                                    </tr>
                                ) : filteredTemplates.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-10 text-center text-text-muted">
                                            Nenhum modelo de documento encontrado.
                                        </td>
                                    </tr>
                                ) : filteredTemplates.map((template, i) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: i * 0.03 }}
                                        key={template.id}
                                        className="group hover:bg-bg-deep transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-md bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-text-primary">{template.nome}</span>
                                                    {template.descricao && (
                                                        <span className="text-xs text-text-muted truncate max-w-[280px]">{template.descricao}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-text-primary font-medium">
                                            {template.tipo_documento}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 text-[10px] font-bold bg-bg-deep border border-border-subtle rounded text-text-muted uppercase tracking-tight">
                                                {template.modulo_origem}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-text-primary font-semibold">
                                            v{template.versao}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(template.status)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-text-muted">
                                            {template.updated_at ? new Date(template.updated_at).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <button
                                                onClick={() => setOpenDropdown(openDropdown === template.id ? null : template.id)}
                                                className="p-2 rounded-md hover:bg-bg-deep text-text-muted hover:text-text-primary transition-all cursor-pointer"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {openDropdown === template.id && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                                                    <div className="absolute right-8 top-10 mt-2 w-48 bg-surface rounded-md shadow-lg z-20 border border-border-subtle overflow-hidden">
                                                        <div className="py-1 flex flex-col">
                                                            <button
                                                                onClick={() => {
                                                                    setOpenDropdown(null);
                                                                    navigate(`/cadastros/modelos-documentos/${template.id}`);
                                                                }}
                                                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep transition-colors w-full text-left"
                                                            >
                                                                {template.status === 'RASCUNHO' ? (
                                                                    <>
                                                                        <Edit2 className="w-4 h-4" /> Editar Rascunho
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Eye className="w-4 h-4" /> Visualizar Modelo
                                                                    </>
                                                                )}
                                                            </button>

                                                            {template.status === 'RASCUNHO' && (
                                                                <button
                                                                    onClick={() => {
                                                                        setOpenDropdown(null);
                                                                        handlePublish(template.id, template.nome);
                                                                    }}
                                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-brand-success hover:bg-brand-success/10 transition-colors w-full text-left"
                                                                >
                                                                    <Check className="w-4 h-4" /> Publicar Modelo
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => {
                                                                    setOpenDropdown(null);
                                                                    handleDuplicate(template.id, template.nome);
                                                                }}
                                                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep transition-colors w-full text-left"
                                                            >
                                                                <Copy className="w-4 h-4" /> Criar Nova Versão / Copiar
                                                            </button>

                                                            {template.status === 'VIGENTE' && (
                                                                <button
                                                                    onClick={() => {
                                                                        setOpenDropdown(null);
                                                                        handleDeactivate(template.id, template.nome);
                                                                    }}
                                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-brand-danger hover:bg-brand-danger/10 transition-colors w-full text-left"
                                                                >
                                                                    <PowerOff className="w-4 h-4" /> Inativar Modelo
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DocumentTemplateList;
