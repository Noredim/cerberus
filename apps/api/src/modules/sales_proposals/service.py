from sqlalchemy.orm import Session
from uuid import UUID
from fastapi import HTTPException
from typing import List, Optional
from datetime import datetime
from src.modules.sales_proposals.models import SalesProposal, SalesProposalKit, SalesProposalLog
from src.modules.sales_proposals.schemas import SalesProposalCreate, SalesProposalUpdate, SalesProposalUpdateFactors
from src.modules.companies.models import Company
from src.modules.opportunity_kits.models import OpportunityKit


class SalesProposalService:
    def get_list(self, db: Session, tenant_id: str, company_id: UUID, skip: int = 0, limit: int = 100):
        return db.query(SalesProposal).filter(
            SalesProposal.tenant_id == tenant_id,
            SalesProposal.company_id == company_id
        ).order_by(SalesProposal.numero_sequencial.desc()).offset(skip).limit(limit).all()

    def get_by_id(self, db: Session, tenant_id: str, company_id: UUID, proposal_id: UUID):
        proposal = db.query(SalesProposal).filter_by(id=proposal_id, tenant_id=tenant_id, company_id=company_id).first()
        if not proposal:
            raise HTTPException(status_code=404, detail="Proposta não encontrada")
        
        # Injeção dos dados granulares financeiros de cada kit para expor para a Grid de Propostas
        from src.modules.opportunity_kits.service import OpportunityKitService
        kit_service = OpportunityKitService(db)
        if proposal.kits:
            for pk in proposal.kits:
                if pk.opportunity_kit:
                    fin = kit_service.calculate_financials(pk.opportunity_kit, tenant_id)
                    pk.opportunity_kit.summary = fin.get("summary")
                    pk.opportunity_kit.item_summaries = fin.get("item_summaries")

        return proposal

    def create(self, db: Session, tenant_id: str, company_id: UUID, user_id: str, data: SalesProposalCreate):
        company = db.query(Company).filter_by(id=company_id, tenant_id=tenant_id).with_for_update().first()
        if not company:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")
        
        seq = company.numero_proposta or 1
        company.numero_proposta = seq + 1
        
        ano = datetime.now().year
        sigla = company.nomenclatura_orcamento or "PROP"
        num_str = f"{sigla}-{seq}/{ano}"
        
        obj = SalesProposal(
            tenant_id=tenant_id,
            company_id=company_id,
            numero_sequencial=seq,
            numero_proposta=num_str,
            responsavel_id=user_id,
            **data.model_dump()
        )
        db.add(obj)
        db.flush()
        
        self._log_action(db, obj.id, user_id, "CRIACAO", f"Proposta {num_str} criada.")
        db.commit()
        db.refresh(obj)
        return obj

    def update(self, db: Session, tenant_id: str, company_id: UUID, proposal_id: UUID, user_id: str, data: SalesProposalUpdate):
        obj = self.get_by_id(db, tenant_id, company_id, proposal_id)
        
        # Access control rule handled in router usually, but we could enforce it here too
        
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
            
        self._log_action(db, obj.id, user_id, "ATUALIZACAO", "Dados principais atualizados.")
        db.commit()
        db.refresh(obj)
        return obj

    def change_responsavel(self, db: Session, tenant_id: str, company_id: UUID, proposal_id: UUID, user_id: str, new_responsavel_id: str):
        obj = self.get_by_id(db, tenant_id, company_id, proposal_id)
        obj.responsavel_id = new_responsavel_id
        
        self._log_action(db, obj.id, user_id, "MUDANCA_RESPONSAVEL", f"Responsável alterado para {new_responsavel_id}.")
        db.commit()
        db.refresh(obj)
        return obj

    def update_factors(self, db: Session, tenant_id: str, company_id: UUID, proposal_id: UUID, user_id: str, data: SalesProposalUpdateFactors):
        obj = self.get_by_id(db, tenant_id, company_id, proposal_id)
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        self._log_action(db, obj.id, user_id, "ATUALIZACAO_FATORES", "Fatores globais da proposta atualizados.")
        db.commit()
        db.refresh(obj)
        return obj

    def apply_factors_to_kits(self, db: Session, tenant_id: str, company_id: UUID, proposal_id: UUID, user_id: str):
        proposal = self.get_by_id(db, tenant_id, company_id, proposal_id)
        
        from src.modules.opportunity_kits.service import OpportunityKitService
        kit_service = OpportunityKitService(db)
        
        for prop_kit in proposal.kits:
            kit = prop_kit.opportunity_kit
            if kit:
                # fator_margem_locacao is the PRIMARY product markup in calculate_financials (line 222)
                # fator_margem_servicos_produtos is the services/software markup
                if proposal.fator_margem_produtos is not None:
                    kit.fator_margem_locacao = proposal.fator_margem_produtos
                if proposal.fator_margem_servicos is not None:
                    kit.fator_margem_servicos_produtos = proposal.fator_margem_servicos
                if proposal.fator_margem_instalacao is not None:
                    kit.fator_margem_instalacao = proposal.fator_margem_instalacao
                if proposal.fator_margem_manutencao is not None:
                    kit.fator_margem_manutencao = proposal.fator_margem_manutencao
                if proposal.frete_venda is not None:
                    kit.perc_frete_venda = proposal.frete_venda
                if proposal.despesas_adm is not None:
                    kit.perc_despesas_adm = proposal.despesas_adm
                if proposal.comissao is not None:
                    kit.perc_comissao = proposal.comissao
                
                # Flush changes to DB before recalculating
                db.flush()
                fin = kit_service.calculate_financials(kit, tenant_id)
                # Ensure the summary on the JSON payload is updated
                kit.summary = fin["summary"]
                kit.item_summaries = fin["item_summaries"]
                
        self._log_action(db, proposal.id, user_id, "APLICACAO_FATORES", "Fatores globais propagados aos kits filhos.")
        db.commit()
        return True

    def add_kit(self, db: Session, tenant_id: str, company_id: UUID, proposal_id: UUID, user_id: str, kit_id: UUID):
        proposal = self.get_by_id(db, tenant_id, company_id, proposal_id)
        
        # verify kit
        kit = db.query(OpportunityKit).filter_by(id=kit_id, tenant_id=tenant_id, company_id=company_id).first()
        if not kit:
            raise HTTPException(status_code=404, detail="Kit não encontrado")
            
        # block duplicates
        existing_kit = db.query(SalesProposalKit).filter_by(proposal_id=proposal_id, opportunity_kit_id=kit_id).first()
        if existing_kit:
            raise HTTPException(status_code=400, detail="Este kit já foi adicionado a esta proposta.")
            
        # check if it's the first kit to populate factors if they are currently null/zero
        is_first_kit = db.query(SalesProposalKit).filter_by(proposal_id=proposal_id).count() == 0
        
        if is_first_kit:
            if proposal.fator_margem_produtos is None or proposal.fator_margem_produtos == 0:
                proposal.fator_margem_produtos = kit.fator_margem_locacao
            if proposal.fator_margem_servicos is None or proposal.fator_margem_servicos == 0:
                proposal.fator_margem_servicos = kit.fator_margem_servicos_produtos
            if proposal.fator_margem_instalacao is None or proposal.fator_margem_instalacao == 0:
                proposal.fator_margem_instalacao = kit.fator_margem_instalacao
            if proposal.fator_margem_manutencao is None or proposal.fator_margem_manutencao == 0:
                proposal.fator_margem_manutencao = kit.fator_margem_manutencao
            if proposal.frete_venda is None or proposal.frete_venda == 0:
                proposal.frete_venda = kit.perc_frete_venda
            if proposal.despesas_adm is None or proposal.despesas_adm == 0:
                proposal.despesas_adm = kit.perc_despesas_adm
            if proposal.comissao is None or proposal.comissao == 0:
                proposal.comissao = kit.perc_comissao

        prop_kit = SalesProposalKit(proposal_id=proposal_id, opportunity_kit_id=kit_id)
        db.add(prop_kit)
        
        # Link the kit exclusively to this proposal if not already linked to an opportunity
        if not kit.sales_budget_id and not kit.sales_proposal_id:
            kit.sales_proposal_id = proposal_id

        self._log_action(db, proposal.id, user_id, "ADICAO_KIT", f"Kit {kit.nome_kit} adicionado.")
        db.commit()
        db.refresh(prop_kit)
        return prop_kit

    def remove_kit(self, db: Session, tenant_id: str, company_id: UUID, proposal_id: UUID, user_id: str, kit_id: UUID):
        proposal = self.get_by_id(db, tenant_id, company_id, proposal_id)
        prop_kit = db.query(SalesProposalKit).filter_by(proposal_id=proposal_id, opportunity_kit_id=kit_id).first()
        if not prop_kit:
            raise HTTPException(status_code=404, detail="Kit não vinculado a esta proposta")
            
        kit = prop_kit.opportunity_kit
        kit_name = kit.nome_kit if kit else ""
        db.delete(prop_kit)
        self._log_action(db, proposal.id, user_id, "REMOCAO_KIT", f"Kit {kit_name} removido.")
        db.commit()
        return True

    def delete_proposal(self, db: Session, tenant_id: str, company_id: UUID, proposal_id: UUID, user_id: str):
        proposal = self.get_by_id(db, tenant_id, company_id, proposal_id)
        has_kits = db.query(SalesProposalKit).filter_by(proposal_id=proposal_id).first()
        if has_kits:
            raise HTTPException(status_code=400, detail="Não é possível excluir a proposta pois existem kits vinculados.")
        
        db.delete(proposal)
        db.commit()
        return True

    def apply_factors_to_all_kits(self, db: Session, tenant_id: str, company_id: UUID, proposal_id: UUID, user_id: str):
        proposal = self.get_by_id(db, tenant_id, company_id, proposal_id)
        # Find all opportunity kits recursively
        prop_kits = db.query(SalesProposalKit).filter_by(proposal_id=proposal_id).all()
        
        count = 0
        for pk in prop_kits:
            kit = pk.opportunity_kit
            if kit:
                kit.fator_margem_servicos_produtos = proposal.fator_margem_produtos  # Simplification, assuming they use the same factor
                kit.fator_margem_instalacao = proposal.fator_margem_instalacao
                kit.fator_margem_manutencao = proposal.fator_margem_manutencao
                kit.perc_frete_venda = proposal.frete_venda
                kit.perc_despesas_adm = proposal.despesas_adm
                kit.perc_comissao = proposal.comissao
                count += 1
                
        self._log_action(db, proposal.id, user_id, "APLICACAO_FATORES_KITS", f"Fatores aplicados a {count} kits.")
        db.commit()
        return True

    def _log_action(self, db: Session, proposal_id: UUID, user_id: str, acao: str, detalhes: str):
        log = SalesProposalLog(
            proposal_id=proposal_id,
            user_id=user_id,
            acao=acao,
            detalhes=detalhes
        )
        db.add(log)

sales_proposal_service = SalesProposalService()
