from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi import HTTPException

from src.modules.opportunity_kits.models import OpportunityKit, OpportunityKitItem
from src.modules.opportunity_kits.schemas import (
    OpportunityKitCreate, OpportunityKitUpdate, OpportunityKitFinancialSummary,
    OpportunityKitItemFinancialSummary
)
from src.modules.products.models import Product
from src.modules.sales_budgets.router import get_product_cost_composition


class OpportunityKitService:
    def __init__(self, db: Session):
        self.db = db

    def get_product_info(self, product_id: str, tenant_id: str) -> dict:
        """
        Calls the existing product cost composition logic to get the final cost.
        Since we need a 'current_user' mock to reuse the router function directly,
        we do a simple DB query here for now as long as we only need the consolidated value.
        """
        product = self.db.query(Product).filter(
            Product.id == product_id,
            Product.tenant_id == tenant_id
        ).first()
        if not product:
            return {"cost": Decimal("0.0"), "tipo": "MERCADORIA", "difal": Decimal("0.0")}
        
        return {
            "cost": Decimal(product.vlr_referencia_uso_consumo or 0),
            "tipo": product.tipo or "MERCADORIA",
            "difal": Decimal(getattr(product, "vlr_referencia_difal", 0) or 0)
        }

    def calculate_financials(self, kit: OpportunityKit, tenant_id: str) -> dict:
        # 2. Prazos do Contrato
        prazo_mensalidades = max(0, kit.prazo_contrato_meses - kit.prazo_instalacao_meses)
        if kit.prazo_instalacao_meses >= kit.prazo_contrato_meses:
            prazo_mensalidades = 0

        # 5. Custos Operacionais Mensais
        custo_operacional_mensal_kit = sum([
            Decimal(kit.custo_manut_mensal_kit or 0),
            Decimal(kit.custo_suporte_mensal_kit or 0),
            Decimal(kit.custo_seguro_mensal_kit or 0),
            Decimal(kit.custo_logistica_mensal_kit or 0),
            Decimal(kit.custo_software_mensal_kit or 0),
            Decimal(kit.custo_itens_acessorios_mensal_kit or 0),
        ])

        # 8 & 9. Custo Consolidado
        custo_aquisicao_kit = Decimal("0.0")
        custo_aquisicao_produtos = Decimal("0.0")
        custo_aquisicao_servicos = Decimal("0.0")
        total_difal_kit = Decimal("0.0")
        
        item_summaries = []
        for item in kit.items:
            # For each item we fetch its active data
            info = self.get_product_info(str(item.product_id), tenant_id)
            custo_base_unitario_item = info["cost"]
            tipo_produto = info["tipo"]
            difal_unitario = info["difal"]
            
            custo_total_item_no_kit = custo_base_unitario_item * Decimal(item.quantidade_no_kit or 1)
            difal_total_item = difal_unitario * Decimal(item.quantidade_no_kit or 1)
            
            custo_aquisicao_kit += custo_total_item_no_kit
            total_difal_kit += difal_total_item
            
            if tipo_produto == "SERVICO":
                custo_aquisicao_servicos += custo_total_item_no_kit
            else:
                custo_aquisicao_produtos += custo_total_item_no_kit
            
            item_summaries.append({
                "id": str(item.id) if item.id else None,
                "product_id": str(item.product_id),
                "custo_base_unitario_item": round(custo_base_unitario_item, 2),
                "custo_total_item_no_kit": round(custo_total_item_no_kit, 2),
                "difal_unitario": round(difal_unitario, 2),
                "difal_total_item": round(difal_total_item, 2)
            })

        custo_aquisicao_total = custo_aquisicao_kit * Decimal(kit.quantidade_kits or 1)

        # 10. Depreciacao
        if kit.tipo_contrato in ["COMODATO", "LOCACAO"] and kit.prazo_contrato_meses > 0:
            depreciacao_mensal_kit = custo_aquisicao_kit / Decimal(kit.prazo_contrato_meses)
        else:
            depreciacao_mensal_kit = Decimal("0.0")

        # 11. Custo Total Mensal
        custo_total_mensal_kit = depreciacao_mensal_kit + custo_operacional_mensal_kit

        # 12. Calculo da Taxa de Locação
        tx_locacao = Decimal("0.0")
        juros = Decimal(kit.taxa_juros_mensal or 0) / Decimal(100.0)
        
        if kit.tipo_contrato == "INSTALACAO":
            tx_locacao = Decimal("1.0")
        elif prazo_mensalidades > 0 and juros > 0:
            # txLocacao = taxa / (1 - (1 + taxa)^(-prazo))
            base = Decimal(1.0) + juros
            tx_locacao = juros / (Decimal(1.0) - (base ** -prazo_mensalidades))
        elif prazo_mensalidades > 0 and juros == 0:
            tx_locacao = Decimal(1.0) / Decimal(prazo_mensalidades)

        # 13. Formação do Valor
        margem = Decimal(kit.fator_margem_locacao or 1)
        valor_base_venda = custo_aquisicao_kit * margem
        
        valor_parcela_locacao = valor_base_venda * tx_locacao
        if kit.tipo_contrato == "INSTALACAO":
            manutencao_mensal = Decimal("0.0")
        else:
            manutencao_mensal = (custo_aquisicao_kit * (Decimal(kit.taxa_manutencao_anual or 0) / Decimal(100.0))) / Decimal(12.0)
        
        valor_base_final = valor_parcela_locacao + manutencao_mensal + custo_operacional_mensal_kit

        # 14. Calculo de Impostos
        aliq_total_impostos = sum([
            Decimal(kit.aliq_pis or 0),
            Decimal(kit.aliq_cofins or 0),
            Decimal(kit.aliq_csll or 0),
            Decimal(kit.aliq_irpj or 0),
            Decimal(kit.aliq_iss or 0)
        ]) / Decimal(100.0)
        
        if aliq_total_impostos >= Decimal(1.0):
            aliq_total_impostos = Decimal("0.99") # Safety fallback
            
        if kit.tipo_contrato == "INSTALACAO":
            # For INSTALACAO typically taxes are inside the final value, 
            # so valor final IS the base final. And we subtract taxes from it.
            # "rateio impositivo de subtrair a tributação retida para valor operacional livre"
            valor_mensal_kit = valor_base_final
            valor_impostos = valor_mensal_kit * aliq_total_impostos
            valor_mensal_antes_impostos = valor_base_final  # purely for display compatibility
        else:
            # Locação adds taxes on top
            valor_mensal_antes_impostos = valor_base_final
            valor_impostos = valor_mensal_antes_impostos * aliq_total_impostos
            valor_mensal_kit = valor_mensal_antes_impostos + valor_impostos

        # 16. Receita Liquida
        receita_liquida_mensal_kit = valor_mensal_kit - valor_impostos

        # 17. Lucro Mensal
        if kit.tipo_contrato == "INSTALACAO":
            # Rule: valor_venda - (custos + impostos) => receita_liquida - custos
            lucro_mensal_kit = receita_liquida_mensal_kit - custo_aquisicao_kit - custo_operacional_mensal_kit
        else:
            lucro_mensal_kit = receita_liquida_mensal_kit - custo_total_mensal_kit

        margem_kit = Decimal("0.0")
        if receita_liquida_mensal_kit > 0:
            if kit.tipo_contrato == "INSTALACAO":
                margem_kit = (lucro_mensal_kit / valor_mensal_kit) * Decimal(100.0)
            else:
                margem_kit = (lucro_mensal_kit / receita_liquida_mensal_kit) * Decimal(100.0)

        return {
            "summary": {
                "prazo_mensalidades": prazo_mensalidades,
                "custo_operacional_mensal_kit": round(custo_operacional_mensal_kit, 2),
                "custo_aquisicao_kit": round(custo_aquisicao_kit, 2),
                "custo_aquisicao_produtos": round(custo_aquisicao_produtos, 2),
                "custo_aquisicao_servicos": round(custo_aquisicao_servicos, 2),
                "custo_aquisicao_total": round(custo_aquisicao_total, 2),
                "total_difal_kit": round(total_difal_kit, 2),
                "depreciacao_mensal_kit": round(depreciacao_mensal_kit, 2),
                "custo_total_mensal_kit": round(custo_total_mensal_kit, 2),
                "tx_locacao": round(tx_locacao, 6),
                "valor_base_venda": round(valor_base_venda, 2),
                "valor_parcela_locacao": round(valor_parcela_locacao, 2),
                "manutencao_mensal": round(manutencao_mensal, 2),
                "valor_mensal_antes_impostos": round(valor_mensal_antes_impostos, 2),
                "aliq_total_impostos": round(aliq_total_impostos * Decimal(100.0), 2),
                "valor_impostos": round(valor_impostos, 2),
                "valor_mensal_kit": round(valor_mensal_kit, 2),
                "receita_liquida_mensal_kit": round(receita_liquida_mensal_kit, 2),
                "lucro_mensal_kit": round(lucro_mensal_kit, 2),
                "margem_kit": round(margem_kit, 2)
            },
            "item_summaries": item_summaries
        }

    def list_kits(self, tenant_id: str, company_id: str):
        kits = self.db.query(OpportunityKit).filter(
            OpportunityKit.tenant_id == tenant_id,
            OpportunityKit.company_id == company_id
        ).all()
        
        # Compute dynamic financials
        for kit in kits:
            fin = self.calculate_financials(kit, tenant_id)
            kit.summary = fin["summary"]
            kit.item_summaries = fin["item_summaries"]
        return kits

    def get_kit(self, kit_id: str, tenant_id: str):
        kit = self.db.query(OpportunityKit).filter(
            OpportunityKit.id == kit_id,
            OpportunityKit.tenant_id == tenant_id
        ).first()
        if kit:
            fin = self.calculate_financials(kit, tenant_id)
            kit.summary = fin["summary"]
            kit.item_summaries = fin["item_summaries"]
        return kit

    def create_kit(self, tenant_id: str, company_id: str, data: OpportunityKitCreate) -> OpportunityKit:
        if data.prazo_instalacao_meses > data.prazo_contrato_meses:
            raise ValueError("Prazo de instalação não pode ser maior que o prazo do contrato.")
            
        kit = OpportunityKit(
            tenant_id=tenant_id,
            company_id=company_id,
            nome_kit=data.nome_kit,
            descricao_kit=data.descricao_kit,
            quantidade_kits=data.quantidade_kits,
            tipo_contrato=data.tipo_contrato,
            prazo_contrato_meses=data.prazo_contrato_meses,
            prazo_instalacao_meses=data.prazo_instalacao_meses,
            fator_margem_locacao=data.fator_margem_locacao,
            taxa_juros_mensal=data.taxa_juros_mensal,
            taxa_manutencao_anual=data.taxa_manutencao_anual,
            aliq_pis=data.aliq_pis,
            aliq_cofins=data.aliq_cofins,
            aliq_csll=data.aliq_csll,
            aliq_irpj=data.aliq_irpj,
            aliq_iss=data.aliq_iss,
            custo_manut_mensal_kit=data.custo_manut_mensal_kit,
            custo_suporte_mensal_kit=data.custo_suporte_mensal_kit,
            custo_seguro_mensal_kit=data.custo_seguro_mensal_kit,
            custo_logistica_mensal_kit=data.custo_logistica_mensal_kit,
            custo_software_mensal_kit=data.custo_software_mensal_kit,
            custo_itens_acessorios_mensal_kit=data.custo_itens_acessorios_mensal_kit
        )
        self.db.add(kit)
        self.db.flush()

        for item_data in data.items:
            item = OpportunityKitItem(
                kit_id=kit.id,
                product_id=item_data.product_id,
                descricao_item=item_data.descricao_item,
                quantidade_no_kit=item_data.quantidade_no_kit
            )
            self.db.add(item)
            
        self.db.commit()
        self.db.refresh(kit)
        fin = self.calculate_financials(kit, tenant_id)
        kit.summary = fin["summary"]
        kit.item_summaries = fin["item_summaries"]
        return kit

    def update_kit(self, kit_id: str, tenant_id: str, data: OpportunityKitUpdate) -> OpportunityKit:
        kit = self.db.query(OpportunityKit).filter(OpportunityKit.id == kit_id).first()
        if not kit:
            return None
            
        update_data = data.model_dump(exclude_unset=True)
        
        items_data = update_data.pop("items", None)
        if items_data is not None:
            # Delete old items
            self.db.query(OpportunityKitItem).filter(OpportunityKitItem.kit_id == kit.id).delete()
            self.db.flush()
            # Insert new items
            for item in items_data:
                new_item = OpportunityKitItem(
                    kit_id=kit.id,
                    product_id=item["product_id"],
                    descricao_item=item["descricao_item"],
                    quantidade_no_kit=item["quantidade_no_kit"]
                )
                self.db.add(new_item)

        for key, value in update_data.items():
            setattr(kit, key, value)
            
        if kit.prazo_instalacao_meses > kit.prazo_contrato_meses:
            raise ValueError("Prazo de instalação não pode ser maior que o prazo do contrato.")    

        self.db.commit()
        self.db.refresh(kit)
        fin = self.calculate_financials(kit, tenant_id)
        kit.summary = fin["summary"]
        kit.item_summaries = fin["item_summaries"]
        return kit
    
    def recalculate_kit_preview(self, tenant_id: str, data: OpportunityKitCreate) -> dict:
        """Endpoint used to preview financials without saving to DB"""
        # Create a mock objects
        kit = OpportunityKit(**data.model_dump(exclude={"items"}))
        kit.items = [OpportunityKitItem(**item_data.model_dump()) for item_data in data.items]
        
        fin = self.calculate_financials(kit, tenant_id)
        return fin
