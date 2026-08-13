import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Eye,
  FileCode,
  Sparkles,
  Loader2,
  AlertCircle,
  HelpCircle,
  Upload,
} from 'lucide-react';
import { letterheadApi, type Letterhead } from '../../services/letterheadApi';
import { resolveHtmlMediaUrls } from '../../services/api';

interface LetterheadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  letterheadToEdit?: Letterhead | null;
  onSaved: () => void;
}

export const LetterheadFormModal: React.FC<LetterheadFormModalProps> = ({
  isOpen,
  onClose,
  letterheadToEdit,
  onSaved,
}) => {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [conteudoHtml, setConteudoHtml] = useState('');
  const [conteudoCss, setConteudoCss] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'html' | 'css'>('html');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingLogo(true);
      const res = await letterheadApi.uploadImage(file);
      const imgTag = `<div style="text-align: left; margin-bottom: 15px;">\n  <img src="${res.url}" alt="Logomarca" style="max-height: 70px; width: auto; display: inline-block;" />\n</div>`;
      setConteudoHtml(prev => imgTag + '\n' + prev);
      alert('Logomarca enviada com sucesso! A imagem foi adicionada ao início do seu código HTML.');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao enviar imagem da logomarca.');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (letterheadToEdit) {
      setNome(letterheadToEdit.nome || '');
      setDescricao(letterheadToEdit.descricao || '');
      setConteudoHtml(letterheadToEdit.conteudo_html || '');
      setConteudoCss(letterheadToEdit.conteudo_css || '');
      setIsActive(letterheadToEdit.is_active ?? true);
      setIsDefault(letterheadToEdit.is_default ?? false);
    } else {
      setNome('');
      setDescricao('');
      setConteudoHtml(
        `<div class="header" style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 20px;">\n  <h1 style="color: #0f172a; margin: 0; font-size: 24px;">STELSEG TECNOLOGIA E SEGURANÇA</h1>\n  <p style="color: #64748b; margin: 5px 0 0 0; font-size: 12px;">Soluções em Segurança Eletrônica e Engenharia</p>\n</div>\n\n<div class="document-body">\n  {{document_content}}\n</div>\n\n<div class="footer" style="margin-top: 30px; border-top: 1px solid #e2e8f0; pt-10px; text-align: center; font-size: 10px; color: #94a3b8;">\n  Stelseg Tecnologia LTDA • CNPJ 00.000.000/0001-00 • www.stelseg.com.br\n</div>`
      );
      setConteudoCss(
        `@page {\n  size: A4;\n  margin: 20mm;\n}\n\nbody {\n  font-family: 'Inter', sans-serif;\n  color: #334155;\n}`
      );
      setIsActive(true);
      setIsDefault(false);
    }
    setError(null);
  }, [letterheadToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('O nome do papel timbrado é obrigatório.');
      return;
    }
    if (!conteudoHtml.trim()) {
      setError('O conteúdo HTML do papel timbrado é obrigatório.');
      return;
    }
    if (!conteudoHtml.includes('{{document_content}}') && !conteudoHtml.includes('{{conteudo_documento}}')) {
      if (!window.confirm('Atenção: O código HTML não contém a tag {{document_content}}. O conteúdo dos documentos será anexado ao final. Deseja continuar?')) {
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      const payload = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        conteudo_html: conteudoHtml,
        conteudo_css: conteudoCss.trim() || null,
        is_active: isActive,
        is_default: isDefault,
      };

      if (letterheadToEdit?.id) {
        await letterheadApi.updateLetterhead(letterheadToEdit.id, payload);
      } else {
        await letterheadApi.createLetterhead(payload);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao salvar o Papel Timbrado.');
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePreview = async () => {
    try {
      setLoadingPreview(true);
      const res = await letterheadApi.previewLetterhead({
        conteudo_html: conteudoHtml,
        conteudo_css: conteudoCss,
      });
      setPreviewHtml(res.html);
      setShowPreviewModal(true);
    } catch (err: any) {
      alert('Erro ao gerar a pré-visualização.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const insertPlaceholder = () => {
    setConteudoHtml(prev => prev + '\n{{document_content}}\n');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
        <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-text-primary">
          {/* Header Modal */}
          <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-bg-deep/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-primary/10 rounded-xl text-brand-primary">
                <FileCode className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  {letterheadToEdit ? 'Editar Papel Timbrado' : 'Novo Papel Timbrado'}
                </h2>
                <p className="text-xs text-text-muted">
                  Configure o layout visual de cabeçalho, rodapé e margens reutilizáveis.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-deep rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Nome e Descrição */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Nome do Papel Timbrado <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Stelseg Padrão 2026"
                  className="w-full px-3.5 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand-primary placeholder:text-text-muted"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Descrição / Finalidade
                </label>
                <input
                  type="text"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Ex: Layout comercial para propostas e orçamentos"
                  className="w-full px-3.5 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand-primary placeholder:text-text-muted"
                />
              </div>
            </div>

            {/* Status e Padrão */}
            <div className="flex flex-wrap items-center gap-6 p-4 bg-bg-deep border border-border-subtle rounded-xl">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="rounded text-brand-primary focus:ring-brand-primary bg-bg-deep border-border-subtle h-4 w-4"
                />
                <span className="text-xs font-semibold text-text-primary">Ativo para novas associações</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                  className="rounded text-brand-primary focus:ring-brand-primary bg-bg-deep border-border-subtle h-4 w-4"
                />
                <span className="text-xs font-semibold text-text-primary">Definir como Papel Timbrado Padrão</span>
              </label>
            </div>

            {/* Editors Tabs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('html')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      activeTab === 'html'
                        ? 'bg-brand-primary text-white'
                        : 'bg-bg-deep text-text-muted hover:text-text-primary'
                    }`}
                  >
                    HTML do Layout
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('css')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      activeTab === 'css'
                        ? 'bg-brand-primary text-white'
                        : 'bg-bg-deep text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Estilos CSS (A4)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  {activeTab === 'html' && (
                    <>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Fazer upload de imagem de cabeçalho / logo"
                      >
                        {uploadingLogo ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        Upload Logomarca
                      </button>

                      <button
                        type="button"
                        onClick={insertPlaceholder}
                        className="px-2.5 py-1 text-xs font-semibold bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 border border-brand-primary/30 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Inserir &#123;&#123;document_content&#125;&#125;
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleGeneratePreview}
                    disabled={loadingPreview}
                    className="px-3 py-1.5 text-xs font-bold bg-bg-deep hover:bg-surface border border-border-subtle text-text-primary rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {loadingPreview ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-brand-primary" />
                    )}
                    Visualizar Preview A4
                  </button>
                </div>
              </div>

              {activeTab === 'html' ? (
                <div className="space-y-1">
                  <textarea
                    rows={12}
                    value={conteudoHtml}
                    onChange={e => setConteudoHtml(e.target.value)}
                    placeholder="Digite o código HTML do papel timbrado..."
                    className="w-full p-3.5 bg-bg-deep border border-border-subtle rounded-xl font-mono text-xs text-text-primary focus:outline-none focus:border-brand-primary leading-relaxed placeholder:text-text-muted"
                  />
                  <p className="text-[11px] text-text-muted flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-brand-primary" />
                    Use a tag <code className="text-brand-primary bg-bg-deep px-1 rounded">&#123;&#123;document_content&#125;&#125;</code> para indicar onde o conteúdo do documento será inserido.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <textarea
                    rows={12}
                    value={conteudoCss}
                    onChange={e => setConteudoCss(e.target.value)}
                    placeholder="Estilos CSS adicionais para impressão A4 e fontes..."
                    className="w-full p-3.5 bg-bg-deep border border-border-subtle rounded-xl font-mono text-xs text-text-primary focus:outline-none focus:border-brand-primary leading-relaxed placeholder:text-text-muted"
                  />
                  <p className="text-[11px] text-text-muted">
                    Regras como <code className="text-brand-primary bg-bg-deep px-1 rounded">@page &#123; size: A4; margin: 20mm; &#125;</code> serão aplicadas na renderização.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-border-subtle flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-bg-deep hover:bg-border-subtle/40 border border-border-subtle text-text-primary text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Papel Timbrado
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal Sub-Preview A4 */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden text-text-primary">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-bg-deep/50">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-brand-primary" />
                <h3 className="text-base font-bold text-text-primary">Pré-Visualização do Papel Timbrado (Simulação A4)</h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-deep rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-neutral-900 p-6 overflow-y-auto flex justify-center items-start">
              {/* Folha A4 Simulação (210mm x 297mm) */}
              <div
                className="bg-white text-slate-900 shadow-2xl rounded-sm w-[210mm] h-[297mm] min-h-[297mm] max-h-[297mm] p-[20mm] box-border flex flex-col justify-between overflow-hidden font-sans relative [&>div]:h-full [&>div]:flex [&>div]:flex-col [&>div]:justify-between [&_:last-child]:mt-auto"
                dangerouslySetInnerHTML={{ __html: resolveHtmlMediaUrls(previewHtml) }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LetterheadFormModal;
