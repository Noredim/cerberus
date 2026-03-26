with open('c:\\cerberus\\apps\\web\\src\\components\\modals\\AddOperationalCostModal.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace MANUTENCAO logic
code = code.replace("useState('Manut. pred./corretiva')", "useState('MANUTENCAO')")
code = code.replace("setTipoCusto('Manut. pred./corretiva')", "setTipoCusto('MANUTENCAO')")

code = code.replace("{ value: 'Manut. pred./corretiva', label: 'Manut. pred./corretiva' }", "{ value: 'MANUTENCAO', label: 'Manut. pred./corretiva' }")

# Add LICENCA filter
code = code.replace("const res = await api.get('/cadastro/produtos', { params: { q: searchTerm, limit: 20, tipo: 'SERVICO' } });\n          setResults(res.data);", "const res = await api.get('/cadastro/produtos', { params: { q: searchTerm, limit: 50 } });\n          const filtered = res.data.filter((p: any) => p.tipo === 'SERVICO' || p.tipo === 'LICENCA').slice(0, 20);\n          setResults(filtered);")

code = code.replace("Apenas produtos do tipo SERVIÇO são listados.", "Apenas produtos do tipo SERVIÇO e LICENÇA são listados.")

with open('c:\\cerberus\\apps\\web\\src\\components\\modals\\AddOperationalCostModal.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

with open('c:\\cerberus\\apps\\web\\src\\modules\\opportunity_kits\\OpportunityKitForm.tsx', 'r', encoding='utf-8') as f:
    kit_code = f.read()

kit_code = kit_code.replace("defaultType={costSearchType === 'inst' ? 'INSTALACAO' : 'Manut. pred./corretiva'}", "defaultType={costSearchType === 'inst' ? 'INSTALACAO' : 'MANUTENCAO'}")

with open('c:\\cerberus\\apps\\web\\src\\modules\\opportunity_kits\\OpportunityKitForm.tsx', 'w', encoding='utf-8') as f:
    f.write(kit_code)

print("SUCCESS")
