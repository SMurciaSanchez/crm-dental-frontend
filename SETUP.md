# CRM Dental UNICOC — Guía de instalación

## Requisitos previos (instalar una sola vez)

| Herramienta | Descarga |
|---|---|
| Node.js v22 | https://nodejs.org |
| Git | https://git-scm.com |
| Docker Desktop | https://www.docker.com/products/docker-desktop |

> Después de instalar Docker Desktop, ábrelo y espera a que el ícono de la ballena deje de animarse antes de continuar.

---

## 1. Clonar los repositorios

Abre **PowerShell** y ejecuta:

```powershell
# Backend
git clone git@github.com:SMurciaSanchez/crm-dental-backend.git
cd crm-dental-backend
npm install

# Frontend (en otra carpeta)
cd ..
git clone git@github.com:SMurciaSanchez/crm-dental-frontend.git
```

> Si no tienes SSH configurado, usa HTTPS:
> `git clone https://github.com/SMurciaSanchez/crm-dental-backend.git`

---

## 2. Configurar variables de entorno del backend

Dentro de la carpeta `crm-dental-backend`, crea un archivo llamado `.env` con este contenido:

```env
DATABASE_URL="postgresql://crm_user:crm_pass@localhost:5432/crm_dental"
JWT_ACCESS_SECRET=clave_acceso_super_secreta_unicoc_2024
JWT_REFRESH_SECRET=clave_refresh_super_secreta_unicoc_2024
ENCRYPTION_KEY=unicoc_crm_dental_key_32bytes!!
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5500
UPLOAD_DIR=uploads
```

---

## 3. Arrancar la base de datos

Desde la carpeta `crm-dental-backend`:

```powershell
docker compose up -d
```

Deberías ver:
```
✔ Container crm_dental_db      Running
✔ Container crm_dental_pgadmin Running
```

---

## 4. Inicializar la base de datos

```powershell
npx prisma db push
npm run db:seed
```

El seed carga los usuarios de prueba, sedes, procedimientos y datos de ejemplo.

---

## 5. Arrancar el backend

```powershell
npm run dev
```

Deberías ver:
```
✅ Conectado a PostgreSQL
║  API    : http://localhost:3000/api
```

---

## 6. Arrancar el frontend

Abre **otra ventana de PowerShell** y ve a la carpeta `crm-dental-frontend`:

```powershell
cd crm-dental-frontend
node servidor-frontend.js
```

Deberías ver:
```
✅ Frontend disponible en: http://localhost:5500
```

---

## 7. Abrir el sistema

Ve a **http://localhost:5500** en tu navegador.

### Usuarios de prueba

| Rol | Email | Contraseña | Documento |
|---|---|---|---|
| Admin | admin@unicoc.edu.co | Admin2024! | 1000000001 |
| Docente | c.vargas@unicoc.edu.co | Docente2024! | 1000000002 |
| Estudiante | l.ramirez@estudiantes.unicoc.edu.co | Estudiante2024! | 1020304050 |
| Paciente | m.torres@gmail.com | Paciente2024! | 52001234 |

---

## Resumen de puertos

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5500 |
| Backend API | http://localhost:3000/api |
| PgAdmin (BD visual) | http://localhost:5050 |

> PgAdmin: usuario `admin@unicoc.edu.co` / contraseña `admin123`

---

## Solución de problemas frecuentes

**"Can't reach database server"**
→ Docker Desktop no está abierto. Ábrelo y espera a que cargue, luego corre `docker compose up -d`.

**"429 Too Many Requests" al hacer login**
→ Esperaste menos de 15 minutos entre intentos fallidos. Espera o abre una ventana de incógnito.

**Login da error 401**
→ Verifica que corriste `npm run db:seed`. Si el problema persiste, vuelve a correrlo.

**Puerto 3000 o 5500 ya en uso**
→ Cierra otras aplicaciones que usen esos puertos o reinicia el computador.
