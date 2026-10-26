# Expedientes — Zaida Marmen | Tu aliada legal

Aplicación interna de seguimiento de expedientes del despacho. Una sola app web
responsiva: se captura en computadora y se consulta en celular o iPad (en el iPad,
Safari → Compartir → *Agregar a pantalla de inicio* para usarla como app).

**Fase 1 (esta versión):** usuarios con permisos, expedientes, bitácora diaria con
archivos, captura de plazos con cálculo de vencimiento (sin días inhábiles todavía),
pantalla *Hoy* e importación del Excel de amparos.

Tecnología: Next.js 16 en Vercel · Supabase (base de datos Postgres, inicio de sesión
y archivos).

---

## Puesta en marcha (una sola vez)

### 1. Base de datos (Supabase)

1. Supabase → tu proyecto → **SQL Editor** → *New query*.
2. Pega todo el contenido de `supabase/schema.sql` y presiona **Run**.
   Crea las tablas, los permisos, el historial imborrable y el espacio para archivos.

### 2. Inicio de sesión

1. Supabase → **Authentication → Sign In / Providers**: deja solo *Email* activo y
   desactiva **Allow new users to sign up** (nadie se registra solo; se invita).
2. **Authentication → URL Configuration**:
   - *Site URL*: la dirección de Vercel (p. ej. `https://expedientes-zm.vercel.app`).
3. **Authentication → Email Templates → Invite user**, cambia el enlace por:
   ```
   <a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite">Crear mi contraseña</a>
   ```
   Y en **Reset password**:
   ```
   <a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery">Cambiar mi contraseña</a>
   ```

### 3. Publicar la app (Vercel)

1. Vercel → **Add New → Project** → importa el repositorio `expedientes-zm`.
2. En **Environment Variables** agrega (los valores están en Supabase →
   Project Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la llave *anon* / *publishable*; **nunca** la *service_role*)
3. **Deploy**.

### 4. Usuarios

1. Supabase → **Authentication → Users → Invite user**, uno por persona.
   Cada quien recibe un correo, entra al enlace y elige su contraseña.
2. Cuando todos estén invitados, en el SQL Editor ajusta nombres y roles
   (cambia los correos por los reales):
   ```sql
   update perfiles set nombre = 'Zaida',  rol = 'admin'          where email = 'zaida@...';
   update perfiles set nombre = 'Uriel',  rol = 'abogado'        where email = 'uriel@...';
   update perfiles set nombre = 'Diego',  rol = 'abogado'        where email = 'diego@...';
   update perfiles set nombre = 'Alex',   rol = 'abogado'        where email = 'alex@...';
   update perfiles set nombre = 'Rafael', rol = 'administrativo' where email = 'rafael@...';
   update perfiles set nombre = 'Ricardo',rol = 'desarrollo'     where email = 'ricardo@...';
   ```

### 5. Carga inicial de expedientes

El archivo con los datos de clientes **no está en este repositorio** (carpeta `datos/`,
excluida a propósito). Con Uriel ya dado de alta y con nombre `Uriel` en `perfiles`:

1. Abre `importacion.sql` (te lo entrega Ricardo por separado).
2. Pégalo en el SQL Editor y presiona **Run**. Es una sola transacción: o entra todo o nada.

Para regenerarlo desde el Excel revisado:
```
python3 scripts/generar_importacion.py datos/carga_inicial_amparos_GrupoMAS.xlsx > datos/importacion.sql
```

---

## Reglas de permisos

| Acción | Quién |
| --- | --- |
| Ver todo | Todos |
| Capturar expedientes, bitácora y plazos | Todos |
| Corregir un registro | Solo su autor (y Zaida) |
| Marcar un pendiente como cumplido | Su autor o su responsable |
| Reasignar, concluir o archivar un expediente | Solo Zaida |
| Borrar | Solo Zaida |
| Modificar el historial de cambios | Nadie |

Estas reglas viven en la base de datos (políticas RLS y triggers), no solo en la
pantalla: aunque alguien intente saltarse la app, la base lo impide. Las pruebas están
en `supabase/tests/permisos.sql`.

## Correos de invitación

La app funciona con los correos que Supabase manda por defecto (en inglés): el enlace
regresa a la página, se abre la sesión y la persona elige su contraseña en `/contrasena`.
Para personalizarlos en español hay que configurar un servidor de correo propio (SMTP)
en Supabase; se hará en la Fase 3 junto con las alertas.

## Desarrollo local

```
cp .env.example .env.local   # y llena los valores
npm install
npm run dev
```

## Siguientes fases

- **Fase 2:** calendarios de días inhábiles por autoridad, plantillas de plazos
  frecuentes, instrucciones de Zaida.
- **Fase 3:** tablero completo de Zaida, alertas diarias por correo, agenda y pagos
  de impuestos de Rafael y Ricardo.
- **Fase 4:** resumen semanal en PDF.
