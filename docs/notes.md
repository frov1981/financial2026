-- Para escribir todas las entidades en un archivo final
--==============================================================
node -e "const fs=require('fs');const dir='src/entities';const out='docs/_entities.txt';const files=fs.readdirSync(dir).filter(f=>f.endsWith('.ts')).sort((a,b)=>a.localeCompare(b));if(files.length===0){console.log('No hay archivos .ts');process.exit(0)};fs.mkdirSync('docs',{recursive:true});fs.writeFileSync(out,'');files.forEach((f,i)=>{fs.appendFileSync(out,'---------------- '+f+' ----------------\n'+fs.readFileSync(dir+'/'+f,'utf8')+(i<files.length-1?'\n\n':''))})"

-- Para escribir todos los controllers en un archivo final
--==============================================================
node -e "const fs=require('fs');const path=require('path');const bases=['src/controllers','src/cache'];const out='docs/_controllers.txt';const getFiles=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?getFiles(path.join(dir,d.name)):path.join(dir,d.name));const allFiles=bases.flatMap(b=>getFiles(b));const files=allFiles.filter(f=>f.endsWith('.ts')).sort((a,b)=>a.localeCompare(b));if(files.length===0){console.log('No hay archivos .ts');process.exit(0)};fs.mkdirSync('docs',{recursive:true});fs.writeFileSync(out,'');files.forEach((f,i)=>{const name=f.replace(/^src[\\/]/,'');fs.appendFileSync(out,'---------------- '+name+' ----------------\n'+fs.readFileSync(f,'utf8')+(i<files.length-1?'\n\n':''))})"

-- Criterios del aplicativo contable
1.  incomes.            todas las transacciones de tipo "income" sin prestamos (sin relacion a "loan")
2.  expenses.           todas las transacciones de tipo "expense" sin pagos (sin relacion a "loan_payment")
3.  loans.              todas las transacciones de tipo "income" con prestamos (relacion a "loan")
4.  payments.           todas las transacciones de tipo "expense" con pagos (relacion a "loan_payment")
5.  savings.            todas las transacciones de tipo "transfer" hacia cuentas de tipo "saving" sin incluir transferencias de savings a savings
6.  withdrawals.        todas las transacciones de tipo "transfer" desde cuentas de tipo "saving" sin incluir transferencias de savings a savings

7.  total_inflows.      incomes + loans
8.  total_outflows.     expenses + payments
9.  net_cash_flow.      total_inflows - total_outflows
10. net_savings.        savings - withdrawals
11. available_balance   net_cash_flow - net_savings