# Sistema de Evaluación de Desempeño — Gratificación Extraordinaria Variable

Aplicación web para la gestión de evaluaciones de desempeño mensuales y el cálculo de la
**Gratificación Extraordinaria Variable** de los colaboradores.

## Stack

| Capa     | Tecnologías |
|----------|-------------|
| Backend  | NestJS 10, Prisma 5, PostgreSQL 16, JWT (access + refresh), Nodemailer, Puppeteer (PDF), node-cron vía `@nestjs/schedule` |
| Frontend | React 18, Vite 5, TypeScript, TailwindCSS, TanStack Query, React Router 6 |
| Infra    | Docker Compose (postgres, backend, frontend con nginx) |

## Estructura

```
gev-evaluation/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── src/
│       ├── main.ts, app.module.ts
│       ├── common/            (prisma, guards, decorators, motor de puntos)
│       └── modules/           (auth, users, branches, importance-levels, periods,
│                               objectives, evaluations, validations, results,
│                               receipts, analytics, notifications, scheduler)
└── frontend/
    ├── Dockerfile, nginx.conf
    ├── package.json
    ├── scripts/check-terminology.mjs
    └── src/
        ├── i18n/es.json       (todos los textos de UI)
        ├── api/ (client, types)
        ├── store/auth.tsx
        ├── layouts/, components/
        └── pages/             (login, admin/*, collaborator/*, validator/*)
```

## Terminología legal (cumplimiento)

En ningún texto visible de la interfaz se utilizan términos prohibidos. La verificación es
automática y obligatoria:

```bash
cd frontend
npm run test:terminology
```

El script escanea `src/i18n/es.json` y falla con `exit 1` si detecta términos prohibidos
o si faltan los términos obligatorios ("Gratificación Extraordinaria Variable",
"Evaluación", "Mis Objetivos").

## Arranque en desarrollo

Requisitos: Node 20+, PostgreSQL 16 local (o vía Docker) y acceso a `npm`.

1. **Variables de entorno**

   ```bash
   cp .env.example .env          # raíz (referencia)
   cp .env.example backend/.env  # la que consume el backend
   ```

2. **Base de datos** (una sola opción):

   ```bash
   # Opción A: PostgreSQL en Docker
   docker run -d --name gev-db -p 5432:5432 \
     -e POSTGRES_USER=gev -e POSTGRES_PASSWORD=gev_secret -e POSTGRES_DB=gev_evaluation \
     postgres:16-alpine

   # Opción B: usar docker compose solo para la base de datos
   docker compose up -d db
   ```

3. **Backend** (puerto 3000, prefijo `/api`):

   ```bash
   cd backend
   npm install
   npx prisma migrate dev --name init   # crea las tablas
   npm run db:seed                      # admin RRHH + niveles + sucursal Matriz
   npm run start:dev
   ```

4. **Frontend** (puerto 5173, proxy `/api` → `localhost:3000`):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Verificación de compilación y terminología**:

   ```bash
   cd backend  && npx tsc --noEmit
   cd frontend && npx tsc --noEmit && npm run test:terminology
   ```

## Arranque con Docker Compose (todo el stack)

```bash
cp .env.example .env   # ajustar secretos si se desea
docker compose up --build
```

- Frontend: http://localhost (nginx, SPA + proxy `/api`)
- Backend: http://localhost:3000/api
- PostgreSQL: localhost:5432
- Los recibos PDF persisten en el volumen `gev_storage` (`/app/storage/receipts`).

## Credenciales iniciales

- **RRHH:** `ADMIN_EMAIL` / `ADMIN_PASSWORD` (defecto `admin@gev.local` / `Admin123!`, cambiables por entorno).
- Colaboradores y jefes se dan de alta desde **Usuarios** (RRHH); la contraseña temporal por
  defecto es `Cambiar123!` (o `DEFAULT_USER_PASSWORD`).

## Reglas de negocio implementadas

- **Roles:** RRHH, JEFE, COLABORADOR. Guards por rol en backend y rutas protegidas en frontend.
- **Objetivos:** 5 a 30 por empleado y periodo; recálculo de puntos con el método del residuo
  mayor (largest remainder) en transacción, tras crear/editar/eliminar.
- **Auditoría inmutable** de cambios de objetivos (`objective_audit_log`).
- **Duplicar del mes anterior** copia los objetivos del periodo previo del mismo empleado.
- **Autoevaluación:** escala fija EXCELENTE=100 / BUENO=80 / REGULAR=50 / NO_CUMPLIDO=0;
  comentario opcional; al enviar, la vista queda bloqueada; el colaborador solo ve el periodo en curso.
- **Validación (JEFE o RRHH):** el primero que decide cierra el ciclo; modificar calificaciones
  exige justificación obligatoria; se guardan ambas versiones (JSONB) en `evaluation_results`.
- **Cálculo:** `total_points = Σ(points × percent / 100)`; prorrateo solo si la fecha de alta
  al programa cae dentro del mes del periodo: `factor = (díasDelMes − díaAlta + 1) / díasDelMes`;
  `monto = total_points × (gratification_max_monthly × factor)`.
- **Auto-cierre** (cron diario 00:05, `America/Mexico_City` vía `@nestjs/schedule`):
  día 7 del mes siguiente → correo recordatorio ("3 días para cierre"); día 11 → colaboradores
  activos con evaluación PENDING/IN_PROGRESS se cierran al 0% (`AUTO_CLOSED`, recibo generado,
  vista bloqueada). Los enviados sin validar quedan PENDING en la bandeja de validación (sin
  auto-aprobar). Empleados inactivos quedan excluidos.
- **Recibos PDF** (Puppeteer, server-side): folio secuencial `GEV-AAAA-MM-0001` por periodo,
  generado en transacción con bloqueo de fila del periodo (sin duplicados); concepto único
  "Gratificación Extraordinaria Variable" y cláusula legal exacta antes del bloque de firmas.
- **Correos** (Nodemailer): asignación de objetivos, recordatorio día 7 y confirmación de
  recibo; si SMTP no está configurado se imprimen en consola (desarrollo).
- **Analítica (RRHH):** mapa de calor de cumplimiento (nivel × sucursal, coloreado por
  `color_hex`), clasificación de colaboradores con filtros (jefe, sucursal, fechas) y
  exportación CSV del periodo (ID, Nombre, Puesto, Monto Final).
- **Auth:** JWT access (12 h) + refresh (7 días en cookie `httpOnly`, `sameSite=lax`);
  contraseñas con bcryptjs.

## Recibos: regeneración

Si la generación del PDF fallara después de cerrar la evaluación, RRHH puede regenerar el
recibo de un resultado (idempotente; devuelve el existente si ya hay uno):

```
POST /api/receipts/result/:resultId/generate
```

## Decisiones y supuestos

1. **Fórmula de monto:** se implementó literalmente `monto = total_points × (máximo_mensual × factor)`,
   tal como se especificó. `total_points` vive en escala 0–100; si el negocio espera que el
   máximo mensual sea el tope real del pago, bastará con dividir `total_points` entre 100 en
   `common/business/calculation.ts` y en los servicios que calculan proyecciones.
2. **Programador:** se usó `@nestjs/schedule` (wrapper oficial de cron sobre node-cron) en lugar
   de invocar node-cron directamente; mismo horario (00:05) y zona horaria configurable.
3. **Migraciones:** en desarrollo se usa `prisma migrate dev`; el contenedor usa `prisma db push`
   para no exigir historial de migraciones en la entrega base. Antes de producción se recomienda
   generar migraciones (`prisma migrate dev`) y cambiar el `CMD` del Dockerfile a `migrate deploy`.
4. **Filtro de fechas del leaderboard:** filtra por año del periodo (rango desde/hasta),
   suficiente para periodos mensuales; se puede refinar a comparación (año, mes) si se requiere.
5. **Duplicar del mes anterior:** exige que el periodo destino no tenga aún objetivos para ese
   empleado, para evitar duplicados accidentales.
6. **Niveles de importancia:** la baja es lógica (`is_active=false`) cuando el nivel ya tiene
   objetivos históricos; si no, se elimina físicamente.
7. **Colaboradores:** alta solo del rol COLABORADOR crea perfil (puesto, monto máximo, alta al
   programa, sucursal); jefes y RRHH pueden existir sin perfil.

## Estado de la validación

- `backend`: `npx tsc --noEmit` → **0 errores**; `npm run build` (nest build) → **OK**.
- `frontend`: `npx tsc --noEmit` → **0 errores**; `npm run build` (tsc + vite) → **OK**;
  `npm run test:terminology` → **✅ Terminología legal correcta**.
- Búsqueda manual de términos prohibidos en `frontend/src`, `backend/src` y `backend/prisma` → sin coincidencias.
- **Prueba de humo E2E ejecutada** (PostgreSQL 16 real + API levantada): login JWT y refresh
  (cookie `httpOnly`), creación/activación de periodos, alta de colaboradores con jefe directo,
  motor de puntos (pesos 4/3/2/1/1 → 37/27/18/9/9, Σ=100 exacto), autoevaluación y bloqueo al
  enviar, validación con y sin modificación (justificación obligatoria solo con cambios,
  400 en caso contrario), rechazo de doble decisión, prorrateo 0.5 para alta a mitad de mes,
  folios `GEV-2026-09-0001/0002` y `GEV-2026-10-0001` sin duplicados, PDF con cláusula legal,
  descarga del recibo, duplicar del mes anterior (y bloqueo de duplicado), bandeja JEFE,
  heatmap, leaderboard, export CSV y guard de roles (401/403).
