# src/modules/cnpj_public/etl/downloader.py
from abc import ABC, abstractmethod
from typing import List
import os

class BaseDownloader(ABC):
    @abstractmethod
    def download(self, source_ref: str, target_dir: str) -> dict:
        """
        Downloads files and returns a dict mapping table types to list of local file paths.
        Example: {"empresas": ["/tmp/empresas1.csv"], "estabelecimentos": ["/tmp/estab1.csv"]}
        """
        pass

class GovBrDownloader(BaseDownloader):
    def download(self, source_ref: str, target_dir: str) -> dict:
        # P0 implementation: Pluggable placeholder. In production, this would fetch the HTML from
        # dados.gov.br, parse links, download ZIPs and extract them to target_dir.
        # For now, it expects the user to have placed the files manually if not a dry_run,
        # or it just simulates for dry_run.
        return {
            "empresas": [],
            "estabelecimentos": [],
            "cnaes": []
        }
