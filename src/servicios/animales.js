import { ErrorHttp } from '../http/error-http.js';

const ESPECIES = new Set(['BUEY', 'MULA', 'OVEJA']);
const FORMATO_FECHA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Guayaquil',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function fechaLocal(fecha) {
  const partes = FORMATO_FECHA.formatToParts(fecha);
  const { year, month, day } = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${year}-${month}-${day}`;
}

export function crearServicioDeAnimales(repositorio, inventario, ahora = () => new Date()) {
  return {
    registrar({ nombre, especie, racionDiaria }) {
      const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
      const detalles = [];
      if (nombreLimpio.length === 0) {
        detalles.push({ campo: 'nombre', mensaje: 'Debe ser un texto no vacío' });
      }
      if (!ESPECIES.has(especie)) {
        detalles.push({ campo: 'especie', mensaje: 'Elige BUEY, MULA u OVEJA' });
      }
      if (!Number.isInteger(racionDiaria) || racionDiaria < 1 || racionDiaria > 10) {
        detalles.push({ campo: 'racionDiaria', mensaje: 'Debe ser un entero entre 1 y 10' });
      }
      if (detalles.length > 0) {
        throw new ErrorHttp(400, 'DATOS_INVALIDOS', 'Revisa los datos del animal', detalles);
      }

      return repositorio.crear({ nombre: nombreLimpio, especie, racionDiaria, ultimaAlimentacion: null });
    },
    listar(especie) {
      if (especie === undefined) return repositorio.listar();
      if (!ESPECIES.has(especie)) {
        throw new ErrorHttp(400, 'FILTROS_INVALIDOS', 'Revisa el filtro de animales', [
          { campo: 'especie', mensaje: 'Elige BUEY, MULA u OVEJA' },
        ]);
      }
      return repositorio.listar().filter((animal) => animal.especie === especie);
    },
    alimentar(id) {
      const animal = repositorio.buscarPorId(id);
      if (!animal) {
        throw new ErrorHttp(404, 'ANIMAL_INEXISTENTE', `No existe el animal ${id}`);
      }

      const hoy = fechaLocal(ahora());
      if (animal.ultimaAlimentacion === hoy) {
        throw new ErrorHttp(422, 'ANIMAL_YA_ALIMENTADO', 'El animal ya fue alimentado hoy');
      }

      const alimento = inventario.listar({ categoria: 'ALIMENTO_ANIMALES' })
        .find((recurso) => recurso.cantidad >= animal.racionDiaria);
      if (!alimento) {
        throw new ErrorHttp(409, 'STOCK_INSUFICIENTE', 'No hay alimento suficiente para cubrir la ración');
      }

      inventario.consumir(alimento.id, animal.racionDiaria);
      return repositorio.guardar({ ...animal, ultimaAlimentacion: hoy });
    },
  };
}
