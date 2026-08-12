import os
import subprocess
from datetime import datetime, timezone
from urllib.parse import urlparse
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from src.modules.backup.models import BackupSettings

BACKUP_DIR = os.getenv("BACKUP_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../backups")))
os.makedirs(BACKUP_DIR, exist_ok=True)


def format_bytes(bytes_num: int) -> str:
    if bytes_num == 0:
        return "0 Bytes"
    units = ["Bytes", "KB", "MB", "GB", "TB"]
    i = 0
    size = float(bytes_num)
    while size >= 1024 and i < len(units) - 1:
        size /= 1024
        i += 1
    return f"{size:.2f} {units[i]}"


def is_remote_ip(ip: Optional[str]) -> bool:
    if not ip:
        return False
    clean = ip.strip().lower()
    return clean != "" and clean != "127.0.0.1" and clean != "localhost"


def get_or_create_settings(db: Session) -> BackupSettings:
    settings = db.query(BackupSettings).first()
    if not settings:
        settings = BackupSettings(
            target_ip="127.0.0.1",
            target_dir=BACKUP_DIR,
            ssh_user="root",
            ssh_port=22,
            cron_expression="0 2 * * *",
            retention_count=3,
            is_active=False
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def test_backup_destination(
    target_ip: Optional[str],
    target_dir: Optional[str],
    ssh_user: Optional[str],
    ssh_port: int,
    ssh_password: Optional[str]
) -> Dict[str, Any]:
    clean_ip = (target_ip or "").strip()
    clean_dir = (target_dir or "").strip().rstrip("/") or BACKUP_DIR
    user = (ssh_user or "").strip() or "root"
    port = int(ssh_port) if ssh_port else 22
    password = (ssh_password or "").strip()

    if not is_remote_ip(clean_ip):
        try:
            os.makedirs(clean_dir, exist_ok=True)
            test_file = os.path.join(clean_dir, ".perm_test")
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
            return {
                "success": True,
                "message": f'Diretório local "{clean_dir}" validado com permissão de escrita.'
            }
        except Exception as e:
            return {
                "success": False,
                "message": f'Falha ao acessar diretório local "{clean_dir}": {str(e)}'
            }
    else:
        env_vars = os.environ.copy()
        if password:
            env_vars["SSHPASS"] = password
            ssh_bin = "sshpass -e ssh"
        else:
            ssh_bin = "ssh"

        cmd = f'{ssh_bin} -p {port} -o StrictHostKeyChecking=no -o ConnectTimeout=5 {user}@{clean_ip} "mkdir -p \\"{clean_dir}\\" && test -w \\"{clean_dir}\\""'

        try:
            res = subprocess.run(
                cmd,
                shell=True,
                env=env_vars,
                capture_output=True,
                text=True,
                timeout=10
            )
            if res.returncode == 0:
                return {
                    "success": True,
                    "message": f'Conexão SSH com {clean_ip}:{port} e diretório remoto "{clean_dir}" validados com sucesso.'
                }
            else:
                err_msg = res.stderr.strip() or res.stdout.strip() or f"Código de erro {res.returncode}"
                if "sshpass: not found" in err_msg or "ssh: not found" in err_msg or res.returncode == 127:
                    return {
                        "success": False,
                        "message": "O utilitário 'ssh' ou 'sshpass' não está instalado no container do backend."
                    }
                return {
                    "success": False,
                    "message": f'Falha na conexão SSH com {user}@{clean_ip}:{port} ({clean_dir}): {err_msg}'
                }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "message": f'Timeout na conexão SSH com {clean_ip}:{port}. Verifique o IP, porta e regras de firewall.'
            }
        except Exception as e:
            return {
                "success": False,
                "message": f'Erro ao testar destino SSH: {str(e)}'
            }


def prune_old_backups(limit: int = 3):
    if not os.path.exists(BACKUP_DIR):
        return

    files = []
    for f in os.listdir(BACKUP_DIR):
        if f.startswith("backup_") and f.endswith(".sql.gz"):
            full_path = os.path.join(BACKUP_DIR, f)
            files.append((f, os.path.getmtime(full_path), full_path))

    # Ordenar por data de modificação decrescente (mais recente primeiro)
    files.sort(key=lambda x: x[1], reverse=True)

    if len(files) > limit:
        to_delete = files[limit:]
        for f_name, _, f_path in to_delete:
            try:
                os.remove(f_path)
            except Exception as e:
                print(f"[BACKUP PRUNE WARNING] Erro ao remover backup antigo {f_name}: {e}")


def list_backup_files() -> List[Dict[str, Any]]:
    if not os.path.exists(BACKUP_DIR):
        return []

    result = []
    for f in os.listdir(BACKUP_DIR):
        if f.startswith("backup_") and f.endswith(".sql.gz"):
            full_path = os.path.join(BACKUP_DIR, f)
            stat = os.stat(full_path)
            created_dt = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
            result.append({
                "filename": f,
                "size_formatted": format_bytes(stat.st_size),
                "size_bytes": stat.st_size,
                "created_at": created_dt
            })

    result.sort(key=lambda x: x["created_at"], reverse=True)
    return result


def delete_backup_file(filename: str) -> bool:
    # Sanitização contra Directory Traversal
    clean_filename = os.path.basename(filename)
    if not clean_filename.startswith("backup_") or not clean_filename.endswith(".sql.gz"):
        raise ValueError("Nome de arquivo de backup inválido.")

    file_path = os.path.join(BACKUP_DIR, clean_filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return True
    return False


def run_backup_now(db: Session) -> Dict[str, Any]:
    settings = get_or_create_settings(db)
    retention_count = settings.retention_count or 3
    target_ip = (settings.target_ip or "").strip()
    target_dir = (settings.target_dir or "").strip().rstrip("/")
    ssh_user = (settings.ssh_user or "").strip() or "root"
    ssh_port = settings.ssh_port or 22
    ssh_password = (settings.ssh_password or "").strip()

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"backup_{timestamp}.sql.gz"
    file_path = os.path.join(BACKUP_DIR, filename)

    database_url = os.getenv("DATABASE_URL", "postgresql://cerberus_user:cerberus_password@db:5432/cerberus")
    parsed = urlparse(database_url)
    db_user = parsed.username or os.getenv("DB_USER", "cerberus_user")
    db_password = parsed.password or os.getenv("DB_PASSWORD", "cerberus_password")
    db_host = parsed.hostname or os.getenv("DB_HOST", "db")
    db_port = str(parsed.port or os.getenv("DB_PORT", "5432"))
    db_name = (parsed.path or "/cerberus").lstrip("/")

    env_vars = os.environ.copy()
    env_vars["PGPASSWORD"] = db_password

    cmd = f'pg_dump -h {db_host} -p {db_port} -U {db_user} -d {db_name} --no-owner --no-privileges | gzip > "{file_path}"'

    try:
        res = subprocess.run(
            cmd,
            shell=True,
            env=env_vars,
            capture_output=True,
            text=True,
            timeout=300
        )
        if res.returncode != 0:
            err_msg = res.stderr.strip() or f"Erro pg_dump (código {res.returncode})"
            settings.last_backup_at = datetime.now(timezone.utc)
            settings.last_backup_status = "FAILED"
            settings.last_backup_message = f"Falha no pg_dump: {err_msg}"
            db.commit()
            raise RuntimeError(f"Falha ao executar pg_dump: {err_msg}")

        if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
            settings.last_backup_at = datetime.now(timezone.utc)
            settings.last_backup_status = "FAILED"
            settings.last_backup_message = "O arquivo de backup foi gerado vazio ou não foi criado."
            db.commit()
            raise RuntimeError("Arquivo de backup gerado está vazio.")

        remote_dest = None
        if is_remote_ip(target_ip) and target_dir:
            remote_file = f"{target_dir}/{filename}"
            scp_env = os.environ.copy()
            if ssh_password:
                scp_env["SSHPASS"] = ssh_password
                scp_bin = "sshpass -e scp"
            else:
                scp_bin = "scp"

            scp_cmd = f'{scp_bin} -P {ssh_port} -o StrictHostKeyChecking=no -o ConnectTimeout=10 "{file_path}" "{ssh_user}@{target_ip}:{remote_file}"'
            scp_res = subprocess.run(
                scp_cmd,
                shell=True,
                env=scp_env,
                capture_output=True,
                text=True,
                timeout=120
            )
            if scp_res.returncode != 0:
                scp_err = scp_res.stderr.strip() or f"Código {scp_res.returncode}"
                settings.last_backup_at = datetime.now(timezone.utc)
                settings.last_backup_status = "FAILED"
                settings.last_backup_message = f"Backup gerado localmente, mas falhou ao enviar por SCP para {target_ip}: {scp_err}"
                db.commit()
                raise RuntimeError(f"Falha no envio remoto SCP: {scp_err}")

            remote_dest = f"{target_ip}:{remote_file}"

        prune_old_backups(retention_count)

        settings.last_backup_at = datetime.now(timezone.utc)
        settings.last_backup_status = "SUCCESS"
        msg = f"Backup {filename} gerado com sucesso."
        if remote_dest:
            msg += f" Copiado para {remote_dest}."
        settings.last_backup_message = msg
        db.commit()

        return {
            "success": True,
            "message": msg,
            "filename": filename,
            "remote_destination": remote_dest
        }

    except Exception as e:
        settings.last_backup_at = datetime.now(timezone.utc)
        settings.last_backup_status = "FAILED"
        settings.last_backup_message = str(e)
        db.commit()
        raise
