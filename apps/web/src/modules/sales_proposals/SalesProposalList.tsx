import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { SalesProposalCreateModal } from './SalesProposalCreateModal';
import Modal from '../../components/modals/Modal';
import { AlertCircle } from 'lucide-react';

export const SalesProposalList: React.FC = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Modal States
    const [proposalToDelete, setProposalToDelete] = useState<any>(null);
    const [proposalValidationError, setProposalValidationError] = useState<any>(null);

    const [proposals, setProposals] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadProposals = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/sales-proposals');
            setProposals(res.data);
        } catch (error) {
            console.error('Error fetching proposals:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadProposals();
    }, []);

    const triggerDelete = (proposal: any) => {
        if (proposal.kits && proposal.kits.length > 0) {
            setProposalValidationError(proposal);
        } else {
            setProposalToDelete(proposal);
        }
    };

    const handleDelete = async () => {
        if (!proposalToDelete) return;
        
        try {
            await api.delete(`/sales-proposals/${proposalToDelete.id}`);
            // Simple visual feedback instead of alert
            const updatedProposals = proposals.filter((p: any) => p.id !== proposalToDelete.id);
            setProposals(updatedProposals);
            setProposalToDelete(null);
        } catch (error: any) {
            console.error('Erro ao excluir proposta:', error);
            // Mostra o erro do backend se falhar
            setProposalValidationError({
                numero_proposta: proposalToDelete.numero_proposta,
                backendError: error.response?.data?.detail || 'Erro ao excluir proposta.'
            });
            setProposalToDelete(null);
        }
    };

    const filteredProposals = proposals.filter((p: any) => 
        p.numero_proposta.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.titulo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Propostas de Venda</h1>
                    <p className="text-text-muted">Gerencie as propostas comerciais (independentes de oportunidades).</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md hover:bg-brand-primary/90 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Lançar na Proposta
                </button>
            </div>

            <div className="bg-surface rounded-lg shadow-sm border border-border-subtle">
                <div className="p-4 border-b border-border-subtle">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Buscar por número ou título..."
                            className="w-full bg-bg-deep border border-border-subtle rounded-md pl-9 pr-4 py-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none text-text-primary"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-bg-deep border-b border-border-subtle">
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Nº da Proposta</th>
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Título</th>
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">Criado Em</th>
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-text-muted">Carregando propostas...</td>
                                </tr>
                            ) : filteredProposals.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-text-muted">Nenhuma proposta encontrada.</td>
                                </tr>
                            ) : (
                                filteredProposals.map((proposal: any) => (
                                    <tr key={proposal.id} className="hover:bg-bg-deep/50 transition-colors">
                                        <td className="py-3 px-4 text-sm font-medium text-brand-primary">
                                            {proposal.numero_proposta}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-text-primary">
                                            {proposal.titulo}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary`}>
                                                {proposal.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-text-muted text-right">
                                            {new Date(proposal.created_at).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/comercial/propostas/${proposal.id}`)}
                                                    className="p-1.5 text-text-muted hover:text-brand-primary rounded-md hover:bg-brand-primary/10 transition-colors"
                                                    title="Visualizar/Editar"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => triggerDelete(proposal)}
                                                    className="p-1.5 text-text-muted hover:text-brand-danger rounded-md hover:bg-brand-danger/10 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <SalesProposalCreateModal 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)} 
            />
            
            <Modal
                isOpen={!!proposalToDelete}
                onClose={() => setProposalToDelete(null)}
                title="Excluir Proposta"
                description={`Deseja realmente excluir a proposta ${proposalToDelete?.numero_proposta}? Esta ação não pode ser desfeita.`}
            >
                <div className="flex justify-end gap-3 mt-6">
                    <button 
                        type="button"
                        className="px-4 py-2 border border-border-subtle bg-bg-surface text-text-primary rounded-md font-medium hover:bg-bg-deep transition-colors" 
                        onClick={() => setProposalToDelete(null)}
                    >
                        Cancelar
                    </button>
                    <button 
                        type="button"
                        className="px-4 py-2 bg-brand-danger text-white rounded-md font-medium hover:bg-brand-danger/90 transition-colors" 
                        onClick={handleDelete}
                    >
                        Sim, Excluir
                    </button>
                </div>
            </Modal>
            
            <Modal
                isOpen={!!proposalValidationError}
                onClose={() => setProposalValidationError(null)}
                title="Ação Restrita"
            >
                <div className="flex flex-col items-center justify-center p-4 text-center">
                    <AlertCircle className="w-12 h-12 text-brand-warning mb-4" />
                    <p className="text-text-primary font-medium mb-2">
                        Não é possível excluir a proposta {proposalValidationError?.numero_proposta}.
                    </p>
                    <p className="text-text-muted text-sm mb-6">
                        {proposalValidationError?.backendError || "Devido a vínculos de kits ativos em seu interior, o sistema bloqueou esta exclusão de segurança. Remova os kits internamente primeiro ou inative a proposta."}
                    </p>
                    <button 
                        type="button"
                        className="w-full px-4 py-2 bg-bg-deep text-text-primary border border-border-subtle rounded-md font-medium hover:bg-bg-hover transition-colors" 
                        onClick={() => setProposalValidationError(null)}
                    >
                        Entendi
                    </button>
                </div>
            </Modal>
        </div>
    );
};
