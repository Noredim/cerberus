import React, { useState, useRef } from 'react';
import { X, Camera, Key, LogOut, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
    const { user, login, logout } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
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
                let width = img.width;
                let height = img.height;

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
        } catch (error: any) {
            setPasswordError(error.response?.data?.detail || 'Erro ao alterar a senha. Verifique sua senha atual.');
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
                    <p className="text-sm text-text-muted text-center mb-6">{user.email}</p>

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
