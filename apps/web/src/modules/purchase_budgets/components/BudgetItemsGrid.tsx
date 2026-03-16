import { useEffect, useCallback, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Trash2 } from 'lucide-react';
import { ProductSearchModal } from '../../products/components/ProductSearchModal';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export interface BudgetItem {
  id?: string;
  product_id?: string;
  quantidade?: number;
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
  product_codigo?: string;
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const calculateRow = useCallback((row: BudgetItem): BudgetItem => {
    const vUnit = row.valor_unitario || 0;
    
    let fretePerc = 0;
    if (freteTipoCabecalho === 'FOB') {
      fretePerc = row.frete_percent || fretePercentCabecalho;
    }
    const freteValor = vUnit * (fretePerc / 100);
    
    const ipiPerc = row.ipi_percent || 0;
    const ipiValor = vUnit * (ipiPerc / 100);
    
    const qtd = row.quantidade || 1;
    let baseUnit = 0;
    if (ipiCalculado) {
      baseUnit = vUnit + freteValor;
    } else {
      baseUnit = vUnit + freteValor + ipiValor;
    }
    
    const total = baseUnit * qtd;
    
    return {
      ...row,
      frete_percent: fretePerc,
      frete_valor: freteValor * qtd,
      ipi_valor: ipiValor * qtd,
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
            onClick={() => setIsModalOpen(true)}
            variant="outline"
          >
            Adicionar Item
          </Button>
        </div>
      </div>
      <div className="border border-border-subtle rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse table-fixed min-w-[1100px]">
          <thead className="bg-[#f8f9fa] dark:bg-bg-deep text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border-subtle">
            <tr>
              <th className="px-4 py-3 w-[100px]">Cód. Sistema</th>
              <th className="px-4 py-3 w-[25%] min-w-[280px]">Produto</th>
              <th className="px-4 py-3 w-[120px]">Cód. Fornecedor</th>
              <th className="px-4 py-3 w-[120px]">NCM</th>
              <th className="px-4 py-3 w-[90px]">Qtd.</th>
              <th className="px-4 py-3 w-[140px]">Valor Un.</th>
              <th className="px-4 py-3 w-[90px]">Frete %</th>
              <th className="px-4 py-3 w-[90px]">IPI %</th>
              <th className="px-4 py-3 w-[90px]">ICMS %</th>
              <th className="px-4 py-3 w-[130px]">Total Item</th>
              <th className="px-4 py-3 w-[50px] text-right"></th>
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
                  <td className="px-4 py-2">
                    <span className="text-xs font-bold text-text-muted bg-bg-deep px-2 py-1 rounded">
                      {row.product_codigo || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-2 w-full">
                    <textarea 
                      disabled={disabled}
                      rows={2}
                      className="w-full text-sm border border-border-subtle rounded px-2 py-1.5 focus:border-brand-primary outline-none resize-none leading-tight"
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
                    <input 
                      disabled={disabled}
                      type="number"
                      step="1"
                      className="w-full text-sm border border-border-subtle rounded px-2 py-1.5 focus:border-brand-primary outline-none"
                      value={row.quantidade || 1} 
                      onChange={(e) => updateField(idx, 'quantidade', parseFloat(e.target.value) || 1)}
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
                  <td className="px-4 py-2 font-semibold text-sm text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
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
      
      <ProductSearchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={(product) => {
          const newItem = calculateRow({
            product_id: product.id,
            product_codigo: product.codigo,
            product_nome: product.nome,
            codigo_fornecedor: '', // Starts empty, user fills
            ncm: product.ncm_codigo || '',
            valor_unitario: 0,
            quantidade: 1,
            frete_percent: 0,
            ipi_percent: 0,
            icms_percent: 0
          });
          onChange([...items, newItem]);
        }}
      />
    </div>
  );
}
