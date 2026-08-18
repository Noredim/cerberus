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
    ListOrdered,
    Eye,
    Indent,
    Outdent,
    AlignJustify,
    Ruler
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

    // Editor Mode: 'visual' | 'html' | 'preview'
    const [editorMode, setEditorMode] = useState<'visual' | 'html' | 'preview'>('visual');
    const [showMarginGuides, setShowMarginGuides] = useState(true);
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

    // Client-side PDF preview modal renderer
    const renderPreviewHTML = React.useCallback(() => {
        const papelTimbradoObj = letterheads.find(l => l.id === papelTimbradoId);
        const guideClass = showMarginGuides ? 'show-margin-guides' : '';
        const isLetterheadActive = Boolean(papelTimbradoObj);

        let processedHtml = conteudoHtml;
        const sampleSyntheticTable = `
            <table class="tabela-itens-sintetica" style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px;">
                <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; color: #334155;">
                        <th style="padding: 10px 12px;">Item / Kit (Sintético)</th>
                        <th style="padding: 10px 12px; text-align: center;">Qtd</th>
                        <th style="padding: 10px 12px; text-align: right;">Val. Unitário</th>
                        <th style="padding: 10px 12px; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 12px; font-weight: 500;"><strong>Kit: Kit CFTV IP 4 Câmeras</strong><br/><small style="color: #64748b;">Kit completo com NVR e câmeras IP 4K</small></td>
                        <td style="padding: 10px 12px; text-align: center;">2</td>
                        <td style="padding: 10px 12px; text-align: right;">R$ 2.500,00</td>
                        <td style="padding: 10px 12px; text-align: right; font-weight: 600;">R$ 5.000,00</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
                        <td colspan="3" style="padding: 10px 12px; text-align: right;">TOTAL DA PROPOSTA:</td>
                        <td style="padding: 10px 12px; text-align: right; color: #0f172a; font-size: 13px;">R$ 5.000,00</td>
                    </tr>
                </tfoot>
            </table>
        `;
        const sampleAnalyticalTable = `
            <table class="tabela-itens-analitica" style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px;">
                <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; color: #334155;">
                        <th style="padding: 10px 12px;">Código</th>
                        <th style="padding: 10px 12px;">Descrição do Item (Analítico)</th>
                        <th style="padding: 10px 12px; text-align: center;">Tipo</th>
                        <th style="padding: 10px 12px; text-align: center;">Qtd</th>
                        <th style="padding: 10px 12px; text-align: right;">Val. Unitário</th>
                        <th style="padding: 10px 12px; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background-color: #f1f5f9; border-top: 2px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
                        <td colspan="4" style="padding: 8px 12px; font-weight: bold; color: #1e293b;">📦 KIT: Kit CFTV IP 4 Câmeras (Qtd: 2 UN)</td>
                        <td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #475569;">Subtotal:</td>
                        <td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #0f172a;">R$ 5.000,00</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 6px 12px 6px 24px; font-mono; font-size: 11px; color: #64748b;">CAM-001</td>
                        <td style="padding: 6px 12px;">Câmera IP Dome 4K 30m IR</td>
                        <td style="padding: 6px 12px; text-align: center;"><span style="background:#e2e8f0; color:#334155; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600;">Mercadoria</span></td>
                        <td style="padding: 6px 12px; text-align: center;">8</td>
                        <td style="padding: 6px 12px; text-align: right;">R$ 450,00</td>
                        <td style="padding: 6px 12px; text-align: right; font-weight: 500;">R$ 3.600,00</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 6px 12px 6px 24px; font-mono; font-size: 11px; color: #64748b;">SERV-INS</td>
                        <td style="padding: 6px 12px;">Instalação e Configuração CFTV</td>
                        <td style="padding: 6px 12px; text-align: center;"><span style="background:#e2e8f0; color:#334155; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600;">Instalação</span></td>
                        <td style="padding: 6px 12px; text-align: center;">1</td>
                        <td style="padding: 6px 12px; text-align: right;">R$ 1.400,00</td>
                        <td style="padding: 6px 12px; text-align: right; font-weight: 500;">R$ 1.400,00</td>
                    </tr>
                </tbody>
            </table>
        `;

        processedHtml = processedHtml
            .replace(/\{\{tabela_itens_sintetica\}\}/g, sampleSyntheticTable)
            .replace(/\{\{tabela_itens_analitica\}\}/g, sampleAnalyticalTable);

        const bodyContent = `<div class="document-body-container ${guideClass} ${isLetterheadActive ? 'has-letterhead' : ''}">${processedHtml}</div>`;
        if (!papelTimbradoObj) return bodyContent;
        
        const lhHtml = papelTimbradoObj.conteudo_html || '{{document_content}}';
        const lhCss = papelTimbradoObj.conteudo_css ? `<style>${papelTimbradoObj.conteudo_css}</style>` : '';
        
        let merged = lhHtml;
        if (merged.includes('{{document_content}}')) {
            merged = merged.replace(/\{\{document_content\}\}/g, bodyContent);
        } else if (merged.includes('{{conteudo_documento}}')) {
            merged = merged.replace(/\{\{conteudo_documento\}\}/g, bodyContent);
        } else if (merged.includes('{{conteudo}}')) {
            merged = merged.replace(/\{\{conteudo\}\}/g, bodyContent);
        } else if (merged.includes('{{content}}')) {
            merged = merged.replace(/\{\{content\}\}/g, bodyContent);
        } else {
            merged = merged + bodyContent;
        }

        return lhCss + merged;
    }, [letterheads, papelTimbradoId, conteudoHtml, showMarginGuides]);

    // Render preview
    const renderPreview = React.useCallback(async () => {
        setRendering(true);
        try {
            if (selectedOppId && id && !isNew) {
                const response = await api.post(`/document-templates/${id}/render`, {
                    oportunidade_id: selectedOppId
                });
                setRenderedHtml(response.data.html);
            } else {
                setRenderedHtml(renderPreviewHTML());
            }
        } catch (err) {
            console.error(err);
            setRenderedHtml(renderPreviewHTML());
        } finally {
            setRendering(false);
        }
    }, [id, isNew, selectedOppId, renderPreviewHTML]);

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

    const changeFontName = (fontName: string) => {
        if (editorMode !== 'visual' || isReadonly || !fontName) return;
        document.execCommand('fontName', false, fontName);
        if (editorRef.current) {
            const fontElements = editorRef.current.querySelectorAll('font[face]');
            fontElements.forEach((el) => {
                const face = el.getAttribute('face');
                if (face) {
                    el.removeAttribute('face');
                    (el as HTMLElement).style.fontFamily = face;
                }
            });
            setConteudoHtml(editorRef.current.innerHTML);
        }
    };

    const changeFontSize = (sizePx: string) => {
        if (editorMode !== 'visual' || isReadonly || !sizePx) return;
        document.execCommand('fontSize', false, '7');
        if (editorRef.current) {
            const fontElements = editorRef.current.querySelectorAll('font[size="7"]');
            fontElements.forEach((el) => {
                el.removeAttribute('size');
                (el as HTMLElement).style.fontSize = sizePx;
            });
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
                    @page { size: A4; margin: 3cm 2cm 2.5cm 2cm; }
                    body { margin: 0; padding: 0; font-family: sans-serif; background: #fff; }
                    .document-body-container { padding-top: 3cm !important; padding-bottom: 2.5cm !important; padding-left: 2cm !important; padding-right: 2cm !important; display: block; width: 100%; min-height: 297mm; box-sizing: border-box; }
                    .document-body-container.has-letterhead, .letterhead-wrapper .document-body-container { padding-top: 0.2cm !important; }
                    p { margin-top: 0; margin-bottom: 0.6em; }
                    .footer, [class*="footer"], footer { margin-top: auto; }
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        @page { margin: 3cm 2cm 2.5cm 2cm; }
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
                    <button
                        type="button"
                        onClick={() => setIsPreviewOpen(true)}
                        className="flex items-center gap-2 bg-bg-surface text-text-primary border border-border-subtle px-4 py-2 rounded-md font-medium hover:bg-bg-deep transition-colors min-h-[40px] cursor-pointer shadow-sm"
                    >
                        <Eye className="w-5 h-5 text-brand-primary" />
                        Pré-visualizar
                    </button>

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
                                {/* Fonte (Font Family) */}
                                <select
                                    onChange={(e) => {
                                        changeFontName(e.target.value);
                                        e.target.value = '';
                                    }}
                                    disabled={editorMode !== 'visual' || isReadonly}
                                    title="Tipo de Fonte"
                                    className="h-8 bg-bg-surface dark:bg-bg-deep border border-border-subtle rounded-md px-2 text-xs font-medium text-text-primary focus:border-brand-primary outline-none cursor-pointer disabled:opacity-40"
                                >
                                    <option value="">Fonte</option>
                                    <option value="Arial, sans-serif">Arial</option>
                                    <option value="Helvetica, sans-serif">Helvetica</option>
                                    <option value="Times New Roman, serif">Times New Roman</option>
                                    <option value="Courier New, monospace">Courier New</option>
                                    <option value="Georgia, serif">Georgia</option>
                                    <option value="Verdana, sans-serif">Verdana</option>
                                    <option value="Tahoma, sans-serif">Tahoma</option>
                                    <option value="Trebuchet MS, sans-serif">Trebuchet MS</option>
                                </select>

                                {/* Tamanho de Fonte (Font Size) */}
                                <select
                                    onChange={(e) => {
                                        changeFontSize(e.target.value);
                                        e.target.value = '';
                                    }}
                                    disabled={editorMode !== 'visual' || isReadonly}
                                    title="Tamanho da Fonte"
                                    className="h-8 bg-bg-surface dark:bg-bg-deep border border-border-subtle rounded-md px-2 text-xs font-medium text-text-primary focus:border-brand-primary outline-none cursor-pointer disabled:opacity-40"
                                >
                                    <option value="">Tamanho</option>
                                    <option value="10px">10 px</option>
                                    <option value="11px">11 px</option>
                                    <option value="12px">12 px</option>
                                    <option value="13px">13 px</option>
                                    <option value="14px">14 px (Padrão)</option>
                                    <option value="16px">16 px</option>
                                    <option value="18px">18 px</option>
                                    <option value="20px">20 px</option>
                                    <option value="24px">24 px</option>
                                    <option value="28px">28 px</option>
                                    <option value="32px">32 px</option>
                                    <option value="36px">36 px</option>
                                    <option value="48px">48 px</option>
                                </select>

                                <span className="w-[1px] h-6 bg-border-subtle mx-1" />

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
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCmd('justifyFull')}
                                    disabled={editorMode !== 'visual' || isReadonly}
                                    title="Justificar Texto"
                                    className="p-1.5 hover:bg-border-subtle rounded text-text-primary disabled:opacity-30 cursor-pointer"
                                >
                                    <AlignJustify className="w-4 h-4" />
                                </button>
                                <span className="w-[1px] h-6 bg-border-subtle mx-1" />
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCmd('outdent')}
                                    disabled={editorMode !== 'visual' || isReadonly}
                                    title="Diminuir Recuo de Parágrafo"
                                    className="p-1.5 hover:bg-border-subtle rounded text-text-primary disabled:opacity-30 cursor-pointer"
                                >
                                    <Outdent className="w-4 h-4" />
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCmd('indent')}
                                    disabled={editorMode !== 'visual' || isReadonly}
                                    title="Aumentar Recuo de Parágrafo"
                                    className="p-1.5 hover:bg-border-subtle rounded text-text-primary disabled:opacity-30 cursor-pointer"
                                >
                                    <Indent className="w-4 h-4" />
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
                                <span className="w-[1px] h-6 bg-border-subtle mx-1" />
                                <button
                                    onClick={() => setShowMarginGuides(!showMarginGuides)}
                                    title="Alternar Marcadores Visuais de Margens (3cm Topo, 2.5cm Base)"
                                    className={`p-1.5 rounded flex items-center gap-1 text-xs font-semibold cursor-pointer transition-colors ${showMarginGuides ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/30' : 'hover:bg-border-subtle text-text-muted'}`}
                                >
                                    <Ruler className="w-4 h-4" />
                                    <span>Guias de Margem</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-1.5 bg-bg-deep p-1 rounded-md border border-border-subtle">
                                <button
                                    onClick={() => setEditorMode('visual')}
                                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded cursor-pointer transition-colors ${editorMode === 'visual' ? 'bg-brand-primary text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                                >
                                    <Sparkles className="w-3.5 h-3.5" /> Editor Visual
                                </button>
                                <button
                                    onClick={() => setEditorMode('html')}
                                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded cursor-pointer transition-colors ${editorMode === 'html' ? 'bg-brand-primary text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                                >
                                    <Code className="w-3.5 h-3.5" /> HTML Código
                                </button>
                                <button
                                    onClick={() => setEditorMode('preview')}
                                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded cursor-pointer transition-colors ${editorMode === 'preview' ? 'bg-brand-primary text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                                >
                                    <Eye className="w-3.5 h-3.5" /> Pré-visualização
                                </button>
                            </div>
                        </div>

                        {/* Editor Canvas */}
                        <div className="p-4 bg-surface min-h-[500px]">
                            {editorMode === 'visual' ? (
                                <div className="space-y-2">
                                    {showMarginGuides && (
                                        <div className="bg-bg-deep border border-border-subtle rounded px-3 py-1.5 flex items-center justify-between text-xs text-text-muted">
                                            <div className="flex items-center gap-2">
                                                <Ruler className="w-3.5 h-3.5 text-brand-primary" />
                                                <span className="font-semibold text-text-primary">Régua de Margens de Segurança:</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-[11px] font-mono">
                                                <span>Topo: <strong className="text-brand-primary">3,0 cm</strong></span>
                                                <span>Base: <strong className="text-brand-primary">2,5 cm</strong></span>
                                                <span>Laterais: <strong className="text-brand-primary">2,0 cm</strong></span>
                                            </div>
                                        </div>
                                    )}
                                    <div className={`relative transition-all ${showMarginGuides ? 'border-2 border-dashed border-brand-primary/40 rounded-md p-6 bg-white dark:bg-bg-deep' : ''}`}>
                                        {showMarginGuides && (
                                            <div className="text-[10px] uppercase tracking-wider font-bold text-brand-primary/70 mb-2 border-b border-dashed border-brand-primary/30 pb-1">
                                                ↓ Início do Conteúdo (Margem Superior: 3,0 cm)
                                            </div>
                                        )}
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
                                        {showMarginGuides && (
                                            <div className="text-[10px] uppercase tracking-wider font-bold text-brand-primary/70 mt-2 border-t border-dashed border-brand-primary/30 pt-1 text-right">
                                                ↑ Limite do Conteúdo (Margem Inferior: 2,5 cm)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : editorMode === 'html' ? (
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
                            ) : (
                                <div className="bg-[#323639] p-6 rounded-md min-h-[600px] flex flex-col items-center overflow-auto shadow-inner">
                                    <div className="w-full max-w-[210mm] mb-2 flex items-center justify-between text-xs text-gray-300 font-medium px-1">
                                        <span>Visualização do Documento (A4)</span>
                                        {papelTimbradoId && (
                                            <span className="bg-white/10 px-2 py-0.5 rounded text-[11px] text-gray-200">
                                                Papel Timbrado Aplicado
                                            </span>
                                        )}
                                    </div>
                                    <iframe
                                        title="Live Document Preview"
                                        srcDoc={`
                                            <!DOCTYPE html>
                                            <html>
                                                <head>
                                                                                   <style>
                                                        @page { size: A4; margin: 3cm 2cm 2.5cm 2cm; }
                                                        html, body { margin: 0; padding: 0; background-color: white; color: #1e293b; font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.6; font-size: 13px; }
                                                        .document-body-container { padding-top: 3cm !important; padding-bottom: 2.5cm !important; padding-left: 2cm !important; padding-right: 2cm !important; box-sizing: border-box; display: block; width: 100%; min-height: 297mm; position: relative; }
                                                        .document-body-container.has-letterhead, .letterhead-wrapper .document-body-container { padding-top: 0.2cm !important; }
                                                        p { margin-top: 0; margin-bottom: 0.6em; }
                                                        h1, h2, h3, h4 { color: #0f172a; margin-top: 1.2em; margin-bottom: 0.4em; }
                                                        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                                                        th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
                                                        th { background-color: #f8fafc; font-weight: 600; color: #334155; }
                                                        .show-margin-guides { outline: 1px dashed rgba(239, 68, 68, 0.4); outline-offset: -2px; }
                                                    </style>
                                                </head>
                                                <body>
                                                    ${resolveHtmlMediaUrls(renderPreviewHTML())}
                                                </body>
                                            </html>
                                        `}
                                        className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-2xl rounded-sm border border-gray-400 my-2"
                                    />
                                </div>
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
                                            <div className="flex items-center gap-1 shrink-0">
                                                {v.tipo === 'TABELA_HTML' && (
                                                    <span className="text-[9px] font-bold text-brand-primary bg-brand-primary/15 px-1.5 py-0.5 rounded border border-brand-primary/30">
                                                        TABELA DADOS
                                                    </span>
                                                )}
                                                {v.tipo === 'BLOCO_HTML' && (
                                                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                                                        BLOCO RESUMO
                                                    </span>
                                                )}
                                                {v.obrigatoria && (
                                                    <span className="text-[9px] font-bold text-brand-danger bg-brand-danger/10 px-1 py-0.5 rounded">
                                                        OBRIGATÓRIO
                                                    </span>
                                                )}
                                            </div>
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
                        <div className="flex-1 bg-[#323639] relative p-6 flex justify-center overflow-auto shadow-inner">
                            {rendering ? (
                                <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex flex-col items-center justify-center z-10 text-white">
                                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary mb-2" />
                                    <span className="text-sm font-medium">Renderizando variáveis...</span>
                                </div>
                            ) : null}

                            {renderedHtml ? (
                                <iframe
                                    ref={iframeRef}
                                    title="Render Frame"
                                    srcDoc={`
                                        <!DOCTYPE html>
                                        <html>
                                            <head>
                                                <meta charset="utf-8">
                                                <style>
                                                    @page { size: A4; margin: 3cm 2cm 2.5cm 2cm; }
                                                    html, body { margin: 0; padding: 0; background-color: white; color: #1e293b; font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.6; font-size: 13px; }
                                                    .document-body-container { padding-top: 3cm !important; padding-bottom: 2.5cm !important; padding-left: 2cm !important; padding-right: 2cm !important; box-sizing: border-box; display: block; width: 100%; min-height: 297mm; position: relative; }
                                                    .document-body-container.has-letterhead, .letterhead-wrapper .document-body-container { padding-top: 0.2cm !important; }
                                                    p { margin-top: 0; margin-bottom: 0.6em; }
                                                    h1, h2, h3, h4 { color: #0f172a; margin-top: 1.2em; margin-bottom: 0.4em; }
                                                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                                                    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
                                                    th { background-color: #f8fafc; font-weight: 600; color: #334155; }
                                                    @media print {
                                                        body { background-color: white; color: black; }
                                                        @page { margin: 3cm 2cm 2.5cm 2cm; }
                                                    }
                                                </style>
                                            </head>
                                            <body>
                                                ${resolveHtmlMediaUrls(renderedHtml)}
                                            </body>
                                        </html>
                                    `}
                                    className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-2xl rounded-sm border border-gray-400 my-2"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-gray-400">
                                    <FileText className="w-12 h-12 mb-2 text-gray-500" />
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
