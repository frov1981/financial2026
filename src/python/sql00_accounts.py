def build_accounts_insert():
    return """SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE loans;
TRUNCATE TABLE loan_payments;
TRUNCATE TABLE transactions;
TRUNCATE TABLE categories;
TRUNCATE TABLE accounts;
TRUNCATE TABLE auth_codes;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO users (id, email, NAME, password_hash)
VALUES (1, 'frov1981@gmail.com', 'nando', '$2b$10$qaz6EVHtMkte3LWWdOMgp.ukFfy60q3yNmmvSR1ed8XBTPSKV3GSO');

INSERT INTO accounts (id, name, type, balance, is_active, user_id)
VALUES
(1,'Efectivo','cash',0,1,1),
(2,'Banco Guayaquil','bank',0,1,1),
(3,'Banco Pichincha','bank',0,1,1),
(4,'Banco Conecel','bank',0,1,1),
(5,'Banquito','bank',0,1,1),
(6,'Mastercard','card',0,1,1);
"""
