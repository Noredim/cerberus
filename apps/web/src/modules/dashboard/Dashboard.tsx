import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';

export function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background Decorativo Baseado no Tema */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-brand-primary/5 rounded-full blur-[100px]" />
        <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-brand-secondary/5 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center max-w-lg text-center"
      >
        <div className="bg-white p-6 rounded-2xl shadow-xl shadow-brand-primary/10 mb-8 border border-border-subtle">
          <img 
            src="/cerberus-logo.png" 
            alt="Cerberus Logo" 
            className="w-32 h-32 object-contain"
          />
        </div>
        
        <h1 className="text-3xl font-display font-bold text-text-primary mb-3">
          Bem-vindo ao Cerberus
        </h1>
        <p className="text-text-muted text-lg">
          Olá, <span className="font-semibold text-text-primary">{user?.name}</span>. Selecione um módulo no menu lateral para começar.
        </p>
      </motion.div>
    </div>
  );
}

export default Dashboard;
