# DiaCaminante — Deep Work & Daily Shutdown Ritual

> Aplicación web minimalista, ultra-rápida y estéticamente impecable para el registro, auditoría y ritual de cierre de Trabajo Profundo (*Deep Work*, Cal Newport), integrando indicadores de salud, flujo cognitivo y planificación estricta.

---

## 🌌 Identidad Visual: Medianoche Pastel Elegante

- **Fondo base**: Medianoche profundo (Obsidian Slate `#090C10`, `#0E131F`).
- **Superficies / Tarjetas**: Medianoche translúcido (`#151C2C`, borde sutil `rgba(255, 255, 255, 0.07)`).
- **Acentos Pastel Muted**:
  - **Lavanda suave** (`#C4B5FD` / `#A78BFA`): Foco activo y botones primarios.
  - **Verde menta** (`#86EFAC`): Estado "Hecho", horas netas acumuladas y confirmación del ritual.
  - **Coral pastel** (`#FDA4AF`): Estado "No hecho", desvíos e incomodidad alta.
  - **Ámbar pastel** (`#FDE68A`): Tareas pendientes y estado intermedio.
  - **Azul hielo** (`#93C5FD`): Sesiones de desarrollo y foco técnico.
- **Tipografía**: Inter & JetBrains Mono con números tabulares para cronómetros y métricas.

---

## 🛠️ Stack Tecnológico

- **Frontend**: [Astro](https://astro.build/) (SSR / Hybrid) con [Tailwind CSS](https://tailwindcss.com/) y componentes reactivos optimistas.
- **Backend / API**: [Hono.js](https://hono.dev/) integrado mediante endpoints de Astro (`/api/...`).
- **Base de Datos**: PostgreSQL en [Supabase](https://supabase.com/) a través de `@supabase/supabase-js` con `SUPABASE_SERVICE_ROLE_KEY` para administración directa.
- **Plataforma de Despliegue**: [Cloudflare Pages](https://pages.cloudflare.com/) (`@astrojs/cloudflare`).

---

## 🚀 Inicio Rápido Local

### 1. Clonar e Instalar Dependencias
```bash
npm install
```

### 2. Configurar Variables de Entorno (`.env`)
Crea tu archivo `.env` basándote en `.env.example`:
```env
SUPABASE_URL="https://tu-proyecto.supabase.co"
SUPABASE_ANON_KEY="tu-anon-key"
SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key"
```

### 3. Iniciar Servidor de Desarrollo
```bash
npm run dev
```
La aplicación estará disponible inmediatamente en `http://localhost:4321`.

### 4. Compilar para Producción (Cloudflare Pages)
```bash
npm run build
```
Genera la carpeta `dist/` con la función `_worker.js` lista para Cloudflare Pages.

---

## 🧩 Arquitectura de la Aplicación

### A. Marcador Superior (Scoreboard en Tiempo Real)
- **Fecha actual** con formato extendido en español.
- **Contador de horas netas acumuladas hoy** con tipografía monoespaciada tabular y acento verde menta.
- **Indicador de estado del ritual**: Muestra si la mente ya fue liberada o si el cierre sigue pendiente.
- **Exportar JSON**: Llama a `/api/exportar`, copia el dataset al portapapeles y descarga el `.json` correspondiente al mes actual.

### B. Módulo 1: Registro Rápido de Flujo (&lt; 15 segundos)
- **Tipo de Enfoque**: Píldoras rápidas (`Desarrollo`, `Estudio`, `Arquitectura`, `Escritura`) + opción personalizada.
- **Horas Netas**: Input numérico con botones rápidos de incremento (`+0.5h`, `+1.0h`, `+1.5h`).
- **Intensidad**: Selector de 3 niveles (`Baja`, `Media`, `Alta`).
- **Incomodidad**: Selector de exigencia cognitiva (`Baja`, `Media`, `Alta`). *Principio Newport: La incomodidad deliberada es la señal de expansión de mielina y frontera cognitiva.*
- **Calidad / Entregable**: Input conciso de una línea para registrar el valor aportado.
- **Línea de Tiempo de Hoy**: Historial cronológico instantáneo de los bloques de foco con badges de exigencia e intensidad.

### C. Módulo 2: Panel de Cierre del Día (Shutdown Ritual)
Inspirado en el mantra de Newport: *"Shutdown Complete"*.
1. **Auditoría de Tareas de Hoy**:
   - Cada tarea planificada para hoy tiene píldoras de estado: `[ Hecho ]`, `[ Incompleto ]`, `[ No hecho ]`.
   - Si se marca `Incompleto` o `No hecho`, se abre un micro-input para auditar el motivo del desvío (`motivo_desvio`).
2. **Contexto de Salud y Mente**:
   - **Alimento**: Escala 1 a 5 (Píldoras numeradas).
   - **Ejercicio Físico**: Input de horas e intensidad (`Baja`, `Media`, `Alta`).
   - **Frío Mental**: Selector excluyente (`Frío total`, `Inspirado`, `Ávido`).
3. **Planificación de Mañana (Editor Estricto Markdown)**:
   - Formato estricto por línea:
     `- [ ] [09:00 - 11:00] [PROFUNDO] Tarea clave de la mañana (2h netas)`
     `- [ ] [11:15 - 12:45] [PROFUNDO] Segunda sesión profunda (1.5h netas)`
     `- [ ] [15:00 - 15:30] [SUPERFICIAL] Organización y respuestas`
   - Parser Regex de alta precisión:
     `/- [ ] \[(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\] \[(PROFUNDO|SUPERFICIAL)\] (.+?)(?: \((\d+(?:\.\d+)?)h netas\))?$/`
   - Al guardar, almacena las tareas para el día siguiente (`fecha_objetivo = CURRENT_DATE + 1`), sella `cierre_realizado = TRUE` y muestra la confirmación de desconexión.

---

## 📡 Endpoints de la API (Hono.js)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/dia/hoy` | Retorna el estado del día, horas acumuladas, sesiones y tareas |
| `POST` | `/api/sesiones` | Inserta un bloque de foco vinculado al día actual |
| `PUT` | `/api/tareas/:id` | Actualiza estado (`hecho`, `incompleto`, `no_hecho`) y motivo de desvío |
| `POST` | `/api/cierre` | Guarda salud, frío mental, parsea el markdown y completa el ritual |
| `GET` | `/api/exportar` | Exporta el resumen del mes consultando `vista_resumen_diario` |
