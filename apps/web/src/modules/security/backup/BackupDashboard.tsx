import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Terminal,
  Layers,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { backupApi, type BackupSettings, type BackupFileItem } from '../../../services/backupApi';

type TabKey = 'config' | 'run' | 'list';

const CRON_PRESETS = [
  { label: 'Diariamente às 02:00 (Padrão)', value: '0 2 * * *' },
  { label: 'Diariamente à meia-noite', value: '0 0 * * *' },
  { label: 'A cada 12 Horas', value: '0 */12 * * *' },
  { label: 'A cada 6 Horas', value: '0 */6 * * *' },
  { label: 'Semanalmente (Domingo às 03:00)', value: '0 3 * * 0' },
];

export const BackupDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('config');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Status e Dados
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [files, setFiles] = useState<BackupFileItem[]>([]);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [backupResult, setBackupResult] = useState<{ success: boolean; message: string } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [targetIp, setTargetIp] = useState('');
  const [targetDir, setTargetDir] = useState('');
  const [sshUser, setSshUser] = useState('root');
  const [sshPort, setSshPort] = useState(22);
  const [sshPassword, setSshPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cronExpression, setCronExpression] = useState('0 2 * * *');
  const [retentionCount, setRetentionCount] = useState(3);
  const [isActive, setIsActive] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const data = await backupApi.getSettings();
      setSettings(data);
      setTargetIp(data.target_ip || '');
      setTargetDir(data.target_dir || '');
      setSshUser(data.ssh_user || 'root');
      setSshPort(data.ssh_port || 22);
      setCronExpression(data.cron_expression || '0 2 * * *');
      setRetentionCount(data.retention_count ?? 3);
      setIsActive(data.is_active || false);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Erro ao carregar configurações de backup.',
      });
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchFiles = async () => {
    try {
      setLoadingFiles(true);
      const data = await backupApi.listBackupFiles();
      setFiles(data);
    } catch (err: any) {
      console.error('Erro ao listar backups:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchFiles();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(false);
    setFeedback(null);
    try {
      setSavingSettings(true);
      const updated = await backupApi.updateSettings({
        target_ip: targetIp.trim() || null,
        target_dir: targetDir.trim() || null,
        ssh_user: sshUser.trim() || 'root',
        ssh_port: Number(sshPort) || 22,
        ssh_password: sshPassword ? sshPassword.trim() : undefined,
        cron_expression: cronExpression.trim() || '0 2 * * *',
        retention_count: Number(retentionCount) || 3,
        is_active: isActive,
      });

      setSettings(updated);
      setSshPassword('');
      setFeedback({
        type: 'success',
        message: 'Configurações de backup salvas e agendamento atualizado com sucesso!',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Falha ao salvar configurações de backup.',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await backupApi.testDestination({
        target_ip: targetIp.trim() || null,
        target_dir: targetDir.trim() || null,
        ssh_user: sshUser.trim() || 'root',
        ssh_port: Number(sshPort) || 22,
        ssh_password: sshPassword ? sshPassword.trim() : undefined,
        use_saved_password: !sshPassword && !!settings?.has_ssh_password,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.detail || err.message || 'Erro ao realizar teste de conexão.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRunBackupNow = async () => {
    setRunningBackup(true);
    setBackupResult(null);
    try {
      const res = await backupApi.runBackupNow();
      setBackupResult({
        success: true,
        message: res.message,
      });
      await fetchFiles();
      await fetchSettings();
    } catch (err: any) {
      setBackupResult({
        success: false,
        message: err.response?.data?.detail || 'Erro ao executar o backup manual.',
      });
    } finally {
      setRunningBackup(false);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (!window.confirm(`Deseja realmente excluir o arquivo de backup "${filename}"?`)) {
      return;
    }
    try {
      await backupApi.deleteBackupFile(filename);
      setFiles(prev => prev.filter(f => f.filename !== filename));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao excluir o arquivo de backup.');
    }
  };

  const handleDownloadFile = async (filename: string) => {
    try {
      const blob = await backupApi.downloadBackupFile(filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Falha ao realizar o download do backup.');
    }
  };

  const isRemote = targetIp.trim() !== '' && targetIp.trim() !== '127.0.0.1' && targetIp.trim().toLowerCase() !== 'localhost';

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary flex items-center gap-3">
          <Database className="w-8 h-8 text-brand-primary" />
          Backup do Sistema (PostgreSQL)
        </h1>
        <p className="text-text-muted max-w-3xl">
          Gerencie o backup automatizado do banco de dados Cerberus com compactação em tempo real e cópia remota opcional para servidores via SSH/SCP.
        </p>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border-subtle">
        <nav className="flex gap-1 -mb-px">
          <button
            onClick={() => setActiveTab('config')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'config'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-muted hover:text-text-primary hover:border-border-subtle'
            }`}
          >
            <Server className="w-4 h-4" />
            Configuração & SSH
          </button>
          <button
            onClick={() => setActiveTab('run')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'run'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-muted hover:text-text-primary hover:border-border-subtle'
            }`}
          >
            <Play className="w-4 h-4" />
            Execução Manual & Status
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'list'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-muted hover:text-text-primary hover:border-border-subtle'
            }`}
          >
            <Layers className="w-4 h-4" />
            Arquivos de Backup ({files.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* TAB 1: CONFIGURAÇÃO */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            {loadingSettings ? (
              <div className="p-8 text-center text-text-muted">Carregando configurações...</div>
            ) : (
              <form onSubmit={handleSaveSettings} className="space-y-6">
                {/* Switch Ativar/Desativar */}
                <div className="p-5 bg-card-bg border border-border-subtle rounded-xl flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <span className="text-base font-semibold text-text-primary flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-brand-primary" />
                      Agendamento Automático via Cron
                    </span>
                    <p className="text-xs text-text-muted">
                      Ative para disparar backups periódicos automaticamente segundo a expressão Cron configurada.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={e => setIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-border-subtle peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                  </label>
                </div>

                {/* Bloco Destino Remoto / SSH */}
                <div className="p-6 bg-card-bg border border-border-subtle rounded-xl space-y-4">
                  <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                    <Server className="w-5 h-5 text-brand-primary" />
                    Destino do Backup (Local ou VM Remota)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-text-muted mb-1">
                        IP da VM Remota / Host (Deixe vazio ou "127.0.0.1" para Apenas Local)
                      </label>
                      <input
                        type="text"
                        value={targetIp}
                        onChange={e => setTargetIp(e.target.value)}
                        placeholder="Ex: 192.168.100.200"
                        className="w-full px-3 py-2 bg-input-bg border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text-muted mb-1">
                        Diretório Destino ({isRemote ? 'Remoto na VM' : 'Local no Servidor'})
                      </label>
                      <input
                        type="text"
                        value={targetDir}
                        onChange={e => setTargetDir(e.target.value)}
                        placeholder="Ex: /var/backups/cerberus"
                        className="w-full px-3 py-2 bg-input-bg border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>

                  {/* Parâmetros SSH se IP for remoto */}
                  {isRemote && (
                    <div className="p-4 bg-background border border-border-subtle rounded-lg space-y-4">
                      <div className="text-xs font-semibold text-brand-primary flex items-center gap-1.5">
                        <Terminal className="w-4 h-4" />
                        Autenticação SSH / SCP (Via Usuário e Senha sem Chave Pública)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-text-muted mb-1">Usuário SSH</label>
                          <input
                            type="text"
                            value={sshUser}
                            onChange={e => setSshUser(e.target.value)}
                            placeholder="root"
                            className="w-full px-3 py-2 bg-input-bg border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-text-muted mb-1">Porta SSH</label>
                          <input
                            type="number"
                            value={sshPort}
                            onChange={e => setSshPort(Number(e.target.value))}
                            placeholder="22"
                            className="w-full px-3 py-2 bg-input-bg border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-text-muted mb-1">
                            Senha SSH {settings?.has_ssh_password && '(Senha Cadastrada)'}
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={sshPassword}
                              onChange={e => setSshPassword(e.target.value)}
                              placeholder={settings?.has_ssh_password ? '•••••••• (Manter Senha)' : 'Digite a senha SSH'}
                              className="w-full px-3 py-2 pr-10 bg-input-bg border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-2.5 text-text-muted hover:text-text-primary"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botão de Teste de Conexão */}
                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testingConnection}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-card-bg border border-border-subtle hover:border-brand-primary text-text-primary hover:text-brand-primary text-xs font-bold rounded-lg transition-all"
                    >
                      {testingConnection ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Testando Destino...
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" /> Testar Conexão / Pasta Destino
                        </>
                      )}
                    </button>
                  </div>

                  {/* Resultado do Teste */}
                  {testResult && (
                    <div
                      className={`p-3 rounded-lg text-xs font-medium border flex items-center gap-2 ${
                        testResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>

                {/* Bloco Cron & Retenção */}
                <div className="p-6 bg-card-bg border border-border-subtle rounded-xl space-y-4">
                  <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                    <Clock className="w-5 h-5 text-brand-primary" />
                    Periodicidade (Cron) e Política de Retenção
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-text-muted mb-1">
                        Expressão Cron de Agendamento
                      </label>
                      <input
                        type="text"
                        value={cronExpression}
                        onChange={e => setCronExpression(e.target.value)}
                        placeholder="0 2 * * *"
                        className="w-full px-3 py-2 bg-input-bg border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary font-mono"
                      />
                      {/* Atalhos Cron */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {CRON_PRESETS.map(p => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setCronExpression(p.value)}
                            className="px-2 py-1 text-[10px] bg-background hover:bg-border-subtle border border-border-subtle rounded text-text-muted hover:text-text-primary transition-all"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text-muted mb-1">
                        Política de Retenção (Manter últimos X arquivos)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={retentionCount}
                        onChange={e => setRetentionCount(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-input-bg border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                      />
                      <p className="mt-1 text-[11px] text-text-muted">
                        Ao gerar um novo backup, arquivos locais antigos excedentes serão removidos automaticamente.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-brand-primary/90 transition-all shadow-md"
                  >
                    {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Salvar Configurações
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: EXECUÇÃO MANUAL E STATUS */}
        {activeTab === 'run' && (
          <div className="space-y-6">
            {/* Status do Último Backup */}
            <div className="p-6 bg-card-bg border border-border-subtle rounded-xl space-y-4 shadow-sm">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Clock className="w-5 h-5 text-brand-primary" />
                Status da Última Execução de Backup
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-background border border-border-subtle rounded-lg">
                  <div className="text-xs font-semibold text-text-muted">Data/Hora da Última Execução</div>
                  <div className="mt-1 text-sm font-bold text-text-primary">
                    {settings?.last_backup_at
                      ? new Date(settings.last_backup_at).toLocaleString('pt-BR')
                      : 'Nenhum backup registrado'}
                  </div>
                </div>

                <div className="p-4 bg-background border border-border-subtle rounded-lg">
                  <div className="text-xs font-semibold text-text-muted">Resultado</div>
                  <div className="mt-1 flex items-center gap-2">
                    {settings?.last_backup_status === 'SUCCESS' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> SUCESSO
                      </span>
                    ) : settings?.last_backup_status === 'FAILED' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-full">
                        <AlertCircle className="w-3.5 h-3.5" /> FALHA
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-text-muted">Pendente</span>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-background border border-border-subtle rounded-lg">
                  <div className="text-xs font-semibold text-text-muted">Status do Agendamento</div>
                  <div className="mt-1 text-sm font-bold">
                    {settings?.is_active ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Ativo ({settings.cron_expression})
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" /> Inativo
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {settings?.last_backup_message && (
                <div className="p-3 bg-background border border-border-subtle rounded-lg text-xs font-mono text-text-muted">
                  <strong>Log de Detalhes:</strong> {settings.last_backup_message}
                </div>
              )}
            </div>

            {/* Painel de Execução Manual */}
            <div className="p-6 bg-card-bg border border-border-subtle rounded-xl space-y-4 shadow-sm">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Play className="w-5 h-5 text-brand-primary" />
                  Geração Manual de Backup Agora
                </h3>
                <p className="text-xs text-text-muted">
                  Gera imediatamente o arquivo compactado <code>.sql.gz</code> do banco de dados PostgreSQL e sincroniza com o destino configurado.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleRunBackupNow}
                  disabled={runningBackup}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-brand-primary/90 transition-all shadow-md disabled:opacity-50"
                >
                  {runningBackup ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Gerando e Enviando Backup...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" /> Executar Backup Agora
                    </>
                  )}
                </button>
              </div>

              {backupResult && (
                <div
                  className={`p-4 rounded-lg text-xs font-medium border flex items-center gap-2 ${
                    backupResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {backupResult.success ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                  <span>{backupResult.message}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: LISTA DE ARQUIVOS DE BACKUP */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Layers className="w-5 h-5 text-brand-primary" />
                Histórico de Arquivos Locais ({files.length})
              </h3>
              <button
                type="button"
                onClick={fetchFiles}
                disabled={loadingFiles}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card-bg border border-border-subtle hover:border-brand-primary text-xs font-semibold text-text-primary rounded-lg transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} /> Atualizar Lista
              </button>
            </div>

            {loadingFiles ? (
              <div className="p-8 text-center text-text-muted">Carregando lista de arquivos...</div>
            ) : files.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-border-subtle rounded-xl bg-card-bg text-text-muted">
                <Database className="w-12 h-12 mx-auto text-text-muted/40 mb-2" />
                Nenhum arquivo de backup gerado até o momento.
              </div>
            ) : (
              <div className="overflow-x-auto border border-border-subtle rounded-xl bg-card-bg shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-background text-text-muted text-xs font-semibold uppercase border-b border-border-subtle">
                    <tr>
                      <th className="px-4 py-3">Nome do Arquivo</th>
                      <th className="px-4 py-3">Tamanho</th>
                      <th className="px-4 py-3">Data de Criação</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-text-primary">
                    {files.map(f => (
                      <tr key={f.filename} className="hover:bg-background/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-brand-primary">
                          {f.filename}
                        </td>
                        <td className="px-4 py-3 font-medium text-xs">
                          {f.size_formatted}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-muted">
                          {new Date(f.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(f.filename)}
                            className="p-1.5 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-all"
                            title="Baixar Backup"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFile(f.filename)}
                            className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                            title="Excluir Backup"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupDashboard;
