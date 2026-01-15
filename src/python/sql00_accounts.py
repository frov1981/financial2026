def build_accounts_insert():
    return """SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE loans;
TRUNCATE TABLE loan_payments;
TRUNCATE TABLE transactions;
TRUNCATE TABLE categories;
TRUNCATE TABLE accounts;
TRUNCATE TABLE auth_codes;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO accounts (id, name, type, balance, is_active, user_id)
VALUES
(1,'Efectivo','cash',0,1,1),
(2,'Banco Guayaquil','bank',0,1,1),
(3,'Banco Pichincha','bank',0,1,1),
(4,'Banco Conecel','bank',0,1,1),
(5,'Banquito','bank',0,1,1),
(6,'Mastercard','card',0,1,1);
"""
