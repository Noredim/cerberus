import React, { useEffect, useState } from 'react';
import {
    Activity,
    CheckCircle,
    XCircle,
    Clock,
    RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SyncJob {
    id: string;
    started_at: string;
    finished_at?: string;
    status: 'RUNNING' | 'SUCCESS' | 'FAILED';
    summary_json?: {
        states_created: number;
        states_updated: number;
        cities_created: number;
        cities_updated: number;
    };
    error_message?: string;
}

const SyncJobsList: React.FC = () => {
    const [jobs, setJobs] = useState<SyncJob[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchJobs = async () => {
        try {
            const response = await fetch('http://localhost:8000/catalog/integrations/ibge/sync-jobs');
            const data = await response.json();
            setJobs(data);
        } catch (error) {
            console.error('Error fetching jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
        const interval = setInterval(fetchJobs, 5000); // Polling every 5s
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6 w-full">
            <header>
                <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                    Histórico de <span className="text-brand-primary">Sincronização</span>
                </h1>
                <p className="text-text-muted mt-1">Monitore os processos de integração com o IBGE.</p>
            </header>

            <div className="grid gap-4">
                {loading && jobs.length === 0 ? (
                    <div className="bg-surface border border-border-subtle p-10 text-center text-text-muted rounded-lg shadow-sm">Carregando histórico...</div>
                ) : jobs.length === 0 ? (
                    <div className="bg-surface border border-border-subtle p-10 text-center text-text-muted rounded-lg shadow-sm">Nenhum job de sincronização encontrado.</div>
                ) : jobs.map((job) => (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={job.id}
                        className={`bg-surface p-6 rounded-lg shadow-sm border border-border-subtle border-l-4 ${job.status === 'SUCCESS' ? 'border-l-brand-success' :
                            job.status === 'FAILED' ? 'border-l-brand-danger' : 'border-l-brand-primary'
                            }`}
                    >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-md flex items-center justify-center ${job.status === 'SUCCESS' ? 'bg-brand-success/10 text-brand-success' :
                                    job.status === 'FAILED' ? 'bg-brand-danger/10 text-brand-danger' : 'bg-brand-primary/10 text-brand-primary'
                                    }`}>
                                    {job.status === 'RUNNING' ? <RefreshCw className="animate-spin" /> :
                                        job.status === 'SUCCESS' ? <CheckCircle /> : <XCircle />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-text-primary">IBGE Sync Operation</h3>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${job.status === 'SUCCESS' ? 'bg-brand-success/10 text-brand-success' :
                                            job.status === 'FAILED' ? 'bg-brand-danger/10 text-brand-danger' : 'bg-brand-primary/10 text-brand-primary'
                                            }`}>
                                            {job.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-text-muted mt-1">
                                        <span className="flex items-center gap-1"><Clock size={12} /> {new Date(job.started_at).toLocaleString('pt-BR')}</span>
                                        <span className="flex items-center gap-1"><Activity size={12} /> ID: {job.id.split('-')[0]}</span>
                                    </div>
                                </div>
                            </div>

                            {job.summary_json && job.status === 'SUCCESS' && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center border-t md:border-t-0 md:border-l border-border-subtle pt-4 md:pt-0 md:pl-8">
                                    <div>
                                        <p className="text-[10px] uppercase text-text-muted font-bold">UFs Criadas</p>
                                        <p className="text-lg font-bold text-text-primary">{job.summary_json.states_created}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase text-text-muted font-bold">UFs Atuais</p>
                                        <p className="text-lg font-bold text-text-primary">{job.summary_json.states_updated}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase text-text-muted font-bold">Mun. Criados</p>
                                        <p className="text-lg font-bold text-text-primary">{job.summary_json.cities_created}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase text-text-muted font-bold">Mun. Atuais</p>
                                        <p className="text-lg font-bold text-text-primary">{job.summary_json.cities_updated}</p>
                                    </div>
                                </div>
                            )}

                            {job.error_message && (
                                <div className="bg-brand-danger/10 border border-brand-danger/20 p-3 rounded-md mt-2 md:mt-0 max-w-md">
                                    <p className="text-xs text-brand-danger font-mono break-all">{job.error_message}</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default SyncJobsList;
