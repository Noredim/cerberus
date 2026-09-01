import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const GoogleCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setLoading(false);
      setErrorMessage(`Autorização cancelada ou recusada: ${error}`);
      return;
    }

    if (!code || !state) {
      setLoading(false);
      setErrorMessage('Parâmetros de autorização ausentes na URL.');
      return;
    }

    const processCallback = async () => {
      try {
        const { data } = await api.post('/integrations/google/callback', { code, state });
        setSuccess(true);
        setConnectedEmail(data.google_email || null);
        
        // Notificar janelas abertas caso seja popup
        if (window.opener) {
          window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', email: data.google_email }, '*');
          setTimeout(() => {
            window.close();
          }, 1500);
        }
      } catch (err: any) {
        console.error('Erro no callback do Google:', err);
        const detail = err.response?.data?.detail || 'Falha ao concluir a autorização com o Google.';
        setErrorMessage(detail);
      } finally {
        setLoading(false);
      }
    };

    processCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-bg-deep flex items-center justify-center p-4">
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
        {loading ? (
          <div className="py-8 flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-brand-primary animate-spin mb-4" />
            <h2 className="text-lg font-bold text-text-primary">Conectando ao Google Calendar...</h2>
            <p className="text-xs text-text-muted mt-2">
              Validando tokens de autorização e configurando sincronização individual de tarefas.
            </p>
          </div>
        ) : success ? (
          <div className="py-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-text-primary">Google Calendar Conectado!</h2>
            <p className="text-sm text-text-muted mt-2">
              Sua conta <strong className="text-text-primary">{connectedEmail}</strong> foi vinculada com sucesso.
            </p>
            <p className="text-xs text-text-muted mt-1">
              Todos os seus compromissos e tarefas atribuídos no Cerberus serão sincronizados automaticamente.
            </p>

            <Button
              variant="primary"
              className="mt-6 w-full"
              onClick={() => navigate('/comercial/leads')}
            >
              Ir para Leads
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4">
              <AlertCircle className="w-10 h-10 text-rose-500" />
            </div>
            <h2 className="text-xl font-bold text-text-primary">Falha na Conexão</h2>
            <p className="text-sm text-rose-500 mt-2 font-medium">
              {errorMessage}
            </p>

            <Button
              variant="outline"
              className="mt-6 w-full"
              onClick={() => navigate('/')}
            >
              Voltar ao Início
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
