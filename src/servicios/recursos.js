import { ErrorHttp } from '../http/error-http.js';

const CATEGORIAS = new Set(['PAJA', 'MANTA', 'AGUA', 'ALIMENTO_ANIMALES', 'LAMPARA_ACEITE']);
const ESTADOS = new Set(['DISPONIBLE', 'BAJO_STOCK', 'AGOTADO', 'REABASTECIMIENTO_PENDIENTE']);

function enteroDesde(valor, minimo) {
  return Number.isSafeInteger(valor) && valor >= minimo;
}

function validarCantidadPositiva(cantidad, operacion) {
  if (!enteroDesde(cantidad, 1)) {
    throw new ErrorHttp(400, 'DATOS_INVALIDOS', `Revisa la cantidad del ${operacion}`, [
      { campo: 'cantidad', mensaje: 'Debe ser un entero mayor o igual a 1' },
    ]);
  }
}

function calcularEstado(cantidad, stockMinimo) {
  if (cantidad === 0) return 'AGOTADO';
  if (cantidad < stockMinimo) return 'BAJO_STOCK';
  return 'DISPONIBLE';
}

export function crearServicioDeRecursos(repositorio, mercado) {
  function obtener(id) {
    const recurso = repositorio.buscarPorId(id);
    if (!recurso) {
      throw new ErrorHttp(404, 'RECURSO_INEXISTENTE', `No existe el recurso ${id}`);
    }
    return recurso;
  }

  function guardarCantidad(recurso, cantidad) {
    return repositorio.guardar({
      ...recurso,
      cantidad,
      estado: calcularEstado(cantidad, recurso.stockMinimo),
    });
  }

  return {
    registrar({ nombre, categoria, cantidad, stockMinimo }) {
      const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
      const longitudNombre = [...nombreLimpio].length;
      const detalles = [];
      if (longitudNombre < 2 || longitudNombre > 60) {
        detalles.push({ campo: 'nombre', mensaje: 'Debe ser un texto de 2 a 60 caracteres' });
      }
      if (!CATEGORIAS.has(categoria)) {
        detalles.push({ campo: 'categoria', mensaje: 'Elige una categoría válida' });
      }
      if (!enteroDesde(cantidad, 0)) {
        detalles.push({ campo: 'cantidad', mensaje: 'Debe ser un entero mayor o igual a 0' });
      }
      if (!enteroDesde(stockMinimo, 1)) {
        detalles.push({ campo: 'stockMinimo', mensaje: 'Debe ser un entero mayor o igual a 1' });
      }
      if (detalles.length > 0) {
        throw new ErrorHttp(400, 'DATOS_INVALIDOS', 'Revisa los datos del recurso', detalles);
      }

      const nombreNormalizado = nombreLimpio.toLowerCase();
      if (repositorio.listar().some((recurso) => recurso.nombre.toLowerCase() === nombreNormalizado)) {
        throw new ErrorHttp(409, 'NOMBRE_DUPLICADO', 'Ya existe un recurso con ese nombre');
      }

      return repositorio.crear({
        nombre: nombreLimpio,
        categoria,
        cantidad,
        stockMinimo,
        estado: calcularEstado(cantidad, stockMinimo),
      });
    },
    listar({ categoria, estado }) {
      const detalles = [];
      if (categoria !== undefined && !CATEGORIAS.has(categoria)) {
        detalles.push({ campo: 'categoria', mensaje: 'Elige una categoría válida' });
      }
      if (estado !== undefined && !ESTADOS.has(estado)) {
        detalles.push({ campo: 'estado', mensaje: 'Elige un estado válido' });
      }
      if (detalles.length > 0) {
        throw new ErrorHttp(400, 'FILTROS_INVALIDOS', 'Revisa los filtros de recursos', detalles);
      }

      return repositorio.listar().filter((recurso) =>
        (categoria === undefined || recurso.categoria === categoria)
        && (estado === undefined || recurso.estado === estado)
      );
    },
    obtener,
    consumir(id, cantidad) {
      validarCantidadPositiva(cantidad, 'consumo');
      const recurso = obtener(id);
      if (cantidad > recurso.cantidad) {
        throw new ErrorHttp(409, 'STOCK_INSUFICIENTE', 'El consumo supera la cantidad disponible');
      }

      return guardarCantidad(recurso, recurso.cantidad - cantidad);
    },
    async reabastecer(id, cantidad) {
      validarCantidadPositiva(cantidad, 'reabastecimiento');
      const { categoria } = obtener(id);
      const resultado = await mercado.consultarExistencias({ categoria, cantidad });

      // El inventario pudo cambiar mientras se esperaba la respuesta del Mercado.
      const recurso = obtener(id);
      if (resultado === 'SIN_EXISTENCIAS') {
        throw new ErrorHttp(422, 'SIN_EXISTENCIAS', 'El Mercado de Belén no tiene las unidades solicitadas');
      }
      if (resultado !== 'DISPONIBLE') {
        const pendiente = repositorio.guardar({ ...recurso, estado: 'REABASTECIMIENTO_PENDIENTE' });
        return { recurso: pendiente, pendiente: true };
      }

      const total = recurso.cantidad + cantidad;
      if (!Number.isSafeInteger(total)) {
        throw new ErrorHttp(422, 'CANTIDAD_FUERA_DE_RANGO', 'La cantidad resultante supera el límite del inventario');
      }
      return { recurso: guardarCantidad(recurso, total), pendiente: false };
    },
    eliminar(id) {
      const recurso = obtener(id);
      if (recurso.cantidad > 0) {
        throw new ErrorHttp(409, 'RECURSO_CON_STOCK', 'El recurso aún tiene existencias');
      }
      repositorio.eliminar(id);
    },
  };
}
