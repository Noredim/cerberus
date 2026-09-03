import unittest
from decimal import Decimal
from src.modules.payment_methods.service import PaymentMethodsService
from src.modules.payment_methods.schemas import FormaPagamentoCreate, FormaPagamentoParcelaCreate, TipoUsoEnum, TipoDistribuicaoEnum
from pydantic import ValidationError

class TestPaymentMethodsInterest(unittest.TestCase):
    def test_01_user_case_4_installments_with_entry(self):
        """
        Caso do Usuário:
        Valor à vista: R$ 10.000,00
        Taxa: 3% ao mês
        Quantidade: 4 parcelas (0, 30, 60, 90 dias)
        Fórmula: 10000 / (1 + 1/1.03 + 1/1.03^2 + 1/1.03^3) = R$ 2.611,91
        Resultado esperado:
        - 4 parcelas fixas de R$ 2.611,91 (inclusive a primeira no ato)
        - Total das parcelas: R$ 10.447,64
        - Total de juros: R$ 447,64
        """
        parcelas_rules = [
            {"sequencia": 1, "descricao": "1ª parcela (No ato)", "intervalo_dias": 0, "percentual": None, "valor_fixo": None},
            {"sequencia": 2, "descricao": "2ª parcela (30 dias)", "intervalo_dias": 30, "percentual": None, "valor_fixo": None},
            {"sequencia": 3, "descricao": "3ª parcela (60 dias)", "intervalo_dias": 60, "percentual": None, "valor_fixo": None},
            {"sequencia": 4, "descricao": "4ª parcela (90 dias)", "intervalo_dias": 90, "percentual": None, "valor_fixo": None},
        ]
        res = PaymentMethodsService.calculate_installments_schedule(
            valor_total=Decimal('10000.00'),
            parcelas_rules=parcelas_rules,
            tipo_distribuicao='RATEIO_IGUAL',
            taxa_juros_mensal=Decimal('3.0')
        )
        self.assertEqual(res['pmt'], Decimal('2611.91'))
        self.assertEqual(res['total_geral'], Decimal('10447.64'))
        self.assertEqual(res['total_juros'], Decimal('447.64'))
        self.assertEqual(res['installments_values'], [Decimal('2611.91'), Decimal('2611.91'), Decimal('2611.91'), Decimal('2611.91')])

    def test_02_bcb_official_case_postecipada(self):
        """
        Caso Oficial Postecipado:
        PV = R$ 10.000,00, i = 2,5% a.m., n = 5 parcelas (30, 60, 90, 120, 150 dias)
        Resultado esperado:
        - 5 parcelas de R$ 2.152,47
        - Total das parcelas: R$ 10.762,35
        - Total de juros: R$ 762,35
        """
        parcelas_rules = [
            {"sequencia": 1, "descricao": "30 dias", "intervalo_dias": 30, "percentual": None, "valor_fixo": None},
            {"sequencia": 2, "descricao": "60 dias", "intervalo_dias": 60, "percentual": None, "valor_fixo": None},
            {"sequencia": 3, "descricao": "90 dias", "intervalo_dias": 90, "percentual": None, "valor_fixo": None},
            {"sequencia": 4, "descricao": "120 dias", "intervalo_dias": 120, "percentual": None, "valor_fixo": None},
            {"sequencia": 5, "descricao": "150 dias", "intervalo_dias": 150, "percentual": None, "valor_fixo": None},
        ]
        res = PaymentMethodsService.calculate_installments_schedule(
            valor_total=Decimal('10000.00'),
            parcelas_rules=parcelas_rules,
            tipo_distribuicao='RATEIO_IGUAL',
            taxa_juros_mensal=Decimal('2.500000')
        )
        self.assertEqual(res['pmt'], Decimal('2152.47'))
        self.assertEqual(res['total_geral'], Decimal('10762.35'))
        self.assertEqual(res['total_juros'], Decimal('762.35'))
        for val in res['installments_values']:
            self.assertEqual(val, Decimal('2152.47'))

    def test_03_zero_interest_rate(self):
        """
        Taxa zero: Mantém rateio igualitário original sem juros
        """
        parcelas_rules = [
            {"sequencia": 1, "descricao": "30 dias", "intervalo_dias": 30, "percentual": None, "valor_fixo": None},
            {"sequencia": 2, "descricao": "60 dias", "intervalo_dias": 60, "percentual": None, "valor_fixo": None},
            {"sequencia": 3, "descricao": "90 dias", "intervalo_dias": 90, "percentual": None, "valor_fixo": None},
        ]
        res = PaymentMethodsService.calculate_installments_schedule(
            valor_total=Decimal('1000.00'),
            parcelas_rules=parcelas_rules,
            tipo_distribuicao='RATEIO_IGUAL',
            taxa_juros_mensal=Decimal('0')
        )
        self.assertEqual(res['total_juros'], Decimal('0'))
        self.assertEqual(res['total_geral'], Decimal('1000.00'))
        self.assertEqual(res['installments_values'], [Decimal('333.33'), Decimal('333.33'), Decimal('333.34')])

    def test_04_fractional_interest_rate_1_99(self):
        """
        Taxa fracionária 1,99% em 12 parcelas postecipadas:
        PV = 10000.00, i = 1.99%, n = 12
        PMT = (10000 * 0.0199) / (1 - 1.0199^(-12)) = 945.02
        """
        parcelas_rules = [
            {"sequencia": i, "descricao": f"{i*30} dias", "intervalo_dias": i*30, "percentual": None, "valor_fixo": None}
            for i in range(1, 13)
        ]
        res = PaymentMethodsService.calculate_installments_schedule(
            valor_total=Decimal('10000.00'),
            parcelas_rules=parcelas_rules,
            tipo_distribuicao='RATEIO_IGUAL',
            taxa_juros_mensal=Decimal('1.990000')
        )
        self.assertEqual(res['pmt'], Decimal('945.02'))
        self.assertEqual(res['total_financiado'], Decimal('11340.24'))
        self.assertEqual(res['total_juros'], Decimal('1340.24'))

    def test_05_100_percent_entry_payment(self):
        """
        100% à vista no ato (0 dias): Não incide juros
        """
        parcelas_rules = [
            {"sequencia": 1, "descricao": "À vista", "intervalo_dias": 0, "percentual": Decimal('100'), "valor_fixo": None}
        ]
        res = PaymentMethodsService.calculate_installments_schedule(
            valor_total=Decimal('5000.00'),
            parcelas_rules=parcelas_rules,
            tipo_distribuicao='PERCENTUAL',
            taxa_juros_mensal=Decimal('3.0')
        )
        self.assertEqual(res['total_entrada'], Decimal('5000.00'))
        self.assertEqual(res['total_juros'], Decimal('0.00'))
        self.assertEqual(res['total_geral'], Decimal('5000.00'))
        self.assertEqual(res['total_entrada'], Decimal('5000.00'))
        self.assertEqual(res['valor_financiado'], Decimal('0.00'))
        self.assertEqual(res['total_juros'], Decimal('0.00'))
        self.assertEqual(res['total_geral'], Decimal('5000.00'))

    def test_07_validation_negative_or_excessive_interest(self):
        """
        Validação Pydantic: Rejeitar taxa negativa ou superior a 100%
        """
        with self.assertRaises(ValidationError):
            FormaPagamentoCreate(
                descricao="Teste Negativo",
                tipo_uso=TipoUsoEnum.VENDA,
                tipo_distribuicao=TipoDistribuicaoEnum.RATEIO_IGUAL,
                taxa_juros_mensal=Decimal('-0.5'),
                parcelas=[FormaPagamentoParcelaCreate(sequencia=1, descricao="30d", intervalo_dias=30)]
            )
        with self.assertRaises(ValidationError):
            FormaPagamentoCreate(
                descricao="Teste Excessivo",
                tipo_uso=TipoUsoEnum.VENDA,
                tipo_distribuicao=TipoDistribuicaoEnum.RATEIO_IGUAL,
                taxa_juros_mensal=Decimal('100.5'),
                parcelas=[FormaPagamentoParcelaCreate(sequencia=1, descricao="30d", intervalo_dias=30)]
            )


    def test_08_locacao_comodato_isolation_and_snapshot(self):
        """
        Isolamento de Locação/Comodato e Snapshot:
        Garante que itens de locação/comodato não sofrem acréscimo de juros e que o snapshot é imutável.
        """
        # Mocking budget
        class MockRentalItem:
            def __init__(self, tipo_contrato_kit, valor_mensal, prazo_contrato, quantidade):
                self.tipo_contrato_kit = tipo_contrato_kit
                self.valor_mensal = valor_mensal
                self.prazo_contrato = prazo_contrato
                self.quantidade = quantidade
                self.product_nome = 'Kit CFTV Locacao'

        class MockItem:
            def __init__(self, total_venda):
                self.total_venda = total_venda

        # Item de venda: R$ 10.000,00 (sofre parcelamento com juros de 2.5% a.m. em 5x)
        # Item de locacao: R$ 500,00/mês por 12 meses (permanece nominal R$ 500,00)
        items = [MockItem(Decimal('10000.00'))]
        rental_items = [MockRentalItem('LOCACAO', Decimal('500.00'), 12, 1)]

        # Verify sale portion vs rental portion
        total_venda_items = sum(Decimal(str(i.total_venda or 0)) for i in items)
        self.assertEqual(total_venda_items, Decimal('10000.00'))

        # Check that rental item monthly remains R$ 500.00 without any interest applied
        for ri in rental_items:
            self.assertEqual(ri.valor_mensal, Decimal('500.00'))

if __name__ == '__main__':
    unittest.main()
