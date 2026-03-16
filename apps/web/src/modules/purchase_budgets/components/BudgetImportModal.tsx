import { useState, useRef } from 'react';
import { UploadCloud, X, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../../services/api';
import { Button } from '../../../components/ui/Button';

interface BudgetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  onImportSuccess: (foundItems: any[], notFoundItems: any[]) => void;
}

export function BudgetImportModal({ isOpen, onClose, supplierId, onImportSuccess }: BudgetImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setError(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!supplierId) {
      setError('Por favor, selecione um Fornecedor no cabeçalho antes de importar.');
      return;
    }
    if (!file) {
      setError('Por favor, selecione um arquivo Excel.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/purchase-budgets/import/${supplierId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      onImportSuccess(response.data.encontrados || [], response.data.nao_encontrados || []);
      onClose();
      setFile(null); // reset state
    } catch (err: any) {
      console.error('Erro na importação', err);
      setError(err.response?.data?.detail || 'Ocorreu um erro ao processar a planilha. Verifique o formato.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-brand-primary text-white">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <UploadCloud className="w-5 h-5" />
            Importar Orçamento Excel
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 bg-brand-danger/10 text-brand-danger p-3 rounded-lg flex gap-2 items-start text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-brand-primary bg-brand-primary/5' : 'border-border-subtle hover:border-brand-primary/50'}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <label htmlFor="file-upload" className="sr-only">Upload de arquivo Excel</label>
            <input 
              id="file-upload"
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                   <UploadCloud className="w-6 h-6" />
                </div>
                <p className="font-medium text-text-primary text-sm mt-2">{file.name}</p>
                <p className="text-xs text-text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                <button 
                  onClick={() => setFile(null)} 
                  className="text-xs text-brand-danger hover:underline mt-2"
                >
                  Remover arquivo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                 <div className="w-12 h-12 bg-bg-deep text-text-muted rounded-full flex items-center justify-center">
                   <UploadCloud className="w-6 h-6" />
                 </div>
                 <p className="font-medium text-text-primary text-sm mt-2">
                   Arraste sua planilha para cá
                 </p>
                 <p className="text-xs text-text-muted mb-4">
                   ou
                 </p>
                 <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
                    Procurar arquivo no computador
                 </Button>
              </div>
            )}
          </div>
          
          <div className="mt-4 text-xs text-text-muted">
            <p className="font-semibold mb-1">Formato esperado (.xlsx):</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>A planilha deve conter uma aba com os dados na primeira posição.</li>
              <li>A primeira linha deve ser o cabeçalho.</li>
              <li>As colunas esperadas incluem: <span className="font-mono">codigo_fornecedor</span>, <span className="font-mono">ncm</span>, <span className="font-mono">valor_unitario</span>, etc. (Opcionais: frete_percent, ipi_percent, icms_percent).</li>
            </ul>
          </div>
        </div>

        <div className="p-4 border-t border-border-subtle bg-bg-deep flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleImport} disabled={!file || loading || !supplierId}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
            Importar
          </Button>
        </div>
      </div>
    </div>
  );
}
