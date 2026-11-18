const MAX_JSON_BYTES = 32_768;
const MAX_QUERY_LENGTH = 4_096;

function json(objeto, status = 200, headers = {}) {
  return Response.json(objeto, { status, headers });
}

async function leerJson(request) {
  if (!request.body) return { error: 'Envía un cuerpo JSON.', status: 400 };
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let delCuerpo = 0;
  let texto = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      delCuerpo += value.byteLength;
      if (delCuerpo > MAX_JSON_BYTES) {
        await reader.cancel();
        return { error: 'El cuerpo supera 32 KiB.', status: 413 };
      }
      texto += decoder.decode(value, { stream: true });
    }
    return { datos: JSON.parse(texto + decoder.decode()) };
  } catch {
    return { error: 'El cuerpo debe ser JSON UTF-8 válido.', status: 400 };
  } finally {
    reader.releaseLock();
  }
}

export function crearServicio(cargarIndice, buscar) {
  return {
    async fetch(request) {
      const ruta = new URL(request.url).pathname;
      if (ruta === '/health' || ruta === '/') {
        if (request.method !== 'GET') {
          return json({ error: 'Usa GET.' }, 405, { Allow: 'GET' });
        }
        const indice = await cargarIndice();
        return json({
          status: 'ok', corpus: 'NFCorpus', documents: indice.documentos.length,
          source: 'https://huggingface.co/datasets/BeIR/nfcorpus',
          license: 'https://creativecommons.org/licenses/by-sa/4.0/',
        });
      }
      if (ruta !== '/search') return json({ error: 'Ruta no encontrada.' }, 404);
      if (request.method !== 'POST') {
        return json({ error: 'Usa POST.' }, 405, { Allow: 'POST' });
      }
      const tipo = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (tipo !== 'application/json') {
        return json({ error: 'Usa Content-Type: application/json.' }, 415);
      }

      const { datos, error, status } = await leerJson(request);
      if (error) return json({ error }, status);
      const { query, model, top_k } = datos ?? {};
      if (typeof query !== 'string' || !query.trim() || query.length > MAX_QUERY_LENGTH) {
        return json({ error: 'query debe contener entre 1 y 4096 caracteres.' }, 400);
      }
      if (model !== 'tfidf' && model !== 'bm25') {
        return json({ error: 'model debe ser tfidf o bm25.' }, 400);
      }
      if (!Number.isSafeInteger(top_k) || top_k < 1) {
        return json({ error: 'top_k debe ser un entero positivo.' }, 400);
      }

      const indice = await cargarIndice();
      return json({ model, results: buscar(indice, query, model, top_k) });
    },
  };
}
