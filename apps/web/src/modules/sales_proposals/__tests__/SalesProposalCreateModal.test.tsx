import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SalesProposalCreateModal } from '../SalesProposalCreateModal';

// Mock do auth context
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', name: 'Tester', roles: ['VENDEDOR'] },
  }),
}));

describe('SalesProposalCreateModal', () => {

  const renderComponent = (isOpen = true) => {
    return render(
        <MemoryRouter>
          <SalesProposalCreateModal isOpen={isOpen} onClose={vi.fn()} />
        </MemoryRouter>
    );
  };

  it('renders correctly when open', () => {
    renderComponent(true);
    expect(screen.getByText('Lançar Nova Proposta')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = renderComponent(false);
    expect(container).toBeEmptyDOMElement();
  });

  it('populates Responsavel automatically', () => {
    renderComponent(true);
    const input = screen.getByDisplayValue('Tester');
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();
  });
});
