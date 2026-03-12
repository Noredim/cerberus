# Restrict Product Actions

## Goal
Restrict product deletion to admins with a custom dependency error message, and lock all core fields during product editing, allowing only Description and Suppliers to be updated.

## Tasks
- [x] Task 1: Update API deletion in `apps/api/src/modules/products/service.py` to catch `IntegrityError` and throw a 400 `HTTPException` with the message "produto vinculado a formaçoes de preço, não é possivel exclusão!". → Verify: The backend gracefully blocks deletions of products that have foreign key restrictions instead of a 500 error.
- [x] Task 2: Update `handleDelete` in `apps/web/src/modules/products/ProductList.tsx` to ensure backend error messages are displayed directly to the user when a deletion is blocked. (Also, verify Admin role checks). → Verify: Alert displays the correct message.
- [x] Task 3: In `apps/web/src/modules/products/ProductForm.tsx`, add an `isEditMode` variable. Apply `disabled={isReadOnly || isEditMode}` to Nome, Empresa, Tipo, Unidade, Categoria, Marca, Modelo, NCM, CEST, and CMT. → Verify: Visual inspection confirms fields are locked during "Editar", while Descrição and Fornecedores inputs remain enabled.

## Done When
- [x] Deletion correctly maps backend constraint exceptions to the exact requested string.
- [x] Product edit mode restricts updates to the description and supplier bindings for all users.
