from __future__ import annotations
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from src.modules.products.models import Product
from src.modules.solution_analysis.models import SolutionAnalysis, SolutionAnalysisItem
from src.modules.solution_analysis.schemas import (
    SolutionAnalysisCreate,
    SolutionAnalysisItemCreate,
    SolutionAnalysisSummary,
    SolutionAnalysisUpdate,
)
from src.modules.users.models import User


class SolutionAnalysisService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _get_price(self, product: Product, tipo_analise: str) -> Decimal:
        """Return the correct unit price based on analysis type and product nature."""
        # Licença (SERVICO) always uses revenda price
        if product.tipo == "SERVICO" or tipo_analise == "REVENDA":
            price = product.vlr_referencia_revenda
        else:
            # LOCACAO type → use uso/consumo; fall back to revenda if absent
            price = product.vlr_referencia_uso_consumo or product.vlr_referencia_revenda

        if not price or price <= 0:
            raise ValueError(f"Item sem valor cadastrado: {product.nome}")
        return Decimal(str(price))

    def _resolve_product(self, item_id: Optional[UUID], tenant_id: str) -> Optional[Product]:
        if not item_id:
            return None
        product = (
            self.db.query(Product)
            .filter(Product.id == item_id, Product.tenant_id == tenant_id)
            .first()
        )
        if not product:
            raise ValueError(f"Produto não encontrado: {item_id}")
        return product

    def _compute_totals(self, analise: SolutionAnalysis) -> dict:
        total_a = Decimal("0")
        total_b = Decimal("0")
        total_c = Decimal("0")
        for it in analise.items:
            total_a += it.vlr_total_a or Decimal("0")
            total_b += it.vlr_total_b or Decimal("0")
            total_c += it.vlr_total_c or Decimal("0")
        return {"total_a": total_a, "total_b": total_b, "total_c": total_c}

    def _compute_line_result(self, item: SolutionAnalysisItem) -> None:
        """Calculate winner, diff value and diff % for a single row."""
        slots: dict[str, Decimal] = {}
        if item.vlr_total_a and item.vlr_total_a > 0:
            slots["A"] = item.vlr_total_a
        if item.vlr_total_b and item.vlr_total_b > 0:
            slots["B"] = item.vlr_total_b
        if item.vlr_total_c and item.vlr_total_c > 0:
            slots["C"] = item.vlr_total_c

        if len(slots) < 2:
            item.melhor_solucao = None
            item.diferenca_valor = None
            item.diferenca_percentual = None
            return

        min_val = min(slots.values())
        max_val = max(slots.values())
        winners = [k for k, v in slots.items() if v == min_val]

        item.melhor_solucao = "EMPATE" if len(winners) > 1 else winners[0]
        item.diferenca_valor = max_val - min_val
        item.diferenca_percentual = (
            (max_val - min_val) / max_val * 100
            if max_val > 0
            else Decimal("0")
        )

    def _best_overall(self, totals: dict) -> Optional[str]:
        valid = {k: v for k, v in [("A", totals["total_a"]), ("B", totals["total_b"]), ("C", totals["total_c"])] if v > 0}
        if len(valid) < 2:
            return None
        min_val = min(valid.values())
        winners = [k for k, v in valid.items() if v == min_val]
        return "EMPATE" if len(winners) > 1 else winners[0]

    def _check_no_duplicate(self, analise: SolutionAnalysis, item_id: UUID) -> None:
        """Ensure the product does not already appear in any line of the analysis."""
        for row in analise.items:
            if (row.item_a_id == item_id
                    or row.item_b_id == item_id
                    or row.item_c_id == item_id):
                raise ValueError("Item já lançado na análise")

    # ── CRUD ─────────────────────────────────────────────────────────────────

    def list_analyses(self, tenant_id: str, company_id: str) -> List[SolutionAnalysisSummary]:
        analyses = (
            self.db.query(SolutionAnalysis)
            .filter(
                SolutionAnalysis.tenant_id == tenant_id,
                SolutionAnalysis.company_id == company_id,
            )
            .order_by(SolutionAnalysis.created_at.desc())
            .all()
        )
        result = []
        for a in analyses:
            totals = self._compute_totals(a)
            result.append(
                SolutionAnalysisSummary(
                    id=a.id,
                    titulo=a.titulo,
                    tipo_analise=a.tipo_analise,
                    nome_solucao_a=a.nome_solucao_a,
                    nome_solucao_b=a.nome_solucao_b,
                    nome_solucao_c=a.nome_solucao_c,
                    criado_por_nome=a.criado_por_nome,
                    usuario_id=a.usuario_id,
                    created_at=a.created_at,
                    updated_at=a.updated_at,
                    qtde_linhas=len(a.items),
                    total_a=totals["total_a"],
                    total_b=totals["total_b"],
                    total_c=totals["total_c"],
                    melhor_solucao_geral=self._best_overall(totals),
                )
            )
        return result

    def get_analysis(self, analise_id: str, tenant_id: str) -> Optional[SolutionAnalysis]:
        return (
            self.db.query(SolutionAnalysis)
            .filter(
                SolutionAnalysis.id == analise_id,
                SolutionAnalysis.tenant_id == tenant_id,
            )
            .first()
        )

    def create_analysis(
        self, tenant_id: str, company_id: str, data: SolutionAnalysisCreate, user: User
    ) -> SolutionAnalysis:
        analise = SolutionAnalysis(
            tenant_id=tenant_id,
            company_id=company_id,
            titulo=data.titulo,
            tipo_analise=data.tipo_analise,
            nome_solucao_a=data.nome_solucao_a or "Solução A",
            nome_solucao_b=data.nome_solucao_b or "Solução B",
            nome_solucao_c=data.nome_solucao_c or "Solução C",
            usuario_id=user.id,
            criado_por_nome=user.name,
            ultima_alteracao_por_id=user.id,
            ultima_alteracao_por_nome=user.name,
        )
        self.db.add(analise)
        self.db.commit()
        self.db.refresh(analise)
        return analise

    def update_analysis(
        self, analise_id: str, tenant_id: str, data: SolutionAnalysisUpdate, user: User
    ) -> Optional[SolutionAnalysis]:
        analise = self.get_analysis(analise_id, tenant_id)
        if not analise:
            return None
        if str(analise.usuario_id) != str(user.id):
            raise PermissionError("Apenas o proprietário pode editar esta análise")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(analise, field, value)
        analise.ultima_alteracao_por_id = user.id
        analise.ultima_alteracao_por_nome = user.name
        self.db.commit()
        self.db.refresh(analise)
        return analise

    def delete_analysis(self, analise_id: str, tenant_id: str, user: User) -> bool:
        analise = self.get_analysis(analise_id, tenant_id)
        if not analise:
            return False
        if str(analise.usuario_id) != str(user.id):
            raise PermissionError("Apenas o proprietário pode excluir esta análise")
        self.db.delete(analise)
        self.db.commit()
        return True

    # ── Items ─────────────────────────────────────────────────────────────────

    def add_item(
        self, analise_id: str, tenant_id: str, data: SolutionAnalysisItemCreate, user: User
    ) -> SolutionAnalysisItem:
        analise = self.get_analysis(analise_id, tenant_id)
        if not analise:
            raise ValueError("Análise não encontrada")
        if str(analise.usuario_id) != str(user.id):
            raise PermissionError("Apenas o proprietário pode editar esta análise")

        # Validate: at least one solution must be filled
        has_any = any([
            data.solucao_a and data.solucao_a.item_id,
            data.solucao_b and data.solucao_b.item_id,
            data.solucao_c and data.solucao_c.item_id,
        ])
        if not has_any:
            raise ValueError("Preencha ao menos uma solução")

        # Validate cross-solution completeness and duplication
        for slot_name, slot in [("A", data.solucao_a), ("B", data.solucao_b), ("C", data.solucao_c)]:
            if slot is None:
                continue
            has_id = bool(slot.item_id)
            has_qty = slot.quantidade is not None
            if has_id != has_qty:
                raise ValueError(f"Solução {slot_name}: item e quantidade são ambos obrigatórios")
            if has_id:
                self._check_no_duplicate(analise, slot.item_id)

        # Resolve products and calculate values
        def _slot_values(slot):
            if not slot or not slot.item_id:
                return None, None, None, None

            product = self._resolve_product(slot.item_id, tenant_id)
            price = self._get_price(product, analise.tipo_analise)
            qty = slot.quantidade
            display_name = f"[{product.codigo}]{product.nome}" if product.codigo else product.nome
            return product.id, display_name, price, qty * price

        a_id, a_nome, a_unit, a_total = _slot_values(data.solucao_a)
        b_id, b_nome, b_unit, b_total = _slot_values(data.solucao_b)
        c_id, c_nome, c_unit, c_total = _slot_values(data.solucao_c)

        next_seq = (
            self.db.query(SolutionAnalysisItem)
            .filter(SolutionAnalysisItem.analise_id == analise_id)
            .count()
        )

        item = SolutionAnalysisItem(
            analise_id=analise.id,
            sequencia=next_seq,
            # A
            item_a_id=a_id,
            item_a_nome=a_nome,
            qtd_a=data.solucao_a.quantidade if data.solucao_a else None,
            vlr_unit_a=a_unit,
            vlr_total_a=a_total,
            # B
            item_b_id=b_id,
            item_b_nome=b_nome,
            qtd_b=data.solucao_b.quantidade if data.solucao_b else None,
            vlr_unit_b=b_unit,
            vlr_total_b=b_total,
            # C
            item_c_id=c_id,
            item_c_nome=c_nome,
            qtd_c=data.solucao_c.quantidade if data.solucao_c else None,
            vlr_unit_c=c_unit,
            vlr_total_c=c_total,
        )
        self._compute_line_result(item)
        self.db.add(item)

        analise.ultima_alteracao_por_id = user.id
        analise.ultima_alteracao_por_nome = user.name

        self.db.commit()
        self.db.refresh(item)
        return item

    def delete_item(
        self, analise_id: str, item_id: str, tenant_id: str, user: User
    ) -> bool:
        analise = self.get_analysis(analise_id, tenant_id)
        if not analise:
            raise ValueError("Análise não encontrada")
        if str(analise.usuario_id) != str(user.id):
            raise PermissionError("Apenas o proprietário pode editar esta análise")

        item = (
            self.db.query(SolutionAnalysisItem)
            .filter(
                SolutionAnalysisItem.id == item_id,
                SolutionAnalysisItem.analise_id == analise_id,
            )
            .first()
        )
        if not item:
            return False
        self.db.delete(item)
        self.db.commit()
        return True

    # ── Computed summary helpers exposed for router ───────────────────────────

    def compute_summary(self, analise: SolutionAnalysis) -> dict:
        totals = self._compute_totals(analise)
        return {
            **totals,
            "melhor_solucao_geral": self._best_overall(totals),
            "qtde_linhas": len(analise.items),
        }
