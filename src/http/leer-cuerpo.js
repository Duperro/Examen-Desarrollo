import { ErrorHttp } from './error-http.js';

const LIMITE_JSON = 64 * 1024;

export async function leerCuerpoJson(solicitud) {
  const tipo = solicitud.headers['content-type']?.split(';', 1)[0].trim().toLowerCase();
  if (tipo !== 'application/json') {
    throw new ErrorHttp(400, 'FORMATO_INVALIDO', 'Envía el cuerpo como application/json');
  }

  const fragmentos = [];
  let bytes = 0;
  for await (const fragmento of solicitud.iterator({ destroyOnReturn: false })) {
    bytes += fragmento.length;
    if (bytes > LIMITE_JSON) {
      solicitud.resume();
      throw new ErrorHttp(400, 'FORMATO_INVALIDO', 'El cuerpo JSON supera 64 KiB');
    }
    fragmentos.push(fragmento);
  }

  let cuerpo;
  try {
    cuerpo = JSON.parse(Buffer.concat(fragmentos).toString('utf8'));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new ErrorHttp(400, 'FORMATO_INVALIDO', 'El cuerpo contiene JSON inválido');
  }

  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    throw new ErrorHttp(400, 'FORMATO_INVALIDO', 'El cuerpo debe ser un objeto JSON');
  }
  return cuerpo;
}
