with open('c:\\cerberus\\apps\\web\\src\\modules\\opportunity_kits\\OpportunityKitForm.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

s3 = code.find('{showBlock3 && (')
s31 = code.find('{showBlock31 && (')

if s3 > -1 and s31 > -1 and s3 < s31:
    pre = code[:s3]
    b3 = code[s3:s31]
    post = code[s31:]
    
    endS31 = post.find('</section>\n           )}') + len('</section>\n           )}')
    b31 = post[:endS31]
    postS31 = post[endS31:]
    
    b3 = b3.replace('5. Custos Operacionais', '6. Custos Operacionais')
    b31 = b31.replace('6. Custos de Instalação', '5. Custos de Instalação')
    
    code = pre + b31 + '\n\n           ' + b3 + postS31

code = code.replace(
    '<td className="px-1.5 py-3 text-center tabular-nums">{c.quantidade}</td>',
    '<td className="px-1.5 py-3 text-center tabular-nums">\n                                    <Input\n                                      type="number"\n                                      min="1"\n                                      step="1"\n                                      className="w-16 text-right h-8 mx-auto"\n                                      value={c.quantidade || 1}\n                                      onChange={(e) => updateCostQuantity(c, Number(e.target.value))}\n                                    />\n                                  </td>'
)

code = code.replace(
    '<td className="px-4 py-3 text-right tabular-nums">{c.quantidade}</td>',
    '<td className="px-2 py-3 text-right tabular-nums">\n                                  <Input\n                                    type="number"\n                                    min="1"\n                                    step="1"\n                                    className="w-16 text-right h-8 ml-auto"\n                                    value={c.quantidade || 1}\n                                    onChange={(e) => updateCostQuantity(c, Number(e.target.value))}\n                                  />\n                                </td>'
)

if 'updateCostQuantity' not in code:
    code = code.replace(
        'const removeCostByProps = (cToRemove: any) => {',
        'const updateCostQuantity = (cost: any, newQty: number) => {\n    setForm(prev => {\n      const idx = prev.costs.findIndex(c => c.product_id === cost.product_id && c.tipo_custo === cost.tipo_custo);\n      if (idx > -1) {\n        const newCosts = [...prev.costs];\n        newCosts[idx] = { ...newCosts[idx], quantidade: newQty };\n        return { ...prev, costs: newCosts };\n      }\n      return prev;\n    });\n  };\n\n  const removeCostByProps = (cToRemove: any) => {'
    )

with open('c:\\cerberus\\apps\\web\\src\\modules\\opportunity_kits\\OpportunityKitForm.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS")
