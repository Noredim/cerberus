import re

with open('c:\\cerberus\\apps\\web\\src\\modules\\opportunity_kits\\OpportunityKitForm.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

s3 = code.find('{showBlock3 && (')
end3 = code.find('{showBlock31 && (')

if s3 > -1 and end3 > -1:
    pre = code[:s3]
    b3 = code[s3:end3]
    post = code[end3:]
    
    # 1. Replace Table Header in b3
    b3 = b3.replace('<th className="px-4 py-3 text-right">Frete</th>', '<th className="px-4 py-3 text-right">V. Mensal</th>')
    
    # 2. Replace the Data Column in b3 (<tbody>)
    # The Frete column is line 1122: <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.frete_venda_item || 0)}</td>
    b3 = b3.replace(
        '<td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.frete_venda_item || 0)}</td>',
        '<td className="px-1.5 py-3 text-right tabular-nums text-brand-primary">{fmtC((summary?.venda_unitario_item || vendaUnit) * c.quantidade)}</td>'
    )
    
    # 3. Handle the Footer
    # First, calculate total_venda_mensal before the table return.
    # Where does the render happen? Above the <tfoot ...> we have some logic.
    # We can just inline the calculate total in the tfoot or before the map.
    
    # Search for the exact footer line in b3:
    footer_frete = '<td className="px-4 py-3 text-right tabular-nums">{fmtC(manuts.reduce((a: any, b: any) => a + (b.frete_venda_item || 0), 0) || 0)}</td>'
    
    inline_calc = '''<td className="px-4 py-3 text-right tabular-nums text-brand-primary font-bold">{fmtC(opCosts.reduce((acc, cost) => {
                                 const cs = financials?.cost_summaries?.find((x: any) => x.product_id === cost.product_id && x.tipo_custo === cost.tipo_custo);
                                 const vUnit = form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? cost.valor_unitario * (form.fator_margem_manutencao || 1) : cost.valor_unitario;
                                 return acc + ((cs?.venda_unitario_item || vUnit) * cost.quantidade);
                               }, 0))}</td>'''
    
    b3 = b3.replace(footer_frete, inline_calc)
    
    code = pre + b3 + post

with open('c:\\cerberus\\apps\\web\\src\\modules\\opportunity_kits\\OpportunityKitForm.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS")
