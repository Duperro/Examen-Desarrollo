export function crearRepositorioEnMemoria() {
  const registros = new Map();
  let siguienteId = 1;

  return {
    crear(datos) {
      const id = siguienteId++;
      const registro = Object.freeze({ ...datos, id });
      registros.set(id, registro);
      return registro;
    },
    listar() {
      return [...registros.values()];
    },
    buscarPorId(id) {
      return registros.get(id);
    },
    guardar(registro) {
      const actualizado = Object.freeze({ ...registro });
      registros.set(actualizado.id, actualizado);
      return actualizado;
    },
    eliminar(id) {
      registros.delete(id);
    },
  };
}
