import { ErrorHttp } from './error-http.js';

export function leerId(valor, entidad) {
  const id = Number(valor);
  if (!/^\d+$/.test(valor) || !Number.isSafeInteger(id) || id < 1) {
    throw new ErrorHttp(400, 'ID_INVALIDO', `El ID del ${entidad} debe ser un entero positivo`);
  }
  return id;
}
