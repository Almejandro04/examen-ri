import { servicio } from './servidor.mjs';

export function paraRuta(ruta) {
  return {
    fetch(request) {
      const destino = new URL(ruta, request.url);
      return servicio.fetch(new Request(destino, request));
    },
  };
}
