import io
import re
import openpyxl
from decimal import Decimal, InvalidOperation
from datetime import date, datetime
from typing import List, Optional, Tuple
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from src.modules.ncm.models import Ncm
from .models import TipiImportacao, NcmTipi

class TipiService:
    @staticmethod
    def importar_tipi(db: Session, file_bytes: bytes, filename: str, vigencia: date) -> TipiImportacao:
        # Load Excel workbook
        try:
            workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            sheet = workbook.active
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Falha ao ler o arquivo Excel: {str(e)}")

        # Find columns by scanning the first 20 rows of the sheet
        col_ncm = None
        col_aliquota = None
        header_row_idx = None

        # 1. Try to find a row containing both NCM and Alíquota/IPI
        for r_idx in range(1, 21):
            row_cells = list(sheet[r_idx])
            temp_ncm = None
            temp_aliquota = None
            
            for c_idx, cell in enumerate(row_cells):
                val = str(cell.value or "").strip().lower()
                
                # Check for NCM keyword
                if "ncm" in val:
                    temp_ncm = c_idx
                elif val in ["codigo", "código", "código ncm", "codigo ncm", "nomenclatura"] and temp_ncm is None:
                    temp_ncm = c_idx
                
                # Check for Alíquota/IPI keyword
                if "aliquota" in val or "alíquota" in val or "ipi" in val:
                    temp_aliquota = c_idx
                elif val in ["aliq", "alíq"] and temp_aliquota is None:
                    temp_aliquota = c_idx

            if temp_ncm is not None and temp_aliquota is not None:
                col_ncm = temp_ncm
                col_aliquota = temp_aliquota
                header_row_idx = r_idx
                break

        # 2. Fallback: Search separately across the first 20 rows if they are not in the same row
        if col_ncm is None or col_aliquota is None:
            for r_idx in range(1, 21):
                row_cells = list(sheet[r_idx])
                for c_idx, cell in enumerate(row_cells):
                    val = str(cell.value or "").strip().lower()
                    
                    if col_ncm is None:
                        if "ncm" in val:
                            col_ncm = c_idx
                            header_row_idx = max(header_row_idx or 1, r_idx)
                        elif val in ["codigo", "código", "código ncm", "codigo ncm", "nomenclatura"]:
                            col_ncm = c_idx
                            header_row_idx = max(header_row_idx or 1, r_idx)
                            
                    if col_aliquota is None:
                        if "aliquota" in val or "alíquota" in val or "ipi" in val:
                            col_aliquota = c_idx
                            header_row_idx = max(header_row_idx or 1, r_idx)
                        elif val in ["aliq", "alíq"]:
                            col_aliquota = c_idx
                            header_row_idx = max(header_row_idx or 1, r_idx)

        if col_ncm is None:
            raise HTTPException(
                status_code=400,
                detail="A coluna contendo 'NCM' nao foi identificada na planilha. Certifique-se de que o cabecalho contenha 'NCM'."
            )
        if col_aliquota is None:
            raise HTTPException(
                status_code=400,
                detail="A coluna contendo 'Aliquota' nao foi identificada na planilha. Certifique-se de que o cabecalho contenha 'Aliquota (%)', 'IPI' ou similar."
            )

        # Create import record in status PROCESSANDO
        importacao = TipiImportacao(
            arquivo_nome=filename,
            vigencia=vigencia,
            total_linhas=0,
            total_importados=0,
            total_ignorados=0,
            total_erros=0,
            status="PROCESSANDO"
        )
        db.add(importacao)
        db.commit()
        db.refresh(importacao)

        total_linhas = 0
        total_importados = 0
        total_ignorados = 0
        total_erros = 0

        min_row = (header_row_idx + 1) if header_row_idx is not None else 2
        try:
            # We start from the row after the identified header row
            for row in sheet.iter_rows(min_row=min_row, values_only=True):
                # If row is empty, skip
                if not any(cell is not None for cell in row):
                    continue

                total_linhas += 1

                try:
                    # Retrieve values
                    ncm_raw = row[col_ncm]
                    aliquota_raw = row[col_aliquota]

                    if ncm_raw is None or aliquota_raw is None:
                        total_ignorados += 1
                        continue

                    # Clean NCM (keep only digits)
                    ncm_clean = re.sub(r"\D", "", str(ncm_raw).strip())
                    if not ncm_clean:
                        total_ignorados += 1
                        continue

                    # Clean and parse Alíquota
                    if isinstance(aliquota_raw, str):
                        aliquota_str = aliquota_raw.strip().replace("%", "").replace(",", ".").strip()
                        if not aliquota_str:
                            total_ignorados += 1
                            continue
                        aliquota_val = Decimal(aliquota_str)
                    else:
                        aliquota_val = Decimal(str(aliquota_raw))

                    # Rule: "Import only numeric alíquotas strictly greater than zero (> 0)"
                    if aliquota_val <= 0:
                        total_ignorados += 1
                        continue

                    # Find existing NCMs with this code
                    normalized_db_code = func.replace(func.replace(func.replace(Ncm.codigo, '.', ''), '-', ''), ' ', '')
                    ncms = db.query(Ncm).filter(normalized_db_code == ncm_clean, Ncm.deleted_at.is_(None)).all()
                    if not ncms:
                        total_ignorados += 1
                        continue

                    # Create relationship for each NCM record matching the code
                    for ncm_obj in ncms:
                        new_ncm_tipi = NcmTipi(
                            ncm_id=ncm_obj.id,
                            importacao_id=importacao.id,
                            aliquota=aliquota_val,
                            vigencia=vigencia
                        )
                        db.add(new_ncm_tipi)
                        total_importados += 1

                except (ValueError, TypeError, InvalidOperation):
                    total_ignorados += 1
                    continue
                except Exception:
                    total_erros += 1
                    continue

            # Update import statistics
            importacao.total_linhas = total_linhas
            importacao.total_importados = total_importados
            importacao.total_ignorados = total_ignorados
            importacao.total_erros = total_erros
            importacao.status = "CONCLUIDO"
            db.commit()
            db.refresh(importacao)

        except Exception as e:
            db.rollback()
            importacao.status = "ERRO"
            db.commit()
            raise HTTPException(status_code=500, detail=f"Erro interno durante processamento: {str(e)}")

        return importacao

    @staticmethod
    def get_importacoes(db: Session, skip: int = 0, limit: int = 100) -> Tuple[List[TipiImportacao], int]:
        query = db.query(TipiImportacao).filter(TipiImportacao.deleted_at.is_(None))
        total = query.count()
        items = query.order_by(TipiImportacao.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    @staticmethod
    def get_valores(db: Session, skip: int = 0, limit: int = 100, codigo_ncm: Optional[str] = None) -> Tuple[List[NcmTipi], int]:
        query = db.query(NcmTipi).join(Ncm, NcmTipi.ncm_id == Ncm.id).filter(NcmTipi.deleted_at.is_(None))
        
        if codigo_ncm:
            codigo_clean = re.sub(r"\D", "", codigo_ncm)
            if codigo_clean:
                normalized_db_code = func.replace(func.replace(func.replace(Ncm.codigo, '.', ''), '-', ''), ' ', '')
                query = query.filter(normalized_db_code.ilike(f"{codigo_clean}%"))
                
        total = query.count()
        items = query.order_by(Ncm.codigo, NcmTipi.vigencia.desc()).offset(skip).limit(limit).all()
        
        # Explicitly set the fields that will be needed by the schema
        for item in items:
            item.codigo_ncm = item.ncm.codigo.replace(".", "") if item.ncm and item.ncm.codigo else ""
            item.descricao_ncm = item.ncm.descricao
            
        return items, total
