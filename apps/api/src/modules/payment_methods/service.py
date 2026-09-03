import uuid
import calendar
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Tuple, Dict, Any
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
    def _clear_other_defaults(db: Session, tenant_id: str, current_id: Optional[uuid.UUID] = None):
        query = db.query(FormaPagamento).filter(FormaPagamento.tenant_id == tenant_id, FormaPagamento.is_default == True)
        if current_id:
            query = query.filter(FormaPagamento.id != current_id)
        for fp in query.all():
            fp.is_default = False

    @staticmethod
    def create_forma(db: Session, tenant_id: str, data: FormaPagamentoCreate) -> FormaPagamento:
        if data.is_default:
            PaymentMethodsService._clear_other_defaults(db, tenant_id)

        db_forma = FormaPagamento(
            tenant_id=tenant_id,
            descricao=data.descricao,
            tipo_uso=data.tipo_uso.value,
            tipo_distribuicao=data.tipo_distribuicao.value,
            taxa_juros_mensal=data.taxa_juros_mensal,
            ativo=data.ativo,
            is_default=data.is_default,
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

        if data.is_default:
            PaymentMethodsService._clear_other_defaults(db, tenant_id, forma_id)

        db_forma.descricao = data.descricao
        db_forma.tipo_uso = data.tipo_uso.value
        db_forma.tipo_distribuicao = data.tipo_distribuicao.value
        db_forma.taxa_juros_mensal = data.taxa_juros_mensal
        db_forma.ativo = data.ativo
        db_forma.is_default = data.is_default
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
    def calculate_installments_schedule(
        valor_total: Decimal,
        parcelas_rules: List[dict],
        tipo_distribuicao: str,
        taxa_juros_mensal: Decimal = Decimal('0')
    ) -> Dict[str, Any]:
        """
        Calcula os valores exatos de cada parcela.
        Se taxa_juros_mensal > 0:
          - Parcelas com intervalo_dias == 0 são consideradas Entrada (não incidem juros).
          - O valor financiado PV = valor_total - valor_entrada.
          - n = quantidade de parcelas financiadas (intervalo_dias > 0).
          - Para i = taxa_juros_mensal / 100:
              PMT = (PV * i) / (1 - (1 + i)^(-n))
            arredondado com ROUND_HALF_UP para 2 casas decimais.
          - Cada parcela financiada recebe exatamente o valor PMT fixo.
          - Total com juros = valor_entrada + (n * PMT)
          - Total de juros = (n * PMT) - PV
        Se taxa_juros_mensal == 0:
          - Mantém o rateio padrão existente (PERCENTUAL, RATEIO_IGUAL, VALOR_FIXO).
        """
        if valor_total <= 0 or not parcelas_rules:
            return {
                "installments_values": [Decimal('0')] * len(parcelas_rules),
                "total_entrada": Decimal('0'),
                "valor_financiado": Decimal('0'),
                "taxa_juros_mensal": Decimal(str(taxa_juros_mensal or 0)),
                "pmt": Decimal('0'),
                "total_financiado": Decimal('0'),
                "total_juros": Decimal('0'),
                "total_geral": Decimal('0')
            }

        num_parcelas = len(parcelas_rules)
        valor_total_dec = Decimal(str(valor_total))
        taxa_juros_dec = Decimal(str(taxa_juros_mensal or 0))

        # Identifica índices de entrada (intervalo_dias == 0) e parcelas financiadas (intervalo_dias > 0)
        entrada_indices = []
        financiada_indices = []
        for idx, p in enumerate(parcelas_rules):
            intervalo = int(p.get("intervalo_dias") or 0)
            if intervalo == 0:
                entrada_indices.append(idx)
            else:
                financiada_indices.append(idx)

        installments_values = [Decimal('0')] * num_parcelas

        # CASO 1: SEM JUROS (taxa_juros_dec <= 0)
        if taxa_juros_dec <= Decimal('0'):
            if tipo_distribuicao == TipoDistribuicaoEnum.PERCENTUAL.value:
                for idx, p in enumerate(parcelas_rules):
                    pct = Decimal(str(p.get("percentual") or 0))
                    val = (valor_total_dec * (pct / Decimal('100'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    installments_values[idx] = val
            elif tipo_distribuicao == TipoDistribuicaoEnum.RATEIO_IGUAL.value:
                for idx in range(num_parcelas):
                    val = (valor_total_dec / Decimal(str(num_parcelas))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    installments_values[idx] = val
            elif tipo_distribuicao == TipoDistribuicaoEnum.VALOR_FIXO.value:
                saldo_idx = -1
                for idx, p in enumerate(parcelas_rules):
                    v_fixo = p.get("valor_fixo")
                    if v_fixo is not None:
                        val = Decimal(str(v_fixo)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                        installments_values[idx] = val
                    else:
                        saldo_idx = idx

                if saldo_idx != -1:
                    sum_others = sum(installments_values[i] for i in range(num_parcelas) if i != saldo_idx)
                    installments_values[saldo_idx] = max(Decimal('0'), valor_total_dec - sum_others)
                else:
                    total_sum = sum(installments_values)
                    if total_sum != valor_total_dec:
                        raise ValueError(f"A soma das parcelas ({total_sum}) deve ser igual ao valor total ({valor_total_dec})")

            # Ajuste de centavos de arredondamento na última parcela para PERCENTUAL e RATEIO_IGUAL
            if tipo_distribuicao in [TipoDistribuicaoEnum.PERCENTUAL.value, TipoDistribuicaoEnum.RATEIO_IGUAL.value]:
                total_calculated = sum(installments_values)
                diff = valor_total_dec - total_calculated
                if diff != Decimal('0'):
                    installments_values[-1] += diff

            total_entrada = sum(installments_values[i] for i in entrada_indices)
            total_financiado = sum(installments_values[i] for i in financiada_indices)

            return {
                "installments_values": installments_values,
                "total_entrada": total_entrada,
                "valor_financiado": total_financiado,
                "taxa_juros_mensal": Decimal('0'),
                "pmt": installments_values[financiada_indices[0]] if financiada_indices else Decimal('0'),
                "total_financiado": total_financiado,
                "total_juros": Decimal('0'),
                "total_geral": valor_total_dec
            }

        # CASO 2: COM JUROS (taxa_juros_dec > 0) — Metodologia de Prestações Fixas / Desconto a Valor Presente
        i = taxa_juros_dec / Decimal('100')

        # 1. Determina os pesos w_k de cada parcela
        weights: List[Decimal] = []
        if tipo_distribuicao == TipoDistribuicaoEnum.PERCENTUAL.value:
            for p in parcelas_rules:
                pct = Decimal(str(p.get("percentual") or 0))
                weights.append(pct / Decimal('100'))
        elif tipo_distribuicao == TipoDistribuicaoEnum.RATEIO_IGUAL.value:
            w_equal = Decimal('1') / Decimal(str(num_parcelas))
            weights = [w_equal] * num_parcelas
        else:  # VALOR_FIXO
            total_fixo = sum(Decimal(str(p.get("valor_fixo") or 0)) for p in parcelas_rules)
            if total_fixo > Decimal('0'):
                weights = [Decimal(str(p.get("valor_fixo") or 0)) / total_fixo for p in parcelas_rules]
            else:
                w_equal = Decimal('1') / Decimal(str(num_parcelas))
                weights = [w_equal] * num_parcelas

        # 2. Calcula a soma dos fatores de desconto: sum( w_k / (1 + i)^(dias_k / 30) )
        sum_discounted_weights = Decimal('0')
        for idx, p in enumerate(parcelas_rules):
            dias = int(p.get("intervalo_dias") or 0)
            if dias == 0:
                df = Decimal('1')
            elif dias % 30 == 0:
                meses = dias // 30
                df = (Decimal('1') + i) ** (-meses)
            else:
                meses_float = dias / 30.0
                df = Decimal(str((1.0 + float(i)) ** (-meses_float)))
            
            sum_discounted_weights += weights[idx] * df

        # 3. Total com Juros = PV / sum_discounted_weights
        if sum_discounted_weights > Decimal('0'):
            total_com_juros = valor_total_dec / sum_discounted_weights
        else:
            total_com_juros = valor_total_dec

        # 4. Valor nominal de cada parcela = round(total_com_juros * weight, 2)
        for idx in range(num_parcelas):
            p_val = (total_com_juros * weights[idx]).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            installments_values[idx] = p_val

        # Para RATEIO_IGUAL, garantir que todas as parcelas tenham exatamente o mesmo valor nominal (PMT fixo)
        if tipo_distribuicao == TipoDistribuicaoEnum.RATEIO_IGUAL.value:
            pmt_val = installments_values[0]
            for idx in range(num_parcelas):
                installments_values[idx] = pmt_val

        total_geral = sum(installments_values)
        total_juros = total_geral - valor_total_dec
        total_entrada = sum(installments_values[idx] for idx, p in enumerate(parcelas_rules) if int(p.get("intervalo_dias") or 0) == 0)
        total_financiado = sum(installments_values[idx] for idx, p in enumerate(parcelas_rules) if int(p.get("intervalo_dias") or 0) > 0)
        pmt = installments_values[0] if installments_values else Decimal('0')

        return {
            "installments_values": installments_values,
            "total_entrada": total_entrada,
            "valor_financiado": total_financiado,
            "taxa_juros_mensal": taxa_juros_dec,
            "pmt": pmt,
            "total_financiado": total_financiado,
            "total_juros": total_juros,
            "total_geral": total_geral
        }

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
        tipo_movimento: str,
        taxa_juros_mensal: Decimal = Decimal('0')
    ) -> List[PlanejamentoFinanceiro]:
        if valor_total <= 0 or not parcelas_rules:
            return []

        calc_result = PaymentMethodsService.calculate_installments_schedule(
            valor_total=valor_total,
            parcelas_rules=parcelas_rules,
            tipo_distribuicao=tipo_distribuicao,
            taxa_juros_mensal=taxa_juros_mensal
        )

        installments_values = calc_result["installments_values"]

        # Create PlanejamentoFinanceiro rows
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

        # 2. Calculate Sales & Upfront Installation budget totals (Pagamento Único)
        total_venda_items = sum(Decimal(str(i.total_venda or 0)) for i in budget.items)
        total_venda_kits = sum(Decimal(str(ri.kit_valor_mensal or 0)) * Decimal(str(ri.quantidade or 1)) for ri in budget.rental_items if getattr(ri, "tipo_contrato_kit", None) == 'VENDA_EQUIPAMENTOS')
        total_instalacao_kits = sum(Decimal(str(ri.kit_valor_mensal or 0)) * Decimal(str(ri.quantidade or 1)) for ri in budget.rental_items if getattr(ri, "tipo_contrato_kit", None) == 'INSTALACAO' or getattr(ri, "is_kit_instalacao", False))
        valor_pagamento_unico = total_venda_items + total_venda_kits + total_instalacao_kits

        # 3. Generate planning for Sales & Installation portion
        if valor_pagamento_unico > 0:
            # Read rules from snapshot if present, otherwise from database
            parcelas_rules = []
            tipo_distribuicao = None
            taxa_juros_mensal = Decimal('0')
            
            if budget.forma_pagamento_snapshot:
                snap = budget.forma_pagamento_snapshot
                tipo_distribuicao = snap.get("tipo_distribuicao")
                parcelas_rules = snap.get("parcelas") or []
                taxa_juros_mensal = Decimal(str(snap.get("taxa_juros_mensal") or 0))
            else:
                forma = db.query(FormaPagamento).filter(FormaPagamento.id == budget.forma_pagamento_id).first()
                if forma:
                    tipo_distribuicao = forma.tipo_distribuicao
                    taxa_juros_mensal = Decimal(str(forma.taxa_juros_mensal or 0))
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
                        "taxa_juros_mensal": float(taxa_juros_mensal),
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
                    valor_total=valor_pagamento_unico,
                    data_inicial=data_inicial,
                    tipo_distribuicao=tipo_distribuicao,
                    parcelas_rules=parcelas_rules,
                    tipo_movimento=TipoMovimentoEnum.RECEBIMENTO.value,
                    taxa_juros_mensal=taxa_juros_mensal
                )

        # 4. Option C: Generate recurring monthly planning for Leases/Rentals (Strictly preserved, without interest)
        valid_rentals = [
            ri for ri in budget.rental_items 
            if getattr(ri, "tipo_contrato_kit", None) not in ('VENDA_EQUIPAMENTOS', 'INSTALACAO') 
            and not getattr(ri, "is_kit_instalacao", False)
        ]
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
            taxa_juros_mensal = Decimal('0')
            
            if budget.forma_pagamento_snapshot:
                snap = budget.forma_pagamento_snapshot
                tipo_distribuicao = snap.get("tipo_distribuicao")
                parcelas_rules = snap.get("parcelas") or []
                taxa_juros_mensal = Decimal(str(snap.get("taxa_juros_mensal") or 0))
            else:
                forma = db.query(FormaPagamento).filter(FormaPagamento.id == budget.forma_pagamento_id).first()
                if forma:
                    tipo_distribuicao = forma.tipo_distribuicao
                    taxa_juros_mensal = Decimal(str(forma.taxa_juros_mensal or 0))
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
                        "taxa_juros_mensal": float(taxa_juros_mensal),
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
                    tipo_movimento=TipoMovimentoEnum.PAGAMENTO.value,
                    taxa_juros_mensal=taxa_juros_mensal
                )
