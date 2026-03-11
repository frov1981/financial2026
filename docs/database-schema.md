# Esquema de la base de datos

Este documento contiene un diagrama en formato ASCII que refleja las tablas
principales del proyecto `ssrfinan` y sus relaciones. Las claves primarias se
marcan con `PK`, las claves foráneas con `FK`, y los vínculos indican filas uno a
muchos (1..*) o uno a uno (1..1).

```text
            +------------------+                       +------------------+
            |      users       |                       |   category_groups|
            |------------------|                       |------------------|
            | id PK            |<---+1              1+--| id PK            |
            | email            |    |                   | user_id FK ->    |
            | name             |    |                   |   users.id       |
            | ...              |    |                   | ...              |
            +------------------+    |                   +------------------+
                    |1              |1
                    |               |
         +----------+----------+    |
         |       accounts      |    |
         |--------------------|    |
         | id PK              |    |
         | user_id FK -> users|----+
         | name               |
         | balance            |
         | ...                |
         +--------------------+
                    |1
                    |          +------------------+
                    |          |   transactions   |
                    |          |------------------|
                    |          | id PK            |
                    |          | user_id FK ->    |
                    |          |   users.id       |
                    |          | account_id FK -> |
                    |          |   accounts.id    |
                    |          | to_account_id FK |
                    |          |   (accounts.id)  |
                    |          | category_id FK ->|
                    |          |   categories.id  |
                    |          | ...              |
                    |          +------------------+
                    |
                    |          +------------------+
                    |          |    loans         |
                    |          |------------------|
                    |          | id PK            |
                    |          | user_id FK ->    |
                    |          |   users.id       |
                    |          | disbursement_acct|
                    |          |   _id FK ->       |
                    |          |   accounts.id    |
                    |          | category_id FK ->|
                    |          |   categories.id  |
                    |          | loan_group_id FK |
                    |          |   -> loan_groups |
                    |          | parent_id FK ->  |
                    |          |   loans.id       |
                    |          | transaction_id FK|
                    |          |   -> transactions|
                    |          | ...              |
                    |          +------------------+
                    |
                    |          +------------------+
                    |          |  loan_groups     |
                    |          |------------------|
                    |          | id PK            |
                    |          | user_id FK ->    |
                    |          |   users.id       |
                    |          | ...              |
                    |          +------------------+
                    |
                    |          +------------------+
                    |          |  loan_payments   |
                    |          |------------------|
                    |          | id PK            |
                    |          | loan_id FK ->    |
                    |          |   loans.id       |
                    |          | account_id FK -> |
                    |          |   accounts.id    |
                    |          | transaction_id FK|
                    |          |   -> transactions|
                    |          | category_id FK ->|
                    |          |   categories.id  |
                    |          | ...              |
                    |          +------------------+
                    |
                    |          +------------------+
                    |          |  categories      |
                    |          |------------------|
                    |          | id PK            |
                    |          | user_id FK ->    |
                    |          |   users.id       |
                    |          | category_group_id|
                    |          |   FK -> category_|
                    |          |   groups.id      |
                    |          | parent_id FK ->  |
                    |          |   categories.id  |
                    |          | ...              |
                    |          +------------------+
                    |
                    |          +------------------+
                    |          | cache_kpi_balances|
                    |          |------------------|
                    |          | id PK            |
                    |          | user_id FK ->    |
                    |          |   users.id       |
                    |          | period_year      |
                    |          | period_month     |
                    |          | ...              |
                    |          +------------------+
                    |
                    |          +------------------+
                    +---------> auth_codes      |
                               |------------------|
                               | id PK            |
                               | user_id FK ->    |
                               |   users.id       |
                               | code_hash        |
                               | ...              |
                               +------------------+
```

> 📝 **Nota:** Las líneas verticales (`|`) representan relaciones de uno a varios
> (por ejemplo, un `user` puede tener muchas `accounts`). Las flechas indican el
> lado propietario de la relación.

El diagrama se puede usar como referencia rápida al desarrollar nuevas tablas
o al analizar consultas complejas. Si se añaden entidades nuevas, este esquema
debe actualizarse manualmente.
