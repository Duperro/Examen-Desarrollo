import { createHash, timingSafeEqual } from 'node:crypto';
import { ErrorHttp } from '../http/error-http.js';

function hash(clave) {
  return createHash('sha256').update(clave).digest();
}

export function crearVerificadorDeRol(clavesPorRol) {
  const hashes = Object.entries(clavesPorRol).map(([rol, clave]) => [rol, hash(clave)]);

  return function verificarRol(autorizacion, rolRequerido) {
    const token = /^Bearer[ \t]+(\S+)$/i.exec(autorizacion ?? '')?.[1];
    if (!token) {
      throw new ErrorHttp(401, 'TOKEN_REQUERIDO', 'Envía una API key en Authorization como Bearer');
    }

    const hashToken = hash(token);
    const credencial = hashes.find(([, hashClave]) => timingSafeEqual(hashClave, hashToken));
    if (!credencial) {
      throw new ErrorHttp(401, 'TOKEN_INVALIDO', 'La API key no es válida');
    }
    if (credencial[0] !== rolRequerido) {
      throw new ErrorHttp(403, 'ROL_INSUFICIENTE', `Se requiere el rol ${rolRequerido}`);
    }
  };
}
