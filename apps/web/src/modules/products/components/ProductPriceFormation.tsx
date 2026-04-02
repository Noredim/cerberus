import React, { useState, useEffect } from "react";
import { Calculator, Info, TrendingUp, Lock } from "lucide-react";

interface BudgetItem {
  id: string;
  quantidade: number;
  unidade?: string;
  valor_unitario: number;
  ipi_percentual: number;
  icms_percentual: number;
  created_at: string;
  budget?: {
    data_cotacao?: string;
    numero_orcamento?: string;
    tipo_orcamento?: string;
    moeda?: string;
    nome_fornecedor_manual?: string;
    supplier?: {
      nome_fantasia?: string;
      razao_social?: string;
      uf?: string;
    };
  };
  uf_origem?: string;
}

interface PriceFormationProps {
  basePrice: number;
  stFlag: boolean;
  bitFlag: boolean;
  importadoFlag: boolean;
  mvaFromProduct?: number;
  productType?: string; // New: 'EQUIPAMENTO', 'SERVICO', 'LICENCA'
  budgets?: BudgetItem[];
}

// Business Rule: ICMS cap at 7%
// 4% → 4%, 7% → 7%, >= 12% → 7%
function applyIcmsCap(icmsRaw: number): number {
  if (icmsRaw <= 4) return icmsRaw;
  if (icmsRaw <= 7) return 7;
  return 7; // 12% or higher → capped at 7%
}

export const ProductPriceFormation: React.FC<PriceFormationProps> = ({
  basePrice,
  stFlag,
  bitFlag,
  importadoFlag,
  mvaFromProduct = 0,
  productType = 'EQUIPAMENTO',
  budgets = [],
}) => {
  // Sort budgets descending by date
  const sortedBudgets = [...budgets].sort((a, b) => {
    const dateA = a.budget?.data_cotacao || a.created_at;
    const dateB = b.budget?.data_cotacao || b.created_at;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const lastBudget = sortedBudgets[0] ?? null;

  // Derive initial values from last budget (Business Rule #2)
  const initialValorUnitario = lastBudget
    ? Number(lastBudget.valor_unitario)
    : basePrice || 0;
  const initialIpi = lastBudget ? Number(lastBudget.ipi_percentual) : 0;
  const icmsFromBudget = lastBudget
    ? Number(lastBudget.icms_percentual)
    : importadoFlag
      ? 4
      : 12;
  const initialUfOrigem =
    (lastBudget as any)?.uf_origem || lastBudget?.budget?.supplier?.uf || "SP";
  const icmsEntradaEffective = applyIcmsCap(icmsFromBudget); // Business Rule #3

  const [valorUnitario, setValorUnitario] =
    useState<number>(initialValorUnitario);
  const [quantidade, setQuantidade] = useState<number>(1);
  const [ipiPercent, setIpiPercent] = useState<number>(initialIpi);

  // Frete
  const [modalidadeFrete, setModalidadeFrete] = useState<"CIF" | "FOB">("CIF");
  const [fretePercentFOB, setFretePercentFOB] = useState<number>(0);

  // MVA from product (Business Rule #4) — read-only
  const mvaPercent = mvaFromProduct;

  // Calculated
  const [valorIpiUnit, setValorIpiUnit] = useState(0);
  const [valorFreteUnit, setValorFreteUnit] = useState(0);
  const [icmsStFinal, setIcmsStFinal] = useState(0);
  const [creditoOutorgado, setCreditoOutorgado] = useState(0);
  const [custoUnitFinal, setCustoUnitFinal] = useState(0);
  const [totalItem, setTotalItem] = useState(0);

  // DIFAL Fields
  const [tipoOrcamento, setTipoOrcamento] = useState<
    "REVENDA" | "ATIVO_IMOBILIZADO_USO_CONSUMO"
  >("REVENDA");
  const [ufOrigem, setUfOrigem] = useState<string>(initialUfOrigem);
  const [ufDestino, setUfDestino] = useState<string>("MT");
  const [aliquotaOrcamento, setAliquotaOrcamento] = useState<number>(icmsFromBudget);
  const [aliquotaInternaDestino, setAliquotaInternaDestino] =
    useState<number>(17);

  // DIFAL Calculated
  const [valorDifal, setValorDifal] = useState(0);
  const [isInterstate, setIsInterstate] = useState(true);

  useEffect(() => {
    setValorUnitario(initialValorUnitario);
    setIpiPercent(initialIpi);
    setUfOrigem(initialUfOrigem);
    setAliquotaOrcamento(icmsFromBudget);
  }, [initialValorUnitario, initialIpi, initialUfOrigem, icmsFromBudget]);

  useEffect(() => {
    const ipiUnit = valorUnitario * (ipiPercent / 100);
    setValorIpiUnit(ipiUnit);

    let freteUnit = 0;
    if (modalidadeFrete === "FOB") {
      freteUnit = valorUnitario * (fretePercentFOB / 100);
    } else if (fretePercentFOB !== 0) {
      setFretePercentFOB(0);
    }
    setValorFreteUnit(freteUnit);

    let calcIcmsStFinal = 0;
    let calcCreditoOutorgado = 0;

    // ST only applies for interstate operations (different UF origin vs destination)
    const _isInterstate = ufOrigem.toUpperCase() !== ufDestino.toUpperCase();
    setIsInterstate(_isInterstate);

    if (stFlag && _isInterstate && ufDestino === "MT" && productType === 'EQUIPAMENTO') {
      // P = valorUnitario, IPI = ipiUnit
      // CRED = ICMS entrada cap (4% importado, 7% nacional — já calculado em icmsEntradaEffective)
      const ALIQUOTA_INTERNA = 0.17;
      const FATOR_BIT = 0.4117;
      const DESCONTO_CREDITO_OUTORGADO = 0.12;
      const CRED = icmsEntradaEffective / 100; // already capped by applyIcmsCap

      const baseComMVA = (valorUnitario + ipiUnit) * (1 + mvaPercent / 100);

      if (bitFlag) {
        // (a/b) BIT = SIM, ST = SIM (importado não altera a fórmula, apenas o CRED)
        // ICMS_ST = (baseComMVA * FATOR_BIT * ALIQUOTA_INTERNA) - (P * FATOR_BIT * CRED)
        const icmsStSaida = baseComMVA * FATOR_BIT * ALIQUOTA_INTERNA;
        const icmsCredito = valorUnitario * FATOR_BIT * CRED;
        calcIcmsStFinal = Math.max(0, icmsStSaida - icmsCredito);
      } else {
        // (c/d) BIT = NÃO, ST = SIM
        // ICMS_ST_BRUTO = baseComMVA * ALIQUOTA_INTERNA - P * CRED
        const icmsStBruto =
          baseComMVA * ALIQUOTA_INTERNA - valorUnitario * CRED;
        const icmsStProtegido = Math.max(0, icmsStBruto);
        // Aplicar crédito outorgado 12%
        calcCreditoOutorgado = icmsStProtegido * DESCONTO_CREDITO_OUTORGADO;
        calcIcmsStFinal = Math.max(
          0,
          icmsStProtegido * (1 - DESCONTO_CREDITO_OUTORGADO),
        );
      }
    }

    setIcmsStFinal(calcIcmsStFinal);
    setCreditoOutorgado(calcCreditoOutorgado);

    // --- DIFAL Logic ---
    let opInterestadual = false;
    let c_icmsOrigem = 0;
    let c_baseCalculoDifal = 0;
    let c_icmsDestino = 0;
    let c_valorDifalBase = 0;
    let c_valorDifal = 0;

    if (ufOrigem && ufDestino) {
      opInterestadual = ufOrigem !== ufDestino;

      // 3.1 Base de Cálculo Inicial do DIFAL (Produto + IPI + Frete)
      const baseComIpiEFrete = valorUnitario + ipiUnit + freteUnit;

      // 3.2 ICMS de origem
      c_icmsOrigem = baseComIpiEFrete * (aliquotaOrcamento / 100);

      // 3.3 DIFAL base
      const aliqInternaDecimal = aliquotaInternaDestino / 100;
      const baseSemIcms = baseComIpiEFrete - c_icmsOrigem;
      const divisor = 1 - aliqInternaDecimal;

      if (divisor > 0) {
        c_baseCalculoDifal = baseSemIcms / divisor;
        c_icmsDestino = c_baseCalculoDifal * aliqInternaDecimal;
        c_valorDifalBase = c_icmsDestino - c_icmsOrigem;
      }

      if (!opInterestadual) {
        c_valorDifalBase = 0;
      }

      if (tipoOrcamento === "ATIVO_IMOBILIZADO_USO_CONSUMO") {
        c_valorDifal = Math.max(0, c_valorDifalBase);
      } else if (tipoOrcamento === "REVENDA") {
        const diffDifalSt = c_valorDifalBase - calcIcmsStFinal;

        if (diffDifalSt > 0) {
          c_valorDifal = calcIcmsStFinal + diffDifalSt;
        } else {
          c_valorDifal = Math.max(0, c_valorDifalBase);
        }
      }
    }

    // --- Business Rule: Only apply DIFAL corrections for Products (EQUIPAMENTO) ---
    if (productType !== 'EQUIPAMENTO') {
      c_valorDifal = 0;
    }

    setValorDifal(c_valorDifal);

    const custoF = valorUnitario + ipiUnit + freteUnit + calcIcmsStFinal;

    // 5. Custo com DIFAL
    // O custo padrão COM DIFAL é: valorProduto + valorIPI + valorFrete + valorDifal
    if (tipoOrcamento === "ATIVO_IMOBILIZADO_USO_CONSUMO") {
      setCustoUnitFinal(valorUnitario + ipiUnit + freteUnit + c_valorDifal);
      setTotalItem(
        (valorUnitario + ipiUnit + freteUnit + c_valorDifal) * quantidade,
      );
    } else {
      // REVENDA (Mantém padrão)
      setCustoUnitFinal(custoF);
      setTotalItem(custoF * quantidade);
    }
  }, [
    valorUnitario,
    quantidade,
    ipiPercent,
    modalidadeFrete,
    fretePercentFOB,
    icmsEntradaEffective,
    importadoFlag,
    ufDestino,
    stFlag,
    bitFlag,
    tipoOrcamento,
    ufOrigem,
    aliquotaOrcamento,
    aliquotaInternaDestino,
    productType,
  ]);

  const fmt = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);

  const inputCls =
    "w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 outline-none focus:border-brand-primary text-sm";
  const readOnlyCls =
    "w-full bg-bg-deep/50 border border-border-subtle rounded-md px-3 py-2 text-sm text-text-muted cursor-not-allowed";

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex items-start justify-between bg-surface p-6 rounded-xl border border-border-subtle shadow-sm">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-text-primary">
            <Calculator className="w-6 h-6 text-brand-primary" />
            Formação de Preço de Custo
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Custo calculado com base no último orçamento lançado. Regras fiscais
            MT.
          </p>
        </div>
        <div className="flex gap-4 flex-wrap justify-end">
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${stFlag ? "bg-brand-primary/10 text-brand-primary border-brand-primary/20" : "bg-bg-deep text-text-muted border-border-subtle"}`}
          >
            {stFlag ? "Produto ST Ativo" : "Produto Sem ST"}
          </div>
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${bitFlag ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-bg-deep text-text-muted border-border-subtle"}`}
          >
            {bitFlag ? "Benefício BIT Ativo" : "Sem Benefício BIT"}
          </div>
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${importadoFlag ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-bg-deep text-text-muted border-border-subtle"}`}
          >
            {importadoFlag ? "Origem Importada" : "Origem Nacional"}
          </div>
        </div>
      </div>

      {/* Last budget banner */}
      {lastBudget && (
        <div className="flex items-center gap-3 px-5 py-3 bg-brand-primary/5 border border-brand-primary/20 rounded-xl text-sm text-brand-primary">
          <TrendingUp className="w-4 h-4 shrink-0" />
          <span>
            <strong>Base automática:</strong> último orçamento de{" "}
            <strong>
              {lastBudget.budget?.supplier?.nome_fantasia ||
                lastBudget.budget?.supplier?.razao_social ||
                lastBudget.budget?.nome_fornecedor_manual ||
                "Fornecedor"}
            </strong>{" "}
            — Vlr. Unit.{" "}
            <strong>{fmt(Number(lastBudget.valor_unitario))}</strong> · IPI{" "}
            <strong>{lastBudget.ipi_percentual}%</strong> · ICMS cotação{" "}
            <strong>{lastBudget.icms_percentual}%</strong> → ICMS fiscal
            aplicado: <strong>{icmsEntradaEffective}%</strong>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entradas */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dados Base */}
          <div className="bg-surface border border-border-subtle rounded-xl p-6">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 border-b border-border-subtle pb-2">
              Valores Base
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">
                  Valor Unitário (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorUnitario}
                  onChange={(e) => setValorUnitario(Number(e.target.value))}
                  className={inputCls}
                />
                {lastBudget && (
                  <p className="text-[10px] text-brand-primary">
                    ← Do último orçamento
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">
                  Quantidade
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Variáveis Fiscais */}
          <div className="bg-surface border border-border-subtle rounded-xl p-6">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 border-b border-border-subtle pb-2">
              Variáveis Fiscais e Logísticas
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">
                  IPI (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ipiPercent}
                  onChange={(e) => setIpiPercent(Number(e.target.value))}
                  className={inputCls}
                />
                {lastBudget && (
                  <p className="text-[10px] text-brand-primary">
                    ← Do orçamento
                  </p>
                )}
              </div>

              {/* ICMS — Read-Only (capped by business rule) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted flex items-center gap-1">
                  ICMS Entrada (%)
                  <Lock className="w-3 h-3 text-text-muted" />
                </label>
                <div className={readOnlyCls}>{icmsEntradaEffective}%</div>
                <p className="text-[10px] text-text-muted">
                  Cotação: {icmsFromBudget}% →{" "}
                  {icmsFromBudget > 7
                    ? "limitado a 7% (regra MT)"
                    : `${icmsEntradaEffective}% aplicado`}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">
                  Modalidade Frete
                </label>
                <select
                  value={modalidadeFrete}
                  onChange={(e) =>
                    setModalidadeFrete(e.target.value as "CIF" | "FOB")
                  }
                  className={inputCls}
                >
                  <option value="CIF">CIF (Incluso)</option>
                  <option value="FOB">FOB (A Pagar)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">
                  Frete FOB (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fretePercentFOB}
                  onChange={(e) => setFretePercentFOB(Number(e.target.value))}
                  disabled={modalidadeFrete === "CIF"}
                  className={`${inputCls} disabled:opacity-50`}
                />
              </div>

              {/* MVA — Read-Only from product cadastro (Business Rule #4) */}
              {stFlag && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted flex items-center gap-1">
                    MVA — Substituição (%)
                    <Lock className="w-3 h-3 text-text-muted" />
                  </label>
                  <div className={readOnlyCls}>{mvaPercent.toFixed(2)}%</div>
                  <p className="text-[10px] text-brand-primary">
                    ← Do cadastro do produto
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* DIFAL Inputs */}
          <div className="bg-surface border border-border-subtle rounded-xl p-6">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 border-b border-border-subtle pb-2">
              Diferencial de Alíquota (DIFAL)
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-xs font-bold text-text-muted">
                  Tipo de Orçamento
                </label>
                <select
                  value={tipoOrcamento}
                  onChange={(e) =>
                    setTipoOrcamento(
                      e.target.value as
                        | "REVENDA"
                        | "ATIVO_IMOBILIZADO_USO_CONSUMO",
                    )
                  }
                  className={inputCls}
                >
                  <option value="REVENDA">Revenda (Mercadoria)</option>
                  <option value="ATIVO_IMOBILIZADO_USO_CONSUMO">
                    Ativo Imobilizado (Uso/Consumo)
                  </option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">
                  UF Origem (Fornecedor)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={ufOrigem}
                  onChange={(e) => setUfOrigem(e.target.value.toUpperCase())}
                  className={inputCls}
                  placeholder="UF"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">
                  UF Destino (Empresa)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={ufDestino}
                  onChange={(e) => setUfDestino(e.target.value.toUpperCase())}
                  className={inputCls}
                  placeholder="UF"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">
                  Alíquota Interestadual (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={aliquotaOrcamento}
                  onChange={(e) => setAliquotaOrcamento(Number(e.target.value))}
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">
                  Alíquota Interna Destino (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={aliquotaInternaDestino}
                  onChange={(e) =>
                    setAliquotaInternaDestino(Number(e.target.value))
                  }
                  className={inputCls}
                />
              </div>
            </div>

            {/* Removido o quadro de 'Resumo do Cálculo DIFAL' a pedido do usuário, agora incorporado no quadro comparativo abaixo */}
          </div>
        </div>


        {/* Composição do Custo */}
        <div className="space-y-4">
          <div className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-5">
              <Info className="w-4 h-4 text-brand-primary" />
              Formação de custo REVENDA
            </h3>

            {/* Unit breakdown */}
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-2">
              Por Unidade
            </p>
            <div className="space-y-2 font-mono text-sm mb-4">
              <div className="flex justify-between text-text-muted">
                <span>Base (Unit.):</span>
                <span>{fmt(valorUnitario)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>IPI ({ipiPercent}%):</span>
                <span className="text-orange-500">+ {fmt(valorIpiUnit)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Frete {modalidadeFrete}:</span>
                <span className="text-orange-500">+ {fmt(valorFreteUnit)}</span>
              </div>

              {stFlag && isInterstate && (
                <>
                  <div className="flex justify-between text-amber-600 pt-2 border-t border-border-subtle/50">
                    <span
                      title={
                        bitFlag
                          ? "ST Redução BIT 41.17%"
                          : "ST antes do Crédito Outorgado"
                      }
                    >
                      ICMS-ST ({bitFlag ? "BIT" : "Normal"}) unit.:
                    </span>
                    <span>
                      + {fmt(icmsStFinal + (bitFlag ? 0 : creditoOutorgado))}
                    </span>
                  </div>
                  {!bitFlag && (
                    <div className="flex justify-between text-green-600">
                      <span title="Crédito Outorgado MT — 12% sobre ST">
                        Créd. Outorgado (12%):
                      </span>
                      <span>- {fmt(creditoOutorgado)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>ICMS-ST Final unit.:</span>
                    <span className="text-amber-600">+ {fmt(icmsStFinal)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-text-primary pt-2 border-t border-border-subtle">
                <span>Custo Unit. Final:</span>
                <span className="text-brand-primary">
                  {fmt(custoUnitFinal)}
                </span>
              </div>
            </div>

            {/* Totals block */}
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-2 mt-4 pt-4 border-t border-border-subtle">
              Totais (× {quantidade} un.)
            </p>
            <div className="space-y-2 font-mono text-sm">
              {/* Total Cotação = qty × valor_unitario */}
              <div className="flex justify-between text-text-muted">
                <span>Total Cotação:</span>
                <span className="font-semibold text-text-primary">
                  {fmt(valorUnitario * quantidade)}
                </span>
              </div>
              {/* Total Impostos = (IPI + Frete + ST) × qty */}
              <div className="flex justify-between text-orange-500">
                <span>Total Impostos:</span>
                <span className="font-semibold">
                  +{" "}
                  {fmt(
                    (valorIpiUnit + valorFreteUnit + icmsStFinal) * quantidade,
                  )}
                </span>
              </div>
              {ipiPercent > 0 && (
                <div className="flex justify-between text-orange-600 text-xs pl-2">
                  <span>↳ Total IPI:</span>
                  <span>+ {fmt(valorIpiUnit * quantidade)}</span>
                </div>
              )}
              {(modalidadeFrete === "FOB" || valorFreteUnit > 0) && (
                <div className="flex justify-between text-orange-600 text-xs pl-2">
                  <span>↳ Total Frete:</span>
                  <span>+ {fmt(valorFreteUnit * quantidade)}</span>
                </div>
              )}
              {stFlag && isInterstate && (
                <div className="flex justify-between text-amber-600 text-xs pl-2">
                  <span>↳ ICMS-ST total:</span>
                  <span>+ {fmt(icmsStFinal * quantidade)}</span>
                </div>
              )}
              {tipoOrcamento === "ATIVO_IMOBILIZADO_USO_CONSUMO" &&
                valorDifal > 0 && (
                  <div className="flex justify-between text-amber-600 text-xs pl-2">
                    <span>↳ DIFAL total:</span>
                    <span>+ {fmt(valorDifal * quantidade)}</span>
                  </div>
                )}
              {/* Total Geral */}
              <div className="flex justify-between text-lg font-black text-text-primary mt-3 py-3 px-3 bg-gradient-to-r from-brand-primary/10 to-bg-deep rounded-lg border border-brand-primary/20">
                <span>Total Geral:</span>
                <span className="text-brand-primary">{fmt(totalItem)}</span>
              </div>
            </div>

            {importadoFlag && (
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 text-blue-700 text-xs rounded-lg flex gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>ICMS de entrada 4% — produto importado.</span>
              </div>
            )}
          </div>

          {/* Novo Painel para Cenário DIFAL */}
          {tipoOrcamento === "REVENDA" && (
              <div className="bg-surface border border-brand-primary/30 rounded-xl p-6 shadow-sm mt-6">
                <h3 className="text-sm font-bold text-brand-primary flex items-center gap-2 mb-5">
                  <Calculator className="w-4 h-4 text-brand-primary" />
                  Formação de custo COMODATO/LOCAÇÃO
                </h3>

                <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-2">
                  Por Unidade
                </p>
                <div className="space-y-2 font-mono text-sm mb-4">
                  <div className="flex justify-between text-text-muted">
                    <span>Base (Unit.):</span>
                    <span>{fmt(valorUnitario)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>IPI ({ipiPercent}%):</span>
                    <span className="text-orange-500">
                      + {fmt(valorIpiUnit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Frete {modalidadeFrete}:</span>
                    <span className="text-orange-500">
                      + {fmt(valorFreteUnit)}
                    </span>
                  </div>
                  <div className="my-2 border-t border-dashed border-border-subtle/50"></div>
                  <div className="flex justify-between text-amber-700 font-semibold mb-2">
                    <span>DIFAL Unit:</span>
                    <span className="text-amber-600">+ {fmt(valorDifal)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-text-primary pt-2 border-t border-border-subtle">
                    <span>Custo Unit. Final:</span>
                    <span className="text-brand-primary">
                      {fmt(
                        valorUnitario +
                          valorIpiUnit +
                          valorFreteUnit +
                          valorDifal,
                      )}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-2 mt-4 pt-4 border-t border-border-subtle">
                  Totais (× {quantidade} un.)
                </p>
                <div className="space-y-2 font-mono text-sm">
                  <div className="flex justify-between text-text-muted">
                    <span>Total da Cotação:</span>
                    <span className="font-semibold text-text-primary">
                      {fmt(valorUnitario * quantidade)}
                    </span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Frete {modalidadeFrete}:</span>
                    <span className="font-semibold">
                      + {fmt(valorFreteUnit * quantidade)}
                    </span>
                  </div>
                  <div className="text-orange-500 mt-2">
                    <div className="flex justify-between mb-1 font-semibold">
                      <span>Total Impostos:</span>
                    </div>
                    {ipiPercent > 0 && (
                      <div className="flex justify-between text-xs pl-2 mb-1">
                        <span>— Total IPI:</span>
                        <span className="font-semibold">
                          + {fmt(valorIpiUnit * quantidade)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs pl-2">
                      <span>— DIFAL:</span>
                      <span className="font-semibold">
                        + {fmt(valorDifal * quantidade)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-lg font-black text-brand-primary mt-3 py-3 px-3 bg-brand-primary/5 rounded-lg border border-brand-primary/30">
                    <span>Total Geral:</span>
                    <span>
                      {fmt(
                        (valorUnitario +
                          valorIpiUnit +
                          valorFreteUnit +
                          valorDifal) *
                          quantidade,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Budget History Grid */}
      {sortedBudgets.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border-subtle flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-primary" />
            <h3 className="text-sm font-bold text-text-primary">
              Histórico de Cotações — Base de Custo
            </h3>
            <span className="ml-auto text-xs text-text-muted">
              {sortedBudgets.length} registro(s) · ordem decrescente
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-deep border-b border-border-subtle text-xs uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">Data Cotação</th>
                  <th className="px-4 py-3 font-bold">Nº Cotação</th>
                  <th className="px-4 py-3 font-bold">Tipo</th>
                  <th className="px-4 py-3 font-bold">Fornecedor</th>
                  <th className="px-4 py-3 font-bold text-center">Qtd</th>
                  <th className="px-4 py-3 font-bold text-center">UN</th>
                  <th className="px-4 py-3 font-bold text-right">Vlr. Unit.</th>
                  <th className="px-4 py-3 font-bold text-center">IPI %</th>
                  <th className="px-4 py-3 font-bold text-center text-amber-600">
                    ICMS %
                  </th>
                  <th className="px-4 py-3 font-bold text-center">
                    ICMS Fiscal
                  </th>
                  <th className="px-4 py-3 font-bold text-right">Vlr. Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sortedBudgets.map((b, idx) => {
                  const icmsRaw = Number(b.icms_percentual);
                  const icmsFiscal = applyIcmsCap(icmsRaw);
                  const fornecedor =
                    b.budget?.supplier?.nome_fantasia ||
                    b.budget?.supplier?.razao_social ||
                    b.budget?.nome_fornecedor_manual ||
                    "—";
                  const dataCotacao = b.budget?.data_cotacao
                    ? new Date(b.budget.data_cotacao).toLocaleDateString(
                        "pt-BR",
                      )
                    : new Date(b.created_at).toLocaleDateString("pt-BR");
                  const vlrTotal =
                    Number(b.quantidade) * Number(b.valor_unitario);
                  const moeda = b.budget?.moeda || "BRL";
                  const fmtMoeda = (v: number) =>
                    new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: moeda,
                    }).format(v);

                  return (
                    <tr
                      key={b.id}
                      className={`transition-colors ${idx === 0 ? "bg-brand-primary/5 hover:bg-brand-primary/10" : "bg-surface hover:bg-bg-deep/50"}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-text-primary">
                        {dataCotacao}
                        {idx === 0 && (
                          <span className="ml-2 px-1.5 py-0.5 bg-brand-primary text-white text-[9px] font-bold rounded uppercase">
                            Atual
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary max-w-[120px] truncate">
                        {b.budget?.numero_orcamento || "Não inf."}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted">
                        {b.budget?.tipo_orcamento === 'REVENDA' ? 'Revenda' : (b.budget?.tipo_orcamento === 'ATIVO_IMOBILIZADO_USO_CONSUMO' ? 'Uso/Consumo' : 'N/A')}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary max-w-[180px] truncate">
                        {fornecedor}
                      </td>
                      <td className="px-4 py-3 text-center text-text-muted">
                        {Number(b.quantidade).toLocaleString("pt-BR", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-center text-text-muted">
                        {b.unidade || "UN"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-text-primary">
                        {fmtMoeda(Number(b.valor_unitario))}
                      </td>
                      <td className="px-4 py-3 text-center text-text-muted">
                        {b.ipi_percentual}%
                      </td>
                      <td className="px-4 py-3 text-center text-amber-600 font-medium">
                        {icmsRaw}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${icmsRaw !== icmsFiscal ? "bg-amber-100 text-amber-700" : "bg-bg-deep text-text-muted"}`}
                        >
                          {icmsFiscal}%{icmsRaw !== icmsFiscal && " ↓"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-brand-primary">
                        {fmtMoeda(vlrTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
