import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SalesProposalForm } from '../SalesProposalForm';

// Mock do auth context
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-2', name: 'Leitor', roles: ['FINANCEIRO'] }, // A role with no write access to Sales Proposals
  }),
}));

describe('SalesProposalForm', () => {

    const renderComponent = () => {
        return render(
                <MemoryRouter initialEntries={['/comercial/propostas/teste-123']}>
                    <Routes>
                        <Route path="/comercial/propostas/:id" element={<SalesProposalForm />} />
                    </Routes>
                </MemoryRouter>
        );
    };

    it('renders the details layout', () => {
        renderComponent();
        expect(screen.getByText('Detalhes da Proposta')).toBeInTheDocument();
        expect(screen.getByText('Itens Comerciais (Kits)')).toBeInTheDocument();
    });

    it('renders ReadOnly alert when user has no access', () => {
        // Here we simulate the logic where the user role triggers "Somente Leitura" mode.
        // Needs the form to have dynamic `isReadOnly` set by `useAuth` hook details.
        
        // This is a placeholder test waiting for business logic implementation in the component
        // expect(screen.getByText('Somente Leitura')).toBeInTheDocument();
        // expect(screen.getByRole('button', { name: /Aplicar aos Kits/i })).toBeDisabled();
    });
});
