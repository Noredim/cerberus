import { useEffect, useCallback } from 'react';
import { Button } from '../../../components/ui/Button';
import { Trash2 } from 'lucide-react';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export interface BudgetItem {
  id?: string;
  product_id?: string;
  codigo_fornecedor: string;
  ncm: string;
  valor_unitario: number;
  frete_percent: number;
  ipi_percent: number;
  icms_percent: number;
  frete_valor?: number;
  ipi_valor?: number;
  total_item?: number;
  product_nome?: string;
}

interface BudgetItemsGridProps {
  items: BudgetItem[];
  onChange: (items: BudgetItem[]) => void;
  freteTipoCabecalho: 'CIF' | 'FOB';
  fretePercentCabecalho: number;
  ipiCalculado: boolean;
  disabled?: boolean;
}

export function BudgetItemsGrid({
  items,
  onChange,
  freteTipoCabecalho,
  fretePercentCabecalho,
  ipiCalculado,
  disabled
}: BudgetItemsGridProps) {

  const calculateRow = useCallback((row: BudgetItem): BudgetItem => {
    const vUnit = row.valor_unitario || 0;
    
    let fretePerc = 0;
    if (freteTipoCabecalho === 'FOB') {
      fretePerc = row.frete_percent || fretePercentCabecalho;
    }
    const freteValor = vUnit * (fretePerc / 100);
    
    const ipiPerc = row.ipi_percent || 0;
    const ipiValor = vUnit * (ipiPerc / 100);
    
    let total = 0;
    if (ipiCalculado) {
      total = vUnit + freteValor;
    } else {
      total = vUnit + freteValor + ipiValor;
    }
    
    return {
      ...row,
      frete_percent: fretePerc,
      frete_valor: freteValor,
      ipi_valor: ipiValor,
      total_item: total
    };
  }, [freteTipoCabecalho, fretePercentCabecalho, ipiCalculado]);

  useEffect(() => {
    if (!items || items.length === 0) return;
    const newItems = items.map(calculateRow);
    const hasChanges = newItems.some((ni, idx) => 
      ni.total_item !== items[idx].total_item || 
      ni.frete_valor !== items[idx].frete_valor
    );
    if (hasChanges) {
      onChange(newItems);
    }
  }, [freteTipoCabecalho, fretePercentCabecalho, ipiCalculado, calculateRow, items, onChange]);

  const updateField = (index: number, field: keyof BudgetItem, value: any) => {
    if (disabled) return;
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    newItems[index] = calculateRow(newItems[index]);
    onChange(newItems);
  };

  const removeRow = (index: number) => {
    if (disabled) return;
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-slate-700">Itens do Orçamento</h3>
        <div className="flex items-center gap-4">
          <div className="bg-surface border border-border-subtle rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Total do Orçamento:</span>
            <span className="text-lg font-bold text-brand-primary">
              {formatCurrency(items.reduce((acc, row) => acc + (row.total_item || 0), 0))}
            </span>
          </div>
          <Button 
            disabled={disabled}
            onClick={() => onChange([...items, calculateRow({ codigo_fornecedor: '', ncm: '', valor_unitario: 0, frete_percent: 0, ipi_percent: 0, icms_percent: 0 })])}
            variant="outline"
          >
            Adicionar Item
          </Button>
        </div>
      </div>
      <div className="border border-border-subtle rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="bg-[#f8f9fa] dark:bg-bg-deep text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border-subtle">
            <tr>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3 w-32">Cód. Fornecedor</th>
              <th className="px-4 py-3 w-28">NCM</th>
              <th className="px-4 py-3 w-32">Valor Un.</th>
              <th className="px-4 py-3 w-24">Frete %</th>
              <th className="px-4 py-3 w-24">IPI %</th>
              <th className="px-4 py-3 w-24">ICMS %</th>
              <th className="px-4 py-3 w-32">Total Item</th>
              <th className="px-4 py-3 w-16 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle bg-surface">
             {items.length === 0 ? (
               <tr>
                 <td colSpan={9} className="px-6 py-8 text-center text-text-muted text-sm border-b border-border-subtle">
                    Nenhum item adicionado ao orçamento.
                 </td>
               </tr>
             ) : items.map((row, idx) => (
                <tr key={idx} className="group hover:bg-bg-deep/50 transition-colors">
                  <td className="px-4 py-2 w-full">
                    <input 
                      disabled={disabled}
                      className="w-full text-sm border border-border-subtle rounded px-2 py-1.5 focus:border-brand-primary outline-none"
                      placeholder="Nome do Produto"
                      value={row.product_nome || ''} 
                      onChange={(e) => updateField(idx, 'product_nome', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      disabled={disabled}
                      className="w-full text-sm border border-border-subtle rounded px-2 py-1.5 focus:border-brand-primary outline-none"
                      value={row.codigo_fornecedor} 
                      onChange={(e) => updateField(idx, 'codigo_fornecedor', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      disabled={disabled}
                      className="w-full text-sm border border-border-subtle rounded px-2 py-1.5 focus:border-brand-primary outline-none"
                      value={row.ncm} 
                      onChange={(e) => updateField(idx, 'ncm', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="relative flex items-center">
                      <span className="absolute left-2.5 z-10 text-xs font-medium text-text-muted">R$</span>
                      <input 
                        disabled={disabled}
                        type="number"
                        step="0.0001"
                        className="w-full text-sm border border-border-subtle rounded py-1.5 pl-8 pr-2 focus:border-brand-primary outline-none disabled:bg-bg-deep transition-colors"
                        value={row.valor_unitario} 
                        onChange={(e) => updateField(idx, 'valor_unitario', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      disabled={disabled || freteTipoCabecalho === 'CIF'}
                      type="number"
                      step="0.01"
                      className="w-full text-sm border border-border-subtle rounded px-2 py-1.5 focus:border-brand-primary outline-none disabled:bg-bg-deep"
                      value={row.frete_percent} 
                      onChange={(e) => updateField(idx, 'frete_percent', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      disabled={disabled}
                      type="number"
                      step="0.01"
                      className="w-full text-sm border border-border-subtle rounded px-2 py-1.5 focus:border-brand-primary outline-none"
                      value={row.ipi_percent} 
                      onChange={(e) => updateField(idx, 'ipi_percent', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      disabled={disabled}
                      type="number"
                      step="0.01"
                      className="w-full text-sm border border-border-subtle rounded px-2 py-1.5 focus:border-brand-primary outline-none"
                      value={row.icms_percent} 
                      onChange={(e) => updateField(idx, 'icms_percent', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-4 py-2 font-semibold text-sm text-text-primary whitespace-nowrap">
                    {formatCurrency(row.total_item || 0)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button 
                      onClick={() => removeRow(idx)}
                      disabled={disabled}
                      className="p-1.5 rounded-md hover:bg-brand-danger/10 text-brand-danger transition-all cursor-pointer disabled:opacity-50"
                      title="Remover Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
