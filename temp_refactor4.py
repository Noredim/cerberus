with open('c:\\cerberus\\apps\\web\\src\\modules\\opportunity_kits\\OpportunityKitForm.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

s3 = code.find('{showBlock3 && (')
# Find the end of section tag safely by searching for another block section or end
end3 = code.find('</section>', s3)

if s3 > -1 and end3 > -1:
    pre = code[:s3]
    b3 = code[s3:end3+10] # include </section>
    post = code[end3+10:]
    
    # 1. Replace Header
    b3 = b3.replace('<th className="px-4 py-3 text-right">Frete</th>', '<th className="px-4 py-3 text-right">V. Mensal</th>')
    
    # 2. Replace Body Venda unit
    b3 = b3.replace(
        '<td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.frete_venda_item || 0)}</td>',
        '<td className="px-1.5 py-3 text-right tabular-nums text-brand-primary font-medium">{fmtC((summary?.venda_unitario_item || vendaUnit) * c.quantidade)}</td>'
    )
    
    # 3. Replace Footer total
    old_foot = '<td className="px-4 py-3 text-right tabular-nums">{fmtC(manuts.reduce((a: any, b: any) => a + (b.frete_venda_item || 0), 0) || 0)}</td>'
    
    new_foot = '''<td className="px-4 py-3 text-right tabular-nums text-brand-primary font-bold">{fmtC(opCosts.reduce((acc, cost) => {
                                 const cs = financials?.cost_summaries?.find((x: any) => x.product_id === cost.product_id && x.tipo_custo === cost.tipo_custo);
                                 const vUnit = form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? cost.valor_unitario * (form.fator_margem_manutencao || 1) : cost.valor_unitario;
                                 return acc + ((cs?.venda_unitario_item || vUnit) * cost.quantidade);
                               }, 0))}</td>'''
    
    b3 = b3.replace(old_foot, new_foot)
    
    code = pre + b3 + post

with open('c:\\cerberus\\apps\\web\\src\\modules\\opportunity_kits\\OpportunityKitForm.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS")
