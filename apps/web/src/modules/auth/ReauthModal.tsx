import React, { useState, useEffect, useRef } from 'react';
import { Lock, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';

interface ReauthModalProps {
    isOpen: boolean;
    email: string;
    onSuccess: (token: string, userData: any) => void;
    onCancel: () => void;
}

export const ReauthModal: React.FC<ReauthModalProps> = ({
    isOpen,
    email,
    onSuccess,
    onCancel
}) => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const passwordInputRef = useRef<HTMLInputElement>(null);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Auto focus password input
            setTimeout(() => {
                passwordInputRef.current?.focus();
            }, 100);
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setError('');
        setLoading(true);

        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await api.post('/auth/login', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            const { access_token } = response.data;

            // Fetch profile data to make sure token is valid
            const meResponse = await api.get('/auth/me', {
                headers: { Authorization: `Bearer ${access_token}` }
            });

            onSuccess(access_token, meResponse.data);
            setPassword('');
        } catch (err: any) {
            console.error('Re-auth login failed:', err);
            setError(err.response?.data?.detail || 'Senha incorreta.');
            passwordInputRef.current?.focus();
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop layer */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9998] overflow-y-auto"
                    />

                    {/* Modal container */}
                    <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999] pointer-events-none">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="w-full max-w-md bg-bg-surface border border-border-subtle rounded-xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col relative"
                        >
                            {/* Color bar at top matching CoreUI Bright */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-brand-primary" />

                            <div className="p-6 space-y-6">
                                <div className="text-center space-y-2">
                                    <div className="bg-brand-primary/10 p-3 rounded-full mb-3 mx-auto w-fit">
                                        <Lock className="w-6 h-6 text-brand-primary" />
                                    </div>
                                    <h3 className="text-lg font-bold text-text-primary">Sessão Expirada</h3>
                                    <p className="text-xs text-text-muted">
                                        Para sua segurança e preservação de dados não salvos, insira sua senha para continuar trabalhando.
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-text-primary mb-1.5">
                                            E-mail Corporativo
                                        </label>
                                        <input
                                            type="email"
                                            disabled
                                            value={email}
                                            className="w-full bg-bg-deep/50 border border-border-subtle rounded-md py-2 px-3 text-xs text-text-muted outline-none cursor-not-allowed"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-text-primary mb-1.5">
                                            Senha
                                        </label>
                                        <input
                                            ref={passwordInputRef}
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                                            placeholder="Digite sua senha"
                                        />
                                    </div>

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center gap-2 p-3 rounded-md bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-xs"
                                        >
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            <p className="font-semibold">{error}</p>
                                        </motion.div>
                                    )}

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={onCancel}
                                            disabled={loading}
                                            className="flex-1 flex items-center justify-center gap-1.5 border border-border-subtle text-text-primary hover:bg-bg-deep py-2.5 rounded-md font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Sair
                                        </button>
                                        
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-primary hover:bg-brand-primary/95 text-white py-2.5 rounded-md font-medium text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                                        >
                                            {loading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                'Continuar'
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};
