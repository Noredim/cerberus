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

# Importar main para carregar todos os modelos do Cerberus e inicializar mapeadores
import src.main  # noqa: F401
from src.core.database import SessionLocal
from src.modules.marketing.models import MarketingLandingPage

try:
    from PIL import Image
except ImportError:
    print("[ERRO] Pillow não está instalado. Execute: pip install Pillow")
    sys.exit(1)


def convert_image_to_webp(filepath: str, max_width: int = 1920, quality: int = 78, force_recompress: bool = False) -> str:
    """Converte e redimensiona uma imagem para WebP otimizado."""
    base, ext = os.path.splitext(filepath)
    is_webp = ext.lower() == ".webp"
    
    if is_webp and not force_recompress:
        with Image.open(filepath) as img:
            if img.width <= max_width:
                return filepath

    webp_path = filepath if is_webp else f"{base}.webp"
    temp_path = f"{webp_path}.tmp"
    
    orig_size = os.path.getsize(filepath)

    with Image.open(filepath) as img:
        # Se for RGBA ou tiver canal alfa, preservar; caso contrário, converter modo
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            pass
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Redimensionar se exceder max_width
        if img.width > max_width:
            new_height = max(1, int((max_width / img.width) * img.height))
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        
        img.save(temp_path, "WEBP", quality=quality, method=6)

    new_size = os.path.getsize(temp_path)

    # Se o novo arquivo for menor ou se converteu de JPG/PNG para WebP
    if new_size < orig_size or not is_webp:
        if os.path.exists(webp_path) and webp_path != filepath:
            try:
                os.remove(webp_path)
            except Exception:
                pass
        os.replace(temp_path, webp_path)
        if not is_webp and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception:
                pass
        savings = (1 - new_size / orig_size) * 100 if orig_size > 0 else 0
        print(f"  [OK] {os.path.basename(filepath)} ({orig_size//1024} KB) -> {os.path.basename(webp_path)} ({new_size//1024} KB) [-{savings:.1f}%]")
    else:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        print(f"  [SKIP] {os.path.basename(filepath)} já está no tamanho ideal ({orig_size//1024} KB)")

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

            # 1. Banner (Max 1200px)
            if lp.url_imagem_banner and "/uploads/marketing/" in lp.url_imagem_banner:
                filename = lp.url_imagem_banner.split("/")[-1]
                filepath = os.path.join(upload_dir, filename)
                if os.path.exists(filepath):
                    print(f"  Otimizando Banner ({filename})...")
                    webp_path = convert_image_to_webp(filepath, max_width=1200, quality=78)
                    new_url = f"/uploads/marketing/{os.path.basename(webp_path)}"
                    if lp.url_imagem_banner != new_url and not args.dry_run:
                        lp.url_imagem_banner = new_url
                        modified = True

            # 2. Fundo (Max 1600px)
            if lp.url_imagem_fundo and "/uploads/marketing/" in lp.url_imagem_fundo:
                filename = lp.url_imagem_fundo.split("/")[-1]
                filepath = os.path.join(upload_dir, filename)
                if os.path.exists(filepath):
                    print(f"  Otimizando Fundo ({filename})...")
                    webp_path = convert_image_to_webp(filepath, max_width=1600, quality=75)
                    new_url = f"/uploads/marketing/{os.path.basename(webp_path)}"
                    if lp.url_imagem_fundo != new_url and not args.dry_run:
                        lp.url_imagem_fundo = new_url
                        modified = True

            # 3. Logo em configuracao_conteudo (Max 300px)
            cfg = dict(lp.configuracao_conteudo or {})
            if cfg.get("url_logo") and "/uploads/marketing/" in cfg["url_logo"]:
                filename = cfg["url_logo"].split("/")[-1]
                filepath = os.path.join(upload_dir, filename)
                if os.path.exists(filepath):
                    print(f"  Otimizando Logo do Conteúdo ({filename})...")
                    webp_path = convert_image_to_webp(filepath, max_width=300, quality=78, force_recompress=True)
                    new_url = f"/uploads/marketing/{os.path.basename(webp_path)}"
                    if cfg["url_logo"] != new_url:
                        cfg["url_logo"] = new_url
                        if not args.dry_run:
                            lp.configuracao_conteudo = cfg
                        modified = True

            # 4. Logo principal do modelo (Max 300px)
            if hasattr(lp, "url_logo") and lp.url_logo and "/uploads/marketing/" in lp.url_logo:
                filename = lp.url_logo.split("/")[-1]
                filepath = os.path.join(upload_dir, filename)
                if os.path.exists(filepath):
                    print(f"  Otimizando Logo Principal ({filename})...")
                    webp_path = convert_image_to_webp(filepath, max_width=300, quality=78, force_recompress=True)
                    new_url = f"/uploads/marketing/{os.path.basename(webp_path)}"
                    if lp.url_logo != new_url and not args.dry_run:
                        lp.url_logo = new_url
                        modified = True

            if modified:
                updated_count += 1

        # 5. Otimização direta de quaisquer arquivos restantes no diretório de uploads
        print("\nVerificando todos os arquivos soltos em uploads/marketing/...")
        for fname in os.listdir(upload_dir):
            fpath = os.path.join(upload_dir, fname)
            if os.path.isfile(fpath) and not fname.endswith(".tmp"):
                lower = fname.lower()
                if lower.endswith((".png", ".jpg", ".jpeg")):
                    convert_image_to_webp(fpath, max_width=1200, quality=78)
                elif lower.endswith(".webp"):
                    try:
                        with Image.open(fpath) as img:
                            w, h = img.size
                        if "869b946a2d8f47fb856c0a5b4c00c753" in lower or (w <= 700 and h <= 250):
                            convert_image_to_webp(fpath, max_width=300, quality=78, force_recompress=True)
                        elif w > 1200:
                            convert_image_to_webp(fpath, max_width=1200, quality=78, force_recompress=True)
                    except Exception as err:
                        print(f"  [AVISO] Não foi possível verificar {fname}: {err}")

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
