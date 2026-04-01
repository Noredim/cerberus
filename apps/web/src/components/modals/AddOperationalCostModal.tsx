import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, PackageOpen, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../ui/Button';

interface AddOperationalCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { 
    tipo_item: string;
    product?: any; 
    own_service?: any;
    forma_execucao?: string;
    quantidade: number; 
    tipo_custo: string; 
    valor_unitario: number;
    descricao_item?: string;
  }) => void;
  defaultType?: string;
}

const COST_TYPES = [
  { value: 'Seguro apólice', label: 'Seguro apólice' },
  { value: 'Logística/veículos', label: 'Logística/veículos' },
  { value: 'Loc. software', label: 'Loc. software' },
  { value: 'MANUTENCAO', label: 'Manut. pred./corretiva' },
  { value: 'INSTALACAO', label: 'Instalação' }
];

const EXEC_MAP: Record<string, string> = {
  'H. NORMAL': 'hora_normal',
  'H. EXTRA': 'hora_extra',
  'H.E. Ad. Noturno': 'hora_extra_adicional_noturno',
  'H.E. Dom./Fer.': 'hora_extra_domingos_feriados',
  'H.E. Dom./Fer. Not.': 'hora_extra_domingos_feriados_noturno',
};
const execOptions = Object.keys(EXEC_MAP);

export function AddOperationalCostModal({ isOpen, onClose, onConfirm, defaultType }: AddOperationalCostModalProps) {
  const [tipoItem, setTipoItem] = useState<'PRODUTO' | 'SERVICO_PROPRIO'>('PRODUTO');
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [manHours, setManHours] = useState<any[]>([]);

  // Form states
  const [quantidade, setQuantidade] = useState(1);
  const [tipoCusto, setTipoCusto] = useState('MANUTENCAO');
  const [valorUnitario, setValorUnitario] = useState(0);
  const [formaExecucao, setFormaExecucao] = useState('H. NORMAL');
  const [calcError, setCalcError] = useState('');

  // Fetch ManHours only once per modal open
  useEffect(() => {
    if (isOpen) {
      setTipoItem('PRODUTO');
      setSearchTerm('');
      setResults([]);
      setSelectedProduct(null);
      setCalcError('');
      setFormaExecucao('H. NORMAL');
      setQuantidade(1);
      
      if (defaultType) {
        setTipoCusto(defaultType);
      } else {
        setTipoCusto('MANUTENCAO');
      }
      setTimeout(() => inputRef.current?.focus(), 100);

      api.get('/man-hours').then(res => setManHours(res.data)).catch(console.error);
    }
  }, [isOpen, defaultType]);

  // Handle Search Input Change
  useEffect(() => {
    if (selectedProduct) return;
    const delayDebounceFn = setTimeout(() => {
      async function fetchData() {
        if (!searchTerm || searchTerm.trim().length < 2) {
          setResults([]);
          return;
        }
        setIsSearching(true);
        try {
          if (tipoItem === 'PRODUTO') {
            const res = await api.get('/cadastro/produtos', { params: { q: searchTerm, limit: 50 } });
            const filtered = res.data.filter((p: any) => p.tipo === 'SERVICO' || p.tipo === 'LICENCA').slice(0, 20);
            setResults(filtered);
          } else {
            const res = await api.get('/own-services');
            const filtered = res.data.filter((s: any) => 
              s.nome_servico.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setResults(filtered);
          }
        } catch (err) {
          console.error('Erro ao buscar', err);
        } finally {
          setIsSearching(false);
        }
      }
      fetchData();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedProduct, tipoItem]);

  const handleSelectItem = async (item: any) => {
    if (tipoItem === 'PRODUTO') {
      setSelectedProduct({ ...item, isOwnService: false });
    } else {
      setIsFetchingDetail(true);
      try {
        const res = await api.get(`/own-services/${item.id}`);
        setSelectedProduct({ ...res.data, isOwnService: true });
      } catch (err) {
        console.error('Erro ao buscar detalhe do serviço', err);
      } finally {
        setIsFetchingDetail(false);
      }
    }
  };

  // Recalculate Logic
  useEffect(() => {
    if (!selectedProduct || isFetchingDetail) return;
    
    if (tipoItem === 'PRODUTO') {
      setCalcError('');
      // In product mode, only reset to reference value if it was just selected
      if (valorUnitario === 0) {
        setValorUnitario(selectedProduct.vlr_referencia_uso_consumo || selectedProduct.vlr_referencia_revenda || 0);
      }
    } else {
      // In OwnService mode, calculate LIVE
      let totalValue = 0;
      let error = '';
      const field = EXEC_MAP[formaExecucao];

      if (!selectedProduct.items || selectedProduct.items.length === 0) {
        error = 'Este Serviço Próprio não possui composição de cargos atrelada.';
      } else {
        for (const item of selectedProduct.items) {
          const mh = manHours.find(m => m.role_id === item.role_id);
          if (!mh || !mh[field] || parseFloat(mh[field]) === 0) {
            error = `Hora/Homem indisponível no sistema para preencher as exigências da forma de execução selecionada.`;
            break;
          }
          const unitPrice = parseFloat(mh[field]);
          totalValue += (unitPrice / 60) * parseInt(item.tempo_minutos || 0);
        }
      }
      setCalcError(error);
      if (!error) setValorUnitario(totalValue);
    }
  }, [selectedProduct, tipoItem, formaExecucao, manHours, isFetchingDetail]);

  const handleConfirm = () => {
    if (!selectedProduct || calcError) return;
    
    onConfirm({
      tipo_item: tipoItem,
      product: tipoItem === 'PRODUTO' ? selectedProduct : undefined,
      own_service: tipoItem === 'SERVICO_PROPRIO' ? selectedProduct : undefined,
      forma_execucao: tipoItem === 'SERVICO_PROPRIO' ? formaExecucao : undefined,
      quantidade,
      tipo_custo: tipoCusto,
      valor_unitario: valorUnitario,
      descricao_item: tipoItem === 'PRODUTO' ? selectedProduct.nome : selectedProduct.nome_servico,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-bg-subtle">
          <h3 className="font-semibold text-lg flex items-center gap-2 text-text-primary">
            <Search className="w-5 h-5 text-brand-primary" />
            Adicionar Custo Operacional (Serviço)
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-md transition-colors text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!selectedProduct ? (
          <>
            <div className="p-4 border-b border-border-subtle bg-bg-subtle">
              <div className="flex p-1 bg-border-subtle rounded-lg w-full mb-4">
                <button
                  onClick={() => { setTipoItem('PRODUTO'); setSearchTerm(''); setResults([]); }}
                  className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${tipoItem === 'PRODUTO' ? 'bg-white shadow-sm text-brand-primary' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Pesquisar Produto Existente
                </button>
                <button
                  onClick={() => { setTipoItem('SERVICO_PROPRIO'); setSearchTerm(''); setResults([]); }}
                  className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${tipoItem === 'SERVICO_PROPRIO' ? 'bg-white shadow-sm text-brand-primary' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Importar Serviço Próprio
                </button>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={`Digite o nome do ${tipoItem === 'PRODUTO' ? 'produto' : 'serviço'}...`}
                  className="w-full pl-10 pr-10 py-3 bg-white border border-border-subtle rounded-lg focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none transition-all text-text-primary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-primary w-5 h-5 animate-spin" />
                )}
                {searchTerm && !isSearching && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary bg-bg-deep rounded-full p-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Results Area */}
            <div className="overflow-y-auto flex-1 bg-white p-4">
              <div className="space-y-2">
                {!searchTerm && results.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted">
                    <PackageOpen className="w-12 h-12 mb-3 opacity-20" />
                    <p>Pesquise um {tipoItem === 'PRODUTO' ? 'produto' : 'serviço'} para adicionar como custo operacional.</p>
                  </div>
                )}

                {results.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className="flex items-center justify-between p-4 bg-bg-surface border border-border-subtle rounded-lg hover:border-brand-primary hover:shadow-sm cursor-pointer transition-all group"
                  >
                    <div className="flex flex-col overflow-hidden w-full pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-text-primary truncate">
                          {tipoItem === 'PRODUTO' ? item.nome : item.nome_servico}
                        </span>
                        {tipoItem === 'SERVICO_PROPRIO' && (
                          <span className="flex-none px-2 py-0.5 text-[10px] bg-brand-primary/10 text-brand-primary rounded font-semibold border border-brand-primary/20 uppercase">
                            Serviço Próprio
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                        {tipoItem === 'PRODUTO' && item.codigo_interno && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Cód:</span> {item.codigo_interno}
                          </span>
                        )}
                        {tipoItem === 'SERVICO_PROPRIO' && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Tempo Padrão:</span> {item.tempo_total_minutos} min
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {searchTerm.length >= 2 && results.length === 0 && !isSearching && (
                  <div className="flex flex-col items-center justify-center py-10 text-center bg-white border border-dashed border-border-subtle rounded-lg">
                    <p className="text-text-primary font-medium mb-1">Nenhum resultado encontrado</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : isFetchingDetail ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-text-muted">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-brand-primary" />
            <p className="font-medium">Carregando composição do serviço...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6 overflow-y-auto">
            <div className={`border rounded-lg p-4 flex items-start gap-4 ${tipoItem === 'PRODUTO' ? 'bg-brand-primary/5 border-brand-primary/20' : 'bg-purple-50 border-purple-200'}`}>
              <CheckCircle className={`w-6 h-6 shrink-0 mt-0.5 ${tipoItem === 'PRODUTO' ? 'text-brand-primary' : 'text-purple-600'}`} />
              <div>
                <h4 className="font-semibold text-text-primary">
                  {tipoItem === 'PRODUTO' ? selectedProduct.nome : selectedProduct.nome_servico}
                </h4>
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => setSelectedProduct(null)}>
                    Mudar Item Selecionado
                  </Button>
                </div>
              </div>
            </div>

            {calcError && (
              <div className="p-3 bg-brand-danger/10 border border-brand-danger/20 rounded-lg flex gap-3 items-center">
                <AlertTriangle className="text-brand-danger w-5 h-5 shrink-0" />
                <p className="text-sm text-brand-danger font-medium">{calcError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Tipo de Custo (Escopo)</label>
                <select
                  value={tipoCusto}
                  onChange={(e) => setTipoCusto(e.target.value)}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 text-text-primary"
                >
                  {COST_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {tipoItem === 'SERVICO_PROPRIO' && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Forma de Execução</label>
                  <select
                    value={formaExecucao}
                    onChange={(e) => setFormaExecucao(e.target.value)}
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50 text-text-primary"
                  >
                    {execOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Quantidade</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantidade}
                  onChange={(e) => setQuantidade(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 text-text-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Valor Unitário {tipoItem === 'SERVICO_PROPRIO' ? '(Automático Hora/Homem)' : '(R$)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  disabled={tipoItem === 'SERVICO_PROPRIO'}
                  value={(valorUnitario || 0).toFixed(2)}
                  onChange={(e) => setValorUnitario(parseFloat(e.target.value) || 0)}
                  className={`w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 text-text-primary ${tipoItem === 'SERVICO_PROPRIO' ? 'opacity-75 cursor-not-allowed bg-border-subtle' : ''}`}
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-muted mb-1">Cálculo Total Para Mensalidade</label>
                <div className="w-full px-4 py-3 border border-border-strong rounded-lg bg-bg-deep text-lg font-bold text-brand-primary">
                  {(quantidade * valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button variant="primary" onClick={handleConfirm} disabled={!!calcError}>Confirmar Custo Operacional</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
