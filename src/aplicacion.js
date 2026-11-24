import { crearControladorDeAnimales } from './controladores/animales.js';
import { crearControladorDeRecursos } from './controladores/recursos.js';
import { crearRepositorioEnMemoria } from './datos/repositorio-en-memoria.js';
import { ErrorHttp, responderError } from './http/error-http.js';
import { responderJson } from './http/json.js';
import { leerCuerpoJson } from './http/leer-cuerpo.js';
import { MercadoAdapter } from './integraciones/mercado-adapter.js';
import { crearVerificadorDeRol } from './middleware/seguridad.js';
import { crearBuscadorDeRutas } from './rutas/pesebre.js';
import { crearServicioDeAnimales } from './servicios/animales.js';
import { crearServicioDeRecursos } from './servicios/recursos.js';

export function crearAplicacion({ clavesPorRol, mercadoSoap }) {
  const verificarRol = crearVerificadorDeRol(clavesPorRol);
  const mercado = new MercadoAdapter(mercadoSoap);
  const servicioRecursos = crearServicioDeRecursos(crearRepositorioEnMemoria(), mercado);
  const servicioAnimales = crearServicioDeAnimales(crearRepositorioEnMemoria(), servicioRecursos);
  const buscarRuta = crearBuscadorDeRutas({
    controladorRecursos: crearControladorDeRecursos(servicioRecursos),
    controladorAnimales: crearControladorDeAnimales(servicioAnimales),
  });

  return async function atenderSolicitud(solicitud, respuesta) {
    const [ruta] = solicitud.url.split('?', 1);

    try {
      const operacion = buscarRuta(solicitud.method, ruta);
      if (!operacion) {
        throw new ErrorHttp(404, 'RUTA_INEXISTENTE', 'La ruta solicitada no existe');
      }
      if (operacion.rol) {
        verificarRol(solicitud.headers.authorization, operacion.rol);
      }

      const cuerpo = operacion.recibeJson ? await leerCuerpoJson(solicitud) : undefined;
      const consulta = new URLSearchParams(solicitud.url.slice(ruta.length));
      const { estado, datos, encabezados } = await operacion.controlador({
        cuerpo,
        consulta,
        parametros: operacion.parametros,
      });
      responderJson(respuesta, estado, datos, encabezados);
    } catch (error) {
      responderError(respuesta, ruta, error);
    }
  };
}
