# Conexión DBeaver — MariaDB local

## Datos de conexión

```text
Driver:     MariaDB (o MySQL)
Host:       127.0.0.1
Puerto:     3306
Database:   cuentas
Usuario:    cuentas_app
Password:   cambiar_esta_clave
```

La contraseña debe coincidir con `DB_PASSWORD` en `backend/.env`.

## Pasos en DBeaver

1. Abrir DBeaver.
2. Clic en **Nueva conexión**.
3. Seleccionar **MariaDB**. Si no aparece, seleccionar **MySQL**.
4. Completar Host, Puerto, Database, Username y Password.
5. Pulsar **Probar conexión**.
6. Si pide descargar el driver, aceptarlo.
7. Guardar y abrir la base `cuentas`.

## Tablas iniciales esperadas

Tras las migraciones de Laravel deben existir, entre otras:

- `users`
- `sessions`
- `cache`
- `jobs`
- `personal_access_tokens`
- `migrations`

## Si no conecta

1. Confirmar que MariaDB está iniciado en el panel de XAMPP.
2. Verificar que el puerto `3306` no esté ocupado por otro servicio.
3. Probar con:

```text
C:\xampp\mysql\bin\mysql.exe -u cuentas_app -pcambiar_esta_clave -h 127.0.0.1 cuentas -e "SHOW TABLES;"
```

4. No usar el usuario `root` desde Laravel; sí puede usarse temporalmente en DBeaver para administración.
