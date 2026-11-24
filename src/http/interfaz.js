import { readFile } from 'node:fs/promises';

const archivos = new Map([
  ['/', ['../../public/index.html', 'text/html; charset=utf-8']],
  ['/panel.css', ['../../public/panel.css', 'text/css; charset=utf-8']],
  ['/panel.js', ['../../public/panel.js', 'text/javascript; charset=utf-8']],
  ['/docs/arquitectura.png', ['../../docs/arquitectura.png', 'image/png']],
]);

export async function servirInterfaz(solicitud, respuesta, ruta) {
  const archivo = archivos.get(ruta);
  if (!archivo || !['GET', 'HEAD'].includes(solicitud.method)) return false;

  const [ubicacion, tipo] = archivo;
  const contenido = await readFile(new URL(ubicacion, import.meta.url));
  respuesta.writeHead(200, {
    'Content-Type': tipo,
    'Content-Length': contenido.length,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  });
  respuesta.end(solicitud.method === 'HEAD' ? undefined : contenido);
  return true;
}
