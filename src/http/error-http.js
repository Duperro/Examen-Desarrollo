import { responderJson } from './json.js';

export class ErrorHttp extends Error {
  constructor(estado, codigo, mensaje, detalles = []) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export function responderError(respuesta, ruta, error) {
  if (!(error instanceof ErrorHttp)) {
    console.error(error);
    error = new ErrorHttp(500, 'ERROR_INTERNO', 'Ocurrió un error interno');
  }

  if (error.estado === 401) {
    respuesta.setHeader('WWW-Authenticate', 'Bearer');
  }

  responderJson(respuesta, error.estado, {
    codigo: error.codigo,
    mensaje: error.message,
    detalles: error.detalles,
    timestamp: new Date().toISOString(),
    ruta,
  });
}
