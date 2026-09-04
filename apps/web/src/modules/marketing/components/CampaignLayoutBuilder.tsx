import React, { useState } from 'react';
import type {
  LayoutConfig,
  LayoutBlockItem,
  SubtitleItem
} from '../types';
import {
  GripVertical,
  Eye,
  EyeOff,
  Sparkles,
  Heading,
  AlignJustify,
  Image as ImageIcon,
  Video,
  ListChecks,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  LayoutTemplate,
  PanelRight,
  PanelLeft,
  PanelBottom
} from 'lucide-react';

interface CampaignLayoutBuilderProps {
  layout?: LayoutConfig;
  subtitulos?: SubtitleItem[];
  onChange: (layout: LayoutConfig) => void;
}

const DEFAULT_BLOCKS: LayoutBlockItem[] = [
  { id: 'badge', visivel: true },
  { id: 'titulo', visivel: true },
  { id: 'subtitulo', visivel: true },
  { id: 'banner', visivel: true },
  { id: 'video', visivel: true },
  { id: 'beneficios', visivel: true }
];

const BASE_BLOCK_META: Record<
  string,
  { label: string; desc: string; icon: React.FC<{ className?: string }> }
> = {
  badge: {
    label: 'Selo / Tag de Oportunidade',
    desc: 'Exibe "Oportunidade por Tempo Limitado" com ícone de brilho no topo.',
    icon: Sparkles
  },
  titulo: {
    label: 'Título Principal (H1)',
    desc: 'Nome da campanha, oferta ou produto em destaque com tipografia forte.',
    icon: Heading
  },
  subtitulo: {
    label: 'Subtítulo Explicativo Principal',
    desc: 'Parágrafo descritivo diagramado de forma justificada para máxima legibilidade.',
    icon: AlignJustify
  },
  banner: {
    label: 'Imagem do Banner / Produto',
    desc: 'Fotografia ou mockup do produto cadastrado na campanha com bordas arredondadas.',
    icon: ImageIcon
  },
  video: {
    label: 'Player de Vídeo Demonstrativo',
    desc: 'Player embutido para YouTube, Vimeo ou vídeo institucional MP4.',
    icon: Video
  },
  beneficios: {
    label: 'Diferenciais / Benefícios Rápidos',
    desc: 'Lista de diferenciais competitivos com ícones de checagem verde.',
    icon: ListChecks
  }
};

export const CampaignLayoutBuilder: React.FC<CampaignLayoutBuilderProps> = ({
  layout,
  subtitulos,
  onChange
}) => {
  const currentPos = layout?.posicao_formulario || 'right';
  
  // Normalizar blocos garantindo sincronização com subtítulos configurados
  const subtitleBlocks: LayoutBlockItem[] = (subtitulos && subtitulos.length > 0)
    ? subtitulos.map(s => ({ id: s.id, visivel: true }))
    : [{ id: 'subtitulo', visivel: true }];

  const baseBlocks = DEFAULT_BLOCKS.filter(b => b.id !== 'subtitulo');
  const allNeededBlocks = [
    baseBlocks[0], // badge
    baseBlocks[1], // titulo
    ...subtitleBlocks,
    ...baseBlocks.slice(2) // banner, video, beneficios
  ];
  const allNeededIds = new Set(allNeededBlocks.map(b => b.id));

  const currentBlocks: LayoutBlockItem[] = (() => {
    if (!layout?.blocos || layout.blocos.length === 0) {
      return allNeededBlocks;
    }
    // Filtrar blocos excluídos (ex: subtítulos removidos) e manter ordem configurada
    const existingFiltered = layout.blocos.filter(b => allNeededIds.has(b.id));
    const existingIds = new Set(existingFiltered.map(b => b.id));
    const missing = allNeededBlocks.filter(b => !existingIds.has(b.id));
    return [...existingFiltered, ...missing];
  })();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const getBlockMeta = (id: string) => {
    if (BASE_BLOCK_META[id] && id !== 'subtitulo') {
      return BASE_BLOCK_META[id];
    }
    // Caso de subtítulo principal ou subtítulos adicionais
    if (id === 'subtitulo' || id.startsWith('subtitulo')) {
      const found = subtitulos?.find(s => s.id === id);
      const label = found?.rotulo?.trim() || (id === 'subtitulo' ? 'Subtítulo Explicativo Principal' : 'Subtítulo Explicativo Adicional');
      const desc = found?.texto?.trim()
        ? (found.texto.trim().length > 75 ? found.texto.trim().substring(0, 75) + '...' : found.texto.trim())
        : 'Parágrafo explicativo diagramado de forma justificada.';
      return {
        label,
        desc,
        icon: AlignJustify
      };
    }
    return {
      label: id,
      desc: '',
      icon: Sparkles
    };
  };

  // Alterar posição do formulário
  const handlePositionChange = (pos: 'right' | 'left' | 'bottom') => {
    onChange({
      posicao_formulario: pos,
      blocos: currentBlocks
    });
  };

  // Alternar visibilidade do bloco
  const handleToggleVisibility = (id: string) => {
    const updated = currentBlocks.map(b =>
      b.id === id ? { ...b, visivel: !b.visivel } : b
    );
    onChange({
      posicao_formulario: currentPos,
      blocos: updated
    });
  };

  // Mover bloco para cima/baixo
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentBlocks.length) return;

    const newBlocks = [...currentBlocks];
    const [moved] = newBlocks.splice(index, 1);
    newBlocks.splice(targetIndex, 0, moved);

    onChange({
      posicao_formulario: currentPos,
      blocos: newBlocks
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newBlocks = [...currentBlocks];
    const [removed] = newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(dropIndex, 0, removed);

    setDraggedIndex(null);
    setDragOverIndex(null);

    onChange({
      posicao_formulario: currentPos,
      blocos: newBlocks
    });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Resetar para ordem padrão
  const handleResetDefault = () => {
    onChange({
      posicao_formulario: 'right',
      blocos: allNeededBlocks
    });
  };

  return (
    <div className="space-y-6 pt-2">
      {/* 1. Posicionamento do Formulário */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <LayoutTemplate className="w-3.5 h-3.5 text-brand-primary" />
            Posicionamento do Formulário de Captura
          </label>
          <span className="text-[11px] text-text-muted">
            Define como o formulário divide a tela com o conteúdo
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Opção: Direita */}
          <button
            type="button"
            onClick={() => handlePositionChange('right')}
            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between relative ${
              currentPos === 'right'
                ? 'border-brand-primary bg-brand-primary/10 shadow-sm ring-1 ring-brand-primary/40'
                : 'border-border-subtle bg-bg-surface hover:border-border-default hover:bg-bg-hover'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <PanelRight className="w-4 h-4 text-brand-primary" />
                Formulário à Direita
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-primary/20 text-brand-primary font-medium">
                Padrão
              </span>
            </div>
            {/* Mini Wireframe */}
            <div className="w-full h-9 bg-bg-deep rounded border border-border-subtle p-1 flex gap-1 items-center">
              <div className="h-full flex-1 bg-border-subtle/80 rounded flex items-center justify-center text-[9px] text-text-muted">
                Conteúdo (60%)
              </div>
              <div className="h-full w-1/3 bg-brand-primary/30 border border-brand-primary/40 rounded flex items-center justify-center text-[9px] font-bold text-brand-primary">
                Form
              </div>
            </div>
            <p className="text-[11px] text-text-muted mt-2">
              Distribuição clássica com mídia à esquerda e conversão à direita.
            </p>
          </button>

          {/* Opção: Esquerda */}
          <button
            type="button"
            onClick={() => handlePositionChange('left')}
            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between relative ${
              currentPos === 'left'
                ? 'border-brand-primary bg-brand-primary/10 shadow-sm ring-1 ring-brand-primary/40'
                : 'border-border-subtle bg-bg-surface hover:border-border-default hover:bg-bg-hover'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <PanelLeft className="w-4 h-4 text-brand-primary" />
                Formulário à Esquerda
              </span>
            </div>
            {/* Mini Wireframe */}
            <div className="w-full h-9 bg-bg-deep rounded border border-border-subtle p-1 flex gap-1 items-center">
              <div className="h-full w-1/3 bg-brand-primary/30 border border-brand-primary/40 rounded flex items-center justify-center text-[9px] font-bold text-brand-primary">
                Form
              </div>
              <div className="h-full flex-1 bg-border-subtle/80 rounded flex items-center justify-center text-[9px] text-text-muted">
                Conteúdo (60%)
              </div>
            </div>
            <p className="text-[11px] text-text-muted mt-2">
              Foco imediato na captação do lead assim que a página é carregada.
            </p>
          </button>

          {/* Opção: Abaixo */}
          <button
            type="button"
            onClick={() => handlePositionChange('bottom')}
            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between relative ${
              currentPos === 'bottom'
                ? 'border-brand-primary bg-brand-primary/10 shadow-sm ring-1 ring-brand-primary/40'
                : 'border-border-subtle bg-bg-surface hover:border-border-default hover:bg-bg-hover'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <PanelBottom className="w-4 h-4 text-brand-primary" />
                Formulário Abaixo
              </span>
            </div>
            {/* Mini Wireframe */}
            <div className="w-full h-9 bg-bg-deep rounded border border-border-subtle p-1 flex flex-col gap-0.5 justify-center">
              <div className="w-full h-3.5 bg-border-subtle/80 rounded flex items-center justify-center text-[8px] text-text-muted">
                Conteúdo Amplo (100%)
              </div>
              <div className="w-full h-3.5 bg-brand-primary/30 border border-brand-primary/40 rounded flex items-center justify-center text-[8px] font-bold text-brand-primary">
                Formulário Centralizado
              </div>
            </div>
            <p className="text-[11px] text-text-muted mt-2">
              Apresentação completa do produto no topo com formulário em largura ampla.
            </p>
          </button>
        </div>
      </div>

      {/* 2. Reordenação e Visibilidade dos Blocos de Conteúdo */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <GripVertical className="w-3.5 h-3.5 text-brand-primary" />
              Hierarquia e Ordem dos Blocos de Conteúdo (Arrastar e Soltar)
            </label>
            <p className="text-[11px] text-text-muted mt-0.5">
              Arraste os cards para reorganizar a sequência dos blocos na Landing Page ou clique no olho para ocultar.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-text-muted hover:text-text-primary border border-border-subtle rounded-lg hover:bg-bg-hover transition-colors"
            title="Voltar para a ordem original recomendada"
          >
            <RotateCcw className="w-3 h-3" />
            Restaurar Padrão
          </button>
        </div>

        <div className="space-y-2">
          {currentBlocks.map((block, index) => {
            const meta = getBlockMeta(block.id);
            const Icon = meta.icon;
            const isBeingDragged = draggedIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <div
                key={block.id}
                draggable
                onDragStart={e => handleDragStart(e, index)}
                onDragOver={e => handleDragOver(e, index)}
                onDrop={e => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 select-none cursor-grab active:cursor-grabbing ${
                  isBeingDragged
                    ? 'opacity-40 border-dashed border-brand-primary bg-brand-primary/5'
                    : isDragOver
                    ? 'border-brand-primary bg-brand-primary/10 scale-[1.01]'
                    : !block.visivel
                    ? 'bg-bg-surface/50 border-border-subtle opacity-60'
                    : 'bg-bg-surface border-border-subtle hover:border-border-default hover:bg-bg-hover'
                }`}
              >
                {/* Lado Esquerdo: Grip + Posição + Ícone + Textos */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-text-muted hover:text-text-primary cursor-grab p-0.5">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <span className="w-5 h-5 rounded-full bg-bg-deep border border-border-subtle flex items-center justify-center text-[10px] font-bold text-text-secondary flex-shrink-0">
                    {index + 1}º
                  </span>

                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      block.visivel
                        ? 'bg-brand-primary/10 text-brand-primary'
                        : 'bg-bg-deep text-text-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold truncate ${
                          block.visivel ? 'text-text-primary' : 'text-text-muted line-through'
                        }`}
                      >
                        {meta.label}
                      </span>
                      {!block.visivel && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 font-medium">
                          Oculto
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted truncate">
                      {meta.desc}
                    </p>
                  </div>
                </div>

                {/* Lado Direito: Ações (Mover Cima/Baixo + Toggle Visibilidade) */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Botões Mover (Acessibilidade) */}
                  <div className="hidden sm:flex items-center gap-0.5 bg-bg-deep rounded-lg border border-border-subtle p-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed hover:bg-bg-hover"
                      title="Mover para cima"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === currentBlocks.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed hover:bg-bg-hover"
                      title="Mover para baixo"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Toggle de Visibilidade */}
                  <button
                    type="button"
                    onClick={() => handleToggleVisibility(block.id)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      block.visivel
                        ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary hover:bg-brand-primary/20'
                        : 'bg-bg-deep border-border-subtle text-text-muted hover:text-text-primary hover:bg-bg-hover'
                    }`}
                    title={block.visivel ? 'Clique para ocultar este bloco na Landing Page' : 'Clique para exibir este bloco'}
                  >
                    {block.visivel ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Visível</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Oculto</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
