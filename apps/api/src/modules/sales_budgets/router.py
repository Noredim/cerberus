from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional
from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User
from src.modules.sales_budgets import service
from src.modules.sales_budgets.schemas import (
    SalesBudgetCreate, SalesBudgetUpdate, SalesBudgetOut,
    SalesBudgetStatusUpdate, SalesBudgetHeaderUpdate,
    WorkflowTransitionSchema
)


router = APIRouter(prefix="/sales-budgets", tags=["Sales Budgets"])


from fastapi import Query

@router.get("")
def list_budgets(
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=1000),
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    budgets, total = service.list_budgets(db, current_user.tenant_id, company_id, skip, limit, q, status, user_id=current_user.id)
    result = []
    for b in budgets:
        lucro_venda, fat_venda = _calc_margem_venda(b.items, b.rental_items, db)
        lucro_rental, fat_rental = _calc_margem_rental(b.rental_items, getattr(b, "prazo_instalacao_meses", 0))
        
        mv = float(round(lucro_venda / fat_venda * 100, 2)) if fat_venda > 0 else 0.0
        mr = float(round(lucro_rental / fat_rental * 100, 2)) if fat_rental > 0 else 0.0
        
        fat_geral = fat_venda + fat_rental
        if fat_geral > 0:
            mg = float(round((lucro_venda + lucro_rental) / fat_geral * 100, 2))
        else:
            mg = 0.0
            
        valid_rentals = [ri for ri in b.rental_items if getattr(ri, "tipo_contrato_kit", None) != 'VENDA_EQUIPAMENTOS']
        
        # Adjust prazo_contrato internally for the header view
        total_faturamento_rental = sum(float(ri.valor_mensal or getattr(ri, "kit_valor_mensal", 0) or 0) * float(ri.quantidade or 1) * max(0, int(ri.prazo_contrato or 0) - int(getattr(b, "prazo_instalacao_meses", 0) or 0)) for ri in valid_rentals)
        # Adding instalacao to the display of total faturamento rental
        total_faturamento_rental += sum(float(getattr(ri, "kit_vlr_instal_calc", 0) or getattr(ri, "valor_instalacao_item", 0) or 0) * float(ri.quantidade or 1) for ri in valid_rentals)
        
        valor_mensal_total_rental = sum(float(ri.valor_mensal or 0) * float(ri.quantidade or 1) for ri in valid_rentals)
        prazo_max_rental = max([int(ri.prazo_contrato or 0) for ri in valid_rentals]) if valid_rentals else 0
        
        result.append({
            "id": b.id,
            "numero_orcamento": b.numero_orcamento,
            "titulo": b.titulo,
            "status": b.status,
            "data_orcamento": b.data_orcamento,
            "customer_nome": b.customer.nome_fantasia or b.customer.razao_social if b.customer else None,
            "total_venda": fat_venda,
            "margem_venda": mv,
            "total_faturamento_rental": total_faturamento_rental,
            "valor_mensal_total_rental": valor_mensal_total_rental,
            "prazo_max_rental": prazo_max_rental,
            "margem_rental": mr,
            "margem_geral": mg,
            "created_at": b.created_at,
        })
    return {"total": total, "items": result}


def _calc_margem_venda(items, rental_items, db: Session = None) -> tuple[float, float]:
    if not db or not items:
        total_lucro = sum(float(i.lucro_unit or 0) * float(i.quantidade or 1) for i in items)
        total_venda = sum(float(i.total_venda or 0) for i in items)
        
        if rental_items:
            for ri in rental_items:
                if ri.tipo_contrato_kit == 'VENDA_EQUIPAMENTOS':
                    total_lucro += float(ri.kit_lucro_mensal or 0) * float(ri.quantidade or 1)
                    total_venda += float(ri.kit_valor_mensal or 0) * float(ri.quantidade or 1)
                    
        return (total_lucro, total_venda)

    budget = items[0].budget
    from src.modules.purchase_budgets.models import PurchaseBudget
    purchase_budgets = db.query(PurchaseBudget).filter(
        PurchaseBudget.sales_budget_id == budget.id,
        PurchaseBudget.tenant_id == budget.tenant_id
    ).all()

    opp_product_taxes = {}
    for item in rental_items:
        if not item.opportunity_kit_id and item.product_id:
            opp_product_taxes[item.product_id] = {
                "difal": float(item.difal_unit or 0.0),
                "st": float(item.icms_st_unit or 0.0)
            }

    from src.modules.opportunity_kits.models import OpportunityKit
    from src.modules.opportunity_kits.service import OpportunityKitService
    kit_service = OpportunityKitService(db)

    kit_ids = set(i.opportunity_kit_id for i in items if i.opportunity_kit_id)
    kit_ids.update(ri.opportunity_kit_id for ri in rental_items if ri.opportunity_kit_id)

    kits_by_id = {}
    for kit_id in kit_ids:
        kit = db.query(OpportunityKit).filter(OpportunityKit.id == kit_id).first()
        if kit:
            kits_by_id[kit.id] = kit
            try:
                kit_financials = kit_service.calculate_financials(kit, budget.tenant_id, sales_budget_id=str(budget.id))
                for item_sum in kit_financials.get("item_summaries", []):
                    p_id = item_sum.get("product_id")
                    if p_id:
                        p_uuid = UUID(p_id) if isinstance(p_id, str) else p_id
                        opp_product_taxes[p_uuid] = {
                            "difal": float(item_sum.get("difal_unitario") or 0.0),
                            "st": float(item_sum.get("icms_st_unitario") or 0.0)
                        }
            except Exception:
                pass

    product_suppliers = {}
    for pb in purchase_budgets:
        for pb_item in pb.items:
            if pb_item.product_id:
                product_suppliers[pb_item.product_id] = pb_item

    venda_consolidada = 0.0
    custo_consolidado = 0.0
    custo_impostos = 0.0
    impostos_venda = 0.0
    despesas_totais = 0.0
    total_ipi_all = 0.0
    custo_servicos_proprios_total = 0.0

    for item in items:
        qty = float(item.quantidade or 1.0)
        if not item.opportunity_kit_id and item.product_id:
            pb_item = product_suppliers.get(item.product_id)
            custo_unit = float(pb_item.valor_unitario) if pb_item else float(item.custo_unit_base or 0.0)
            
            difal_unit = 0.0
            st_unit = 0.0
            
            tax_info = opp_product_taxes.get(item.product_id)
            if tax_info:
                difal_unit = tax_info["difal"]
                st_unit = tax_info["st"]
            
            if difal_unit == 0.0 and pb_item and pb_item.difal_unitario is not None:
                difal_unit = float(pb_item.difal_unitario)
            if st_unit == 0.0 and pb_item and pb_item.st_unitario is not None:
                st_unit = float(pb_item.st_unitario)
                
            purchase_tax_unit = difal_unit + st_unit
            
            ipi_unit = 0.0
            if pb_item and pb_item.ipi_valor is not None and float(pb_item.ipi_valor) > 0.0:
                pb_qty = float(pb_item.quantidade) if float(pb_item.quantidade) > 0 else 1.0
                ipi_unit = float(pb_item.ipi_valor) / pb_qty
            total_ipi_all += ipi_unit * qty
            
            pis_unit = float(item.pis_unit or 0.0)
            cofins_unit = float(item.cofins_unit or 0.0)
            csll_unit = float(item.csll_unit or 0.0)
            irpj_unit = float(item.irpj_unit or 0.0)
            icms_unit = float(item.icms_unit or 0.0)
            iss_unit = float(item.iss_unit or 0.0)
            sales_tax_unit = pis_unit + cofins_unit + csll_unit + irpj_unit + icms_unit + iss_unit
            
            venda_unit = float(item.venda_unit or 0.0)
            venda_total = venda_unit * qty
            custo_total = custo_unit * qty
            purchase_tax_total = purchase_tax_unit * qty
            sales_tax_total = sales_tax_unit * qty
            
            frete_venda_unit = float(item.frete_venda_unit or 0.0)
            desp_adm_unit = float(item.despesa_adm_unit or 0.0)
            comissao_unit = float(item.comissao_unit or 0.0)
            
            frete_total = frete_venda_unit * qty
            desp_adm_total = desp_adm_unit * qty
            comissao_total = comissao_unit * qty
            despesas_adm_total = frete_total + desp_adm_total + comissao_total
            
            venda_consolidada += venda_total
            custo_consolidado += custo_total
            custo_impostos += purchase_tax_total
            impostos_venda += sales_tax_total
            despesas_totais += despesas_adm_total
            
        elif item.opportunity_kit_id:
            kit = kits_by_id.get(item.opportunity_kit_id)
            if kit:
                try:
                    kit_financials = kit_service.calculate_financials(kit, budget.tenant_id, sales_budget_id=str(budget.id))
                    vlr_instal_calc = float(kit_financials["summary"].get("vlr_instal_calc", 0.0) or 0.0)
                    vlt_manut = float(kit_financials["summary"].get("vlt_manut", 0.0) or 0.0)
                    custo_servicos_proprios_total += (vlr_instal_calc + vlt_manut) * qty

                    for summary in kit_financials.get("item_summaries", []):
                        p_id = summary.get("product_id")
                        p_uuid = UUID(p_id) if isinstance(p_id, str) else p_id
                        kit_item = next((ki for ki in kit.items if ki.product_id == p_uuid), None)
                        qty_in_kit = float(kit_item.quantidade_no_kit) if kit_item else 1.0
                        component_qty = qty * qty_in_kit
                        
                        if p_uuid:
                            difal_unit = float(summary.get("difal_unitario") or 0.0)
                            st_unit = float(summary.get("icms_st_unitario") or 0.0)
                            ipi_unit = float(summary.get("ipi_unit") or 0.0)
                            base_forn = summary.get("base_fornecedor")
                            if base_forn is not None:
                                custo_unit = float(base_forn)
                            else:
                                custo_unit = float(summary.get("custo_base_unitario_item") or 0.0) - (difal_unit + st_unit)
                        else:
                            difal_unit = 0.0
                            st_unit = 0.0
                            ipi_unit = 0.0
                            custo_unit = float(summary.get("custo_base_unitario_item") or 0.0)
                            
                        purchase_tax_unit = difal_unit + st_unit
                        total_ipi_all += ipi_unit * component_qty
                        
                        sales_tax_unit = float(summary.get("imposto_venda_item") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                        
                        venda_unit = float(summary.get("venda_unitario_item") or 0.0)
                        venda_total = venda_unit * component_qty
                        custo_total = custo_unit * component_qty
                        purchase_tax_total = purchase_tax_unit * component_qty
                        sales_tax_total = sales_tax_unit * component_qty
                        
                        frete_venda_unit = float(summary.get("frete_venda_item") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                        desp_adm_unit = float(summary.get("desp_adm_item") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                        comissao_unit = float(summary.get("comissao_item") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                        
                        frete_total = frete_venda_unit * component_qty
                        desp_adm_total = desp_adm_unit * component_qty
                        comissao_total = comissao_unit * component_qty
                        despesas_adm_total = frete_total + desp_adm_total + comissao_total
                        
                        venda_consolidada += venda_total
                        custo_consolidado += custo_total
                        custo_impostos += purchase_tax_total
                        impostos_venda += sales_tax_total
                        despesas_totais += despesas_adm_total
                except Exception:
                    pass

    if rental_items:
        for ri in rental_items:
            if ri.tipo_contrato_kit == 'VENDA_EQUIPAMENTOS':
                venda_consolidada += float(ri.kit_valor_mensal or 0) * float(ri.quantidade or 1)

    lucro_total = venda_consolidada - (custo_consolidado + total_ipi_all) - custo_impostos - impostos_venda - despesas_totais - custo_servicos_proprios_total
    return (lucro_total, venda_consolidada)


def _calc_margem_rental(rental_items, prazo_instalacao: int = 0) -> tuple[float, float]:
    valid_rentals = [ri for ri in rental_items if getattr(ri, "tipo_contrato_kit", None) != 'VENDA_EQUIPAMENTOS']
    
    total_faturamento = 0.0
    total_custo = 0.0
    
    for ri in valid_rentals:
        q = float(ri.quantidade or 1)
        pCtrRaw = int(ri.prazo_contrato or 36)
        pCtr = max(0, pCtrRaw - (prazo_instalacao or 0))
        
        is_instalacao = getattr(ri, "tipo_contrato_kit", None) == 'INSTALACAO' or getattr(ri, "is_kit_instalacao", False)
        
        fat_mensal = float(ri.valor_mensal or getattr(ri, "kit_valor_mensal", 0) or 0)
        instalacao = float(getattr(ri, "kit_vlr_instal_calc", 0) or getattr(ri, "valor_instalacao_item", 0) or 0)
        
        impostos_mensal = float(ri.impostos_mensal or getattr(ri, "kit_valor_impostos", 0) or 0)
        perc_impostos = float(ri.perc_impostos_total or 0) / 100.0
        
        custo_op_mensal = float(ri.custo_total_mensal or ri.custo_manut_mensal or getattr(ri, "kit_vlt_manut", 0) or 0)
        comissao_mensal = float(ri.comissao_mensal or 0)
        perc_comissao = float(ri.perc_comissao or 0) / 100.0
        
        if is_instalacao:
            fat_lifetime = fat_mensal * q
            impostos_total = impostos_mensal * q
            custo_op_total = custo_op_mensal * q
            comissao_total = comissao_mensal * q
            investimento = float(ri.custo_total_aquisicao or 0) * q
        else:
            fat_lifetime = (fat_mensal * pCtr + instalacao) * q
            impostos_total = (impostos_mensal * pCtr + instalacao * perc_impostos) * q
            custo_op_total = (custo_op_mensal * pCtr) * q
            comissao_total = (comissao_mensal * pCtr + instalacao * perc_comissao) * q
            investimento = float(ri.custo_total_aquisicao or 0) * q
            
        custo_lifetime = investimento + impostos_total + custo_op_total + comissao_total
        
        total_faturamento += fat_lifetime
        total_custo += custo_lifetime
        
    lucro = total_faturamento - total_custo
    return (lucro, total_faturamento)


@router.get("/check-st")
def check_st(
    ncm_codigo: str,
    company_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if a product NCM has ST rules for the company's UF."""
    from src.modules.companies.models import Company
    company = db.query(Company).filter(Company.id == company_id).first()
    company_uf = company.state_id if company else ""
    has_st = service.check_st_flag(db, current_user.tenant_id, ncm_codigo, company_uf)
    return {"has_st": has_st}


@router.get("/product-cost-composition/{product_id}")
def get_product_cost_composition(
    product_id: str,
    tipo: str = "REVENDA",
    sales_budget_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return the full cost composition breakdown for a product."""
    res = service.calculate_product_cost_composition(db, product_id, current_user.tenant_id, tipo, sales_budget_id=sales_budget_id)
    if not res:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return res


@router.post("")
def create_budget(
    data: SalesBudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    budget = service.create_budget(
        db, current_user.tenant_id, company_id, data
    )
    return _budget_to_dict(budget, db)


@router.get("/check-approver")
def check_approver(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: Optional[str] = Depends(get_active_company)
):
    if not company_id:
        return {"is_approver": False, "cargo": None}
    is_app, cargo = service.check_is_approver(db, current_user.id, current_user.tenant_id, company_id)
    return {"is_approver": is_app, "cargo": cargo}


@router.get("/aprovacoes-pendentes")
def list_aprovacoes_pendentes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    # Check if is approver
    is_app, cargo = service.check_is_approver(db, current_user.id, current_user.tenant_id, company_id)
    if not is_app:
         raise HTTPException(status_code=403, detail="Acesso negado: apenas aprovadores podem listar aprovações pendentes.")
         
    # Query budgets with status ENVIADO_APROVACAO in this company/tenant
    from src.modules.sales_budgets.models import SalesBudget
    budgets = db.query(SalesBudget).filter(
        SalesBudget.tenant_id == current_user.tenant_id,
        SalesBudget.company_id == company_id,
        SalesBudget.status == "ENVIADO_APROVACAO"
    ).order_by(SalesBudget.updated_at.desc()).all()
    
    result = []
    for b in budgets:
        # Get last history entry for justification
        last_hist = sorted(b.history, key=lambda x: x.data_movimentacao, reverse=True)
        justificativa = last_hist[0].descricao if last_hist else ""
        result.append({
            "id": b.id,
            "numero_orcamento": b.numero_orcamento,
            "titulo": b.titulo,
            "status": b.status,
            "valor_total": float(b.valor_total or 0),
            "vendedor_nome": b.vendedor.name if b.vendedor else "Não atribuído",
            "justificativa": justificativa,
            "data_envio": b.updated_at.isoformat()
        })
    return result


@router.get("/{budget_id}")
def get_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    budget = service.get_budget(db, current_user.tenant_id, str(budget_id), user_id=current_user.id)
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return _budget_to_dict(budget, db)


@router.put("/{budget_id}")
def update_budget(
    budget_id: UUID,
    data: SalesBudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        budget = service.update_budget(db, current_user.tenant_id, str(budget_id), data, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return _budget_to_dict(budget, db)


@router.patch("/{budget_id}/header")
def update_header(
    budget_id: UUID,
    data: SalesBudgetHeaderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        budget = service.update_header(db, current_user.tenant_id, str(budget_id), data, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return _budget_to_dict(budget, db)


@router.patch("/{budget_id}/status")
def update_status(
    budget_id: UUID,
    data: SalesBudgetStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    budget = service.get_budget(db, current_user.tenant_id, str(budget_id), user_id=current_user.id)
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    budget = service.update_status(db, current_user.tenant_id, str(budget_id), data.status.value)
    return {"status": budget.status}


@router.post("/{budget_id}/duplicate")
def duplicate_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        budget = service.duplicate_budget(db, current_user.tenant_id, str(budget_id), user_id=current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return _budget_to_dict(budget, db)


@router.delete("/{budget_id}")
def delete_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        success = service.delete_budget(db, current_user.tenant_id, str(budget_id), user_id=current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not success:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return {"message": "Orçamento excluído com sucesso"}


def _budget_to_dict(budget, db: Session = None) -> dict:
    """Serialize budget to response dict."""
    items = []
    for i in budget.items:
        items.append({
            "id": i.id,
            "product_id": i.product_id,
            "opportunity_kit_id": i.opportunity_kit_id,
            "product_nome": i.product_nome,
            "product_codigo": i.product_codigo,
            "tipo_item": i.tipo_item,
            "descricao_servico": i.descricao_servico,
            "usa_parametros_padrao": i.usa_parametros_padrao,
            "custo_unit_base": float(i.custo_unit_base or 0),
            "markup": float(i.markup or 1),
            "venda_unit": float(i.venda_unit or 0),
            "perc_frete_venda": float(i.perc_frete_venda or 0),
            "frete_venda_unit": float(i.frete_venda_unit or 0),
            "perc_pis": float(i.perc_pis or 0), "pis_unit": float(i.pis_unit or 0),
            "perc_cofins": float(i.perc_cofins or 0), "cofins_unit": float(i.cofins_unit or 0),
            "perc_csll": float(i.perc_csll or 0), "csll_unit": float(i.csll_unit or 0),
            "perc_irpj": float(i.perc_irpj or 0), "irpj_unit": float(i.irpj_unit or 0),
            "perc_icms": float(i.perc_icms or 0), "icms_unit": float(i.icms_unit or 0),
            "tem_st": i.tem_st,
            "perc_iss": float(i.perc_iss or 0), "iss_unit": float(i.iss_unit or 0),
            "perc_despesa_adm": float(i.perc_despesa_adm or 0), "despesa_adm_unit": float(i.despesa_adm_unit or 0),
            "perc_comissao": float(i.perc_comissao or 0), "comissao_unit": float(i.comissao_unit or 0),
            "lucro_unit": float(i.lucro_unit or 0),
            "margem_unit": float(i.margem_unit or 0),
            "quantidade": float(i.quantidade or 1),
            "total_venda": float(i.total_venda or 0),
        })

    rental_items = []
    for ri in budget.rental_items:
        rental_items.append({
            "id": ri.id,
            "product_id": ri.product_id,
            "opportunity_kit_id": ri.opportunity_kit_id,
            "product_nome": ri.product_nome,
            "product_codigo": ri.product_codigo,
            "custo_op_mensal_kit": float(ri.custo_op_mensal_kit) if ri.custo_op_mensal_kit is not None else None,
            "is_kit_instalacao": ri.is_kit_instalacao,
            "tipo_contrato_kit": ri.tipo_contrato_kit,
            "kit_taxa_juros_mensal": float(ri.kit_taxa_juros_mensal) if ri.kit_taxa_juros_mensal is not None else None,
            "kit_custo_produtos": float(ri.kit_custo_produtos) if ri.kit_custo_produtos is not None else None,
            "kit_custo_servicos": float(ri.kit_custo_servicos) if ri.kit_custo_servicos is not None else None,
            "kit_pis": float(ri.kit_pis) if ri.kit_pis is not None else None,
            "kit_cofins": float(ri.kit_cofins) if ri.kit_cofins is not None else None,
            "kit_csll": float(ri.kit_csll) if ri.kit_csll is not None else None,
            "kit_irpj": float(ri.kit_irpj) if ri.kit_irpj is not None else None,
            "kit_iss": float(ri.kit_iss) if ri.kit_iss is not None else None,
            "kit_vlt_manut": float(ri.kit_vlt_manut) if ri.kit_vlt_manut is not None else None,
            "kit_valor_mensal": float(ri.kit_valor_mensal) if ri.kit_valor_mensal is not None else None,
            "kit_valor_impostos": float(ri.kit_valor_impostos) if ri.kit_valor_impostos is not None else None,
            "kit_receita_liquida": float(ri.kit_receita_liquida) if ri.kit_receita_liquida is not None else None,
            "kit_lucro_mensal": float(ri.kit_lucro_mensal) if ri.kit_lucro_mensal is not None else None,
            "kit_margem": float(ri.kit_margem) if ri.kit_margem is not None else None,
            "quantidade": float(ri.quantidade or 1),
            "custo_aquisicao_unit": float(ri.custo_aquisicao_unit or 0),
            "ipi_unit": float(ri.ipi_unit or 0),
            "frete_unit": float(ri.frete_unit or 0),
            "icms_st_unit": float(ri.icms_st_unit or 0),
            "difal_unit": float(ri.difal_unit or 0),
            "custo_total_aquisicao": float(ri.custo_total_aquisicao or 0),
            "prazo_contrato": ri.prazo_contrato,
            "usa_taxa_manut_padrao": ri.usa_taxa_manut_padrao,
            "taxa_manutencao_anual_item": float(ri.taxa_manutencao_anual_item) if ri.taxa_manutencao_anual_item is not None else None,
            "perc_instalacao_item": float(ri.perc_instalacao_item) if ri.perc_instalacao_item is not None else None,
            "valor_instalacao_item": float(ri.valor_instalacao_item) if ri.valor_instalacao_item is not None else None,
            "kit_parcela_locacao": float(ri.kit_parcela_locacao) if ri.kit_parcela_locacao is not None else None,
            "kit_faturamento_separado": ri.kit_faturamento_separado if hasattr(ri, 'kit_faturamento_separado') else False,
            "kit_perc_comissao": float(ri.kit_perc_comissao) if getattr(ri, 'kit_perc_comissao', None) is not None else None,
            "kit_despesas_adm": float(ri.kit_despesas_adm) if getattr(ri, 'kit_despesas_adm', None) is not None else None,
            "kit_perc_despesas_adm": float(ri.kit_perc_despesas_adm) if getattr(ri, 'kit_perc_despesas_adm', None) is not None else None,
            "kit_imposto_instalacao": float(ri.kit_imposto_instalacao) if getattr(ri, 'kit_imposto_instalacao', None) is not None else None,
            "kit_comissao": float(ri.kit_comissao) if getattr(ri, 'kit_comissao', None) is not None else None,
            "kit_vlr_instal_calc": float(ri.kit_vlr_instal_calc) if getattr(ri, 'kit_vlr_instal_calc', None) is not None else None,
            "kit_venda_unit_monitoramento": float(ri.kit_venda_unit_monitoramento) if getattr(ri, 'kit_venda_unit_monitoramento', None) is not None else None,
            "kit_custo_monitoramento_unit": float(ri.kit_custo_monitoramento_unit) if getattr(ri, 'kit_custo_monitoramento_unit', None) is not None else None,
            "kit_investimento_total": float(ri.kit_investimento_total) if getattr(ri, 'kit_investimento_total', None) is not None else None,
            "custo_manut_mensal": float(ri.custo_manut_mensal or 0),
            "custo_total_mensal": float(ri.custo_total_mensal or 0),
            "fator_margem": float(ri.fator_margem or 1),
            "valor_venda_equipamento": float(ri.valor_venda_equipamento or 0),
            "parcela_locacao": float(ri.parcela_locacao or 0),
            "manutencao_locacao": float(ri.manutencao_locacao or 0),
            "valor_mensal": float(ri.valor_mensal or 0),
            "perc_impostos_total": float(ri.perc_impostos_total or 0),
            "impostos_mensal": float(ri.impostos_mensal or 0),
            "receita_liquida_mensal": float(ri.receita_liquida_mensal or 0),
            "perc_comissao": float(ri.perc_comissao or 0),
            "comissao_mensal": float(ri.comissao_mensal or 0),
            "dsr_mensal": float(ri.dsr_mensal or 0),
            "fgts_mensal": float(ri.fgts_mensal or 0),
            "inss_mensal": float(ri.inss_mensal or 0),
            "demais_incidencias_mensal": float(ri.demais_incidencias_mensal or 0),
            "despesa_operacional_mensal": float(ri.despesa_operacional_mensal or 0),
            "lucro_mensal": float(ri.lucro_mensal or 0),
            "margem": float(ri.margem or 0),
        })

    planning = []
    if db:
        from src.modules.payment_methods.models import PlanejamentoFinanceiro
        planning_rows = db.query(PlanejamentoFinanceiro).filter(
            PlanejamentoFinanceiro.origem_id == budget.id,
            PlanejamentoFinanceiro.origem_tipo == 'SALES_BUDGET'
        ).order_by(PlanejamentoFinanceiro.data_prevista.asc(), PlanejamentoFinanceiro.numero_parcela.asc()).all()
        for p in planning_rows:
            planning.append({
                "id": str(p.id),
                "numero_parcela": p.numero_parcela,
                "descricao": p.descricao,
                "data_prevista": p.data_prevista.isoformat() if p.data_prevista else None,
                "valor_previsto": float(p.valor_previsto),
                "tipo_movimento": p.tipo_movimento,
                "status": p.status
            })

    return {
        "id": budget.id,
        "tenant_id": budget.tenant_id,
        "company_id": budget.company_id,
        "customer_id": budget.customer_id,
        "customer_nome": budget.customer.nome_fantasia or budget.customer.razao_social if budget.customer else None,
        "customer_state_sigla": budget.customer.state.sigla if budget.customer and budget.customer.state else None,
        "company_state_sigla": budget.company.state.sigla if budget.company and budget.company.state else None,
        "vendedor_id": str(budget.vendedor_id) if budget.vendedor_id else None,
        "forma_pagamento_id": str(budget.forma_pagamento_id) if budget.forma_pagamento_id else None,
        "data_vencimento_inicial": budget.data_vencimento_inicial.isoformat() if budget.data_vencimento_inicial else None,
        "forma_pagamento_snapshot": budget.forma_pagamento_snapshot,
        "financial_planning": planning,
        "numero_orcamento": budget.numero_orcamento,
        "titulo": budget.titulo,
        "observacoes": budget.observacoes,
        "data_orcamento": budget.data_orcamento,
        "status": budget.status,
        "markup_padrao": float(budget.markup_padrao or 0),
        "perc_despesa_adm": float(budget.perc_despesa_adm or 0),
        "perc_comissao": float(budget.perc_comissao or 0),
        "perc_frete_venda": float(budget.perc_frete_venda or 0),
        "perc_pis": float(budget.perc_pis or 0),
        "perc_cofins": float(budget.perc_cofins or 0),
        "perc_csll": float(budget.perc_csll or 0),
        "perc_irpj": float(budget.perc_irpj or 0),
        "perc_iss": float(budget.perc_iss or 0),
        "perc_icms_interno": float(budget.perc_icms_interno or 0),
        "perc_icms_externo": float(budget.perc_icms_externo or 0),
        "venda_markup_produtos": float(budget.venda_markup_produtos or 1),
        "venda_markup_servicos": float(budget.venda_markup_servicos or 1),
        "venda_markup_instalacao": float(budget.venda_markup_instalacao or 1),
        "venda_markup_manutencao": float(budget.venda_markup_manutencao or 1),
        "venda_havera_manutencao": bool(budget.venda_havera_manutencao),
        "venda_qtd_meses_manutencao": int(budget.venda_qtd_meses_manutencao or 0),
        "tipo_receita_rental": budget.tipo_receita_rental,
        "prazo_contrato_meses": budget.prazo_contrato_meses,
        "prazo_instalacao_meses": budget.prazo_instalacao_meses,
        "taxa_juros_mensal": float(budget.taxa_juros_mensal or 0),
        "taxa_manutencao_anual": float(budget.taxa_manutencao_anual or 0),
        "fator_margem_padrao": float(budget.fator_margem_padrao or 0),
        "fator_manutencao_padrao": float(budget.fator_manutencao_padrao or 0),
        "perc_instalacao_padrao": float(budget.perc_instalacao_padrao or 0),
        "perc_comissao_rental": float(budget.perc_comissao_rental or 0),
        "perc_pis_rental": float(budget.perc_pis_rental or 0),
        "perc_cofins_rental": float(budget.perc_cofins_rental or 0),
        "perc_csll_rental": float(budget.perc_csll_rental or 0),
        "perc_irpj_rental": float(budget.perc_irpj_rental or 0),
        "perc_iss_rental": float(budget.perc_iss_rental or 0),
        "perc_comissao_diretoria": float(budget.perc_comissao_diretoria or 0),
        "tipo_comissionamento": budget.tipo_comissionamento,
        "perc_dsr": float(budget.perc_dsr or 0),
        "perc_fgts": float(budget.perc_fgts or 0),
        "perc_inss": float(budget.perc_inss or 0),
        "perc_demais_incidencias": float(budget.perc_demais_incidencias or 0),
        "perc_despesa_operacional": float(budget.perc_despesa_operacional or 0),
        "responsavel_ids": [r.user_id for r in budget.responsaveis],
        "items": items,
        "rental_items": rental_items,
        "versao": budget.versao,
        "valor_total": float(budget.valor_total or 0),
        "history": [{
            "id": str(h.id),
            "sales_budget_id": str(h.sales_budget_id),
            "tenant_id": h.tenant_id,
            "versao": h.versao,
            "status_anterior": h.status_anterior,
            "status_novo": h.status_novo,
            "usuario_id": h.usuario_id,
            "cargo_usuario": h.cargo_usuario,
            "descricao": h.descricao,
            "data_movimentacao": h.data_movimentacao.isoformat() if h.data_movimentacao else None
        } for h in budget.history],
        "approvals": [{
            "id": str(ap.id),
            "sales_budget_id": str(ap.sales_budget_id),
            "tenant_id": ap.tenant_id,
            "usuario_aprovador_id": ap.usuario_aprovador_id,
            "cargo_aprovador": ap.cargo_aprovador,
            "data_aprovacao": ap.data_aprovacao.isoformat() if ap.data_aprovacao else None,
            "observacao": ap.observacao
        } for ap in budget.approvals],
        "created_at": budget.created_at,
        "updated_at": budget.updated_at,
    }


@router.post("/{budget_id}/enviar-aprovacao")
def enviar_para_aprovacao(
    budget_id: UUID,
    data: WorkflowTransitionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        budget = service.enviar_para_aprovacao(db, current_user.tenant_id, str(budget_id), current_user.id, data.justificativa)
        return _budget_to_dict(budget, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{budget_id}/aprovar")
def aprovar_oportunidade(
    budget_id: UUID,
    data: WorkflowTransitionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        budget = service.aprovar_oportunidade(db, current_user.tenant_id, str(budget_id), current_user.id, data.justificativa)
        return _budget_to_dict(budget, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{budget_id}/retornar")
def retornar_ao_vendedor(
    budget_id: UUID,
    data: WorkflowTransitionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        budget = service.retornar_ao_vendedor(db, current_user.tenant_id, str(budget_id), current_user.id, data.justificativa)
        return _budget_to_dict(budget, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{budget_id}/cancelar")
def cancelar_oportunidade(
    budget_id: UUID,
    data: WorkflowTransitionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        budget = service.cancelar_oportunidade(db, current_user.tenant_id, str(budget_id), current_user.id, data.justificativa)
        return _budget_to_dict(budget, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{budget_id}/ganhar")
def ganhar_oportunidade(
    budget_id: UUID,
    data: WorkflowTransitionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        budget = service.ganhar_oportunidade(db, current_user.tenant_id, str(budget_id), current_user.id, data.justificativa)
        return _budget_to_dict(budget, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{budget_id}/perder")
def perder_oportunidade(
    budget_id: UUID,
    data: WorkflowTransitionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        budget = service.perder_oportunidade(db, current_user.tenant_id, str(budget_id), current_user.id, data.justificativa)
        return _budget_to_dict(budget, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{budget_id}/reabrir")
def reabrir_oportunidade(
    budget_id: UUID,
    data: WorkflowTransitionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        budget = service.reabrir_oportunidade(db, current_user.tenant_id, str(budget_id), current_user.id, data.justificativa)
        return _budget_to_dict(budget, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/{opportunity_id}/reports/fechamento-fornecedores")
def download_fechamento_fornecedores_report(
    opportunity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from src.modules.sales_budgets.reports import OpportunitiesReportService
    return OpportunitiesReportService.generate_fechamento_fornecedores_pdf(db, opportunity_id, current_user)


@router.get("/{opportunity_id}/reports/venda-approval")
def download_venda_approval_report(
    opportunity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from src.modules.sales_budgets.reports import OpportunitiesReportService
    return OpportunitiesReportService.generate_venda_approval_pdf(db, opportunity_id, current_user)


@router.get("/{opportunity_id}/reports/locacao-approval")
def download_locacao_approval_report(
    opportunity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from src.modules.sales_budgets.reports import OpportunitiesReportService
    return OpportunitiesReportService.generate_locacao_approval_pdf(db, opportunity_id, current_user)


@router.get("/{opportunity_id}/drv")
def get_opportunity_dre(
    opportunity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        opportunity = service.get_budget(db, current_user.tenant_id, str(opportunity_id), user_id=current_user.id)
        if not opportunity:
            raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
        return service.get_opportunity_dre(db, current_user.tenant_id, opportunity_id, opportunity.company_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{opportunity_id}/reports/drv")
def download_opportunity_dre_report(
    opportunity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from src.modules.sales_budgets.reports import OpportunitiesReportService
    return OpportunitiesReportService.generate_dre_pdf(db, opportunity_id, current_user)


@router.get("/{budget_id}/historico")
def get_historico(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    budget = service.get_budget(db, current_user.tenant_id, str(budget_id), user_id=current_user.id)
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return [{
        "id": str(h.id),
        "sales_budget_id": str(h.sales_budget_id),
        "tenant_id": h.tenant_id,
        "versao": h.versao,
        "status_anterior": h.status_anterior,
        "status_novo": h.status_novo,
        "usuario_id": h.usuario_id,
        "cargo_usuario": h.cargo_usuario,
        "descricao": h.descricao,
        "data_movimentacao": h.data_movimentacao.isoformat() if h.data_movimentacao else None
    } for h in budget.history]
