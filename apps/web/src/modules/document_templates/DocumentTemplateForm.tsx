import React, { useEffect, useState, useRef } from 'react';
import {
    ArrowLeft,
    Save,
    Check,
    Loader2,
    Code,
    Sparkles,
    FileText,
    Download,
    Printer,
    Info,
    History,
    FileCode,
    AlertTriangle,
    Bold,
    Italic,
    Underline,
    AlignLeft,
    AlignCenter,
    AlignRight,
    List,
    ListOrdered
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, resolveHtmlMediaUrls } from '../../services/api';
import { letterheadApi, type Letterhead } from '../../services/letterheadApi';

interface VariableCatalogItem {
    nome: string;
    origem: string;
    campo: string;
    tipo: string;
    obrigatoria: boolean;
}

interface DocumentVariable {
    id?: string;
    nome: string;
    origem: string;
    campo: string;
    tipo: string;
    obrigatoria: boolean;
}

interface DocumentVersion {
    id: string;
    versao: number;
    conteudo_html: string;
    data_publicacao: string;
    usuario: { name: string; email: string };
}

interface DocumentAudit {
    id: string;
    acao: string;
    data_hora: string;
    usuario: { name: string };
}

interface DocumentTemplate {
    id?: string;
    nome: string;
    tipo_documento: string;
    modulo_origem: string;
    papel_timbrado_id?: string | null;
    status: 'RASCUNHO' | 'VIGENTE' | 'INATIVO';
    versao: number;
    conteudo_html: string;
    descricao?: string | null;
    variables: DocumentVariable[];
    versions?: DocumentVersion[];
    audits?: DocumentAudit[];
}

const DocumentTemplateForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isNew = !id;

    // States
    const [activeTab, setActiveTab] = useState<'dados' | 'editor' | 'historico'>('dados');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [catalog, setCatalog] = useState<Record<string, VariableCatalogItem[]>>({});
    
    const [nome, setNome] = useState('');
    const [tipoDocumento, setTipoDocumento] = useState('PROPOSTA_COMERCIAL');
    const [moduloOrigem, setModuloOrigem] = useState('OPORTUNIDADE');
    const [papelTimbradoId, setPapelTimbradoId] = useState<string>('');
    const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
    const [descricao, setDescricao] = useState('');
    const [status, setStatus] = useState<'RASCUNHO' | 'VIGENTE' | 'INATIVO'>('RASCUNHO');
    const [versao, setVersao] = useState(1);
    const [conteudoHtml, setConteudoHtml] = useState('<p>Digite seu documento aqui...</p>');
    
    const [versions, setVersions] = useState<DocumentVersion[]>([]);
    const [audits, setAudits] = useState<DocumentAudit[]>([]);

    // Editor Mode: 'visual' or 'html'
    const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual');
    const editorRef = useRef<HTMLDivElement>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const lastTextAreaPosRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

    const saveSelection = () => {
        if (editorMode === 'visual') {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && editorRef.current) {
                const range = sel.getRangeAt(0);
                if (editorRef.current.contains(range.commonAncestorContainer)) {
                    savedRangeRef.current = range.cloneRange();
                }
            }
        }
    };

    const updateTextareaPos = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.currentTarget;
        lastTextAreaPosRef.current = {
            start: target.selectionStart,
            end: target.selectionEnd,
        };
    };

    // Preview/Render Modal
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [opportunities, setOpportunities] = useState<{ id: string; numero_orcamento?: string; titulo?: string; customer?: { razao_social?: string } }[]>([]);
    const [selectedOppId, setSelectedOppId] = useState('');
    const [renderedHtml, setRenderedHtml] = useState('');
    const [rendering, setRendering] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Fetch active letterheads
    const fetchLetterheads = React.useCallback(async () => {
        try {
            const data = await letterheadApi.listLetterheads({ is_active: true });
            setLetterheads(data);
            // If new template and default letterhead exists, auto-select it
            if (isNew) {
                const def = data.find(l => l.is_default);
                if (def) setPapelTimbradoId(def.id);
            }
        } catch (err) {
            console.error('Erro ao buscar papéis timbrados:', err);
        }
    }, [isNew]);

    // Fetch variables catalog
    const fetchCatalog = React.useCallback(async () => {
        try {
            const response = await api.get('/document-templates/variables-catalog');
            setCatalog(response.data);
        } catch (err) {
            console.error('Erro ao buscar catálogo de variáveis:', err);
        }
    }, []);

    // Load template details
    const loadTemplate = React.useCallback(async () => {
        if (isNew) return;
        setLoading(true);
        try {
            const response = await api.get(`/document-templates/${id}`);
            const data: DocumentTemplate = response.data;
            setNome(data.nome);
            setTipoDocumento(data.tipo_documento);
            setModuloOrigem(data.modulo_origem);
            setPapelTimbradoId(data.papel_timbrado_id || '');
            setDescricao(data.descricao || '');
            setStatus(data.status);
            setVersao(data.versao);
            setConteudoHtml(data.conteudo_html);
            setVersions(data.versions || []);
            setAudits(data.audits || []);
        } catch (err) {
            console.error('Erro ao carregar modelo:', err);
            alert('Erro ao carregar modelo de documento.');
            navigate('/cadastros/modelos-documentos');
        } finally {
            setLoading(false);
        }
    }, [id, isNew, navigate]);

    useEffect(() => {
        fetchCatalog();
        fetchLetterheads();
        loadTemplate();
    }, [fetchCatalog, fetchLetterheads, loadTemplate]);

    // Handle editor view synchronization when mode/tab changes
    useEffect(() => {
        if (editorRef.current && editorMode === 'visual') {
            if (editorRef.current.innerHTML !== conteudoHtml) {
                editorRef.current.innerHTML = conteudoHtml;
            }
        }
    }, [editorMode, activeTab]);

    // Load opportunities for preview
    const loadOpportunities = React.useCallback(async () => {
        try {
            const response = await api.get('/sales-budgets');
            setOpportunities(response.data);
            if (response.data.length > 0) {
                setSelectedOppId(response.data[0].id);
            }
        } catch (err) {
            console.error('Erro ao carregar oportunidades:', err);
        }
    }, []);

    // Render preview
    const renderPreview = React.useCallback(async () => {
        if (!selectedOppId) return;
        setRendering(true);
        try {
            // First render local state to ensure preview has latest changes
            const response = await api.post(`/document-templates/${id}/render`, {
                oportunidade_id: selectedOppId
            });
            setRenderedHtml(response.data.html);
        } catch (err) {
            console.error(err);
            const axiosError = err as { response?: { data?: { detail?: string } } };
            alert(axiosError.response?.data?.detail || 'Erro ao processar renderização do documento.');
        } finally {
            setRendering(false);
        }
    }, [id, selectedOppId]);

    useEffect(() => {
        if (isPreviewOpen) {
            loadOpportunities();
        }
    }, [isPreviewOpen, loadOpportunities]);

    useEffect(() => {
        if (isPreviewOpen && selectedOppId) {
            renderPreview();
        }
    }, [selectedOppId, isPreviewOpen, renderPreview]);

    // Format selection commands in rich editor
    const execCmd = (command: string, value: string = '') => {
        if (editorMode !== 'visual') return;
        document.execCommand(command, false, value);
        if (editorRef.current) {
            setConteudoHtml(editorRef.current.innerHTML);
        }
    };

    // Get variables list for current selected origin
    const variablesList = catalog[moduloOrigem] || [];

    // Helper to check if a variable is present in the HTML
    const isVariablePresent = (varName: string) => {
        const token = `{{${varName}}}`;
        return conteudoHtml.includes(token);
    };

    // Mandatory variables validation check
    const getMissingMandatoryVariables = () => {
        return variablesList.filter(v => v.obrigatoria && !isVariablePresent(v.nome));
    };

    // Insert variable token into current cursor position inside contentEditable or textarea
    const insertVariable = (varName: string) => {
        if (status === 'INATIVO') return;
        const token = `{{${varName}}}`;

        if (editorMode === 'visual') {
            if (editorRef.current) {
                editorRef.current.focus();
            }
            const selection = window.getSelection();
            let range: Range | null = null;

            if (selection && selection.rangeCount > 0) {
                const currentRange = selection.getRangeAt(0);
                if (editorRef.current?.contains(currentRange.commonAncestorContainer)) {
                    range = currentRange;
                }
            }

            if (!range && savedRangeRef.current && editorRef.current?.contains(savedRangeRef.current.commonAncestorContainer)) {
                range = savedRangeRef.current;
            }

            if (range && selection) {
                range.deleteContents();
                const textNode = document.createTextNode(token);
                range.insertNode(textNode);

                // Place cursor after inserted token
                const newRange = document.createRange();
                newRange.setStartAfter(textNode);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                savedRangeRef.current = newRange;

                if (editorRef.current) {
                    setConteudoHtml(editorRef.current.innerHTML);
                }
            } else {
                setConteudoHtml(prev => prev + token);
            }
        } else {
            const el = document.getElementById('html-textarea') as HTMLTextAreaElement;
            if (el) {
                const startPos = el.selectionStart ?? lastTextAreaPosRef.current.start ?? el.value.length;
                const endPos = el.selectionEnd ?? startPos;
                const newText = el.value.substring(0, startPos) + token + el.value.substring(endPos);
                setConteudoHtml(newText);
                setTimeout(() => {
                    el.focus();
                    const nextPos = startPos + token.length;
                    el.setSelectionRange(nextPos, nextPos);
                    lastTextAreaPosRef.current = { start: nextPos, end: nextPos };
                }, 0);
            } else {
                setConteudoHtml(prev => prev + token);
            }
        }
    };

    // Client-side PDF preview modal renderer
    const renderPreviewHTML = () => {
        const papelTimbradoObj = letterheads.find(l => l.id === papelTimbradoId);
        if (!papelTimbradoObj) return conteudoHtml;
        const bodyContent = `<div class="letterhead-wrapper">${conteudoHtml}</div>`;
        if (papelTimbradoObj.conteudo_html?.includes('{{conteudo}}') || papelTimbradoObj.conteudo_html?.includes('{{content}}')) {
            return papelTimbradoObj.conteudo_html.replace(/\{\{(conteudo|content)\}\}/g, bodyContent);
        }
        return papelTimbradoObj.conteudo_html + bodyContent;
    };

    // Save Template (Draft or Update)
    const handleSave = async (isPublishing = false) => {
        const missing = getMissingMandatoryVariables();
        if (missing.length > 0) {
            const listNames = missing.map(v => `'${v.nome}'`).join(', ');
            alert(`Erro de Validação: Não é possível salvar o documento sem as seguintes variáveis obrigatórias: ${listNames}`);
            setActiveTab('editor');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                nome,
                tipo_documento: tipoDocumento,
                modulo_origem: moduloOrigem,
                papel_timbrado_id: papelTimbradoId || null,
                conteudo_html: conteudoHtml,
                descricao,
                variables: []
            };

            let savedTemplate;
            if (isNew) {
                const response = await api.post('/document-templates', payload);
                savedTemplate = response.data;
            } else {
                const response = await api.put(`/document-templates/${id}`, payload);
                savedTemplate = response.data;
            }

            if (isPublishing) {
                await api.post(`/document-templates/${savedTemplate.id}/publish`);
                alert('Modelo salvo e publicado com sucesso!');
            } else {
                alert(status === 'VIGENTE' ? 'Modelo atualizado com sucesso!' : 'Rascunho salvo com sucesso!');
            }
            navigate('/cadastros/modelos-documentos');
        } catch (err) {
            console.error(err);
            const axiosError = err as { response?: { data?: { detail?: string } } };
            const errorMsg = axiosError.response?.data?.detail || 'Erro ao salvar modelo de documento.';
            alert(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    // Client-side PDF print triggers
    const handlePrintPDF = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const fullContent = renderPreviewHTML();
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${nome || 'Modelo_Documento'}</title>
                <style>
                    @page { size: A4; margin: 0; }
                    body { margin: 0; padding: 0; font-family: sans-serif; background: #fff; }
                    .letterhead-wrapper { padding: 20mm; display: flex; flex-direction: column; justify-content: space-between; min-height: 100vh; box-sizing: border-box; }
                    .letterhead-wrapper > *:last-child, .footer { margin-top: auto; }
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                ${fullContent}
                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Export HTML to .doc (Word format)
    const handleExportWord = () => {
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
            "xmlns:w='urn:schemas-microsoft-com:office:word' "+
            "xmlns='http://www.w3.org/TR/REC-html40'>"+
            "<head><meta charset='utf-8'><title>Export Word</title></head><body>";
        const renderedHtml = renderPreviewHTML();
        const footer = "</body></html>";
        const sourceHTML = header + renderedHtml + footer;
        
        const blob = new Blob(['\ufeff' + sourceHTML], {
            type: 'application/msword'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${nome}_rendered.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const isReadonly = status === 'INATIVO';

    if (loading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full relative">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/cadastros/modelos-documentos')}
                        className="p-2 hover:bg-bg-deep rounded-full text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                            {isNew ? 'Novo' : isReadonly ? 'Visualizar' : 'Editar'} <span className="text-brand-primary">Modelo</span>
                        </h1>
                        <p className="text-text-muted mt-1">
                            {isNew ? 'Crie um novo rascunho de modelo' : `Versão v${versao} — ${status}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!isReadonly && (
                        <>
                            <button
                                onClick={() => handleSave(false)}
                                disabled={saving}
                                className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md font-medium hover:bg-brand-primary/90 transition-colors min-h-[40px] cursor-pointer shadow-sm"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {status === 'VIGENTE' ? 'Salvar Alterações' : 'Salvar Rascunho'}
                            </button>

                            {status === 'RASCUNHO' && (
                                <button
                                    onClick={() => handleSave(true)}
                                    disabled={saving}
                                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md font-medium hover:bg-emerald-700 transition-colors min-h-[40px] cursor-pointer shadow-sm"
                                >
                                    <Check className="w-5 h-5" />
                                    Salvar & Publicar
                                </button>
                            )}
                        </>
                    )}
                </div>
            </header>

            {/* Warning when read-only */}
            {isReadonly && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg p-4 flex gap-3 items-start">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Modelo INATIVO (Sem Edição)</h4>
                        <p className="text-xs text-text-muted mt-0.5">
                            Este modelo está inativo e não pode ser editado.
                        </p>
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex border-b border-border-subtle">
                <button
                    onClick={() => setActiveTab('dados')}
                    className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer ${activeTab === 'dados' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                >
                    Dados Gerais
                </button>
                <button
                    onClick={() => setActiveTab('editor')}
                    className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer ${activeTab === 'editor' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                >
                    Editor de Conteúdo
                </button>
                {!isNew && (
                    <button
                        onClick={() => setActiveTab('historico')}
                        className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer ${activeTab === 'historico' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                    >
                        Histórico & Timeline
                    </button>
                )}
            </div>

            {/* Tab: Dados Gerais */}
            {activeTab === 'dados' && (
                <div className="bg-surface rounded-lg border border-border-subtle shadow-sm p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-text-primary">Nome do Modelo *</label>
                            <input
                                type="text"
                                placeholder="CGF Comercial, Contrato Locação de Equipamentos..."
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                disabled={isReadonly}
                                className="bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors disabled:opacity-60"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-text-primary">Tipo de Documento *</label>
                            <select
                                value={tipoDocumento}
                                onChange={(e) => setTipoDocumento(e.target.value)}
                                disabled={isReadonly}
                                className="bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors disabled:opacity-60"
                            >
                                <option value="PROPOSTA_COMERCIAL">Proposta Comercial</option>
                                <option value="PROPOSTA_TECNICA">Proposta Técnica</option>
                                <option value="CONTRATO">Contrato</option>
                                <option value="CGF">Condições Gerais de Fornecimento (CGF)</option>
                                <option value="DECLARACAO">Declaração / Termos</option>
                                <option value="OUTRO">Outro</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-text-primary">Módulo de Origem *</label>
                            <select
                                value={moduloOrigem}
                                onChange={(e) => setModuloOrigem(e.target.value)}
                                disabled={isReadonly}
                                className="bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors disabled:opacity-60"
                            >
                                <option value="OPORTUNIDADE">Oportunidade (Comercial)</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-text-primary flex items-center justify-between">
                                <span>Papel Timbrado (Identidade Visual)</span>
                                <span className="text-[11px] font-normal text-text-muted">Opcional</span>
                            </label>
                            <select
                                value={papelTimbradoId}
                                onChange={(e) => setPapelTimbradoId(e.target.value)}
                                disabled={isReadonly}
                                className="bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors disabled:opacity-60"
                            >
                                <option value="">Nenhum (Sem papel timbrado)</option>
                                {letterheads.map((lh) => (
                                    <option key={lh.id} value={lh.id}>
                                        {lh.nome} {lh.is_default ? '(Padrão)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 font-sans">
                        <label className="text-sm font-semibold text-text-primary">Descrição / Finalidade</label>
                        <textarea
                            placeholder="Descreva o propósito deste documento..."
                            rows={4}
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            disabled={isReadonly}
                            className="bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors disabled:opacity-60 resize-y"
                        />
                    </div>
                </div>
            )}

            {/* Tab: Editor */}
            {activeTab === 'editor' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                    {/* Visual / HTML Editor Area */}
                    <div className="lg:col-span-3 bg-surface rounded-lg border border-border-subtle shadow-sm overflow-hidden">
                        {/* Editor Header Toolbar */}
                        <div className="bg-[#f8f9fa] dark:bg-bg-deep border-b border-border-subtle px-4 py-2 flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCmd('bold')}
                                    disabled={editorMode !== 'visual' || isReadonly}
                                    title="Negrito"
                                    className="p-1.5 hover:bg-border-subtle rounded text-text-primary disabled:opacity-30 cursor-pointer"
                                >
                                    <Bold className="w-4 h-4" />
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCmd('italic')}
                                    disabled={editorMode !== 'visual' || isReadonly}
                                    title="Itálico"
                                    className="p-1.5 hover:bg-border-subtle rounded text-text-primary disabled:opacity-30 cursor-pointer"
                                >
                                    <Italic className="w-4 h-4" />
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCmd('underline')}
                                    disabled={editorMode !== 'visual' || isReadonly}
                                    title="Sublinhado"
                                    className="p-1.5 hover:bg-border-subtle rounded text-text-primary disabled:opacity-30 cursor-pointer"
                                >
                                    <Underline className="w-4 h-4" />
                                </button>
                                <span className="w-[1px] h-6 bg-border-subtle mx-1" />
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCmd('justifyLeft')}
                                    disabled={editorMode !== 'visual' || isReadonly}
                                    title="Alinhar à Esquerda"
                                    className="p-1.5 hover:bg-border-subtle rounded text-text-primary disabled:opacity-30 cursor-pointer"
                                >
                                    <AlignLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCmd('justifyCenter')}
                                    disabled={editorMode !== 'visual' || isReadonly}
                                    title="Centralizar"
                                    className="p-1.5 hover:bg-border-subtle rounded text-text-primary disabled:opacity-30 cursor-pointer"
                                >
                                    <AlignCenter className="w-4 h-4" />
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCmd('justifyRight')}
                                    disabled={editorMode !== 'visual' || isReadonly}
                                    title="Alinhar à Direita"
                                    className="p-1.5 hover:bg-border-subtle rounded text-text-primary disabled:opacity-30 cursor-pointer"
                                >
                                    <AlignRight className="w-4 h-4" />
                                </button>
                                <span className="w-[1px] h-6 bg-border-subtle mx-1" />
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCmd('insertUnorderedList')}
                                    disabled={editorMode !== 'visual' || isReadonly}
                                    title="Marcadores"
                                    className="p-1.5 hover:bg-border-subtle rounded text-text-primary disabled:opacity-30 cursor-pointer"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCmd('insertOrderedList')}
                                    disabled={editorMode !== 'visual' || isReadonly}
                                    title="Numeração"
                                    className="p-1.5 hover:bg-border-subtle rounded text-text-primary disabled:opacity-30 cursor-pointer"
                                >
                                    <ListOrdered className="w-4 h-4" />
                                </button>
                            </div>

                            <button
                                onClick={() => {
                                    if (editorMode === 'visual') {
                                        setEditorMode('html');
                                    } else {
                                        setEditorMode('visual');
                                    }
                                }}
                                className="flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-brand-primary/10 text-brand-primary rounded hover:bg-brand-primary/20 cursor-pointer transition-colors"
                            >
                                {editorMode === 'visual' ? (
                                    <>
                                        <Code className="w-3.5 h-3.5" /> HTML Código
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-3.5 h-3.5" /> Editor Visual
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Editor Canvas */}
                        <div className="p-4 bg-surface min-h-[500px]">
                            {editorMode === 'visual' ? (
                                <div
                                    ref={editorRef}
                                    contentEditable={!isReadonly}
                                    onKeyUp={saveSelection}
                                    onMouseUp={saveSelection}
                                    onFocus={saveSelection}
                                    onInput={saveSelection}
                                    onBlur={() => {
                                        saveSelection();
                                        if (editorRef.current) {
                                            setConteudoHtml(editorRef.current.innerHTML);
                                        }
                                    }}
                                    style={{ outline: 'none' }}
                                    className="prose dark:prose-invert max-w-none min-h-[460px] text-text-primary text-sm p-2 overflow-y-auto"
                                />
                            ) : (
                                <textarea
                                    id="html-textarea"
                                    value={conteudoHtml}
                                    onChange={(e) => {
                                        setConteudoHtml(e.target.value);
                                        updateTextareaPos(e);
                                    }}
                                    onKeyUp={updateTextareaPos}
                                    onMouseUp={updateTextareaPos}
                                    onSelect={updateTextareaPos}
                                    onFocus={updateTextareaPos}
                                    onBlur={updateTextareaPos}
                                    disabled={isReadonly}
                                    className="w-full min-h-[460px] bg-bg-deep border border-border-subtle rounded-md p-3 text-xs font-mono text-text-primary focus:border-brand-primary outline-none transition-colors resize-y disabled:opacity-60"
                                />
                            )}
                        </div>
                    </div>

                    {/* Variables Catalog Sidebar */}
                    <div className="bg-surface rounded-lg border border-border-subtle shadow-sm p-4 space-y-4">
                        <div>
                            <h3 className="font-bold text-text-primary text-md">Variáveis do Módulo</h3>
                            <p className="text-xs text-text-muted mt-0.5">
                                Clique para inserir no documento na posição do cursor.
                            </p>
                        </div>

                        <div className="space-y-2 max-h-[550px] overflow-y-auto custom-scrollbar pr-1">
                            {variablesList.map((v) => {
                                const present = isVariablePresent(v.nome);
                                return (
                                    <div
                                        key={v.nome}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => insertVariable(v.nome)}
                                        className={`group p-2.5 rounded-md border flex flex-col gap-1 transition-all text-left ${isReadonly ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:border-brand-primary/40 hover:bg-brand-primary/5'} ${present ? 'border-brand-success/20 bg-brand-success/5' : 'border-border-subtle bg-bg-deep'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono text-xs font-bold text-text-primary break-all">
                                                {`{{${v.nome}}}`}
                                            </span>
                                            {v.obrigatoria && (
                                                <span className="text-[9px] font-bold text-brand-danger bg-brand-danger/10 px-1 py-0.5 rounded shrink-0">
                                                    OBRIGATÓRIO
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-text-muted mt-1">
                                            <span>
                                                Origem: {v.origem}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                {present ? (
                                                    <span className="text-brand-success font-semibold flex items-center gap-0.5">
                                                        <Check className="w-3.5 h-3.5" /> Presente
                                                    </span>
                                                ) : (
                                                    <span className="text-text-muted flex items-center gap-0.5">
                                                        <Info className="w-3.5 h-3.5" /> Ausente
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: Histórico & Timeline */}
            {activeTab === 'historico' && !isNew && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* Version History List */}
                    <div className="bg-surface rounded-lg border border-border-subtle shadow-sm p-6 space-y-4">
                        <div className="flex items-center gap-2 text-brand-primary">
                            <History className="w-5 h-5" />
                            <h3 className="font-bold text-text-primary text-lg">Versões Publicadas</h3>
                        </div>

                        <div className="relative border-l border-border-subtle pl-6 space-y-6">
                            {versions.length === 0 ? (
                                <p className="text-text-muted text-sm">Nenhuma versão publicada no histórico.</p>
                            ) : versions.map((ver) => (
                                <div key={ver.id} className="relative">
                                    {/* Timeline dot */}
                                    <div className="absolute left-[-30px] top-1.5 w-2 h-2 rounded-full bg-brand-primary" />
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-text-primary text-sm">Versão v{ver.versao}</h4>
                                        <span className="text-[11px] text-text-muted">
                                            {new Date(ver.data_publicacao).toLocaleString('pt-BR')}
                                        </span>
                                    </div>
                                    <p className="text-xs text-text-muted mt-1">
                                        Publicado por: {ver.usuario?.name || ver.usuario?.email}
                                    </p>
                                    <button
                                        onClick={() => {
                                            setConteudoHtml(ver.conteudo_html);
                                            alert(`Conteúdo da versão v${ver.versao} carregado no editor.`);
                                            setActiveTab('editor');
                                        }}
                                        disabled={isReadonly}
                                        className="text-xs text-brand-primary font-semibold hover:underline mt-2 flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:hover:no-underline"
                                    >
                                        <FileCode className="w-3.5 h-3.5" /> Restaurar para Editor
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Audit trail */}
                    <div className="bg-surface rounded-lg border border-border-subtle shadow-sm p-6 space-y-4">
                        <div className="flex items-center gap-2 text-brand-primary">
                            <History className="w-5 h-5" />
                            <h3 className="font-bold text-text-primary text-lg">Trilha de Auditoria</h3>
                        </div>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {audits.length === 0 ? (
                                <p className="text-text-muted text-sm">Sem histórico de auditoria registrado.</p>
                            ) : audits.map((aud) => (
                                <div key={aud.id} className="p-3 bg-bg-deep rounded border border-border-subtle flex justify-between items-center text-xs">
                                    <div>
                                        <span className="font-bold text-text-primary uppercase tracking-tight">
                                            {aud.acao.replace('_', ' ')}
                                        </span>
                                        <p className="text-text-muted mt-0.5">Realizado por: {aud.usuario?.name}</p>
                                    </div>
                                    <span className="text-text-muted font-mono text-[10px]">
                                        {new Date(aud.data_hora).toLocaleString('pt-BR')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Render & Preview Modal */}
            {isPreviewOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-surface border border-border-subtle rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <header className="p-4 border-b border-border-subtle flex items-center justify-between bg-bg-deep">
                            <div>
                                <h3 className="font-bold text-text-primary text-lg">Visualização & Exportação</h3>
                                <p className="text-xs text-text-muted">Simule com os dados de uma proposta/oportunidade ativa.</p>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-text-muted font-medium">Oportunidade:</span>
                                    <select
                                        value={selectedOppId}
                                        onChange={(e) => setSelectedOppId(e.target.value)}
                                        className="bg-surface border border-border-subtle rounded-md py-1 px-3 text-xs text-text-primary outline-none focus:border-brand-primary max-w-[250px]"
                                    >
                                        {opportunities.length === 0 ? (
                                            <option value="">Nenhuma proposta cadastrada</option>
                                        ) : opportunities.map(opp => (
                                            <option key={opp.id} value={opp.id}>
                                                {opp.numero_orcamento ? `[${opp.numero_orcamento}] ` : ''}{opp.titulo || opp.customer?.razao_social || 'Sem Título'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    onClick={handlePrintPDF}
                                    disabled={rendering}
                                    className="flex items-center gap-1.5 bg-brand-primary text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-brand-primary/90 transition-colors cursor-pointer"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    Imprimir PDF
                                </button>

                                <button
                                    onClick={handleExportWord}
                                    disabled={rendering}
                                    className="flex items-center gap-1.5 bg-bg-surface text-text-primary border border-border-subtle px-3 py-1.5 rounded text-xs font-semibold hover:bg-bg-deep transition-colors cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Exportar DOCX
                                </button>

                                <button
                                    onClick={() => {
                                        setIsPreviewOpen(false);
                                        setRenderedHtml('');
                                    }}
                                    className="text-text-muted hover:text-text-primary text-sm font-semibold p-1 hover:bg-bg-deep rounded"
                                >
                                    Fechar
                                </button>
                            </div>
                        </header>

                        {/* Modal content / Render Canvas */}
                        <div className="flex-1 bg-[#eeeeee] relative p-4 flex justify-center overflow-hidden">
                            {rendering ? (
                                <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center z-10">
                                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary mb-2" />
                                    <span className="text-sm text-text-muted font-medium">Renderizando variáveis...</span>
                                </div>
                            ) : null}

                            {renderedHtml ? (
                                <iframe
                                    ref={iframeRef}
                                    title="Render Frame"
                                    srcDoc={`
                                        <html>
                                            <head>
                                                <style>
                                                    html, body {
                                                        height: 100%;
                                                        margin: 0;
                                                    }
                                                    body {
                                                        font-family: 'Inter', system-ui, -apple-system, sans-serif;
                                                        padding: 20mm;
                                                        box-sizing: border-box;
                                                        background-color: white;
                                                        color: #333333;
                                                        line-height: 1.6;
                                                        font-size: 14px;
                                                        display: flex;
                                                        flex-direction: column;
                                                        justify-content: space-between;
                                                        min-height: 100vh;
                                                    }
                                                    .footer, [class*="footer"] {
                                                        margin-top: auto;
                                                    }
                                                    h1, h2, h3, h4 { color: #111111; margin-top: 1.5em; margin-bottom: 0.5em; }
                                                    p { margin-bottom: 1em; }
                                                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                                                    th, td { border: 1px solid #dddddd; padding: 10px; text-align: left; }
                                                    th { background-color: #f2f2f2; font-weight: bold; }
                                                    @media print {
                                                        body { padding: 0; background-color: white; color: black; }
                                                        @page { margin: 20mm; }
                                                    }
                                                </style>
                                            </head>
                                            <body>
                                                ${resolveHtmlMediaUrls(renderedHtml)}
                                            </body>
                                        </html>
                                    `}
                                    className="w-full max-w-4xl h-full bg-white shadow-md border-0 rounded"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-text-muted">
                                    <FileText className="w-12 h-12 mb-2 text-text-muted/40" />
                                    <span>Selecione uma proposta para gerar a visualização.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentTemplateForm;
