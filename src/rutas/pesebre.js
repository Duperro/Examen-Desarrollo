import { ENCARGADO_PESEBRE } from '../configuracion.js';

const recursos = /^\/api\/recursos$/;
const recurso = /^\/api\/recursos\/(?<id>[^/]+)$/;
const animales = /^\/api\/animales$/;

export function crearBuscadorDeRutas({ controladorRecursos, controladorAnimales }) {
  const rutas = [
    { 
      metodo: 'POST', 
      patron: recursos, 
      rol: ENCARGADO_PESEBRE, 
      recibeJson: true, 
      controlador: controladorRecursos.registrar 
    },
    { 
      metodo: 'GET', 
      patron: recursos, 
      controlador: controladorRecursos.listar 
    },
    { 
      metodo: 'GET', 
      patron: recurso, 
      controlador: controladorRecursos.obtener 
    },
    {
      metodo: 'PATCH',
      patron: /^\/api\/recursos\/(?<id>[^/]+)\/consumo$/,
      rol: ENCARGADO_PESEBRE,
      recibeJson: true,
      controlador: controladorRecursos.consumir,
    },
    {
      metodo: 'PATCH',
      patron: /^\/api\/recursos\/(?<id>[^/]+)\/reabastecimiento$/,
      rol: ENCARGADO_PESEBRE,
      recibeJson: true,
      controlador: controladorRecursos.reabastecer,
    },
    { 
      metodo: 'DELETE', 
      patron: recurso, 
      rol: ENCARGADO_PESEBRE, 
      controlador: controladorRecursos.eliminar 
    },
    { 
      metodo: 'POST', 
      patron: animales, 
      recibeJson: true, 
      controlador: controladorAnimales.registrar 
    },
    { 
      metodo: 'GET', 
      patron: animales, 
      controlador: controladorAnimales.listar 
    },
    {
      metodo: 'PATCH',
      patron: /^\/api\/animales\/(?<id>[^/]+)\/alimentacion$/,
      controlador: controladorAnimales.alimentar,
    },
  ];

  return function buscarRuta(metodo, ruta) {
    for (const definicion of rutas) {
      if (definicion.metodo !== metodo) continue;
      const coincidencia = definicion.patron.exec(ruta);
      if (coincidencia) {
        const { controlador, rol, recibeJson } = definicion;
        return { controlador, rol, recibeJson, parametros: coincidencia.groups ?? {} };
      }
    }
  };
}
