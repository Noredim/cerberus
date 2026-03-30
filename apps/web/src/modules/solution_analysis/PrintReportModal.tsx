import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalysisItem {
  id: string;
  sequencia: number;
  item_a_nome: string | null;
  qtd_a: number | null;
  vlr_unit_a: number | null;
  vlr_total_a: number | null;
  item_b_nome: string | null;
  qtd_b: number | null;
  vlr_unit_b: number | null;
  vlr_total_b: number | null;
  item_c_nome: string | null;
  qtd_c: number | null;
  vlr_unit_c: number | null;
  vlr_total_c: number | null;
  melhor_solucao: string | null;
  diferenca_valor: number | null;
  diferenca_percentual: number | null;
}

interface Analysis {
  id: string;
  titulo: string;
  tipo_analise: string;
  nome_solucao_a: string | null;
  nome_solucao_b: string | null;
  nome_solucao_c: string | null;
  criado_por_nome: string | null;
  created_at: string;
  updated_at: string;
  items: AnalysisItem[];
}

interface CompanyInfo {
  nome: string;
  logoBase64: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Pass full analysis object (from form) OR just the id (from list — will fetch) */
  analise: Analysis | null;
  analiseId?: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const BRL = (v: number | null | undefined) =>
  v != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
    : '—';

const PCT = (v: number | null | undefined) =>
  v != null ? `${Number(v).toFixed(2)}%` : '—';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse "[SKU-001]Camera Bullet..." → { code, name }.
 *  Gracefully falls back for legacy entries without the [code] prefix. */
function parseItemNome(raw: string | null): { code: string | null; name: string } {
  if (!raw) return { code: null, name: '' };
  const match = raw.match(/^\[([^\]]+)\](.+)$/);
  if (match) return { code: match[1], name: match[2] };
  return { code: null, name: raw };
}

/** Fetch image URL and return its base64 data URI. */
async function toBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Resolve which solutions have at least one item for a given slot. */
function activeSolutions(items: AnalysisItem[]): Set<'A' | 'B' | 'C'> {
  const active = new Set<'A' | 'B' | 'C'>();
  for (const item of items) {
    if (item.item_a_nome) active.add('A');
    if (item.item_b_nome) active.add('B');
    if (item.item_c_nome) active.add('C');
  }
  return active;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReportHeader({
  company,
  analise,
  userName,
  generatedAt,
}: {
  company: CompanyInfo;
  analise: Analysis;
  userName: string;
  generatedAt: string;
}) {
  const tipoLabel: Record<string, string> = {
    REVENDA: 'Revenda',
    LOCACAO: 'Locação / Comodato',
  };

  return (
    <div className="report-header">
      {/* Company branding row */}
      <div className="report-branding">
        {company.logoBase64 ? (
          <img src={company.logoBase64} alt={company.nome} className="report-logo" />
        ) : (
          <div className="report-logo-placeholder">{company.nome.slice(0, 2).toUpperCase()}</div>
        )}
        <div className="report-company-info">
          <div className="report-company-name">{company.nome}</div>
          <div className="report-doc-title">Relatório de Análise de Produto / Solução</div>
        </div>
      </div>

      {/* Metadata row */}
      <div className="report-meta-row">
        <div className="report-meta-item">
          <span className="report-meta-label">Análise</span>
          <span className="report-meta-value">{analise.titulo}</span>
        </div>
        <div className="report-meta-item">
          <span className="report-meta-label">Tipo</span>
          <span className="report-meta-value">{tipoLabel[analise.tipo_analise] ?? analise.tipo_analise}</span>
        </div>
        <div className="report-meta-item">
          <span className="report-meta-label">Emitido em</span>
          <span className="report-meta-value">{generatedAt}</span>
        </div>
        <div className="report-meta-item">
          <span className="report-meta-label">Emitido por</span>
          <span className="report-meta-value">{userName}</span>
        </div>
      </div>
    </div>
  );
}

function AnalysisHeader({
  active,
  nomes,
}: {
  analise: Analysis;
  active: Set<'A' | 'B' | 'C'>;
  nomes: Record<string, string>;
}) {
  const slots = (['A', 'B', 'C'] as const).filter((s) => active.has(s));
  if (slots.length === 0) return null;

  return (
    <div className="report-section">
      <div className="report-section-title">Soluções Comparadas</div>
      <div className="report-solutions-row">
        {slots.map((s) => (
          <div key={s} className="report-solution-badge">
            <span className="report-solution-letter">
              Solução {s}
            </span>
            <span className="report-solution-name">{nomes[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparativeGrid({
  analise,
  active,
  nomes,
}: {
  analise: Analysis;
  active: Set<'A' | 'B' | 'C'>;
  nomes: Record<string, string>;
}) {
  const slots = (['A', 'B', 'C'] as const).filter((s) => active.has(s));

  // Totals per active solution
  const totals: Record<string, number> = {
    A: analise.items.reduce((s, i) => s + (Number(i.vlr_total_a) || 0), 0),
    B: analise.items.reduce((s, i) => s + (Number(i.vlr_total_b) || 0), 0),
    C: analise.items.reduce((s, i) => s + (Number(i.vlr_total_c) || 0), 0),
  };

  type SlotKey = 'A' | 'B' | 'C';
  const getValue = <T,>(item: AnalysisItem, slot: SlotKey, field: 'nome' | 'qtd' | 'vlr_unit' | 'vlr_total'): T => {
    const map: Record<SlotKey, Record<string, keyof AnalysisItem>> = {
      A: { nome: 'item_a_nome', qtd: 'qtd_a', vlr_unit: 'vlr_unit_a', vlr_total: 'vlr_total_a' },
      B: { nome: 'item_b_nome', qtd: 'qtd_b', vlr_unit: 'vlr_unit_b', vlr_total: 'vlr_total_b' },
      C: { nome: 'item_c_nome', qtd: 'qtd_c', vlr_unit: 'vlr_unit_c', vlr_total: 'vlr_total_c' },
    };
    return item[map[slot][field]] as T;
  };

  return (
    <div className="report-section">
      <div className="report-section-title">Grid Comparativa</div>
      <table className="report-table">
        <thead>
          <tr>
            {slots.map((s) => (
              <th key={s} colSpan={4} className="report-th report-th-solution">
                {nomes[s]}
              </th>
            ))}
            <th colSpan={3} className="report-th report-th-result">
              Resultado
            </th>
          </tr>
          <tr>
            {slots.map((s) => (
              <>
                <th key={`${s}-item`} className="report-th report-th-sub report-th-left">Item</th>
                <th key={`${s}-qtd`} className="report-th report-th-sub report-th-center">Qtd</th>
                <th key={`${s}-unit`} className="report-th report-th-sub report-th-right">Vlr Unit</th>
                <th key={`${s}-total`} className="report-th report-th-sub report-th-right">Vlr Total</th>
              </>
            ))}
            <th className="report-th report-th-sub report-th-center">Melhor</th>
            <th className="report-th report-th-sub report-th-right">Diferença R$</th>
            <th className="report-th report-th-sub report-th-right">Diferença %</th>
          </tr>
        </thead>
        <tbody>
          {analise.items.map((item) => {
            const isTie = item.melhor_solucao === 'EMPATE';
            const bestLabel =
              item.melhor_solucao === 'EMPATE'
                ? 'Empate'
                : item.melhor_solucao
                ? nomes[item.melhor_solucao] || `Sol. ${item.melhor_solucao}`
                : '—';
            return (
              <tr key={item.id} className="report-tr">
                {slots.map((s) => {
                  const nome = getValue<string | null>(item, s, 'nome');
                  const qtd = getValue<number | null>(item, s, 'qtd');
                  const vlrUnit = getValue<number | null>(item, s, 'vlr_unit');
                  const vlrTotal = getValue<number | null>(item, s, 'vlr_total');
                  const isBest = item.melhor_solucao === s;
                  const cellCls = isBest
                    ? 'report-td report-td-best'
                    : isTie && nome
                    ? 'report-td report-td-tie'
                    : 'report-td';
                  return nome ? (
                    <>
                      <td key={`${s}-nome`} className={`${cellCls} report-td-left`}>
                        {(() => {
                          const { code, name } = parseItemNome(nome);
                          return (
                            <>
                              {code && (
                                <span className="report-item-code">{code}</span>
                              )}
                              <span>{name}</span>
                            </>
                          );
                        })()}
                      </td>
                      <td key={`${s}-qtd`} className={`${cellCls} report-td-center`}>{qtd}</td>
                      <td key={`${s}-unit`} className={`${cellCls} report-td-right`}>{BRL(vlrUnit)}</td>
                      <td key={`${s}-total`} className={`${cellCls} report-td-right report-td-bold`}>{BRL(vlrTotal)}</td>
                    </>
                  ) : (
                    <td key={`${s}-empty`} colSpan={4} className="report-td report-td-center report-td-muted">—</td>
                  );
                })}
                {/* Resultado */}
                {item.melhor_solucao ? (
                  <>
                    <td className="report-td report-td-center">
                      <span className={isTie ? 'report-badge-tie' : 'report-badge-best'}>
                        {bestLabel}
                      </span>
                    </td>
                    <td className="report-td report-td-right report-td-diff">{BRL(item.diferenca_valor)}</td>
                    <td className="report-td report-td-right report-td-diff">{PCT(item.diferenca_percentual)}</td>
                  </>
                ) : (
                  <td colSpan={3} className="report-td report-td-center report-td-muted">Sem comparação</td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="report-tfoot-row">
            {slots.map((s, idx) => (
              <>
                <td key={`${s}-label`} colSpan={idx === 0 ? 3 : 3} className="report-td report-tfoot-label">
                  {idx === 0 ? 'Total' : ''}
                </td>
                <td key={`${s}-total`} className="report-td report-td-right report-tfoot-total">
                  {BRL(totals[s])}
                </td>
              </>
            ))}
            <td colSpan={3} className="report-td" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function FinalResult({
  analise,
  active,
  nomes,
}: {
  analise: Analysis;
  active: Set<'A' | 'B' | 'C'>;
  nomes: Record<string, string>;
}) {
  const totals: [string, number][] = (['A', 'B', 'C'] as const)
    .filter((s) => active.has(s))
    .map((s): [string, number] => {
      const total = analise.items.reduce((acc, i) => {
        const key = `vlr_total_${s.toLowerCase()}` as keyof AnalysisItem;
        return acc + (Number(i[key]) || 0);
      }, 0);
      return [s, total];
    })
    .filter(([, v]): boolean => (v as number) > 0);

  if (totals.length < 2) return null;

  const min = totals.reduce((a, b) => (b[1] < a[1] ? b : a));

  return (
    <div className="report-section">
      <div className="report-section-title">Resultado Final</div>
      <div className="report-result-cards">
        {totals.map(([sol, total]) => {
          const isBest = sol === min[0];
          return (
            <div key={sol} className={isBest ? 'report-result-card report-result-card-best' : 'report-result-card'}>
              <div className="report-result-card-label">
                {nomes[sol]}
                {isBest && <span className="report-result-best-tag"> — MELHOR</span>}
              </div>
              <div className={`report-result-total ${isBest ? 'report-result-total-best' : ''}`}>
                {BRL(total)}
              </div>
              {isBest &&
                totals
                  .filter(([s]) => s !== sol)
                  .map(([s, t]) => (
                    <div key={s} className="report-result-saving">
                      Economia vs {nomes[s]}: {BRL(t - total)} ({PCT(((t - total) / t) * 100)})
                    </div>
                  ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Print Styles (injected once) ─────────────────────────────────────────────

const PRINT_STYLE_ID = 'cerberus-print-report-styles';

function injectPrintStyles() {
  if (document.getElementById(PRINT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    /* ── Screen preview inside modal ── */
    .print-report-scroll {
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #1a1a2e;
      background: #fff;
      padding: 24px 28px;
      line-height: 1.45;
    }

    /* Header */
    .report-header { margin-bottom: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; }
    .report-branding { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
    .report-logo { height: 52px; max-width: 160px; object-fit: contain; }
    .report-logo-placeholder {
      width: 52px; height: 52px; background: #0f4c75; border-radius: 6px;
      color: #fff; font-size: 18px; font-weight: 800;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .report-company-name { font-size: 15px; font-weight: 800; color: #0f4c75; line-height: 1.2; }
    .report-doc-title { font-size: 11px; color: #64748b; font-weight: 500; margin-top: 2px; }
    .report-meta-row { display: flex; gap: 20px; flex-wrap: wrap; }
    .report-meta-item { display: flex; flex-direction: column; gap: 1px; }
    .report-meta-label { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; font-weight: 600; }
    .report-meta-value { font-size: 11px; font-weight: 600; color: #1e293b; }

    /* Sections */
    .report-section { margin-bottom: 18px; }
    .report-section-title {
      font-size: 9px; text-transform: uppercase; letter-spacing: .08em;
      font-weight: 700; color: #0f4c75;
      border-left: 3px solid #0f4c75; padding-left: 8px;
      margin-bottom: 10px;
    }

    /* Solutions badges */
    .report-solutions-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .report-solution-badge {
      border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 6px 12px;
      display: flex; flex-direction: column; gap: 2px; min-width: 140px;
    }
    .report-solution-letter { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .report-solution-name { font-size: 12px; font-weight: 700; color: #1e293b; }

    /* Table */
    .report-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .report-th {
      background: #f1f5f9; color: #475569;
      padding: 5px 6px; font-weight: 700; font-size: 9px;
      text-transform: uppercase; letter-spacing: .04em;
      border: 1px solid #e2e8f0;
    }
    .report-th-solution { background: #0f4c75; color: #fff; text-align: left; }
    .report-th-result { background: #1e293b; color: #fff; text-align: center; }
    .report-th-sub { background: #f8fafc; }
    .report-th-left { text-align: left; }
    .report-th-center { text-align: center; }
    .report-th-right { text-align: right; }
    .report-td { padding: 4px 6px; border: 1px solid #e2e8f0; vertical-align: top; }
    .report-td-left { text-align: left; min-width: 100px; max-width: 170px; white-space: normal; word-break: break-word; line-height: 1.3; vertical-align: top; }
    .report-td-center { text-align: center; }
    .report-td-right { text-align: right; font-variant-numeric: tabular-nums; }
    .report-td-bold { font-weight: 700; }
    .report-td-muted { color: #94a3b8; font-style: italic; }
    .report-item-code {
      display: inline-block; margin-bottom: 2px;
      padding: 1px 5px; border-radius: 3px;
      font-size: 8px; font-family: 'Courier New', monospace; font-weight: 700;
      background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;
      letter-spacing: .03em; white-space: nowrap;
    }
    .report-td-diff { color: #dc2626; font-weight: 600; }
    .report-td-best { background: #f0fdf4; }
    .report-td-tie { background: #fffbeb; }
    .report-tr:nth-child(even) .report-td { background-color: #fafafa; }
    .report-tr:nth-child(even) .report-td-best { background: #f0fdf4; }
    .report-tr:nth-child(even) .report-td-tie { background: #fffbeb; }
    .report-tfoot-row .report-td { background: #f1f5f9 !important; border-top: 2px solid #cbd5e1; }
    .report-tfoot-label { font-weight: 700; color: #1e293b; font-size: 10px; }
    .report-tfoot-total { font-weight: 800; color: #0f4c75; font-size: 11px; font-variant-numeric: tabular-nums; }
    .report-badge-best {
      background: #dcfce7; color: #166534; padding: 2px 6px;
      border-radius: 999px; font-size: 9px; font-weight: 700; white-space: nowrap;
    }
    .report-badge-tie {
      background: #fef3c7; color: #92400e; padding: 2px 6px;
      border-radius: 999px; font-size: 9px; font-weight: 700;
    }

    /* Result cards */
    .report-result-cards { display: flex; gap: 12px; flex-wrap: wrap; }
    .report-result-card {
      flex: 1; min-width: 120px; border: 1.5px solid #e2e8f0;
      border-radius: 8px; padding: 10px 14px;
    }
    .report-result-card-best { border-color: #86efac; background: #f0fdf4; }
    .report-result-card-label { font-size: 10px; font-weight: 700; color: #475569; margin-bottom: 4px; }
    .report-result-best-tag { color: #16a34a; font-weight: 800; }
    .report-result-total { font-size: 18px; font-weight: 800; color: #1e293b; font-variant-numeric: tabular-nums; }
    .report-result-total-best { color: #15803d; }
    .report-result-saving { font-size: 9px; color: #16a34a; margin-top: 3px; }

    /* Footer */
    .report-footer {
      margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px;
      font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between;
    }

    /* ── @media print ── */
    @media print {
      @page {
        size: A4 landscape;
        margin: 10mm 12mm;
      }

      /* Hide everything except the print report */
      body > * { display: none !important; }
      #cerberus-print-root { display: block !important; }

      #cerberus-print-root {
        position: fixed; inset: 0; z-index: 99999;
        background: #fff; padding: 0; margin: 0;
      }

      /* Landscape: use the full 277mm printable width, keep font compact */
      .print-report-scroll {
        padding: 0;
        font-size: 9px;
      }

      /* Tighter cells so 15 columns fit in 277mm */
      .report-th { padding: 3px 4px; font-size: 8px; }
      .report-td { padding: 3px 4px; font-size: 8.5px; }
      .report-td-left { max-width: 110px; }
      .report-tfoot-total { font-size: 9.5px; }

      /* Compact header */
      .report-logo { height: 40px; }
      .report-logo-placeholder { width: 40px; height: 40px; font-size: 14px; }
      .report-company-name { font-size: 13px; }
      .report-section { margin-bottom: 10px; }

      .report-table { page-break-inside: auto; }
      .report-tr { page-break-inside: avoid; }
      .report-section { page-break-inside: avoid; }

      /* Force background colors */
      .report-td-best { background: #f0fdf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .report-td-tie { background: #fffbeb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .report-tfoot-row .report-td { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .report-th-solution { background: #0f4c75 !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .report-th-result { background: #1e293b !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .report-result-card-best { background: #f0fdf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Print Root Portal ────────────────────────────────────────────────────────

function ensurePrintRoot(): HTMLElement {
  let el = document.getElementById('cerberus-print-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cerberus-print-root';
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function PrintReportModal({ isOpen, onClose, analise: analiseFromProps, analiseId }: Props) {
  const { user, userCompanies, activeCompanyId } = useAuth();
  const [analise, setAnalise] = useState<Analysis | null>(analiseFromProps);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [printing, setPrinting] = useState(false);
  const printContentRef = useRef<HTMLDivElement>(null);
  const generatedAt = useRef(fmtDate(new Date().toISOString()));

  // Inject print styles once
  useEffect(() => {
    injectPrintStyles();
    ensurePrintRoot();
  }, []);

  // Fetch analysis if only id provided (from list)
  useEffect(() => {
    if (!isOpen) return;
    if (analiseFromProps) {
      setAnalise(analiseFromProps);
      return;
    }
    if (!analiseId) return;
    setLoadingData(true);
    api
      .get<Analysis>(`/solution-analysis/${analiseId}`)
      .then(({ data }) => setAnalise(data))
      .catch(() => setAnalise(null))
      .finally(() => setLoadingData(false));
  }, [isOpen, analiseId, analiseFromProps]);

  // Fetch company info + logo → base64
  const loadCompany = useCallback(async () => {
    const activeCompany = userCompanies.find((c) => c.company_id === activeCompanyId);
    if (!activeCompany) return;

    const nome = activeCompany.company_name;
    let logoBase64: string | null = null;

    try {
      const { data } = await api.get(`/companies/${activeCompany.company_id}`);
      if (data.logo_url) {
        const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';
        const logoUrl = data.logo_url.startsWith('http') ? data.logo_url : `${baseUrl}${data.logo_url}`;
        logoBase64 = await toBase64(logoUrl);
      }
    } catch {
      // logo não disponível — usa placeholder
    }

    setCompany({ nome, logoBase64 });
  }, [activeCompanyId, userCompanies]);

  useEffect(() => {
    if (isOpen) {
      generatedAt.current = fmtDate(new Date().toISOString());
      loadCompany();
    }
  }, [isOpen, loadCompany]);

  // ── Print handler ──────────────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    if (!printContentRef.current) return;
    const printRoot = ensurePrintRoot();
    printRoot.style.display = 'block';
    printRoot.innerHTML = printContentRef.current.outerHTML;

    setPrinting(true);
    // Small delay to allow DOM paint before print dialog
    setTimeout(() => {
      window.print();
      printRoot.style.display = 'none';
      printRoot.innerHTML = '';
      setPrinting(false);
    }, 150);
  }, []);

  if (!isOpen) return null;

  // Derived
  const isReady = !!analise && !!company;
  const active = analise ? activeSolutions(analise.items) : new Set<'A' | 'B' | 'C'>();
  const nomes: Record<string, string> = analise
    ? {
        A: analise.nome_solucao_a || 'Solução A',
        B: analise.nome_solucao_b || 'Solução B',
        C: analise.nome_solucao_c || 'Solução C',
      }
    : {};
  const userName = user?.name ?? 'Desconhecido';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm px-2 pt-4 pb-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full border border-slate-200 flex flex-col" style={{ maxWidth: '330mm' }}>
        {/* Modal toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Printer className="w-4 h-4 text-slate-500" />
            Pré-visualização do Relatório
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={!isReady || printing}
              className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              {printing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              {printing ? 'Preparando...' : 'Imprimir / Salvar PDF'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview content */}
        <div className="overflow-auto p-4 bg-slate-100 rounded-b-2xl">
          {loadingData || !isReady ? (
            <div className="flex items-center justify-center py-24 gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Carregando dados do relatório...</span>
            </div>
          ) : (
            /* The A4 landscape white paper */
            <div
              className="bg-white mx-auto shadow-md rounded"
              style={{ maxWidth: '297mm', minHeight: '210mm' }}
            >
              {/* This div is what gets cloned to print root */}
              <div ref={printContentRef} className="print-report-scroll">
                <ReportHeader
                  company={company!}
                  analise={analise!}
                  userName={userName}
                  generatedAt={generatedAt.current}
                />

                <AnalysisHeader analise={analise!} active={active} nomes={nomes} />

                {analise!.items.length > 0 ? (
                  <>
                    <ComparativeGrid analise={analise!} active={active} nomes={nomes} />
                    <FinalResult analise={analise!} active={active} nomes={nomes} />
                  </>
                ) : (
                  <div style={{ padding: '20px 0', color: '#94a3b8', fontStyle: 'italic' }}>
                    Nenhum item lançado na grid comparativa.
                  </div>
                )}

                <div className="report-footer">
                  <span>Cerberus — Sistema Comercial</span>
                  <span>Gerado em {generatedAt.current} por {userName}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
