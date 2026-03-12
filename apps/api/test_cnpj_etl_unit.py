import datetime
from decimal import Decimal
import unittest
from src.modules.cnpj_public.etl.normalizer import parse_cnpj

class TestCnpjNormalizer(unittest.TestCase):
    def test_parse_cnpj_valid(self):
        # Normal padding
        self.assertEqual(parse_cnpj("12345678", "0001", "53"), "12345678000153")
        # Needs padding on left
        self.assertEqual(parse_cnpj("191", "1", "00"), "00000191000100")
        
    def test_parse_cnpj_invalid(self):
        self.assertIsNone(parse_cnpj("", "0001", "53"))
        self.assertIsNone(parse_cnpj(None, "0001", "53"))
        self.assertIsNone(parse_cnpj("123", None, "53"))

if __name__ == '__main__':
    unittest.main()
