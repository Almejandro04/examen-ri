import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { crearServicio } from './api.mjs';
import { buscar } from './motor.mjs';

const archivoIndice = new URL('./indice.json.gz', import.meta.url);
const indice = JSON.parse(gunzipSync(readFileSync(archivoIndice)).toString('utf8'));
const servicio = crearServicio(() => indice, buscar);

export function servir(host, puerto) {
  const servidor = createServer(async (req, res) => {
    try {
      const init = { method: req.method, headers: req.headers };
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        Object.assign(init, { body: Readable.toWeb(req), duplex: 'half' });
      }
      const request = new Request(new URL(req.url, 'http://localhost'), init);
      const respuesta = await servicio.fetch(request);
      res.writeHead(respuesta.status, Object.fromEntries(respuesta.headers));
      res.end(Buffer.from(await respuesta.arrayBuffer()));
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"error":"Error interno."}');
    }
  });
  servidor.listen(puerto, host);
  return servidor;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.HOST ?? '127.0.0.1';
  const servidor = servir(host, Number(process.env.PORT ?? 8080));
  await once(servidor, 'listening');
  console.log(`http://${host}:${servidor.address().port}`);
}
