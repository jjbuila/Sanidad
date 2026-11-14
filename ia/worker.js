/* Sanidad Vegetal · Piloto de diagnóstico asistido por IA (Cloudflare Worker).
   La App envía la foto de la palma y las opciones del formulario; el Worker comprueba que quien llama tiene acceso al repositorio
   de datos (con el mismo token de GitHub de la App) y pide a Claude una SUGERENCIA. El operario siempre confirma o corrige.
   La clave de Anthropic vive solo aquí, como secreto del Worker (ANTHROPIC_API_KEY); nunca llega al celular ni al repositorio. */
import Anthropic from "@anthropic-ai/sdk";

const MODELO = "claude-opus-5-5";
const ORIGENES = ["https://jjbuila.github.io", "https://localhost", "capacitor://localhost", "http://localhost", "http://127.0.0.1:8765"];
const MAX_IMAGEN = 1_500_000; // bytes en base64 (la App reduce la foto a 1024 px)

const cors = (origen) => ({
  "Access-Control-Allow-Origin": ORIGENES.includes(origen) ? origen : ORIGENES[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});
const json = (cuerpo, estado, origen) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origen) } });

/* El token de GitHub de la App debe poder escribir en el repositorio de datos: así solo los usuarios de la App usan el servicio. */
async function accesoValido(token, repo) {
  if (!token) return false;
  const r = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "sanidad-ia-worker", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!r.ok) return false;
  const d = await r.json();
  return !!(d.permissions && (d.permissions.push || d.permissions.admin));
}

const SISTEMA = `Eres un asistente de sanidad vegetal para palma de aceite (híbrido OxG y guineensis) en Tumaco, Colombia.
Recibes una foto tomada en campo por un operario de censo y el catálogo de diagnósticos del formulario de la empresa.
Tu trabajo es sugerir el diagnóstico más probable SOLO entre las opciones del catálogo, para que el operario lo confirme o lo corrija.
Reglas:
- Elige "codigo" del catálogo; si hay opciones de la enfermedad para ese código, elige "opcion" exactamente como aparece; si no hay, deja "opcion" vacío.
- "sintomas": solo los síntomas del catálogo de esa opción que se vean en la foto (puede ser una lista vacía).
- Si la foto no permite ver la parte de la palma necesaria (por ejemplo, la flecha o el cogollo para PC), o está borrosa u oscura, usa confianza "baja" y dilo en la explicación.
- Si la palma se ve sana, usa el código SN.
- La explicación es para el operario: una o dos frases en español sencillo, sin tecnicismos innecesarios.
Responde siempre llamando a la herramienta registrar_sugerencia.`;

function herramienta(codigos) {
  return {
    name: "registrar_sugerencia",
    description: "Registra la sugerencia de diagnóstico para la foto de la palma.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        codigo: { type: "string", enum: codigos, description: "Código de la enfermedad principal del catálogo (SN = sana)." },
        opcion: { type: "string", description: "Opción de la enfermedad, exactamente como en el catálogo; vacío si no aplica." },
        sintomas: { type: "array", items: { type: "string" }, description: "Síntomas del catálogo visibles en la foto." },
        confianza: { type: "string", enum: ["alta", "media", "baja"] },
        explicacion: { type: "string", description: "Una o dos frases para el operario." },
      },
      required: ["codigo", "opcion", "sintomas", "confianza", "explicacion"],
      additionalProperties: false,
    },
  };
}

export default {
  async fetch(req, env) {
    const origen = req.headers.get("Origin") || "";
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origen) });
    if (req.method !== "POST") return json({ error: "Use POST." }, 405, origen);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!(await accesoValido(token, env.REPO_DATOS))) return json({ error: "Sin acceso: inicie sesión en la App con internet." }, 401, origen);

    let b;
    try { b = await req.json(); } catch { return json({ error: "Solicitud no válida." }, 400, origen); }
    const { imagen, media_type = "image/jpeg", opciones = [], contexto = {} } = b || {};
    if (typeof imagen !== "string" || !imagen || imagen.length > MAX_IMAGEN) return json({ error: "Falta la foto o es demasiado grande." }, 400, origen);
    if (!["image/jpeg", "image/png", "image/webp"].includes(media_type)) return json({ error: "Formato de foto no admitido." }, 400, origen);
    if (!Array.isArray(opciones) || !opciones.length) return json({ error: "Faltan las opciones del formulario." }, 400, origen);

    const codigos = [...new Set(["SN", ...opciones.map((o) => String(o.c))])];
    const catalogo = opciones.map((o) => `- ${o.c} · ${o.n1}${o.n2 ? " · opción: " + o.n2 : ""}${o.s && o.s.length ? " · síntomas: " + o.s.join("; ") : ""}`).join("\n");
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const r = await client.beta.messages.create({
        model: MODELO,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: SISTEMA,
        tools: [herramienta(codigos)],
        tool_choice: { type: "auto" },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type, data: imagen } },
            { type: "text", text: `Catálogo del formulario:\n- SN · SANA\n${catalogo}\n\nContexto: lote ${contexto.lote || "?"}${contexto.historial ? "; diagnóstico anterior de esta palma: " + contexto.historial : ""}.\nSugiere el diagnóstico.` },
          ],
        }],
      });
      if (r.stop_reason === "refusal") return json({ error: "La IA no pudo analizar esta foto. Diagnostique normalmente." }, 422, origen);
      const uso = r.content.find((x) => x.type === "tool_use" && x.name === "registrar_sugerencia");
      if (!uso) return json({ error: "La IA no devolvió una sugerencia. Intente con otra foto." }, 502, origen);
      const s = uso.input;
      // Validación final contra el catálogo enviado (la App también vuelve a validar)
      const o = opciones.filter((x) => x.c === s.codigo);
      const opcion = o.some((x) => x.n2 === s.opcion) ? s.opcion : "";
      const validos = new Set(o.filter((x) => !opcion || x.n2 === opcion).flatMap((x) => x.s || []));
      return json({ codigo: s.codigo, opcion, sintomas: (s.sintomas || []).filter((x) => validos.has(x)), confianza: s.confianza, explicacion: s.explicacion, modelo: r.model }, 200, origen);
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return json({ error: "Servicio de IA ocupado. Intente en un minuto." }, 429, origen);
      if (e instanceof Anthropic.APIConnectionError) return json({ error: "No hay conexión con el servicio de IA." }, 503, origen);
      if (e instanceof Anthropic.APIError) return json({ error: `Error del servicio de IA (${e.status}).` }, 502, origen);
      return json({ error: "Error interno del servicio." }, 500, origen);
    }
  },
};
