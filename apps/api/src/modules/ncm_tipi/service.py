import io
import re
import openpyxl
from decimal import Decimal, InvalidOperation
from datetime import date, datetime
from typing import List, Optional, Tuple
from uuid import UUID
from fastapi import HTTPException
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

        # Find columns by checking the first row headers
        col_ncm = None
        col_aliquota = None
        
        # Read the first row (headers)
        headers = []
        for cell in sheet[1]:
            headers.append(str(cell.value or "").strip().lower())
            
        for idx, header in enumerate(headers):
            if "ncm" in header:
                col_ncm = idx
            elif "aliquota" in header or "alíquota" in header:
                col_aliquota = idx

        if col_ncm is None:
            raise HTTPException(
                status_code=400,
                detail="A coluna contendo 'NCM' não foi identificada na planilha. Certifique-se de que o cabeçalho contenha 'NCM'."
            )
        if col_aliquota is None:
            raise HTTPException(
                status_code=400,
                detail="A coluna contendo 'Alíquota' não foi identificada na planilha. Certifique-se de que o cabeçalho contenha 'Alíquota (%)' ou similar."
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

        try:
            # We start from row 2 (index 2 onwards in iter_rows)
            for row in sheet.iter_rows(min_row=2, values_only=True):
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
                    ncms = db.query(Ncm).filter(Ncm.codigo == ncm_clean, Ncm.deleted_at.is_(None)).all()
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
                query = query.filter(Ncm.codigo.ilike(f"{codigo_clean}%"))
                
        total = query.count()
        items = query.order_by(Ncm.codigo, NcmTipi.vigencia.desc()).offset(skip).limit(limit).all()
        
        # Explicitly set the fields that will be needed by the schema
        for item in items:
            item.codigo_ncm = item.ncm.codigo
            item.descricao_ncm = item.ncm.descricao
            
        return items, total
