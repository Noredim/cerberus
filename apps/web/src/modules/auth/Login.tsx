import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { Shield, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // Inicializar com o dark mode por default na tela de login
        if (!('theme' in localStorage) || localStorage.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const formData = new URLSearchParams();
            formData.append('username', email); // OAuth2 form password flow uses username
            formData.append('password', password);

            const response = await api.post('/auth/login', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            const { access_token } = response.data;

            // Immediately fetch user data with the new token
            const meResponse = await api.get('/auth/me', {
                headers: { Authorization: `Bearer ${access_token}` }
            });

            login(access_token, meResponse.data);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'E-mail ou senha incorretos.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-bg-deep">
            {/* Ambient Background Elements Removed for CoreUI Bright Solid Identity */}

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full max-w-md relative z-10"
            >
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand-primary ring-1 ring-brand-primary/20 shadow-sm">
                        <Shield className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-display font-bold text-text-primary tracking-tight mb-2">
                        Cerberus
                    </h1>
                    <p className="text-text-muted">Sales Engine & Inteligência Tributária</p>
                </div>

                {/* Login Card */}
                <div className="bg-bg-surface p-8 rounded-xl shadow-sm border border-border-subtle relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-brand-primary" />

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">E-mail Corporativo</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 pl-12 pr-4 text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                                        placeholder="nome@empresa.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">Senha</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 pl-12 pr-4 text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="flex items-center gap-2 p-3 rounded-md bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-sm"
                            >
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <p>{error}</p>
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white py-3 rounded-md font-medium hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-sm"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                'Acessar Plataforma'
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-text-muted text-sm mt-8">
                    &copy; 2026 Cerberus System. Todos os direitos reservados.
                </p>
            </motion.div>
        </div>
    );
};

export default Login;
