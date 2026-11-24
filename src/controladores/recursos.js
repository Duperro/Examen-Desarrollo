import { leerId } from '../http/leer-id.js';

export function crearControladorDeRecursos(servicio) {
  return {
    registrar({ cuerpo }) {
      const recurso = servicio.registrar(cuerpo);
      return {
        estado: 201,
        datos: recurso,
        encabezados: { Location: `/api/recursos/${recurso.id}` },
      };
    },
    listar({ consulta }) {
      const filtros = {
        categoria: consulta.get('categoria') ?? undefined,
        estado: consulta.get('estado') ?? undefined,
      };
      return { estado: 200, datos: servicio.listar(filtros) };
    },
    obtener({ parametros }) {
      const id = leerId(parametros.id, 'recurso');
      return { estado: 200, datos: servicio.obtener(id) };
    },
    consumir({ parametros, cuerpo }) {
      const id = leerId(parametros.id, 'recurso');
      return { estado: 200, datos: servicio.consumir(id, cuerpo.cantidad) };
    },
    async reabastecer({ parametros, cuerpo }) {
      const id = leerId(parametros.id, 'recurso');
      const { recurso, pendiente } = await servicio.reabastecer(id, cuerpo.cantidad);
      if (pendiente) {
        return {
          estado: 202,
          datos: { ...recurso, mensaje: 'Reabastecimiento pendiente de confirmación' },
        };
      }
      return { estado: 200, datos: recurso };
    },
    eliminar({ parametros }) {
      const id = leerId(parametros.id, 'recurso');
      servicio.eliminar(id);
      return { estado: 204 };
    },
  };
}
