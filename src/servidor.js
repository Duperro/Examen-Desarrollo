import { createServer } from 'node:http';
import { crearAplicacion } from './aplicacion.js';
import { leerConfiguracion } from './configuracion.js';

try {
  const configuracion = leerConfiguracion();
  const servidor = createServer(crearAplicacion(configuracion));
  servidor.on('error', (error) => {
    console.error(`No se pudo iniciar la API. ${error.message}`);
    process.exitCode = 1;
  });
  servidor.listen(configuracion.puerto, '127.0.0.1', () => {
    console.log(`API del pesebre disponible en http://127.0.0.1:${configuracion.puerto}`);
  });
} catch (error) {
  console.error(`No se pudo iniciar la API. ${error.message}`);
  process.exitCode = 1;
}
