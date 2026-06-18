from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from decimal import Decimal
from fastapi import HTTPException

from .models import (
    Licitacao, LicitacaoLote, LicitacaoItem, LicitacaoAnalista, LicitacaoHistory,
    LicitacaoChecklistGrupo, LicitacaoChecklistItem, LicitacaoChecklistAplicacao,
    LicitacaoTarefa, LicitacaoTarefaAndamento
)
from .schemas import (
    LicitacaoCreate, LicitacaoUpdate, LicitacaoChecklistAplicacaoCreate,
    LicitacaoChecklistAplicacaoUpdate, LicitacaoChecklistItemUpdate,
    LicitacaoTarefaCreate, LicitacaoTarefaUpdate, LicitacaoChecklistItemCreate
)
from src.modules.opportunity_kits.models import OpportunityKit
from src.modules.opportunity_kits.service import OpportunityKitService
from src.modules.companies.models import CommercialPolicy, CommercialPolicyRole
from src.modules.users.models import User, UserRole, UserRoleEnum
from src.modules.professionals.models import Professional

class LicitacaoService:
    @staticmethod
    def get_licitacoes(db: Session, tenant_id: str, company_id: str, skip: int = 0, limit: int = 100, status: Optional[str] = None) -> tuple[List[Licitacao], int]:
        query = db.query(Licitacao).filter(Licitacao.tenant_id == tenant_id, Licitacao.company_id == company_id)
        if status:
            query = query.filter(Licitacao.status == status)
        total = query.count()
        items = query.order_by(Licitacao.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    @staticmethod
    def _calculate_kit_financials(kit, tenant_id: str, kit_service: OpportunityKitService) -> tuple[Decimal, Decimal, Decimal]:
        """Calcula e popula os campos financeiros de um kit em kit.summary.
        Retorna (venda_total, custo_total, lucro_estimado).
        """
        try:
            fin = kit_service.calculate_financials(kit, tenant_id)
            summary = fin["summary"]
            kit.summary = summary
            kit.item_summaries = fin["item_summaries"]
            
            prazo_mensalidades = Decimal(str(summary.get("prazo_mensalidades") or 0))
            valor_mensal_kit = Decimal(str(summary.get("valor_mensal_kit") or 0))
            vlr_instal_calc = Decimal(str(summary.get("vlr_instal_calc") or 0))
            lucro_mensal_kit = Decimal(str(summary.get("lucro_mensal_kit") or 0))
            imposto_instalacao = Decimal(str(summary.get("imposto_instalacao") or 0))
            
            perc_comissao = Decimal(str(getattr(kit, "perc_comissao", 0) or 0))
            quantidade_kits = Decimal(str(getattr(kit, "quantidade_kits", 1) or 1))
            
            if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
                venda_total = valor_mensal_kit * quantidade_kits
                lucro_estimado = lucro_mensal_kit * quantidade_kits
            else:
                venda_total = (valor_mensal_kit * prazo_mensalidades + vlr_instal_calc) * quantidade_kits
                lucro_estimado = (
                    lucro_mensal_kit * prazo_mensalidades + 
                    (vlr_instal_calc - imposto_instalacao - (vlr_instal_calc * perc_comissao / Decimal(100.0)))
                ) * quantidade_kits
                
            custo_total = venda_total - lucro_estimado
            margem_geral = (lucro_estimado / venda_total * Decimal(100.0)) if venda_total > 0 else Decimal("0.0")
            
            venda_unitario = venda_total / quantidade_kits if quantidade_kits > 0 else Decimal("0.0")
            custo_unitario = custo_total / quantidade_kits if quantidade_kits > 0 else Decimal("0.0")
            
            # Populate summary fields
            summary["venda_total"] = round(venda_total, 2)
            summary["custo_total"] = round(custo_total, 2)
            summary["lucro_estimado"] = round(lucro_estimado, 2)
            summary["margem_geral"] = round(margem_geral, 2)
            summary["venda_unitario"] = round(venda_unitario, 2)
            summary["custo_unitario"] = round(custo_unitario, 2)
            
            return venda_total, custo_total, lucro_estimado
        except Exception:
            return Decimal("0.0"), Decimal("0.0"), Decimal("0.0")

    @staticmethod
    def populate_kits_financials(db: Session, tenant_id: str, licitacao: Licitacao) -> Licitacao:
        if not licitacao:
            return licitacao
        kit_service = OpportunityKitService(db)
        
        licitacao_custo_total = Decimal("0.0")
        licitacao_lucro_estimado = Decimal("0.0")
        
        for lote in licitacao.lotes:
            lote_venda_total = Decimal("0.0")
            lote_custo_total = Decimal("0.0")
            lote_lucro_estimado = Decimal("0.0")
            
            for item in lote.items:
                item_venda_total = Decimal("0.0")
                item_custo_total = Decimal("0.0")
                item_lucro_estimado = Decimal("0.0")
                
                for kit in item.kits:
                    v_t, c_t, l_e = LicitacaoService._calculate_kit_financials(kit, tenant_id, kit_service)
                    item_venda_total += v_t
                    item_custo_total += c_t
                    item_lucro_estimado += l_e
                    
                item.venda_total = round(item_venda_total, 2)
                item.custo_total = round(item_custo_total, 2)
                item.lucro_estimado = round(item_lucro_estimado, 2)
                item.margem_geral = round((item_lucro_estimado / item_venda_total * Decimal("100.0")) if item_venda_total > 0 else Decimal("0.0"), 2)
                
                item_qty = Decimal(str(item.quantidade or 1))
                if item.tipo_fornecimento == "Unitário" and item_qty > 0:
                    item.venda_unitario = round(item_venda_total / item_qty, 2)
                    item.custo_unitario = round(item_custo_total / item_qty, 2)
                else:
                    item.venda_unitario = None
                    item.custo_unitario = None
                    
                lote_venda_total += item_venda_total
                lote_custo_total += item_custo_total
                lote_lucro_estimado += item_lucro_estimado
                
            lote.venda_total = round(lote_venda_total, 2)
            lote.custo_total = round(lote_custo_total, 2)
            lote.lucro_estimado = round(lote_lucro_estimado, 2)
            lote.margem_geral = round((lote_lucro_estimado / lote_venda_total * Decimal("100.0")) if lote_venda_total > 0 else Decimal("0.0"), 2)
            
            licitacao_custo_total += lote_custo_total
            licitacao_lucro_estimado += lote_lucro_estimado
            
        licitacao.custo_total = round(licitacao_custo_total, 2)
        licitacao.lucro_estimado = round(licitacao_lucro_estimado, 2)
        
        return licitacao

    @staticmethod
    def populate_item_kits_financials(db: Session, tenant_id: str, item: LicitacaoItem) -> LicitacaoItem:
        if not item:
            return item
        kit_service = OpportunityKitService(db)
        
        item_venda_total = Decimal("0.0")
        item_custo_total = Decimal("0.0")
        item_lucro_estimado = Decimal("0.0")
        
        for kit in item.kits:
            v_t, c_t, l_e = LicitacaoService._calculate_kit_financials(kit, tenant_id, kit_service)
            item_venda_total += v_t
            item_custo_total += c_t
            item_lucro_estimado += l_e
            
        item.venda_total = round(item_venda_total, 2)
        item.custo_total = round(item_custo_total, 2)
        item.lucro_estimado = round(item_lucro_estimado, 2)
        item.margem_geral = round((item_lucro_estimado / item_venda_total * Decimal("100.0")) if item_venda_total > 0 else Decimal("0.0"), 2)
        
        item_qty = Decimal(str(item.quantidade or 1))
        if item.tipo_fornecimento == "Unitário" and item_qty > 0:
            item.venda_unitario = round(item_venda_total / item_qty, 2)
            item.custo_unitario = round(item_custo_total / item_qty, 2)
        else:
            item.venda_unitario = None
            item.custo_unitario = None
            
        return item

    @staticmethod
    def get_licitacao_by_id(db: Session, tenant_id: str, licitacao_id: UUID, company_id: str) -> Licitacao:
        licitacao = db.query(Licitacao).filter(
            Licitacao.id == licitacao_id,
            Licitacao.tenant_id == tenant_id,
            Licitacao.company_id == company_id
        ).first()
        if not licitacao:
            raise HTTPException(status_code=404, detail="Licitação não encontrada")
        return LicitacaoService.populate_kits_financials(db, tenant_id, licitacao)

    @staticmethod
    def create_licitacao(db: Session, tenant_id: str, company_id: str, data: LicitacaoCreate, current_user: User = None) -> Licitacao:
        licitacao = Licitacao(
            tenant_id=tenant_id,
            company_id=company_id,
            customer_id=data.customer_id,
            numero_edital=data.numero_edital,
            descricao=data.descricao,
            data_publicacao=data.data_publicacao,
            data_licitacao=data.data_licitacao,
            data_limite_questionamento=data.data_limite_questionamento,
            po_id=data.po_id,
            status="Criada",
            modalidade=data.modalidade,
            tipo_licitacao=data.tipo_licitacao
        )
        db.add(licitacao)
        db.flush()

        for lote_data in data.lotes:
            lote = LicitacaoLote(
                licitacao_id=licitacao.id,
                numero=lote_data.numero,
                nome=lote_data.nome,
                descricao=lote_data.descricao
            )
            db.add(lote)
            db.flush()

            for item_data in lote_data.items:
                qty_total = item_data.quantidade
                if item_data.tipo_fornecimento == "Mensal":
                    qty_total = item_data.quantidade * Decimal(str(item_data.total_meses))
                else:
                    qty_total = item_data.quantidade

                item = LicitacaoItem(
                    lote_id=lote.id,
                    codigo=item_data.codigo,
                    nome=item_data.nome,
                    descricao=item_data.descricao,
                    quantidade=item_data.quantidade,
                    tipo_fornecimento=item_data.tipo_fornecimento,
                    total_meses=item_data.total_meses,
                    quantidade_total=qty_total
                )
                db.add(item)

        # Seed default checklist
        LicitacaoService.seed_checklist(db, tenant_id, licitacao.id)

        # Log creation
        usuario_nome = current_user.name if current_user else "Sistema"
        usuario_id = current_user.id if current_user else "system"
        LicitacaoService.register_history(
            db, 
            licitacao.id, 
            tenant_id, 
            usuario_id, 
            f"{usuario_nome} criou a Licitação."
        )

        db.commit()
        db.refresh(licitacao)
        LicitacaoService.recalculate_licitacao(db, tenant_id, licitacao.id)
        return licitacao

    @staticmethod
    def update_licitacao(db: Session, tenant_id: str, company_id: str, licitacao_id: UUID, data: LicitacaoUpdate, current_user: User = None) -> Licitacao:
        licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)

        # Regra 1.b: Ganha, Perdida, Cancelada travam para edição
        if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
            raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")

        update_data = data.model_dump(exclude_unset=True)
        
        # Check P.O. edit permissions
        new_po_id = update_data.get("po_id")
        if new_po_id is not None and licitacao.po_id is not None and str(licitacao.po_id) != str(new_po_id):
            if current_user:
                # Check UserRole (ADMIN or DIRETORIA)
                is_privileged = db.query(UserRole).filter(
                    UserRole.user_id == current_user.id,
                    UserRole.role.in_([UserRoleEnum.ADMIN, UserRoleEnum.DIRETORIA])
                ).first() is not None
                
                if not is_privileged:
                    # Check if Professional role is GERENTE or DIRETORIA
                    from src.modules.roles.models import Role
                    prof = db.query(Professional).filter(
                        Professional.user_id == current_user.id,
                        Professional.tenant_id == tenant_id
                    ).first()
                    role_allowed = False
                    if prof and prof.role_id:
                        r = db.query(Role).filter(Role.id == prof.role_id).first()
                        if r and r.name in ["GERENTE", "DIRETORIA"]:
                            role_allowed = True
                    if not role_allowed:
                        raise HTTPException(
                            status_code=400,
                            detail="Apenas usuários com perfil GERENTE ou DIRETORIA podem alterar o P.O. após sua definição."
                        )

        # Validate status transition to Em Análise/Precificação
        new_status = update_data.get("status")
        if new_status == "Em Análise/Precificação":
            final_po_id = new_po_id if new_po_id is not None else licitacao.po_id
            if not final_po_id:
                raise HTTPException(
                    status_code=400,
                    detail="Não é possível alterar para 'Em Análise/Precificação' sem um P.O. definido."
                )
            
            # Count analysts
            num_analysts = db.query(LicitacaoAnalista).filter(
                LicitacaoAnalista.licitacao_id == licitacao_id
            ).count()
            if num_analysts == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Não é possível alterar para 'Em Análise/Precificação' sem pelo menos um analista definido."
                )

        # Generate logs for changes
        usuario_nome = current_user.name if current_user else "Sistema"
        usuario_id = current_user.id if current_user else "system"
        
        # Log status change
        if new_status and new_status != licitacao.status:
            LicitacaoService.register_history(
                db, 
                licitacao.id, 
                tenant_id, 
                usuario_id, 
                f"{usuario_nome} alterou o status para {new_status}."
            )
            
        # Log P.O. change
        if new_po_id is not None and str(new_po_id) != str(licitacao.po_id):
            po_user = db.query(User).filter(User.id == new_po_id).first()
            po_name = po_user.name if po_user else "Desconhecido"
            LicitacaoService.register_history(
                db, 
                licitacao.id, 
                tenant_id, 
                usuario_id, 
                f"{usuario_nome} definiu o P.O. como {po_name}."
            )

        # Log fields change (generic description if metadata changes)
        changed_fields = []
        for key in ["numero_edital", "descricao", "data_publicacao", "data_licitacao", "modalidade", "tipo_licitacao"]:
            if key in update_data and update_data[key] != getattr(licitacao, key):
                changed_fields.append(key)
        if changed_fields:
            LicitacaoService.register_history(
                db,
                licitacao.id,
                tenant_id,
                usuario_id,
                f"{usuario_nome} atualizou os dados gerais: {', '.join(changed_fields)}."
            )

        # Apply updates
        for key, value in update_data.items():
            setattr(licitacao, key, value)

        db.commit()
        db.refresh(licitacao)

        # Recalculate margins and check limits
        LicitacaoService.recalculate_licitacao(db, tenant_id, licitacao.id)
        
        # Alçada de aprovação check
        if current_user and new_status == "Aprovada para Envio":
            LicitacaoService.validate_licitacao_approval(db, current_user, company_id, licitacao)

        return LicitacaoService.populate_kits_financials(db, tenant_id, licitacao)

    @staticmethod
    def delete_licitacao(db: Session, tenant_id: str, company_id: str, licitacao_id: UUID) -> bool:
        licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
        if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
            raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser excluída.")
        
        db.delete(licitacao)
        db.commit()
        return True

    @staticmethod
    def recalculate_licitacao(db: Session, tenant_id: str, licitacao_id: UUID) -> Licitacao:
        licitacao = db.query(Licitacao).filter(Licitacao.id == licitacao_id).first()
        if not licitacao:
            return None

        # Fetch all kits linked to this licitacao
        kits = db.query(OpportunityKit).filter(OpportunityKit.licitacao_id == licitacao_id).all()
        
        kit_service = OpportunityKitService(db)
        total_venda = Decimal("0.0")
        total_lucro_global = Decimal("0.0")
        total_estimado = Decimal("0.0")

        for kit in kits:
            try:
                # Recalculate financials dynamically
                fin = kit_service.calculate_financials(kit, tenant_id)
                summary = fin.get("summary", {})
                
                qty = Decimal(str(kit.quantidade_kits or 1))
                
                if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
                    valor_mensal_kit = Decimal(str(summary.get("valor_mensal_kit", 0)))
                    lucro_mensal_kit = Decimal(str(summary.get("lucro_mensal_kit", 0)))
                    
                    total_venda += valor_mensal_kit
                    total_lucro_global += lucro_mensal_kit
                else:
                    # Rental or Comodato lifetime
                    valor_mensal_kit = Decimal(str(summary.get("valor_mensal_kit", 0)))
                    vlr_instal_calc = sa_val = Decimal(str(summary.get("vlr_instal_calc", 0)))
                    prazo_mensalidades = max(0, kit.prazo_contrato_meses - kit.prazo_instalacao_meses)
                    
                    fat_lifetime = valor_mensal_kit * Decimal(prazo_mensalidades) + vlr_instal_calc
                    
                    # We compute profit lifetime
                    lucro_mensal_kit = Decimal(str(summary.get("lucro_mensal_kit", 0)))
                    # Recalculate upfront setup installation profit if applicable
                    # (Installation margin is factor * setup cost minus taxes and commission)
                    imposto_instalacao = Decimal(str(summary.get("imposto_instalacao", 0)))
                    lucro_instalacao = vlr_instal_calc - imposto_instalacao - (vlr_instal_calc * Decimal(str(kit.perc_comissao or 0)) / Decimal("100.0"))
                    
                    lucro_lifetime = (lucro_mensal_kit * Decimal(prazo_mensalidades)) + lucro_instalacao
                    
                    total_venda += fat_lifetime
                    total_lucro_global += lucro_lifetime

            except Exception as e:
                # Fallback to model values if calculation fails
                pass

        licitacao.valor_total_venda = total_venda
        if total_venda > 0:
            licitacao.margem_ponderada_global = (total_lucro_global / total_venda) * Decimal("100.0")
        else:
            licitacao.margem_ponderada_global = Decimal("0.0")

        db.commit()
        db.refresh(licitacao)
        return licitacao

    @staticmethod
    def validate_licitacao_approval(db: Session, current_user: User, company_id: str, licitacao: Licitacao):
        """
        Checks if the global weighted margin of the tender is below the commercial policy factor
        for the user's role. If yes, flags need for director approval.
        """
        professional = db.query(Professional).filter(
            Professional.user_id == current_user.id,
            Professional.tenant_id == current_user.tenant_id
        ).first()

        if not professional or not professional.role_id:
            return

        policies = db.query(CommercialPolicy).join(
            CommercialPolicyRole
        ).filter(
            CommercialPolicy.company_id == company_id,
            CommercialPolicy.ativo == True,
            CommercialPolicyRole.role_id == professional.role_id
        ).all()

        if not policies:
            return

        # Get the MINIMUM margin factor allowed for this user
        min_allowed = min(p.fator_limite for p in policies)
        
        # Convert factor (e.g. 1.15) to minimum margin percentage: (factor - 1) * 100
        # If factor is 1.0, minimum margin is 0%. If factor is 1.15, minimum margin is 15%.
        min_margin_percent = (min_allowed - Decimal("1.0")) * Decimal("100.0")

        if licitacao.margem_ponderada_global < min_margin_percent:
            # Requires Director approval
            licitacao.precisa_aprovacao_diretoria = True
            licitacao.aprovado_diretoria = False
            licitacao.status = "Em Análise/Precificação"  # Send back to pricing stage
            db.commit()
            raise HTTPException(
                status_code=400,
                detail=f"A margem global da licitação ({licitacao.margem_ponderada_global:.2f}%) está abaixo do limite permitido ({min_margin_percent:.2f}%). O edital foi retido para aprovação da Diretoria."
            )

    @staticmethod
    def calculate_data_limite(data_zero: datetime, prazo_dias_uteis: int) -> datetime:
        current_date = data_zero
        added_days = 0
        while added_days < prazo_dias_uteis:
            current_date += timedelta(days=1)
            if current_date.weekday() < 5:  # Monday=0 to Friday=4 are business days
                added_days += 1
        return current_date

    @staticmethod
    def register_history(db: Session, licitacao_id: UUID, tenant_id: str, usuario_id: str, descricao: str):
        log_entry = LicitacaoHistory(
            licitacao_id=licitacao_id,
            tenant_id=tenant_id,
            usuario_id=usuario_id,
            descricao=descricao
        )
        db.add(log_entry)
        db.flush()

    @staticmethod
    def get_history(db: Session, tenant_id: str, licitacao_id: UUID) -> List[LicitacaoHistory]:
        return db.query(LicitacaoHistory).filter(
            LicitacaoHistory.licitacao_id == licitacao_id,
            LicitacaoHistory.tenant_id == tenant_id
        ).order_by(LicitacaoHistory.data_movimentacao.desc()).all()

    @staticmethod
    def add_analista(db: Session, tenant_id: str, company_id: str, licitacao_id: UUID, user_id: str, prazo_dias_uteis: int, current_user: User) -> LicitacaoAnalista:
        licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
        if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
            raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")

        # Check permissions
        LicitacaoService.check_user_edit_permission(db, tenant_id, licitacao, current_user)

        # Check if analyst user exists
        analyst_user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).first()
        if not analyst_user:
            raise HTTPException(status_code=404, detail="Usuário analista não encontrado")

        # Check if already added
        existing = db.query(LicitacaoAnalista).filter(
            LicitacaoAnalista.licitacao_id == licitacao_id,
            LicitacaoAnalista.usuario_id == user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Este analista já está adicionado a esta licitação.")

        # Data Zero is the creation date of the bid
        data_zero = licitacao.created_at or datetime.now(timezone.utc)
        data_limite = LicitacaoService.calculate_data_limite(data_zero, prazo_dias_uteis)

        analista = LicitacaoAnalista(
            licitacao_id=licitacao_id,
            tenant_id=tenant_id,
            usuario_id=user_id,
            data_zero=data_zero,
            prazo_dias_uteis=prazo_dias_uteis,
            data_limite=data_limite
        )
        db.add(analista)
        db.flush()

        # Log to timeline
        usuario_nome = current_user.name if current_user else "Sistema"
        LicitacaoService.register_history(
            db,
            licitacao_id,
            tenant_id,
            current_user.id if current_user else "system",
            f"{usuario_nome} adicionou o analista {analyst_user.name} com prazo de {prazo_dias_uteis} dias úteis."
        )

        db.commit()
        return analista

    @staticmethod
    def remove_analista(db: Session, tenant_id: str, company_id: str, licitacao_id: UUID, analista_id: UUID, current_user: User) -> bool:
        licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
        if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
            raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")

        # Check permissions
        LicitacaoService.check_user_edit_permission(db, tenant_id, licitacao, current_user)

        analista = db.query(LicitacaoAnalista).filter(
            LicitacaoAnalista.id == analista_id,
            LicitacaoAnalista.licitacao_id == licitacao_id
        ).first()
        if not analista:
            raise HTTPException(status_code=404, detail="Analista não encontrado nesta licitação.")

        analyst_name = analista.usuario.name if analista.usuario else "Desconhecido"

        db.delete(analista)
        db.flush()

        # Log to timeline
        usuario_nome = current_user.name if current_user else "Sistema"
        LicitacaoService.register_history(
            db,
            licitacao_id,
            tenant_id,
            current_user.id if current_user else "system",
            f"{usuario_nome} removeu o analista {analyst_name}."
        )

        db.commit()
        return True

    @staticmethod
    def link_purchase_budget(db: Session, tenant_id: str, company_id: str, licitacao_id: UUID, budget_id: UUID, current_user: User) -> bool:
        from src.modules.purchase_budgets.models import PurchaseBudget
        licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
        if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
            raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")

        budget = db.query(PurchaseBudget).filter(
            PurchaseBudget.id == budget_id,
            PurchaseBudget.tenant_id == tenant_id
        ).first()
        if not budget:
            raise HTTPException(status_code=404, detail="Orçamento de compra não encontrado.")

        if budget.licitacao_id == licitacao_id:
            return True

        budget.licitacao_id = licitacao_id
        db.flush()

        # Log to timeline
        usuario_nome = current_user.name if current_user else "Sistema"
        LicitacaoService.register_history(
            db,
            licitacao_id,
            tenant_id,
            current_user.id if current_user else "system",
            f"{usuario_nome} vinculou o orçamento de compra {budget.numero_orcamento or 'Sem Número'}."
        )

        db.commit()
        return True

    @staticmethod
    def unlink_purchase_budget(db: Session, tenant_id: str, company_id: str, licitacao_id: UUID, budget_id: UUID, current_user: User) -> bool:
        from src.modules.purchase_budgets.models import PurchaseBudget
        licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
        if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
            raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")

        budget = db.query(PurchaseBudget).filter(
            PurchaseBudget.id == budget_id,
            PurchaseBudget.licitacao_id == licitacao_id
        ).first()
        if not budget:
            raise HTTPException(status_code=404, detail="Orçamento de compra não está vinculado a esta licitação.")

        budget.licitacao_id = None
        db.flush()

        # Log to timeline
        usuario_nome = current_user.name if current_user else "Sistema"
        LicitacaoService.register_history(
            db,
            licitacao_id,
            tenant_id,
            current_user.id if current_user else "system",
            f"{usuario_nome} desvinculou o orçamento de compra {budget.numero_orcamento or 'Sem Número'}."
        )

        db.commit()
        return True

    @staticmethod
    def seed_checklist(db: Session, tenant_id: str, licitacao_id: UUID):
        grupos_def = [
            ("Habilitação", [
                ("Verificar Regularidade Fiscal", "Conferência de certidões, FGTS, INSS, Receita Federal e Trabalhista."),
                ("Verificar Qualificação Técnica", "Conferência de atestados de capacidade técnica e registros em conselhos."),
                ("Verificar Qualificação Econômico-Financeira", "Análise de balanço patrimonial e índices de liquidez."),
                ("Verificar necessidade de Checklist CERCA", "Avaliação de exigência e elaboração do checklist CERCA (Certificado de Registro Cadastral)."),
                ("Verificar regularidade no SICAF", "Validação do cadastro e certidões no Sistema de Cadastramento Unificado de Fornecedores.")
            ]),
            ("Análise Técnica", [
                ("Análise de Requisitos do Edital", "Estudo detalhado do termo de referência e exigências técnicas."),
                ("Validação de Especificação Técnica", "Confronto entre a especificação do edital e as soluções ofertadas.")
            ]),
            ("Checklist de Fechamento", [
                ("Revisão de Margens e Custos", "Verificação final da precificação, impostos e rentabilidade."),
                ("Aprovação de Proposta Final", "Garantia de que todos os documentos e propostas estão assinados e prontos.")
            ])
        ]
        
        for g_idx, (g_nome, items_def) in enumerate(grupos_def):
            grupo = LicitacaoChecklistGrupo(
                licitacao_id=licitacao_id,
                tenant_id=tenant_id,
                nome=g_nome,
                ordem=g_idx
            )
            db.add(grupo)
            db.flush()
            
            for i_idx, (i_nome, i_desc) in enumerate(items_def):
                item = LicitacaoChecklistItem(
                    grupo_id=grupo.id,
                    tenant_id=tenant_id,
                    nome=i_nome,
                    descricao=i_desc,
                    status="Pendente",
                    ordem=i_idx
                )
                db.add(item)
        db.flush()

    @staticmethod
    def get_checklist(db: Session, tenant_id: str, licitacao_id: UUID, current_user: Optional[User] = None) -> List[LicitacaoChecklistGrupo]:
        licitacao = db.query(Licitacao).filter(Licitacao.id == licitacao_id, Licitacao.tenant_id == tenant_id).first()
        if not licitacao:
            raise HTTPException(status_code=404, detail="Licitação não encontrada")
        
        if current_user:
            LicitacaoService.check_user_edit_permission(db, tenant_id, licitacao, current_user)

        grupos = db.query(LicitacaoChecklistGrupo).filter(
            LicitacaoChecklistGrupo.licitacao_id == licitacao_id,
            LicitacaoChecklistGrupo.tenant_id == tenant_id
        ).order_by(LicitacaoChecklistGrupo.ordem.asc()).all()
        
        if not grupos:
            LicitacaoService.seed_checklist(db, tenant_id, licitacao_id)
            db.commit()
            grupos = db.query(LicitacaoChecklistGrupo).filter(
                LicitacaoChecklistGrupo.licitacao_id == licitacao_id,
                LicitacaoChecklistGrupo.tenant_id == tenant_id
            ).order_by(LicitacaoChecklistGrupo.ordem.asc()).all()
            
        return grupos

    @staticmethod
    def update_checklist_item(db: Session, tenant_id: str, item_id: UUID, data: LicitacaoChecklistItemUpdate, current_user: User) -> LicitacaoChecklistItem:
        item = db.query(LicitacaoChecklistItem).filter(
            LicitacaoChecklistItem.id == item_id,
            LicitacaoChecklistItem.tenant_id == tenant_id
        ).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item de checklist não encontrado.")

        licitacao = item.grupo.licitacao
        LicitacaoService.check_user_edit_permission(db, tenant_id, licitacao, current_user)

        if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
            raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")

        old_status = item.status
        old_usuario_id = item.usuario_id

        if data.status is not None:
            item.status = data.status
            if data.status == "Concluído":
                item.data_conclusao = datetime.now(timezone.utc)
            elif data.status in ["Pendente", "Não Aplicável"]:
                item.data_conclusao = None

        if data.usuario_id is not None:
            if data.usuario_id == "":
                item.usuario_id = None
            else:
                item.usuario_id = data.usuario_id

        db.flush()

        # Log change to history
        usuario_nome = current_user.name if current_user else "Sistema"
        msg = f"{usuario_nome} alterou o item '{item.nome}'"
        parts = []
        if old_status != item.status:
            parts.append(f"de '{old_status}' para '{item.status}'")
        if old_usuario_id != item.usuario_id:
            responsavel_nome = item.usuario.name if item.usuario else "ninguém"
            parts.append(f"responsável definido como '{responsavel_nome}'")
        
        if parts:
            msg += " (" + ", ".join(parts) + ")"
            LicitacaoService.register_history(
                db,
                item.grupo.licitacao_id,
                tenant_id,
                str(current_user.id) if current_user else "system",
                msg
            )

        db.commit()
        return item

    @staticmethod
    def create_technical_aplicacao(db: Session, tenant_id: str, item_id: UUID, data: LicitacaoChecklistAplicacaoCreate, current_user: User) -> LicitacaoChecklistAplicacao:
        item = db.query(LicitacaoChecklistItem).filter(
            LicitacaoChecklistItem.id == item_id,
            LicitacaoChecklistItem.tenant_id == tenant_id
        ).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item de checklist não encontrado.")

        licitacao_id = item.grupo.licitacao_id
        licitacao = item.grupo.licitacao
        LicitacaoService.check_user_edit_permission(db, tenant_id, licitacao, current_user)

        # Validate that usuario_id is in the team
        is_in_team = db.query(LicitacaoAnalista).filter(
            LicitacaoAnalista.licitacao_id == licitacao_id,
            LicitacaoAnalista.usuario_id == data.usuario_id
        ).first() is not None

        licitacao = db.query(Licitacao).filter(Licitacao.id == licitacao_id).first()
        if not is_in_team and licitacao and str(licitacao.po_id) == str(data.usuario_id):
            is_in_team = True

        if not is_in_team:
            raise HTTPException(
                status_code=400,
                detail="O usuário selecionado para a aplicação técnica deve fazer parte da equipe da licitação."
            )

        aplicacao = LicitacaoChecklistAplicacao(
            licitacao_id=licitacao_id,
            tenant_id=tenant_id,
            item_id=item_id,
            usuario_id=data.usuario_id,
            status="Pendente",
            observacao=data.observacao
        )
        db.add(aplicacao)
        db.flush()

        usuario_nome = current_user.name if current_user else "Sistema"
        analyst_user = db.query(User).filter(User.id == data.usuario_id).first()
        analista_nome = analyst_user.name if analyst_user else "Desconhecido"
        LicitacaoService.register_history(
            db,
            licitacao_id,
            tenant_id,
            str(current_user.id) if current_user else "system",
            f"{usuario_nome} adicionou uma aplicação técnica no item '{item.nome}' para o analista '{analista_nome}'."
        )

        db.commit()
        return aplicacao

    @staticmethod
    def update_technical_aplicacao(db: Session, tenant_id: str, aplicacao_id: UUID, data: LicitacaoChecklistAplicacaoUpdate, current_user: User) -> LicitacaoChecklistAplicacao:
        aplicacao = db.query(LicitacaoChecklistAplicacao).filter(
            LicitacaoChecklistAplicacao.id == aplicacao_id,
            LicitacaoChecklistAplicacao.tenant_id == tenant_id
        ).first()
        if not aplicacao:
            raise HTTPException(status_code=404, detail="Aplicação técnica não encontrada.")

        licitacao = aplicacao.licitacao
        LicitacaoService.check_user_edit_permission(db, tenant_id, licitacao, current_user)

        old_status = aplicacao.status

        if data.status is not None:
            aplicacao.status = data.status
            if data.status == "Concluído":
                aplicacao.data_conclusao = datetime.now(timezone.utc)
            elif data.status in ["Pendente", "Não Aplicável"]:
                aplicacao.data_conclusao = None

        if data.observacao is not None:
            aplicacao.observacao = data.observacao

        db.flush()

        # Log change
        usuario_nome = current_user.name if current_user else "Sistema"
        if old_status != aplicacao.status:
            LicitacaoService.register_history(
                db,
                aplicacao.licitacao_id,
                tenant_id,
                str(current_user.id) if current_user else "system",
                f"{usuario_nome} alterou o status da aplicação técnica de '{aplicacao.item.nome}' para '{aplicacao.status}'."
            )

        db.commit()
        return aplicacao

    @staticmethod
    def delete_technical_aplicacao(db: Session, tenant_id: str, aplicacao_id: UUID, current_user: User) -> bool:
        aplicacao = db.query(LicitacaoChecklistAplicacao).filter(
            LicitacaoChecklistAplicacao.id == aplicacao_id,
            LicitacaoChecklistAplicacao.tenant_id == tenant_id
        ).first()
        if not aplicacao:
            raise HTTPException(status_code=404, detail="Aplicação técnica não encontrada.")

        licitacao = aplicacao.licitacao
        LicitacaoService.check_user_edit_permission(db, tenant_id, licitacao, current_user)

        licitacao_id = aplicacao.licitacao_id
        item_nome = aplicacao.item.nome
        analista_nome = aplicacao.usuario.name if aplicacao.usuario else "Desconhecido"

        db.delete(aplicacao)
        db.flush()

        usuario_nome = current_user.name if current_user else "Sistema"
        LicitacaoService.register_history(
            db,
            licitacao_id,
            tenant_id,
            str(current_user.id) if current_user else "system",
            f"{usuario_nome} removeu a aplicação técnica de '{item_nome}' do analista '{analista_nome}'."
        )

        db.commit()
        return True

    @staticmethod
    def create_checklist_item(db: Session, tenant_id: str, company_id: str, licitacao_id: UUID, grupo_id: UUID, data: LicitacaoChecklistItemCreate, current_user: User) -> LicitacaoChecklistItem:
        licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
        if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
            raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")

        # Check permissions
        LicitacaoService.check_user_edit_permission(db, tenant_id, licitacao, current_user)

        # Get max ordem to append
        from sqlalchemy import func
        max_ord = db.query(func.max(LicitacaoChecklistItem.ordem)).filter(
            LicitacaoChecklistItem.grupo_id == grupo_id
        ).scalar() or 0

        item = LicitacaoChecklistItem(
            grupo_id=grupo_id,
            tenant_id=tenant_id,
            nome=data.nome,
            descricao=data.descricao,
            status="Pendente",
            ordem=max_ord + 1
        )
        db.add(item)
        db.flush()

        usuario_nome = current_user.name if current_user else "Sistema"
        LicitacaoService.register_history(
            db,
            licitacao_id,
            tenant_id,
            str(current_user.id) if current_user else "system",
            f"{usuario_nome} adicionou o item '{data.nome}' ao checklist."
        )

        db.commit()
        return item

    @staticmethod
    def delete_checklist_item(db: Session, tenant_id: str, company_id: str, licitacao_id: UUID, item_id: UUID, current_user: User) -> bool:
        licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
        if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
            raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")

        item = db.query(LicitacaoChecklistItem).filter(
            LicitacaoChecklistItem.id == item_id,
            LicitacaoChecklistItem.tenant_id == tenant_id
        ).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item de checklist não encontrado.")

        # Check permissions
        LicitacaoService.check_user_edit_permission(db, tenant_id, licitacao, current_user)

        item_nome = item.nome
        db.delete(item)
        db.flush()

        usuario_nome = current_user.name if current_user else "Sistema"
        LicitacaoService.register_history(
            db,
            licitacao_id,
            tenant_id,
            str(current_user.id) if current_user else "system",
            f"{usuario_nome} removeu o item '{item_nome}' do checklist."
        )

        db.commit()
        return True

    @staticmethod
    def is_user_po_or_privileged(db: Session, tenant_id: str, licitacao: Licitacao, current_user: User) -> bool:
        if not current_user:
            return False
        
        if str(licitacao.po_id) == str(current_user.id):
            return True

        is_privileged = db.query(UserRole).filter(
            UserRole.user_id == current_user.id,
            UserRole.role.in_([UserRoleEnum.ADMIN, UserRoleEnum.DIRETORIA])
        ).first() is not None
        if is_privileged:
            return True

        from src.modules.roles.models import Role
        prof = db.query(Professional).filter(
            Professional.user_id == current_user.id,
            Professional.tenant_id == tenant_id
        ).first()
        if prof and prof.role_id is not None:
            r = db.query(Role).filter(Role.id == prof.role_id).first()
            if r and r.name in ["GERENTE", "DIRETORIA"]:
                return True

        return False

    @staticmethod
    def check_user_edit_permission(db: Session, tenant_id: str, licitacao: Licitacao, current_user: User):
        if not LicitacaoService.is_user_po_or_privileged(db, tenant_id, licitacao, current_user):
            raise HTTPException(
                status_code=403,
                detail="Apenas o P.O. da licitação ou usuários com perfil GERENTE ou DIRETORIA possuem essa permissão."
            )

    @staticmethod
    def sync_tarefa_to_checklist(db: Session, tenant_id: str, checklist_item_id: Optional[UUID], checklist_aplicacao_id: Optional[UUID], task_status: str, responsavel_id: str):
        status_map = {
            "Pendente": "Pendente",
            "Em Andamento": "Em Andamento",
            "Pausada": "Pausado",
            "Concluída": "Concluído",
            "Cancelada": "Não Aplicável"
        }
        mapped_status = status_map.get(task_status, "Pendente")
        data_conclusao = datetime.now(timezone.utc) if mapped_status == "Concluído" else None

        if checklist_item_id:
            item = db.query(LicitacaoChecklistItem).filter(
                LicitacaoChecklistItem.id == checklist_item_id,
                LicitacaoChecklistItem.tenant_id == tenant_id
            ).first()
            if item:
                item.status = mapped_status
                item.usuario_id = responsavel_id
                item.data_conclusao = data_conclusao
        
        if checklist_aplicacao_id:
            aplicacao = db.query(LicitacaoChecklistAplicacao).filter(
                LicitacaoChecklistAplicacao.id == checklist_aplicacao_id,
                LicitacaoChecklistAplicacao.tenant_id == tenant_id
            ).first()
            if aplicacao:
                aplicacao.status = mapped_status
                aplicacao.usuario_id = responsavel_id
                aplicacao.data_conclusao = data_conclusao

    @staticmethod
    def get_tarefas(db: Session, tenant_id: str, licitacao_id: UUID, licitacao: Licitacao, current_user: User) -> List[LicitacaoTarefa]:
        query = db.query(LicitacaoTarefa).filter(
            LicitacaoTarefa.licitacao_id == licitacao_id,
            LicitacaoTarefa.tenant_id == tenant_id
        )
        if current_user and not LicitacaoService.is_user_po_or_privileged(db, tenant_id, licitacao, current_user):
            query = query.filter(LicitacaoTarefa.responsavel_id == current_user.id)
            
        return query.order_by(LicitacaoTarefa.created_at.desc()).all()

    @staticmethod
    def get_tarefa_by_id(db: Session, tenant_id: str, tarefa_id: UUID) -> LicitacaoTarefa:
        tarefa = db.query(LicitacaoTarefa).filter(
            LicitacaoTarefa.id == tarefa_id,
            LicitacaoTarefa.tenant_id == tenant_id
        ).first()
        if not tarefa:
            raise HTTPException(status_code=404, detail="Tarefa não encontrada.")
        return tarefa

    @staticmethod
    def check_reopen_permission(db: Session, tenant_id: str, licitacao: Licitacao, current_user: User):
        if not LicitacaoService.is_user_po_or_privileged(db, tenant_id, licitacao, current_user):
            raise HTTPException(
                status_code=403,
                detail="Apenas o P.O. da licitação ou usuários com perfil GERENTE ou DIRETORIA podem reabrir uma tarefa concluída."
            )

    @staticmethod
    def create_tarefa(db: Session, tenant_id: str, company_id: str, licitacao_id: UUID, data: LicitacaoTarefaCreate, current_user: User) -> LicitacaoTarefa:
        licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
        creator_id = str(current_user.id) if current_user else "system"

        is_creator_in_team = (str(licitacao.po_id) == creator_id) or (
            db.query(LicitacaoAnalista).filter(
                LicitacaoAnalista.licitacao_id == licitacao_id,
                LicitacaoAnalista.usuario_id == creator_id
            ).first() is not None
        )

        is_resp_in_team = (str(licitacao.po_id) == str(data.responsavel_id)) or (
            db.query(LicitacaoAnalista).filter(
                LicitacaoAnalista.licitacao_id == licitacao_id,
                LicitacaoAnalista.usuario_id == data.responsavel_id
            ).first() is not None
        )

        if not is_resp_in_team:
            raise HTTPException(
                status_code=400,
                detail="O responsável selecionado deve fazer parte da equipe da licitação."
            )

        if not is_creator_in_team:
            if str(data.responsavel_id) == creator_id:
                raise HTTPException(
                    status_code=400,
                    detail="Usuários fora da equipe da licitação não podem atribuir tarefas para si mesmos."
                )

        analyst = db.query(LicitacaoAnalista).filter(
            LicitacaoAnalista.licitacao_id == licitacao_id,
            LicitacaoAnalista.usuario_id == data.responsavel_id
        ).first()
        if analyst:
            if data.data_limite.tzinfo is None:
                data_limite_aware = data.data_limite.replace(tzinfo=timezone.utc)
            else:
                data_limite_aware = data.data_limite

            analyst_limit_aware = analyst.data_limite
            if analyst_limit_aware.tzinfo is None:
                analyst_limit_aware = analyst_limit_aware.replace(tzinfo=timezone.utc)

            if data_limite_aware.date() > analyst_limit_aware.date():
                raise HTTPException(
                    status_code=400,
                    detail=f"A data limite da tarefa não pode ser posterior ao prazo de previsão de entrega do analista ({analyst_limit_aware.strftime('%d/%m/%Y')})."
                )

        tarefa = LicitacaoTarefa(
            licitacao_id=licitacao_id,
            tenant_id=tenant_id,
            checklist_item_id=data.checklist_item_id,
            checklist_aplicacao_id=data.checklist_aplicacao_id,
            titulo=data.titulo,
            descricao=data.descricao,
            responsavel_id=data.responsavel_id,
            criador_id=creator_id,
            data_limite=data.data_limite,
            status="Pendente"
        )
        db.add(tarefa)
        db.flush()

        LicitacaoService.sync_tarefa_to_checklist(db, tenant_id, data.checklist_item_id, data.checklist_aplicacao_id, "Pendente", data.responsavel_id)

        andamento = LicitacaoTarefaAndamento(
            tarefa_id=tarefa.id,
            tenant_id=tenant_id,
            usuario_id=creator_id,
            descricao="Tarefa criada.",
            status_anterior="Pendente",
            status_novo="Pendente"
        )
        db.add(andamento)
        db.flush()

        usuario_nome = current_user.name if current_user else "Sistema"
        LicitacaoService.register_history(
            db,
            licitacao_id,
            tenant_id,
            creator_id,
            f"{usuario_nome} criou a tarefa '{tarefa.titulo}'."
        )

        db.commit()
        return tarefa

    @staticmethod
    def update_tarefa(db: Session, tenant_id: str, company_id: str, licitacao_id: UUID, tarefa_id: UUID, data: LicitacaoTarefaUpdate, current_user: User) -> LicitacaoTarefa:
        licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
        tarefa = LicitacaoService.get_tarefa_by_id(db, tenant_id, tarefa_id)

        old_status = tarefa.status
        new_status = data.status
        if old_status == "Concluída" and new_status is not None and new_status != "Concluída":
            LicitacaoService.check_reopen_permission(db, tenant_id, licitacao, current_user)

        if new_status == "Cancelada" and old_status != "Cancelada":
            if not LicitacaoService.is_user_po_or_privileged(db, tenant_id, licitacao, current_user):
                raise HTTPException(
                    status_code=403,
                    detail="Apenas o P.O. da licitação ou usuários com perfil GERENTE ou DIRETORIA podem cancelar tarefas."
                )

        if data.titulo is not None:
            tarefa.titulo = data.titulo
        if data.descricao is not None:
            tarefa.descricao = data.descricao
        if data.responsavel_id is not None:
            tarefa.responsavel_id = data.responsavel_id
        if data.data_limite is not None:
            tarefa.data_limite = data.data_limite
        if new_status is not None:
            tarefa.status = new_status

        if data.responsavel_id is not None or data.data_limite is not None:
            is_resp_in_team = (str(licitacao.po_id) == str(tarefa.responsavel_id)) or (
                db.query(LicitacaoAnalista).filter(
                    LicitacaoAnalista.licitacao_id == licitacao_id,
                    LicitacaoAnalista.usuario_id == tarefa.responsavel_id
                ).first() is not None
            )
            if not is_resp_in_team:
                raise HTTPException(
                    status_code=400,
                    detail="O responsável selecionado deve fazer parte da equipe da licitação."
                )

            analyst = db.query(LicitacaoAnalista).filter(
                LicitacaoAnalista.licitacao_id == licitacao_id,
                LicitacaoAnalista.usuario_id == tarefa.responsavel_id
            ).first()
            if analyst:
                if tarefa.data_limite.tzinfo is None:
                    data_limite_aware = tarefa.data_limite.replace(tzinfo=timezone.utc)
                else:
                    data_limite_aware = tarefa.data_limite

                analyst_limit_aware = analyst.data_limite
                if analyst_limit_aware.tzinfo is None:
                    analyst_limit_aware = analyst_limit_aware.replace(tzinfo=timezone.utc)

                if data_limite_aware.date() > analyst_limit_aware.date():
                    raise HTTPException(
                        status_code=400,
                        detail=f"A data limite da tarefa não pode ser posterior ao prazo de previsão de entrega do analista ({analyst_limit_aware.strftime('%d/%m/%Y')})."
                    )

        db.flush()

        LicitacaoService.sync_tarefa_to_checklist(db, tenant_id, tarefa.checklist_item_id, tarefa.checklist_aplicacao_id, tarefa.status, tarefa.responsavel_id)

        usuario_nome = current_user.name if current_user else "Sistema"
        usuario_id = str(current_user.id) if current_user else "system"

        if old_status != tarefa.status:
            andamento = LicitacaoTarefaAndamento(
                tarefa_id=tarefa.id,
                tenant_id=tenant_id,
                usuario_id=usuario_id,
                descricao=f"Status alterado para '{tarefa.status}'.",
                status_anterior=old_status,
                status_novo=tarefa.status
            )
            db.add(andamento)
            
            LicitacaoService.register_history(
                db,
                licitacao_id,
                tenant_id,
                usuario_id,
                f"{usuario_nome} alterou o status da tarefa '{tarefa.titulo}' de '{old_status}' para '{tarefa.status}'."
            )

        db.commit()
        return tarefa

    @staticmethod
    def create_tarefa_andamento(db: Session, tenant_id: str, company_id: str, licitacao_id: UUID, tarefa_id: UUID, descricao: str, current_user: User) -> LicitacaoTarefaAndamento:
        LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
        tarefa = LicitacaoService.get_tarefa_by_id(db, tenant_id, tarefa_id)

        usuario_id = str(current_user.id) if current_user else "system"

        andamento = LicitacaoTarefaAndamento(
            tarefa_id=tarefa.id,
            tenant_id=tenant_id,
            usuario_id=usuario_id,
            descricao=descricao,
            status_anterior=tarefa.status,
            status_novo=tarefa.status
        )
        db.add(andamento)
        db.flush()

        usuario_nome = current_user.name if current_user else "Sistema"
        LicitacaoService.register_history(
            db,
            licitacao_id,
            tenant_id,
            usuario_id,
            f"{usuario_nome} adicionou um andamento na tarefa '{tarefa.titulo}': {descricao[:100]}"
        )

        db.commit()
        return andamento

    @staticmethod
    def get_dashboard_summary(db: Session, tenant_id: str, company_id: str, licitacao_id: UUID, current_user: User) -> dict:
        from src.modules.purchase_budgets.models import PurchaseBudget

        # 1. Fetch Licitacao (will raise 404 if not found or mismatch of tenant/company)
        licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
        
        # 2. Resumo da Licitação
        cliente_nome = licitacao.customer_nome
        po_nome = licitacao.po_nome
        
        qtd_analistas = len(licitacao.analistas)
        qtd_lotes = len(licitacao.lotes)
        qtd_itens = sum(len(lote.items) for lote in licitacao.lotes)
        
        # Calculate kits count and items in kits
        kits = db.query(OpportunityKit).filter(OpportunityKit.licitacao_id == licitacao_id).all()
        qtd_kits = len(kits)
        
        qtd_orcamentos = db.query(PurchaseBudget).filter(PurchaseBudget.licitacao_id == licitacao_id).count()
        
        resumo = {
            "numero_edital": licitacao.numero_edital,
            "cliente": cliente_nome,
            "status": licitacao.status,
            "data_publicacao": licitacao.data_publicacao,
            "data_licitacao": licitacao.data_licitacao,
            "po_responsavel": po_nome,
            "qtd_analistas": qtd_analistas,
            "qtd_lotes": qtd_lotes,
            "qtd_itens": qtd_itens,
            "qtd_kits": qtd_kits,
            "qtd_orcamentos": qtd_orcamentos
        }
        
        # 3. Resumo Financeiro
        total_venda = licitacao.valor_total_venda or Decimal("0.0")
        margem_geral = licitacao.margem_ponderada_global or Decimal("0.0")
        
        total_custo = Decimal("0.0")
        total_lucro_global = Decimal("0.0")
        kit_service = OpportunityKitService(db)
        for kit in kits:
            try:
                fin = kit_service.calculate_financials(kit, tenant_id)
                summary = fin.get("summary", {})
                
                if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
                    valor_mensal_kit = Decimal(str(summary.get("valor_mensal_kit", 0)))
                    lucro_mensal_kit = Decimal(str(summary.get("lucro_mensal_kit", 0)))
                    
                    kit_venda = valor_mensal_kit
                    kit_lucro = lucro_mensal_kit
                else:
                    valor_mensal_kit = Decimal(str(summary.get("valor_mensal_kit", 0)))
                    vlr_instal_calc = Decimal(str(summary.get("vlr_instal_calc", 0)))
                    prazo_mensalidades = max(0, kit.prazo_contrato_meses - kit.prazo_instalacao_meses)
                    
                    kit_venda = valor_mensal_kit * Decimal(prazo_mensalidades) + vlr_instal_calc
                    
                    lucro_mensal_kit = Decimal(str(summary.get("lucro_mensal_kit", 0)))
                    imposto_instalacao = Decimal(str(summary.get("imposto_instalacao", 0)))
                    lucro_instalacao = vlr_instal_calc - imposto_instalacao - (vlr_instal_calc * Decimal(str(kit.perc_comissao or 0)) / Decimal("100.0"))
                    
                    kit_lucro = (lucro_mensal_kit * Decimal(prazo_mensalidades)) + lucro_instalacao
                
                total_lucro_global += kit_lucro
                total_custo += (kit_venda - kit_lucro)
            except Exception:
                pass
                
        financeiro = {
            "total_custo": total_custo,
            "total_venda": total_venda,
            "lucro_estimado": total_lucro_global,
            "margem_geral": margem_geral
        }
        
        # 4. Checklist Progress
        checklist_items = db.query(LicitacaoChecklistItem).join(LicitacaoChecklistGrupo).filter(
            LicitacaoChecklistGrupo.licitacao_id == licitacao_id,
            LicitacaoChecklistItem.tenant_id == tenant_id
        ).all()
        
        std_items = [item for item in checklist_items if item.grupo.nome != "Análise Técnica"]
        
        tech_aplicacoes = db.query(LicitacaoChecklistAplicacao).filter(
            LicitacaoChecklistAplicacao.licitacao_id == licitacao_id,
            LicitacaoChecklistAplicacao.tenant_id == tenant_id
        ).all()
        
        chk_points = []
        for item in std_items:
            chk_points.append(item.status)
        for ap in tech_aplicacoes:
            chk_points.append(ap.status)
            
        chk_total = len(chk_points)
        chk_pendentes = sum(1 for status in chk_points if status in ["Pendente", "Pausado", "Pausada"])
        chk_em_andamento = sum(1 for status in chk_points if status == "Em Andamento")
        chk_concluidos = sum(1 for status in chk_points if status == "Concluído")
        chk_nao_aplicaveis = sum(1 for status in chk_points if status == "Não Aplicável")
        
        chk_valid_total = chk_total - chk_nao_aplicaveis
        chk_percentual = Decimal("0.0")
        if chk_valid_total > 0:
            chk_percentual = (Decimal(str(chk_concluidos)) / Decimal(str(chk_valid_total))) * Decimal("100.0")
            
        checklist = {
            "total": chk_total,
            "pendentes": chk_pendentes,
            "em_andamento": chk_em_andamento,
            "concluidos": chk_concluidos,
            "nao_aplicaveis": chk_nao_aplicaveis,
            "percentual": chk_percentual
        }
        
        # 5. Tarefas
        tarefas_obj = db.query(LicitacaoTarefa).filter(
            LicitacaoTarefa.licitacao_id == licitacao_id,
            LicitacaoTarefa.tenant_id == tenant_id
        ).all()
        
        t_total = len(tarefas_obj)
        t_pendentes = sum(1 for t in tarefas_obj if t.status == "Pendente")
        t_em_andamento = sum(1 for t in tarefas_obj if t.status == "Em Andamento")
        t_pausadas = sum(1 for t in tarefas_obj if t.status == "Pausada")
        t_concluidas = sum(1 for t in tarefas_obj if t.status == "Concluída")
        t_canceladas = sum(1 for t in tarefas_obj if t.status == "Cancelada")
        
        t_valid_total = t_total - t_canceladas
        t_percentual = Decimal("0.0")
        if t_valid_total > 0:
            t_percentual = (Decimal(str(t_concluidas)) / Decimal(str(t_valid_total))) * Decimal("100.0")
            
        tarefas = {
            "total": t_total,
            "pendentes": t_pendentes,
            "em_andamento": t_em_andamento,
            "pausadas": t_pausadas,
            "concluidas": t_concluidas,
            "canceladas": t_canceladas,
            "percentual": t_percentual
        }
        
        # 6. Distribuição por Analista
        current_time = datetime.now(timezone.utc)
        distribuicao_analistas = []
        for analista in licitacao.analistas:
            analista_user_id = analista.usuario_id
            
            analista_tasks = [t for t in tarefas_obj if t.responsavel_id == analista_user_id]
            t_pend = sum(1 for t in analista_tasks if t.status == "Pendente")
            t_and = sum(1 for t in analista_tasks if t.status == "Em Andamento")
            t_paus = sum(1 for t in analista_tasks if t.status == "Pausada")
            t_conc = sum(1 for t in analista_tasks if t.status == "Concluída")
            
            t_atras = 0
            for t in analista_tasks:
                if t.status not in ["Concluída", "Cancelada"]:
                    limit_date = t.data_limite
                    if limit_date.tzinfo is None:
                        limit_date = limit_date.replace(tzinfo=timezone.utc)
                    if limit_date < current_time:
                        t_atras += 1
                        
            chk_atrib = 0
            for item in std_items:
                if item.usuario_id == analista_user_id:
                    chk_atrib += 1
            for ap in tech_aplicacoes:
                if ap.usuario_id == analista_user_id:
                    chk_atrib += 1
                    
            if t_atras > 0:
                status_ind = "Vermelho"
            else:
                has_warning = False
                for t in analista_tasks:
                    if t.status not in ["Concluída", "Cancelada"]:
                        limit_date = t.data_limite
                        if limit_date.tzinfo is None:
                            limit_date = limit_date.replace(tzinfo=timezone.utc)
                        if limit_date - current_time < timedelta(hours=24):
                            has_warning = True
                            break
                status_ind = "Amarelo" if has_warning else "Verde"
                
            distribuicao_analistas.append({
                "usuario_id": analista_user_id,
                "nome": analista.usuario_nome,
                "prazo_entrega": analista.data_limite,
                "tarefas_pendentes": t_pend,
                "tarefas_em_andamento": t_and,
                "tarefas_pausadas": t_paus,
                "tarefas_concluidas": t_conc,
                "tarefas_atrasadas": t_atras,
                "checklist_atribuidos": chk_atrib,
                "status_indicador": status_ind
            })
            
        # 7. Últimos Andamentos
        history_objs = db.query(LicitacaoHistory).filter(
            LicitacaoHistory.licitacao_id == licitacao_id,
            LicitacaoHistory.tenant_id == tenant_id
        ).order_by(LicitacaoHistory.data_movimentacao.desc()).limit(10).all()
        
        ultimos_andamentos = []
        for h in history_objs:
            ultimos_andamentos.append({
                "data": h.data_movimentacao,
                "usuario": h.usuario_nome,
                "descricao": h.descricao
            })
            
        # 8. Resumo Lotes
        qtd_produtos = Decimal("0.0")
        qtd_servicos = Decimal("0.0")
        for kit in kits:
            for item in kit.items:
                if item.tipo_item == "PRODUTO":
                    qtd_produtos += item.quantidade_no_kit
                elif item.tipo_item == "SERVICO_PROPRIO":
                    qtd_servicos += item.quantidade_no_kit
                    
        resumo_lotes = {
            "qtd_lotes": qtd_lotes,
            "qtd_itens": qtd_itens,
            "qtd_kits": qtd_kits,
            "qtd_produtos": qtd_produtos,
            "qtd_servicos": qtd_servicos
        }
        
        # 9. Alertas
        alertas = []
        
        has_checklist_overdue = False
        for t in tarefas_obj:
            if (t.checklist_item_id or t.checklist_aplicacao_id) and t.status not in ["Concluída", "Cancelada"]:
                limit_date = t.data_limite
                if limit_date.tzinfo is None:
                    limit_date = limit_date.replace(tzinfo=timezone.utc)
                if limit_date < current_time:
                    has_checklist_overdue = True
                    break
        if has_checklist_overdue:
            alertas.append({
                "tipo": "CHECKLIST_ATRASADO",
                "mensagem": "Existem itens de checklist vinculados a tarefas atrasadas.",
                "nivel": "Vermelho"
            })
            
        t_atrasadas_total = 0
        for t in tarefas_obj:
            if t.status not in ["Concluída", "Cancelada"]:
                limit_date = t.data_limite
                if limit_date.tzinfo is None:
                    limit_date = limit_date.replace(tzinfo=timezone.utc)
                if limit_date < current_time:
                    t_atrasadas_total += 1
        if t_atrasadas_total > 0:
            alertas.append({
                "tipo": "TAREFA_ATRASADA",
                "mensagem": f"Existem {t_atrasadas_total} tarefas operacionais com prazo vencido.",
                "nivel": "Vermelho"
            })
            
        analistas_atrasados = [da["nome"] for da in distribuicao_analistas if da["tarefas_atrasadas"] > 0]
        if analistas_atrasados:
            alertas.append({
                "tipo": "ANALISTA_COM_TAREFA_VENCIDA",
                "mensagem": f"Analistas com tarefas vencidas: {', '.join(analistas_atrasados)}.",
                "nivel": "Vermelho"
            })
            
        if not licitacao.po_id:
            alertas.append({
                "tipo": "LICITACAO_SEM_PO",
                "mensagem": "Este edital de licitação não possui P.O. responsável definido.",
                "nivel": "Vermelho"
            })
            
        if licitacao.status != "Criada" and qtd_analistas == 0:
            alertas.append({
                "tipo": "LICITACAO_SEM_ANALISTAS",
                "mensagem": "Nenhum analista alocado na equipe para esta licitação.",
                "nivel": "Amarelo"
            })
            
        items_sem_kits = []
        for lote in licitacao.lotes:
            for item in lote.items:
                if not item.kits:
                    items_sem_kits.append(item.codigo)
        if items_sem_kits:
            alertas.append({
                "tipo": "ITEM_SEM_KITS",
                "mensagem": f"Itens sem Kits de Oportunidade vinculados: {', '.join(items_sem_kits)}.",
                "nivel": "Amarelo"
            })
            
        if qtd_orcamentos == 0:
            alertas.append({
                "tipo": "ITEM_SEM_ORCAMENTOS",
                "mensagem": "Não há orçamentos de compras de fornecedores vinculados a este edital.",
                "nivel": "Amarelo"
            })
            
        return {
            "resumo": resumo,
            "financeiro": financeiro,
            "checklist": checklist,
            "tarefas": tarefas,
            "distribuicao_analistas": distribuicao_analistas,
            "ultimos_andamentos": ultimos_andamentos,
            "resumo_lotes": resumo_lotes,
            "alertas": alertas
        }

