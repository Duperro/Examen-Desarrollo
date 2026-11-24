import { leerId } from '../http/leer-id.js';

export function crearControladorDeAnimales(servicio) {
  return {
    registrar({ cuerpo }) {
      return { estado: 201, datos: servicio.registrar(cuerpo) };
    },
    listar({ consulta }) {
      const especie = consulta.get('especie') ?? undefined;
      return { estado: 200, datos: servicio.listar(especie) };
    },
    alimentar({ parametros }) {
      const id = leerId(parametros.id, 'animal');
      return { estado: 200, datos: servicio.alimentar(id) };
    },
  };
}
