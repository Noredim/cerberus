import React, { useEffect, useState } from 'react';
import {
  FileCode,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit2,
  Eye,
  Trash2,
  Star,
  RefreshCw,
  X,
} from 'lucide-react';
import { letterheadApi, type Letterhead } from '../../services/letterheadApi';
import { resolveHtmlMediaUrls } from '../../services/api';
import LetterheadFormModal from './LetterheadFormModal';

export const LetterheadList: React.FC = () => {
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLetterhead, setSelectedLetterhead] = useState<Letterhead | null>(null);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);

  const fetchLetterheads = async () => {
    try {
      setLoading(true);
      const params: { is_active?: boolean; search?: string } = {};
      if (statusFilter === 'ACTIVE') params.is_active = true;
      if (statusFilter === 'INACTIVE') params.is_active = false;
      if (search.trim()) params.search = search.trim();

      const data = await letterheadApi.listLetterheads(params);
      setLetterheads(data);
    } catch (err: any) {
      console.error('Erro ao buscar Papéis Timbrados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLetterheads();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLetterheads();
  };

  const handleOpenCreate = () => {
    setSelectedLetterhead(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lh: Letterhead) => {
    setSelectedLetterhead(lh);
    setIsModalOpen(true);
  };

  const handleDelete = async (lh: Letterhead) => {
    if (!window.confirm(`Deseja realmente remover o Papel Timbrado "${lh.nome}"?`)) {
      return;
    }
    try {
      await letterheadApi.deleteLetterhead(lh.id);
      fetchLetterheads();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao remover Papel Timbrado.');
    }
  };

  const handlePreview = async (lh: Letterhead) => {
    try {
      setLoadingPreviewId(lh.id);
      const res = await letterheadApi.previewLetterhead({
        conteudo_html: lh.conteudo_html,
        conteudo_css: lh.conteudo_css,
      });
      setPreviewHtml(res.html);
    } catch (err) {
      alert('Erro ao carregar pré-visualização.');
    } finally {
      setLoadingPreviewId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Ações */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-5 border border-border-subtle rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-text-primary flex items-center gap-2">
            <FileCode className="w-6 h-6 text-brand-primary" />
            Papéis Timbrados ({letterheads.length})
          </h2>
          <p className="text-xs text-text-muted">
            Cadastre a identidade visual (cabeçalho, rodapé e marca d'água) que envelope os documentos emitidos.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Papel Timbrado
        </button>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full pl-10 pr-4 py-2 bg-bg-deep border border-border-subtle rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand-primary placeholder:text-text-muted"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-surface text-text-muted border-border-subtle hover:text-text-primary'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              statusFilter === 'ACTIVE'
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-surface text-text-muted border-border-subtle hover:text-text-primary'
            }`}
          >
            Ativos
          </button>
          <button
            onClick={() => setStatusFilter('INACTIVE')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              statusFilter === 'INACTIVE'
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-surface text-text-muted border-border-subtle hover:text-text-primary'
            }`}
          >
            Inativos
          </button>
          <button
            onClick={fetchLetterheads}
            className="p-2 bg-surface border border-border-subtle text-text-muted hover:text-text-primary rounded-lg cursor-pointer"
            title="Atualizar Lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Lista / Grid */}
      {loading ? (
        <div className="p-12 text-center text-text-muted">Carregando papéis timbrados...</div>
      ) : letterheads.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border-subtle rounded-2xl bg-surface text-text-muted">
          <FileCode className="w-12 h-12 mx-auto text-text-muted/40 mb-2" />
          Nenhum papel timbrado encontrado. Clique em "Novo Papel Timbrado" para cadastrar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {letterheads.map(lh => (
            <div
              key={lh.id}
              className="bg-surface border border-border-subtle hover:border-brand-primary/40 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-sm group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-text-primary group-hover:text-brand-primary transition-colors">
                      {lh.nome}
                    </span>
                    {lh.is_default && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400" /> Padrão
                      </span>
                    )}
                  </div>
                  {lh.is_active ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Ativo
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-full flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Inativo
                    </span>
                  )}
                </div>

                <p className="text-xs text-text-muted line-clamp-2 min-h-[32px]">
                  {lh.descricao || 'Sem descrição cadastrada.'}
                </p>

                <div className="text-[11px] text-text-muted pt-2 border-t border-border-subtle flex items-center justify-between">
                  <span>Criado em: {new Date(lh.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  onClick={() => handlePreview(lh)}
                  disabled={loadingPreviewId === lh.id}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-bg-deep hover:bg-border-subtle/30 text-text-primary rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Visualizar Preview A4"
                >
                  {loadingPreviewId === lh.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-brand-primary" />
                  )}
                  Preview
                </button>
                <button
                  onClick={() => handleOpenEdit(lh)}
                  className="p-1.5 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-all cursor-pointer"
                  title="Editar Papel Timbrado"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(lh)}
                  className="p-1.5 text-text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                  title="Excluir Papel Timbrado"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Formulário */}
      <LetterheadFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        letterheadToEdit={selectedLetterhead}
        onSaved={fetchLetterheads}
      />

      {/* Modal de Preview A4 */}
      {previewHtml && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden text-text-primary">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-bg-deep/50">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-brand-primary" />
                <h3 className="text-base font-bold text-text-primary">Pré-Visualização do Papel Timbrado (Simulação A4)</h3>
              </div>
              <button
                onClick={() => setPreviewHtml(null)}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-deep rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-neutral-900 p-6 overflow-y-auto flex justify-center items-start">
              <div
                className="bg-white text-slate-900 shadow-2xl rounded-sm w-[210mm] h-[297mm] min-h-[297mm] max-h-[297mm] p-[20mm] box-border flex flex-col justify-between overflow-hidden font-sans relative [&>div]:h-full [&>div]:flex [&>div]:flex-col [&>div]:justify-between [&_:last-child]:mt-auto"
                dangerouslySetInnerHTML={{ __html: resolveHtmlMediaUrls(previewHtml) }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LetterheadList;
