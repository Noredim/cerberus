import uuid
import calendar
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from sqlalchemy import or_

from .models import FormaPagamento, FormaPagamentoParcela, PlanejamentoFinanceiro
from .schemas import FormaPagamentoCreate, FormaPagamentoUpdate, TipoDistribuicaoEnum, TipoMovimentoEnum
from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem, RentalBudgetItem
from src.modules.purchase_budgets.models import PurchaseBudget

class PaymentMethodsService:
    @staticmethod
    def list_formas(db: Session, tenant_id: str) -> List[FormaPagamento]:
        return db.query(FormaPagamento).filter(FormaPagamento.tenant_id == tenant_id).order_by(FormaPagamento.descricao.asc()).all()

    @staticmethod
    def get_forma(db: Session, tenant_id: str, forma_id: uuid.UUID) -> Optional[FormaPagamento]:
        return db.query(FormaPagamento).filter(FormaPagamento.id == forma_id, FormaPagamento.tenant_id == tenant_id).first()

    @staticmethod
    def create_forma(db: Session, tenant_id: str, data: FormaPagamentoCreate) -> FormaPagamento:
        db_forma = FormaPagamento(
            tenant_id=tenant_id,
            descricao=data.descricao,
            tipo_uso=data.tipo_uso.value,
            tipo_distribuicao=data.tipo_distribuicao.value,
            ativo=data.ativo,
            observacao=data.observacao
        )
        db.add(db_forma)
        db.flush()  # get ID

        for p in data.parcelas:
            db_parcela = FormaPagamentoParcela(
                forma_pagamento_id=db_forma.id,
                sequencia=p.sequencia,
                descricao=p.descricao,
                intervalo_dias=p.intervalo_dias,
                percentual=p.percentual,
                valor_fixo=p.valor_fixo
            )
            db.add(db_parcela)

        db.commit()
        db.refresh(db_forma)
        return db_forma

    @staticmethod
    def update_forma(db: Session, tenant_id: str, forma_id: uuid.UUID, data: FormaPagamentoUpdate) -> Optional[FormaPagamento]:
        db_forma = PaymentMethodsService.get_forma(db, tenant_id, forma_id)
        if not db_forma:
            return None

        # Check if in use before allow update if it's changing structure
        # (For safety, we validate if it has linked transactions)
        is_used = PaymentMethodsService.check_if_used(db, forma_id)
        if is_used:
            # Check if fields that alter layout are changing
            # If description or active state is changing it might be ok, but changing installments is blocked
            raise ValueError("Esta forma de pagamento já possui movimentações vinculadas e não pode ser alterada. Inative-a e crie uma nova.")

        db_forma.descricao = data.descricao
        db_forma.tipo_uso = data.tipo_uso.value
        db_forma.tipo_distribuicao = data.tipo_distribuicao.value
        db_forma.ativo = data.ativo
        db_forma.observacao = data.observacao

        # Remove old installments
        db.query(FormaPagamentoParcela).filter(FormaPagamentoParcela.forma_pagamento_id == forma_id).delete()
        db.flush()

        for p in data.parcelas:
            db_parcela = FormaPagamentoParcela(
                forma_pagamento_id=db_forma.id,
                sequencia=p.sequencia,
                descricao=p.descricao,
                intervalo_dias=p.intervalo_dias,
                percentual=p.percentual,
                valor_fixo=p.valor_fixo
            )
            db.add(db_parcela)

        db.commit()
        db.refresh(db_forma)
        return db_forma

    @staticmethod
    def delete_forma(db: Session, tenant_id: str, forma_id: uuid.UUID) -> bool:
        db_forma = PaymentMethodsService.get_forma(db, tenant_id, forma_id)
        if not db_forma:
            return False

        if PaymentMethodsService.check_if_used(db, forma_id):
            raise ValueError("Esta forma já possui movimentações vinculadas")

        db.delete(db_forma)
        db.commit()
        return True

    @staticmethod
    def check_if_used(db: Session, forma_id: uuid.UUID) -> bool:
        from src.modules.sales_budgets.models import SalesBudget
        from src.modules.purchase_budgets.models import PurchaseBudget

        sales_count = db.query(SalesBudget).filter(SalesBudget.forma_pagamento_id == forma_id).count()
        purchase_count = db.query(PurchaseBudget).filter(PurchaseBudget.forma_pagamento_id == forma_id).count()

        return (sales_count + purchase_count) > 0

    @staticmethod
    def add_months(sourcedate: date, months: int) -> date:
        month = sourcedate.month - 1 + months
        year = sourcedate.year + month // 12
        month = month % 12 + 1
        day = min(sourcedate.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)

    @staticmethod
    def generate_planning_from_rules(
        db: Session,
        tenant_id: str,
        company_id: uuid.UUID,
        origem_tipo: str,
        origem_id: uuid.UUID,
        valor_total: Decimal,
        data_inicial: date,
        tipo_distribuicao: str,
        parcelas_rules: List[dict],
        tipo_movimento: str
    ) -> List[PlanejamentoFinanceiro]:
        if valor_total <= 0:
            return []

        num_parcelas = len(parcelas_rules)
        if num_parcelas == 0:
            return []

        # Convert values to Decimal
        valor_total_dec = Decimal(str(valor_total))
        installments_values = []

        # 1. Compute values for each installment
        if tipo_distribuicao == TipoDistribuicaoEnum.PERCENTUAL.value:
            for p in parcelas_rules:
                pct = Decimal(str(p.get("percentual") or 0))
                val = round(valor_total_dec * (pct / Decimal('100')), 2)
                installments_values.append(val)
        elif tipo_distribuicao == TipoDistribuicaoEnum.RATEIO_IGUAL.value:
            for p in parcelas_rules:
                val = round(valor_total_dec / Decimal(str(num_parcelas)), 2)
                installments_values.append(val)
        elif tipo_distribuicao == TipoDistribuicaoEnum.VALOR_FIXO.value:
            for p in parcelas_rules:
                v_fixo = p.get("valor_fixo")
                val = round(Decimal(str(v_fixo)), 2) if v_fixo is not None else Decimal('0')
                installments_values.append(val)

            # Determine dynamic "Saldo" installment if any
            saldo_idx = -1
            for idx, p in enumerate(parcelas_rules):
                if p.get("valor_fixo") is None:
                    saldo_idx = idx
                    break

            if saldo_idx != -1:
                sum_others = sum(installments_values[i] for i in range(num_parcelas) if i != saldo_idx)
                installments_values[saldo_idx] = max(Decimal('0'), valor_total_dec - sum_others)
            else:
                # If all filled, enforce sum equals total
                total_sum = sum(installments_values)
                if total_sum != valor_total_dec:
                    raise ValueError(f"A soma das parcelas ({total_sum}) deve ser igual ao valor total ({valor_total_dec})")

        # 2. Adjust rounding difference for PERCENTUAL and RATEIO_IGUAL (rest goes to last installment)
        if tipo_distribuicao in [TipoDistribuicaoEnum.PERCENTUAL.value, TipoDistribuicaoEnum.RATEIO_IGUAL.value]:
            total_calculated = sum(installments_values)
            diff = valor_total_dec - total_calculated
            if diff != 0:
                installments_values[-1] += diff

        # 3. Create PlanejamentoFinanceiro rows
        results = []
        for idx, p in enumerate(parcelas_rules):
            intervalo = int(p.get("intervalo_dias") or 0)
            data_prevista = data_inicial + timedelta(days=intervalo)
            
            pf = PlanejamentoFinanceiro(
                tenant_id=tenant_id,
                company_id=company_id,
                origem_tipo=origem_tipo,
                origem_id=origem_id,
                numero_parcela=p.get("sequencia") or (idx + 1),
                descricao=p.get("descricao") or f"Parcela {idx + 1}",
                data_prevista=data_prevista,
                valor_previsto=installments_values[idx],
                tipo_movimento=tipo_movimento,
                status='PREVISTO'
            )
            db.add(pf)
            results.append(pf)

        return results

    @staticmethod
    def sync_sales_budget_planning(db: Session, budget: SalesBudget):
        # 1. Clear previous planning records
        db.query(PlanejamentoFinanceiro).filter(
            PlanejamentoFinanceiro.origem_id == budget.id,
            PlanejamentoFinanceiro.origem_tipo == 'SALES_BUDGET'
        ).delete()

        if not budget.forma_pagamento_id or not budget.data_vencimento_inicial:
            return

        data_inicial = budget.data_vencimento_inicial
        if isinstance(data_inicial, datetime):
            data_inicial = data_inicial.date()

        # 2. Calculate Sales budget totals
        # Sale portion = items + rental_items of type VENDA_EQUIPAMENTOS
        total_venda_items = sum(Decimal(str(i.total_venda or 0)) for i in budget.items)
        total_venda_kits = sum(Decimal(str(ri.kit_valor_mensal or 0)) * Decimal(str(ri.quantidade or 1)) for ri in budget.rental_items if getattr(ri, "tipo_contrato_kit", None) == 'VENDA_EQUIPAMENTOS')
        valor_venda = total_venda_items + total_venda_kits

        # 3. Generate planning for Sales portion
        if valor_venda > 0:
            # Read rules from snapshot if present, otherwise from database
            parcelas_rules = []
            tipo_distribuicao = None
            
            if budget.forma_pagamento_snapshot:
                snap = budget.forma_pagamento_snapshot
                tipo_distribuicao = snap.get("tipo_distribuicao")
                parcelas_rules = snap.get("parcelas") or []
            else:
                forma = db.query(FormaPagamento).filter(FormaPagamento.id == budget.forma_pagamento_id).first()
                if forma:
                    tipo_distribuicao = forma.tipo_distribuicao
                    parcelas_rules = [
                        {
                            "sequencia": p.sequencia,
                            "descricao": p.descricao,
                            "intervalo_dias": p.intervalo_dias,
                            "percentual": float(p.percentual) if p.percentual is not None else None,
                            "valor_fixo": float(p.valor_fixo) if p.valor_fixo is not None else None
                        }
                        for p in forma.parcelas
                    ]
                    # Save snapshot
                    budget.forma_pagamento_snapshot = {
                        "id": str(forma.id),
                        "descricao": forma.descricao,
                        "tipo_distribuicao": forma.tipo_distribuicao,
                        "parcelas": parcelas_rules
                    }
                    db.add(budget)

            if tipo_distribuicao and parcelas_rules:
                PaymentMethodsService.generate_planning_from_rules(
                    db=db,
                    tenant_id=budget.tenant_id,
                    company_id=budget.company_id,
                    origem_tipo='SALES_BUDGET',
                    origem_id=budget.id,
                    valor_total=valor_venda,
                    data_inicial=data_inicial,
                    tipo_distribuicao=tipo_distribuicao,
                    parcelas_rules=parcelas_rules,
                    tipo_movimento=TipoMovimentoEnum.RECEBIMENTO.value
                )

        # 4. Option C: Generate recurring monthly planning for Leases/Rentals
        valid_rentals = [ri for ri in budget.rental_items if getattr(ri, "tipo_contrato_kit", None) != 'VENDA_EQUIPAMENTOS']
        for ri in valid_rentals:
            prazo = int(ri.prazo_contrato or 0)
            valor_mensal = Decimal(str(ri.valor_mensal or 0)) * Decimal(str(ri.quantidade or 1))
            
            if valor_mensal > 0 and prazo > 0:
                for m in range(1, prazo + 1):
                    # Recurrence is month-based
                    data_prevista = PaymentMethodsService.add_months(data_inicial, m)
                    
                    pf = PlanejamentoFinanceiro(
                        tenant_id=budget.tenant_id,
                        company_id=budget.company_id,
                        origem_tipo='SALES_BUDGET',
                        origem_id=budget.id,
                        numero_parcela=m,
                        descricao=f"Mensalidade {m}/{prazo} - {ri.product_nome}",
                        data_prevista=data_prevista,
                        valor_previsto=valor_mensal,
                        tipo_movimento=TipoMovimentoEnum.RECEBIMENTO.value,
                        status='PREVISTO'
                    )
                    db.add(pf)

    @staticmethod
    def sync_purchase_budget_planning(db: Session, budget: PurchaseBudget):
        # 1. Clear previous planning records
        db.query(PlanejamentoFinanceiro).filter(
            PlanejamentoFinanceiro.origem_id == budget.id,
            PlanejamentoFinanceiro.origem_tipo == 'PURCHASE_BUDGET'
        ).delete()

        if not budget.forma_pagamento_id or not budget.data_vencimento_inicial:
            return

        data_inicial = budget.data_vencimento_inicial
        if isinstance(data_inicial, datetime):
            data_inicial = data_inicial.date()

        valor_total = Decimal(str(budget.valor_total))

        if valor_total > 0:
            parcelas_rules = []
            tipo_distribuicao = None
            
            if budget.forma_pagamento_snapshot:
                snap = budget.forma_pagamento_snapshot
                tipo_distribuicao = snap.get("tipo_distribuicao")
                parcelas_rules = snap.get("parcelas") or []
            else:
                forma = db.query(FormaPagamento).filter(FormaPagamento.id == budget.forma_pagamento_id).first()
                if forma:
                    tipo_distribuicao = forma.tipo_distribuicao
                    parcelas_rules = [
                        {
                            "sequencia": p.sequencia,
                            "descricao": p.descricao,
                            "intervalo_dias": p.intervalo_dias,
                            "percentual": float(p.percentual) if p.percentual is not None else None,
                            "valor_fixo": float(p.valor_fixo) if p.valor_fixo is not None else None
                        }
                        for p in forma.parcelas
                    ]
                    # Save snapshot
                    budget.forma_pagamento_snapshot = {
                        "id": str(forma.id),
                        "descricao": forma.descricao,
                        "tipo_distribuicao": forma.tipo_distribuicao,
                        "parcelas": parcelas_rules
                    }
                    db.add(budget)

            if tipo_distribuicao and parcelas_rules:
                PaymentMethodsService.generate_planning_from_rules(
                    db=db,
                    tenant_id=budget.tenant_id,
                    company_id=budget.company_id,
                    origem_tipo='PURCHASE_BUDGET',
                    origem_id=budget.id,
                    valor_total=valor_total,
                    data_inicial=data_inicial,
                    tipo_distribuicao=tipo_distribuicao,
                    parcelas_rules=parcelas_rules,
                    tipo_movimento=TipoMovimentoEnum.PAGAMENTO.value
                )
