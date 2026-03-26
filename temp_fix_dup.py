with open('c:\\cerberus\\apps\\web\\src\\modules\\opportunity_kits\\OpportunityKitForm.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace the first entire {showBlock31 && ( ... )} that is duplicated
start_dup = code.find('{showBlock31 && (')
end_dup = code.find('{showBlock31 && (', start_dup + 1)

if start_dup > -1 and end_dup > -1:
    # remove the first one, keep the second one.
    pre = code[:start_dup]
    post = code[end_dup:]
    code = pre + post

# Rename showBlock31 back to showBlock2 (or whatever block 5 should be... wait, block 1 is block 1, block 2 is block 2. 
# It seems block 5 uses showBlock31? Let's check what variable toggles block 5.
# Let's just rename showBlock31 to showBlock2 everywhere for consistency if needed, but wait!
# If I rename showBlock31 to showBlock2, what if showBlock2 is used elsewhere?
# Let's see what variables there are.
# It's safer to just change the '{showBlock31 && (' to '{showBlock2 && ('
code = code.replace('{showBlock31 && (', '{showBlock2 && (')

with open('c:\\cerberus\\apps\\web\\src\\modules\\opportunity_kits\\OpportunityKitForm.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS")
