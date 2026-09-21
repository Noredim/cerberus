#!/usr/bin/env python3
"""
Script para otimizar mídias e imagens de Landing Pages existentes no Cerberus.
Converte arquivos JPG/PNG pesados em WebP comprimido e atualiza com segurança
as URLs registradas no banco de dados.
"""

import os
import sys
import argparse

# Adicionar path raiz do backend para imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from sqlalchemy.orm import configure_mappers
from src.core.database import SessionLocal
import src.modules.companies.models
import src.modules.users.models
import src.modules.leads.models
import src.modules.marketing.models
from src.modules.marketing.models import MarketingLandingPage

try:
    configure_mappers()
except Exception:
    pass

try:
    from PIL import Image
except ImportError:
    print("[ERRO] Pillow não está instalado. Execute: pip install Pillow")
    sys.exit(1)


def convert_image_to_webp(filepath: str, max_width: int = 1920, quality: int = 82) -> str:
    """Converte uma imagem para WebP se ainda não for."""
    base, ext = os.path.splitext(filepath)
    if ext.lower() == ".webp":
        return filepath

    webp_path = f"{base}.webp"
    
    with Image.open(filepath) as img:
        # Redimensionar se exceder max_width
        if img.width > max_width:
            new_height = int((max_width / img.width) * img.height)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        
        img.save(webp_path, "WEBP", quality=quality, method=6)

    orig_size = os.path.getsize(filepath)
    webp_size = os.path.getsize(webp_path)
    savings = (1 - webp_size / orig_size) * 100 if orig_size > 0 else 0
    print(f"  [OK] {os.path.basename(filepath)} ({orig_size//1024} KB) -> {os.path.basename(webp_path)} ({webp_size//1024} KB) [-{savings:.1f}%]")
    
    return webp_path


def main():
    parser = argparse.ArgumentParser(description="Otimizar imagens de Landing Pages existentes para WebP.")
    parser.add_argument("--dry-run", action="store_true", help="Apenas simular as conversões sem alterar o banco de dados.")
    args = parser.parse_args()

    upload_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../uploads/marketing"))
    if not os.path.exists(upload_dir):
        print(f"[INFO] Diretório {upload_dir} não existe. Nada a fazer.")
        return

    print("=" * 60)
    print("CERBERUS MARKETING - Otimizador de Imagens de Landing Pages")
    print(f"Diretório: {upload_dir}")
    print(f"Modo: {'SIMULAÇÃO (DRY RUN)' if args.dry_run else 'APLICAR ALTERAÇÕES'}")
    print("=" * 60)

    db = SessionLocal()
    try:
        pages = db.query(MarketingLandingPage).all()
        updated_count = 0

        for lp in pages:
            modified = False
            print(f"\nVerificando Landing Page: '{lp.titulo}' (slug: {lp.slug})")

            # 1. Banner
            if lp.url_imagem_banner and "/uploads/marketing/" in lp.url_imagem_banner:
                filename = lp.url_imagem_banner.split("/")[-1]
                filepath = os.path.join(upload_dir, filename)
                if os.path.exists(filepath) and not filename.lower().endswith(".webp"):
                    print(" Convertendo Banner...")
                    webp_path = convert_image_to_webp(filepath)
                    new_url = f"/uploads/marketing/{os.path.basename(webp_path)}"
                    if not args.dry_run:
                        lp.url_imagem_banner = new_url
                    modified = True

            # 2. Fundo
            if lp.url_imagem_fundo and "/uploads/marketing/" in lp.url_imagem_fundo:
                filename = lp.url_imagem_fundo.split("/")[-1]
                filepath = os.path.join(upload_dir, filename)
                if os.path.exists(filepath) and not filename.lower().endswith(".webp"):
                    print(" Convertendo Fundo...")
                    webp_path = convert_image_to_webp(filepath)
                    new_url = f"/uploads/marketing/{os.path.basename(webp_path)}"
                    if not args.dry_run:
                        lp.url_imagem_fundo = new_url
                    modified = True

            # 3. Logo em configuracao_conteudo
            cfg = dict(lp.configuracao_conteudo or {})
            if cfg.get("url_logo") and "/uploads/marketing/" in cfg["url_logo"]:
                filename = cfg["url_logo"].split("/")[-1]
                filepath = os.path.join(upload_dir, filename)
                if os.path.exists(filepath) and not filename.lower().endswith(".webp"):
                    print(" Convertendo Logo...")
                    webp_path = convert_image_to_webp(filepath, max_width=600)
                    new_url = f"/uploads/marketing/{os.path.basename(webp_path)}"
                    cfg["url_logo"] = new_url
                    if not args.dry_run:
                        lp.configuracao_conteudo = cfg
                    modified = True

            if modified:
                updated_count += 1

        if not args.dry_run:
            db.commit()
            print(f"\n[SUCESSO] {updated_count} Landing Page(s) atualizada(s) no banco de dados com URLs WebP!")
        else:
            print(f"\n[SIMULAÇÃO] {updated_count} Landing Page(s) seriam atualizadas.")

    except Exception as e:
        db.rollback()
        print(f"[ERRO] Falha ao otimizar imagens: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
