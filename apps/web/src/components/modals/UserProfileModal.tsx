import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Key, LogOut, Check, Loader2, Download, Calendar, Unlink, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { versionInfo } from '../../version';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface CustomWindow extends Window {
    deferredPrompt?: BeforeInstallPromptEvent | null;
}

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
    const { user, login, logout } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [isPwa, setIsPwa] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsPwa(
                window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as Navigator & { standalone?: boolean }).standalone === true
            );

            const win = window as unknown as CustomWindow;
            if (win.deferredPrompt) {
                setDeferredPrompt(win.deferredPrompt);
            }

            const handlePromptAvailable = (e: Event) => {
                const customEvent = e as CustomEvent<BeforeInstallPromptEvent>;
                setDeferredPrompt(customEvent.detail || win.deferredPrompt);
            };

            const handleAppInstalled = () => {
                setIsPwa(true);
                setDeferredPrompt(null);
            };

            window.addEventListener('pwa-prompt-available', handlePromptAvailable);
            window.addEventListener('pwa-installed-success', handleAppInstalled);
            window.addEventListener('appinstalled', handleAppInstalled);

            return () => {
                window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
                window.removeEventListener('pwa-installed-success', handleAppInstalled);
                window.removeEventListener('appinstalled', handleAppInstalled);
            };
        }
    }, []);

    const handleInstallPwa = async () => {
        const win = window as unknown as CustomWindow;
        const promptEvent = deferredPrompt || win.deferredPrompt;
        if (!promptEvent) return;

        promptEvent.prompt();
        try {
            const choiceResult = await promptEvent.userChoice;
            if (choiceResult.outcome === 'accepted') {
                console.log('[PWA] User accepted the installation from Profile Modal');
                setIsPwa(true);
                window.dispatchEvent(new CustomEvent('pwa-installed-success'));
            } else {
                console.log('[PWA] User dismissed the installation from Profile Modal');
            }
        } catch (err) {
            console.error('[PWA] Install prompt error:', err);
        } finally {
            setDeferredPrompt(null);
            win.deferredPrompt = null;
            window.dispatchEvent(new CustomEvent('pwa-prompt-resolved'));
        }
    };
    
    const [isUploading, setIsUploading] = useState(false);
    const [pendingAvatarBase64, setPendingAvatarBase64] = useState<string | null>(null);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    
    // Password Form State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    // Google Calendar State
    const [googleStatus, setGoogleStatus] = useState<any | null>(null);
    const [loadingGoogle, setLoadingGoogle] = useState(false);
    const [googleActionLoading, setGoogleActionLoading] = useState(false);

    const fetchGoogleStatus = useCallback(async () => {
        try {
            setLoadingGoogle(true);
            const { data } = await api.get('/integrations/google/status');
            setGoogleStatus(data);
        } catch (err) {
            console.error('Erro ao buscar status do Google Calendar:', err);
        } finally {
            setLoadingGoogle(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen && user) {
            fetchGoogleStatus();
        }
    }, [isOpen, user, fetchGoogleStatus]);

    // Escutar mensagem do callback em popup
    useEffect(() => {
        const handleAuthMessage = (e: MessageEvent) => {
            if (e.data && e.data.type === 'GOOGLE_AUTH_SUCCESS') {
                fetchGoogleStatus();
            }
        };
        window.addEventListener('message', handleAuthMessage);
        return () => window.removeEventListener('message', handleAuthMessage);
    }, [fetchGoogleStatus]);

    const handleConnectGoogle = async () => {
        try {
            setGoogleActionLoading(true);
            const { data } = await api.get('/integrations/google/auth-url');
            if (data.auth_url) {
                // Abrir popup de autorização
                const width = 500;
                const height = 600;
                const left = window.screenX + (window.outerWidth - width) / 2;
                const top = window.screenY + (window.outerHeight - height) / 2;
                window.open(
                    data.auth_url,
                    'Google Calendar OAuth',
                    `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
                );
            }
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao iniciar conexão com o Google.');
        } finally {
            setGoogleActionLoading(false);
        }
    };

    const handleDisconnectGoogle = async () => {
        if (!confirm('Deseja realmente desconectar sua conta Google Calendar? As tarefas continuarão no Cerberus, mas novas tarefas não serão sincronizadas.')) {
            return;
        }

        try {
            setGoogleActionLoading(true);
            await api.post('/integrations/google/disconnect');
            await fetchGoogleStatus();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao desconectar Google Calendar.');
        } finally {
            setGoogleActionLoading(false);
        }
    };

    if (!isOpen || !user) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Limites do Whatsapp geralmente em torno de 192x192
        const MAX_WIDTH = 192;
        const MAX_HEIGHT = 192;
        
        setIsUploading(true);
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const width = img.width;
                const height = img.height;

                // Calcula a nova dimensão mantendo aspecto cortado
                const size = Math.min(width, height);
                const sx = (width - size) / 2;
                const sy = (height - size) / 2;

                canvas.width = MAX_WIDTH;
                canvas.height = MAX_HEIGHT;

                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, sx, sy, size, size, 0, 0, MAX_WIDTH, MAX_HEIGHT);

                const base64String = canvas.toDataURL('image/jpeg', 0.8);
                setPendingAvatarBase64(base64String);
                setIsUploading(false);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleUploadBase64 = async () => {
        if (!pendingAvatarBase64) return;
        setIsUploading(true);
        try {
            await api.put('/users/me/profile-picture', { profile_picture: pendingAvatarBase64 });
            // Atualizar o contexto local
            const token = sessionStorage.getItem('@Cerberus:token');
            if (token) {
                login(token, { ...user, profile_picture: pendingAvatarBase64 });
            }
            setPendingAvatarBase64(null);
        } catch (error) {
            console.error('Failed to upload picture', error);
            alert('Não foi possível salvar a foto. Tente novamente.');
        } finally {
            setIsUploading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess(false);

        if (newPassword !== confirmPassword) {
            setPasswordError('A nova senha e a confirmação não coincidem.');
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError('A nova senha deve ter no mínimo 6 caracteres.');
            return;
        }

        setIsSavingPassword(true);
        try {
            await api.put('/users/me/reset-password', {
                current_password: currentPassword,
                new_password: newPassword
            });
            setPasswordSuccess(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                setShowPasswordForm(false);
                setPasswordSuccess(false);
            }, 2000);
        } catch (error) {
            const err = error as { response?: { data?: { detail?: string } } };
            setPasswordError(err.response?.data?.detail || 'Erro ao alterar a senha. Verifique sua senha atual.');
        } finally {
            setIsSavingPassword(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface rounded-xl shadow-2xl w-full max-w-sm flex flex-col border border-border-subtle overflow-hidden"
            >
                {/* Header Actions */}
                <div className="flex justify-end p-2 bg-bg-subtle border-b border-border-subtle">
                    <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-deep rounded-md transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 flex flex-col items-center">
                    {/* Avatar Upload */}
                    <div className="relative mb-4 group">
                        <div className="w-24 h-24 rounded-full border-4 border-surface shadow-md overflow-hidden bg-bg-deep relative">
                            {pendingAvatarBase64 ? (
                                <img src={pendingAvatarBase64} alt="Profile" className="w-full h-full object-cover" />
                            ) : user.profile_picture ? (
                                <img src={user.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-brand-primary text-white text-3xl font-bold">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            
                            {/* Overlay Click */}
                            <div 
                                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {isUploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
                            </div>
                        </div>
                        <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            className="hidden" 
                        />
                    </div>

                    {/* Avatar Confirmation */}
                    <AnimatePresence>
                        {pendingAvatarBase64 && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex gap-2 w-full mb-4"
                            >
                                <button
                                    onClick={() => {
                                        setPendingAvatarBase64(null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                    className="flex-1 py-1.5 text-xs font-semibold text-text-muted hover:text-text-primary bg-surface border border-border-subtle rounded-md"
                                    disabled={isUploading}
                                >
                                    Cancelar Foto
                                </button>
                                <button
                                    onClick={handleUploadBase64}
                                    className="flex-1 py-1.5 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primary-hover rounded-md flex items-center justify-center gap-1 disabled:opacity-70 disabled:pointer-events-none"
                                    disabled={isUploading}
                                >
                                    {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3" /> Salvar Foto</>}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <h2 className="text-lg font-bold text-text-primary text-center leading-tight mb-1">{user.name}</h2>
                    <p className="text-sm text-text-muted text-center mb-4">{user.email}</p>

                    {/* Version & PWA Mode Label (P3 & P6) */}
                    <div className="w-full bg-bg-deep rounded-lg p-3 text-center border border-border-subtle mb-4">
                        <p className="text-xs font-bold text-text-primary">Cerberus</p>
                        <p className="text-[11px] text-text-muted mt-0.5">Versão: {versionInfo.version} (Build: {versionInfo.buildDate})</p>
                        <p className={`text-[11px] font-semibold mt-1 transition-colors ${isPwa ? 'text-brand-success' : 'text-brand-primary'}`}>
                            {isPwa ? 'PWA Instalado' : 'Executando via Navegador'}
                        </p>

                        {!isPwa && deferredPrompt && (
                            <motion.button
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={handleInstallPwa}
                                className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-lg shadow-sm hover:shadow hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                            >
                                <Download className="w-3.5 h-3.5" /> Instalar Aplicativo (PWA)
                            </motion.button>
                        )}
                    </div>

                    {/* Google Calendar Integration Card */}
                    <div className="w-full bg-bg-deep rounded-xl p-3.5 border border-border-subtle mb-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
                                    <Calendar className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                    <h4 className="text-xs font-bold text-text-primary">Google Calendar</h4>
                                    <p className="text-[10px] text-text-muted">Sincronização de tarefas e visitas</p>
                                </div>
                            </div>

                            {loadingGoogle ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />
                            ) : googleStatus?.is_connected ? (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                                    Conectado
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-bg-surface text-text-muted border border-border-subtle">
                                    Não vinculado
                                </span>
                            )}
                        </div>

                        {googleStatus?.is_connected ? (
                            <div className="space-y-2 mt-2 pt-2 border-t border-border-subtle text-left">
                                <p className="text-[11px] text-text-primary font-medium truncate">
                                    Conta: <span className="font-bold">{googleStatus.google_email}</span>
                                </p>
                                {googleStatus.last_error_message && (
                                    <p className="text-[10px] text-rose-500 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3 shrink-0" />
                                        {googleStatus.last_error_message}
                                    </p>
                                )}
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={handleDisconnectGoogle}
                                        disabled={googleActionLoading}
                                        className="w-full py-1.5 px-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-semibold rounded-lg border border-rose-500/20 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
                                    >
                                        <Unlink className="w-3 h-3" /> Desconectar Agenda
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-2 pt-2 border-t border-border-subtle">
                                <button
                                    onClick={handleConnectGoogle}
                                    disabled={googleActionLoading}
                                    className="w-full py-2 px-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-text-primary text-xs font-bold rounded-lg border border-border-subtle flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-60"
                                >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                    </svg>
                                    Conectar Google Calendar
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="w-full space-y-3">
                        {!showPasswordForm ? (
                            <button 
                                onClick={() => setShowPasswordForm(true)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-bg-deep border border-border-subtle text-text-primary text-sm font-semibold rounded-lg hover:bg-border-subtle/40 transition-colors"
                            >
                                <Key className="w-4 h-4" /> Resetar Senha
                            </button>
                        ) : (
                            <div className="w-full bg-bg-subtle p-4 rounded-lg border border-border-subtle space-y-3">
                                <h3 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
                                    <Key className="w-4 h-4 text-brand-primary" /> Trocar Senha
                                </h3>
                                
                                <form onSubmit={handlePasswordSubmit} className="space-y-3">
                                    <div>
                                        <input 
                                            type="password" 
                                            placeholder="Senha Atual" 
                                            required
                                            value={currentPassword}
                                            onChange={e => setCurrentPassword(e.target.value)}
                                            className="w-full px-3 py-2 border border-border-subtle rounded-md bg-surface text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary" 
                                        />
                                    </div>
                                    <div>
                                        <input 
                                            type="password" 
                                            placeholder="Nova Senha" 
                                            required
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            className="w-full px-3 py-2 border border-border-subtle rounded-md bg-surface text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary" 
                                        />
                                    </div>
                                    <div>
                                        <input 
                                            type="password" 
                                            placeholder="Confirme a Nova Senha" 
                                            required
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            className="w-full px-3 py-2 border border-border-subtle rounded-md bg-surface text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary" 
                                        />
                                    </div>

                                    {passwordError && <p className="text-xs text-brand-danger font-medium leading-tight">{passwordError}</p>}
                                    {passwordSuccess && <p className="text-xs text-brand-primary font-medium flex items-center gap-1"><Check className="w-3 h-3" /> Senha atualizada!</p>}

                                    <div className="flex gap-2 pt-1">
                                        <button 
                                            type="button"
                                            onClick={() => setShowPasswordForm(false)}
                                            className="flex-1 py-2 text-xs font-semibold text-text-muted hover:text-text-primary bg-surface border border-border-subtle rounded-md"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            type="submit"
                                            disabled={isSavingPassword || passwordSuccess}
                                            className="flex-1 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primary-hover rounded-md flex items-center justify-center gap-1 disabled:opacity-70 disabled:pointer-events-none"
                                        >
                                            {isSavingPassword ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        <button 
                            onClick={() => {
                                onClose();
                                logout();
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-sm font-semibold rounded-lg hover:bg-brand-danger hover:text-white transition-colors cursor-pointer"
                        >
                            <LogOut className="w-4 h-4 shrink-0" /> Sair do Sistema
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default UserProfileModal;
