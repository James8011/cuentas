# Despliegue en Hostinger

Ruta en el servidor:

`/home/u118311013/domains/sirvelo.online/public_html/subdominios/hogar`

El workflow [`.github/workflows/deploy-hostinger.yml`](../.github/workflows/deploy-hostinger.yml) se ejecuta en cada push a `main` (o manualmente).

## Qué hace el pipeline

1. `npm ci` + `npm run build` del frontend  
2. Copia la SPA a `backend/public/` (`index.html` + `assets/`)  
3. Empaqueta el backend (sin `vendor` ni `.env`)  
4. Sube el tarball por SCP/SSH  
5. En el servidor: `composer install --no-dev`, `php artisan migrate --force`, caches y symlink `public/storage` → `storage/app/public` (vía `ln -sfn`; `artisan storage:link` falla porque Hostinger deshabilita `exec()`)

## Secrets de GitHub

En el repo → **Settings → Secrets and variables → Actions**:

| Secret | Valor típico |
|--------|----------------|
| `HOSTINGER_HOST` | IP del VPS/shared o `ssh.hostinger.com` |
| `HOSTINGER_USERNAME` | `u118311013` |
| `HOSTINGER_SSH_KEY` | Clave privada SSH (recomendada) |
| `HOSTINGER_PASSWORD` | Solo si no usas llave |

El puerto SSH del workflow está fijo en **65002** (estándar Hostinger). Si el tuyo es otro, edita `port:` en el YAML.

## Primera vez en Hostinger

1. Activa **SSH** en el panel de Hostinger.  
2. Crea la base de datos MySQL en el panel.  
3. En el servidor:

```bash
cd /home/u118311013/domains/sirvelo.online/public_html/subdominios/hogar
nano .env   # usa deploy/hostinger/.env.hostinger.example como base
# Define SEED_ADMIN_PHONE / SEED_ADMIN_PASSWORD si quieres otros datos de acceso
php artisan key:generate
```

4. Apunta el subdominio `hogar.sirvelo.online` a la carpeta `subdominios/hogar`.  
5. Lanza el workflow desde la pestaña **Actions** → *Deploy Hostinger* → *Run workflow*.

El deploy ejecuta `InitialAccessSeeder`: crea permisos, usuario admin, hogar y roles
**Administrador** (todo), **Integrante** (operación) y **Consulta** (solo lectura).

## URL esperada

- App: `https://hogar.sirvelo.online`  
- API: `https://hogar.sirvelo.online/api/v1`

Si el sitio se sirve por ruta (`https://sirvelo.online/subdominios/hogar`) en lugar de subdominio, ajusta `base` en Vite y `APP_URL` / `FRONTEND_URL`.
