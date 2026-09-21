import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../../components/modals/Modal';
import { Button } from '../../../components/ui/Button';
import { Plus, Trash2, Layers, AlertTriangle, CheckCircle2, Package, Info, ShieldAlert } from 'lucide-react';

export interface ProposalKitInfo {
  id: string;
  nome: string;
  tipo: 'LOCACAO' | 'VENDA' | 'INSTALACAO';
  valorMensal?: number;
  valorTotal?: number;
  prazoMeses?: number;
}

export interface ProposalKitGroup {
  id: string;
  nome_grupo: string;
  tipo_contrato: string;
  kit_ids: string[];
  hide_items?: boolean;
}

interface ProposalGroupingModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableKits: ProposalKitInfo[];
  initialGroupings: ProposalKitGroup[];
  onSave: (updatedGroupings: ProposalKitGroup[]) => void;
  onSaveAndGenerate?: (updatedGroupings: ProposalKitGroup[]) => void;
}

const formatCurrency = (val?: number) => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const ProposalGroupingModal: React.FC<ProposalGroupingModalProps> = ({
  isOpen,
  onClose,
  availableKits,
  initialGroupings,
  onSave,
  onSaveAndGenerate,
}) => {
  const [groups, setGroups] = useState<ProposalKitGroup[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Clona os agrupamentos existentes ou inicializa
      setGroups(JSON.parse(JSON.stringify(initialGroupings || [])));
    }
  }, [isOpen, initialGroupings]);

  // Adicionar novo grupo
  const handleAddGroup = () => {
    const newGroup: ProposalKitGroup = {
      id: 'grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      nome_grupo: '',
      tipo_contrato: 'LOCACAO',
      kit_ids: [],
      hide_items: true,
    };
    setGroups([...groups, newGroup]);
  };

  // Remover grupo
  const handleRemoveGroup = (groupId: string) => {
    setGroups(groups.filter(g => g.id !== groupId));
  };

  // Atualizar nome do grupo
  const handleUpdateGroupName = (groupId: string, nome: string) => {
    setGroups(groups.map(g => (g.id === groupId ? { ...g, nome_grupo: nome } : g)));
  };

  // Toggle inclusão de kit no grupo
  const handleToggleKitInGroup = (groupId: string, kitId: string) => {
    setGroups(prevGroups => {
      return prevGroups.map(g => {
        if (g.id === groupId) {
          const exists = g.kit_ids.includes(kitId);
          const nextKits = exists ? g.kit_ids.filter(id => id !== kitId) : [...g.kit_ids, kitId];
          return { ...g, kit_ids: nextKits };
        } else {
          // Garante que o kit não fique em mais de um grupo simultaneamente
          return { ...g, kit_ids: g.kit_ids.filter(id => id !== kitId) };
        }
      });
    });
  };

  // Mapeamento de kits por ID
  const kitMap = useMemo(() => {
    const map = new Map<string, ProposalKitInfo>();
    availableKits.forEach(k => map.set(k.id, k));
    return map;
  }, [availableKits]);

  // Kits já alocados em algum grupo
  const allocatedKitIds = useMemo(() => {
    const ids = new Set<string>();
    groups.forEach(g => g.kit_ids.forEach(id => ids.add(id)));
    return ids;
  }, [groups]);

  // Kits avulsos (não agrupados)
  const unallocatedKits = useMemo(() => {
    return availableKits.filter(k => !allocatedKitIds.has(k.id));
  }, [availableKits, allocatedKitIds]);

  // Validação de prazos divergentes e nomes vazios
  const validationErrors = useMemo(() => {
    const errors: { groupId: string; message: string }[] = [];

    groups.forEach((g, idx) => {
      if (!g.nome_grupo.trim() && g.kit_ids.length > 0) {
        errors.push({
          groupId: g.id,
          message: `O Grupo ${idx + 1} precisa de um Nome Comercial preenchido.`,
        });
      }

      if (g.kit_ids.length > 1) {
        // Verificar se há prazos diferentes entre os kits de locação
        const prazos = new Set<number>();
        g.kit_ids.forEach(kId => {
          const kInfo = kitMap.get(kId);
          if (kInfo && kInfo.prazoMeses) {
            prazos.add(kInfo.prazoMeses);
          }
        });

        if (prazos.size > 1) {
          errors.push({
            groupId: g.id,
            message: `Kits com prazos contratuais divergentes (${Array.from(prazos).join(', ')} meses). Iguale os prazos na oportunidade para poder agrupá-los.`,
          });
        }
      }
    });

    return errors;
  }, [groups, kitMap]);

  const hasErrors = validationErrors.length > 0;

  const handleSave = () => {
    if (hasErrors) return;
    // Filtra apenas grupos válidos com pelo menos 1 kit e com nome preenchido
    const validGroups = groups.filter(g => g.nome_grupo.trim() && g.kit_ids.length > 0);
    onSave(validGroups);
    onClose();
  };

  const handleSaveAndGenerate = () => {
    if (hasErrors) return;
    const validGroups = groups.filter(g => g.nome_grupo.trim() && g.kit_ids.length > 0);
    if (onSaveAndGenerate) {
      onSaveAndGenerate(validGroups);
    } else {
      onSave(validGroups);
    }
    onClose();
  };

  const handleClearAll = () => {
    setGroups([]);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Agrupamento de Kits na Proposta Comercial"
      description="Junte o valor de múltiplos kits sob uma única nomenclatura e mensalidade consolidada na proposta comercial impressa/PDF."
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Info Banner */}
        <div className="p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-xl text-text-primary text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <p>
              <strong>Regra de Exibição Comercial:</strong> Os kits agrupados aparecerão na proposta como um único bloco consolidado com a <strong>mensalidade somada</strong> e <strong>sem detalhar os itens individuais</strong>.
            </p>
            <p className="text-text-muted">
              Kits que não forem incluídos em nenhum grupo continuarão sendo exibidos normalmente de forma individual. A memória de cálculo e engenharia de custos não é alterada.
            </p>
          </div>
        </div>

        {/* Global Validation Error Banner */}
        {hasErrors && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Ajustes necessários antes de salvar:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              {validationErrors.map((err, i) => (
                <li key={i}>{err.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Grupos Criados */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-primary" />
              <h3 className="text-sm font-bold text-text-primary">
                Grupos de Kits Configurados ({groups.length})
              </h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddGroup}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Criar Novo Agrupamento
            </Button>
          </div>

          {groups.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-border-subtle rounded-xl bg-bg-surface/50">
              <Package className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-text-primary">Nenhum agrupamento configurado</p>
              <p className="text-xs text-text-muted max-w-md mx-auto mt-1">
                Todos os kits da oportunidade serão exibidos individualmente na proposta comercial. Clique em &quot;Criar Novo Agrupamento&quot; caso queira unir o valor de kits.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleAddGroup}
                className="mt-3 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Criar Primeiro Grupo
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => {
                const groupKits = group.kit_ids.map(id => kitMap.get(id)).filter(Boolean) as ProposalKitInfo[];
                const totalMensal = groupKits.reduce((acc, k) => acc + (k.valorMensal || 0), 0);
                const totalGeral = groupKits.reduce((acc, k) => acc + (k.valorTotal || 0), 0);

                // Erro de prazo específico do grupo
                const groupError = validationErrors.find(e => e.groupId === group.id);

                return (
                  <div
                    key={group.id}
                    className="p-4 rounded-xl border border-border-subtle bg-bg-surface space-y-3 relative shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-3">
                      <div className="flex-1 max-w-lg">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                          Nomenclatura Comercial do Grupo <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Solução Integrada de Portaria e Monitoramento"
                          value={group.nome_grupo}
                          onChange={e => handleUpdateGroupName(group.id, e.target.value)}
                          className="w-full px-3 py-1.5 text-sm font-semibold border border-border-subtle rounded-lg bg-bg-deep text-text-primary focus:outline-none focus:border-brand-primary"
                        />
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-text-muted block">Mensalidade Somada</span>
                          <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(totalMensal)}/mês
                          </span>
                          {totalGeral > 0 && totalMensal === 0 && (
                            <span className="text-xs font-bold text-text-primary block">
                              Total: {formatCurrency(totalGeral)}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveGroup(group.id)}
                          className="p-2 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Remover grupo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {groupError && (
                      <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{groupError.message}</span>
                      </div>
                    )}

                    {/* Seleção de Kits para este grupo */}
                    <div>
                      <span className="block text-xs font-semibold text-text-primary mb-2">
                        Selecione os kits que compõem este agrupamento ({group.kit_ids.length} selecionados):
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {availableKits.map(kit => {
                          const isSelectedInThisGroup = group.kit_ids.includes(kit.id);
                          const isSelectedInOtherGroup = allocatedKitIds.has(kit.id) && !isSelectedInThisGroup;

                          return (
                            <label
                              key={kit.id}
                              className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                                isSelectedInThisGroup
                                  ? 'border-brand-primary bg-brand-primary/10 text-text-primary font-medium'
                                  : isSelectedInOtherGroup
                                  ? 'border-border-subtle bg-bg-deep/50 opacity-40 cursor-not-allowed text-text-muted'
                                  : 'border-border-subtle hover:bg-bg-deep text-text-secondary'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelectedInThisGroup}
                                disabled={isSelectedInOtherGroup}
                                onChange={() => handleToggleKitInGroup(group.id, kit.id)}
                                className="mt-0.5 rounded border-border-subtle text-brand-primary focus:ring-brand-primary"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold block truncate">{kit.nome}</span>
                                <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-0.5">
                                  {kit.valorMensal ? (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      {formatCurrency(kit.valorMensal)}/mês
                                    </span>
                                  ) : (
                                    <span>{formatCurrency(kit.valorTotal)}</span>
                                  )}
                                  {kit.prazoMeses ? <span>• {kit.prazoMeses}m</span> : null}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumo de Kits Avulsos (Não Agrupados) */}
        {unallocatedKits.length > 0 && groups.length > 0 && (
          <div className="p-3 bg-bg-deep rounded-xl border border-border-subtle space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Kits que permanecerão individuais na proposta ({unallocatedKits.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {unallocatedKits.map(k => (
                <div
                  key={k.id}
                  className="px-2.5 py-1 bg-bg-surface rounded-lg border border-border-subtle text-xs text-text-secondary flex items-center gap-1.5"
                >
                  <span className="font-medium">{k.nome}</span>
                  <span className="text-text-muted">
                    ({k.valorMensal ? `${formatCurrency(k.valorMensal)}/mês` : formatCurrency(k.valorTotal)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-xs text-rose-500 hover:text-rose-600"
          >
            Limpar Todos os Agrupamentos
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={hasErrors}
              onClick={handleSave}
            >
              Salvar Agrupamentos
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={hasErrors}
              onClick={handleSaveAndGenerate}
              className="bg-brand-primary"
            >
              Salvar e Gerar Proposta
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
