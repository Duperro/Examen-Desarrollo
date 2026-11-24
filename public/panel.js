const categorias = {
  PAJA: 'Paja',
  MANTA: 'Manta',
  AGUA: 'Agua',
  ALIMENTO_ANIMALES: 'Alimento para animales',
  LAMPARA_ACEITE: 'Lámpara de aceite',
};
const estados = {
  DISPONIBLE: 'Disponible',
  BAJO_STOCK: 'Stock bajo',
  AGOTADO: 'Agotado',
  REABASTECIMIENTO_PENDIENTE: 'Reabastecimiento pendiente',
};
const especies = { BUEY: 'Buey', MULA: 'Mula', OVEJA: 'Oveja' };
const fechaGuayaquil = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Guayaquil',
  dateStyle: 'short',
});
const porId = (id) => document.getElementById(id);
const dialogoClave = porId('dialogo-clave');
const dialogoOperacion = porId('dialogo-operacion');
const formularioOperacion = porId('formulario-operacion');
const enviarOperacion = porId('enviar-operacion');
const detalleOperacion = porId('detalle-operacion');
const errorOperacion = porId('error-operacion');

let clave = '';
let recursos = [];
let animales = [];
let datosCargados = false;
let cargaActual = 0;
let operacion;
let temporizadorAviso;
const eventos = [];

function nodo(etiqueta, texto, clase) {
  const elemento = document.createElement(etiqueta);
  if (texto !== undefined) elemento.textContent = texto;
  if (clase) elemento.className = clase;
  return elemento;
}

function boton(texto, accion, id) {
  const elemento = nodo('button', texto, 'boton boton-secundario');
  elemento.type = 'button';
  elemento.dataset.accion = accion;
  if (id !== undefined) elemento.dataset.id = id;
  return elemento;
}

function llenarOpciones(select, opciones) {
  for (const [valor, nombre] of Object.entries(opciones)) select.add(new Option(nombre, valor));
}

function rellenarCeldaNombre(fila, registro) {
  const celda = fila.insertCell();
  celda.append(nodo('strong', registro.nombre), nodo('small', `ID ${registro.id}`));
}

function vacio(tabla, columnas, mensaje) {
  const fila = tabla.insertRow();
  const celda = fila.insertCell();
  celda.colSpan = columnas;
  celda.className = 'vacio';
  celda.textContent = mensaje;
}

function mostrarRecursos() {
  const tabla = porId('filas-recursos');
  const nombre = porId('buscar-recurso').value.trim().toLocaleLowerCase('es');
  const categoria = porId('filtro-categoria').value;
  const estado = porId('filtro-estado').value;
  const visibles = recursos.filter((recurso) =>
    recurso.nombre.toLocaleLowerCase('es').includes(nombre)
    && (!categoria || recurso.categoria === categoria)
    && (!estado || recurso.estado === estado)
  );

  tabla.replaceChildren();
  if (!visibles.length) {
    const mensaje = recursos.length ? 'Ningún recurso coincide con los filtros.' : 'El inventario está vacío. Registra un recurso para empezar.';
    vacio(tabla, 6, datosCargados ? mensaje : 'El inventario no está disponible.');
    return;
  }
  for (const recurso of visibles) {
    const fila = tabla.insertRow();
    rellenarCeldaNombre(fila, recurso);
    fila.insertCell().textContent = categorias[recurso.categoria];
    fila.insertCell().textContent = recurso.cantidad;
    fila.insertCell().textContent = recurso.stockMinimo;
    const estadoVisual = nodo('span', estados[recurso.estado], 'pildora');
    estadoVisual.dataset.estado = recurso.estado;
    fila.insertCell().append(estadoVisual);

    const acciones = nodo('div', undefined, 'acciones-celda');
    acciones.append(boton('Detalle', 'detalle-recurso', recurso.id), boton('Reabastecer', 'reabastecimiento', recurso.id));
    fila.insertCell().append(acciones);
  }
}

function mostrarAnimales() {
  const tabla = porId('filas-animales');
  const especie = porId('filtro-especie').value;
  const visibles = animales.filter((animal) => !especie || animal.especie === especie);

  tabla.replaceChildren();
  if (!visibles.length) {
    const mensaje = animales.length ? 'Ningún animal coincide con esta especie.' : 'Todavía no hay animales registrados.';
    vacio(tabla, 5, datosCargados ? mensaje : 'La lista de animales no está disponible.');
    return;
  }
  for (const animal of visibles) {
    const fila = tabla.insertRow();
    rellenarCeldaNombre(fila, animal);
    fila.insertCell().textContent = especies[animal.especie];
    fila.insertCell().textContent = `${animal.racionDiaria} unid.`;
    fila.insertCell().textContent = animal.ultimaAlimentacion ?? 'Sin registro';
    const acciones = nodo('div', undefined, 'acciones-celda');
    acciones.append(boton('Alimentar', 'alimentacion', animal.id));
    fila.insertCell().append(acciones);
  }
}

function mostrarMetricas() {
  const hoy = fechaGuayaquil.format(new Date());
  porId('total-recursos').textContent = recursos.length;
  porId('total-bajo-stock').textContent = recursos.filter((recurso) => recurso.cantidad < recurso.stockMinimo).length;
  porId('total-pendientes').textContent = recursos.filter((recurso) => recurso.estado === 'REABASTECIMIENTO_PENDIENTE').length;
  porId('total-sin-alimentar').textContent = animales.filter((animal) => animal.ultimaAlimentacion !== hoy).length;
}

function mostrarAviso(mensaje, tipo = 'exito') {
  const aviso = porId('aviso');
  aviso.textContent = mensaje;
  aviso.dataset.tipo = tipo;
  aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { aviso.hidden = true; }, 8000);
}

function tipoRespuesta(estado) {
  if (estado === 202) return 'pendiente';
  if (estado >= 400) return 'error';
  return 'exito';
}

function registrarEvento(evento) {
  eventos.unshift(evento);
  if (eventos.length > 10) eventos.pop();
  const lista = porId('lista-actividad');
  lista.replaceChildren();
  for (const { metodo, ruta, estado, cuerpo, antes } of eventos) {
    const entrada = nodo('details', undefined, 'evento');
    const cabecera = nodo('summary');
    const pildora = nodo('span', estado, 'pildora');
    pildora.dataset.tipo = tipoRespuesta(estado);
    cabecera.append(pildora, nodo('code', `${metodo} ${ruta}`));
    entrada.append(cabecera);
    if (antes !== undefined && typeof cuerpo?.cantidad === 'number') {
      entrada.append(nodo('small', `Cantidad antes: ${antes} · Cantidad en la respuesta: ${cuerpo.cantidad}`));
    }
    entrada.append(nodo('pre', cuerpo ? JSON.stringify(cuerpo, null, 2) : 'Respuesta sin cuerpo'));
    lista.append(entrada);
  }
}

async function solicitar(metodo, ruta, { datos, protegida, registrar, antes } = {}) {
  const headers = { Accept: 'application/json' };
  if (datos !== undefined) headers['Content-Type'] = 'application/json';
  if (protegida) headers.Authorization = `Bearer ${clave}`;
  const respuesta = await fetch(ruta, {
    method: metodo,
    headers,
    body: datos === undefined ? undefined : JSON.stringify(datos),
    cache: 'no-store',
  });
  const estado = respuesta.status;
  const cuerpo = estado === 204 ? null : await respuesta.json();
  if (registrar) registrarEvento({ metodo, ruta, estado, cuerpo, antes });
  if (!respuesta.ok) {
    const detalles = (cuerpo?.detalles ?? []).map((detalle) => `${detalle.campo}: ${detalle.mensaje}`);
    throw new Error([`HTTP ${estado} · ${cuerpo?.mensaje ?? 'Solicitud rechazada'}`, ...detalles].join(' · '));
  }
  return { estado, cuerpo };
}

function mostrarConexion(estado, texto) {
  const conexion = porId('conexion');
  conexion.dataset.estado = estado;
  conexion.textContent = texto;
}

async function actualizarDatos({ avisar = false } = {}) {
  const version = ++cargaActual;
  porId('actualizar').disabled = true;
  mostrarConexion('cargando', 'Consultando API');
  try {
    const [inventario, establo] = await Promise.all([
      solicitar('GET', '/api/recursos'),
      solicitar('GET', '/api/animales'),
    ]);
    if (version !== cargaActual) return;
    recursos = inventario.cuerpo;
    animales = establo.cuerpo;
    datosCargados = true;
    mostrarMetricas();
    mostrarConexion('conectada', 'API conectada');
    if (avisar) mostrarAviso('Inventario y animales actualizados.');
  } catch {
    if (version !== cargaActual) return;
    mostrarConexion('error', 'API no disponible');
    mostrarAviso('No se pudo actualizar el panel. Comprueba que el servidor esté iniciado.', 'error');
  } finally {
    if (version === cargaActual) {
      mostrarRecursos();
      mostrarAnimales();
      porId('actualizar').disabled = false;
    }
  }
}

function actualizarAcceso() {
  porId('abrir-clave').textContent = clave ? 'Clave configurada' : 'Configurar clave';
  porId('quitar-clave').hidden = !clave;
}

function abrirClave() {
  if (dialogoOperacion.open) dialogoOperacion.close();
  porId('clave').value = '';
  dialogoClave.showModal();
}

function campo({ nombre, etiqueta, tipo = 'text', opciones, ...atributos }) {
  const grupo = nodo('div');
  const label = nodo('label', etiqueta);
  const entrada = nodo(opciones ? 'select' : 'input');
  entrada.id = `campo-${nombre}`;
  entrada.name = nombre;
  entrada.required = true;
  label.htmlFor = entrada.id;
  if (opciones) {
    entrada.add(new Option('Selecciona una opción', ''));
    llenarOpciones(entrada, opciones);
  } else {
    entrada.type = tipo;
    for (const [atributo, valor] of Object.entries(atributos)) entrada.setAttribute(atributo, valor);
  }
  grupo.append(label, entrada);
  return grupo;
}

function resetearOperacion(titulo) {
  porId('titulo-operacion').textContent = titulo;
  detalleOperacion.replaceChildren();
  porId('campos-operacion').replaceChildren();
  errorOperacion.hidden = true;
  operacion = undefined;
}

function abrirOperacion(configuracion) {
  if (configuracion.protegida && !clave) {
    abrirClave();
    return;
  }
  resetearOperacion(configuracion.titulo);
  operacion = configuracion;
  if (configuracion.descripcion) detalleOperacion.append(nodo('p', configuracion.descripcion));
  for (const definicion of configuracion.campos ?? []) {
    porId('campos-operacion').append(campo(definicion));
  }
  formularioOperacion.hidden = false;
  enviarOperacion.textContent = configuracion.boton ?? 'Guardar';
  enviarOperacion.classList.toggle('boton-peligro', configuracion.metodo === 'DELETE');
  enviarOperacion.classList.toggle('boton-primario', configuracion.metodo !== 'DELETE');
  if (!dialogoOperacion.open) dialogoOperacion.showModal();
  (formularioOperacion.querySelector('input, select') ?? enviarOperacion).focus();
}

const cantidad = (min) => ({ nombre: 'cantidad', etiqueta: 'Cantidad', tipo: 'number', min, step: 1 });
const operacionesNuevas = {
  'nuevo-recurso': {
    titulo: 'Nuevo recurso',
    metodo: 'POST',
    ruta: '/api/recursos',
    protegida: true,
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', minlength: 2, maxlength: 60, placeholder: 'Paja para el pesebre' },
      { nombre: 'categoria', etiqueta: 'Categoría', opciones: categorias },
      cantidad(0),
      { nombre: 'stockMinimo', etiqueta: 'Stock mínimo', tipo: 'number', min: 1, step: 1 },
    ],
  },
  'nuevo-animal': {
    titulo: 'Nuevo animal',
    metodo: 'POST',
    ruta: '/api/animales',
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', placeholder: 'Lucero' },
      { nombre: 'especie', etiqueta: 'Especie', opciones: especies },
      { nombre: 'racionDiaria', etiqueta: 'Ración diaria', tipo: 'number', min: 1, max: 10, step: 1 },
    ],
  },
};

async function mostrarDetalle(id) {
  try {
    const { cuerpo: recurso } = await solicitar('GET', `/api/recursos/${id}`, { registrar: true });
    if (dialogoOperacion.open || dialogoClave.open) return;
    resetearOperacion(recurso.nombre);
    const campos = nodo('dl', undefined, 'datos-detalle');
    for (const [etiqueta, valor] of [
      ['ID', recurso.id],
      ['Categoría', categorias[recurso.categoria]],
      ['Cantidad', recurso.cantidad],
      ['Stock mínimo', recurso.stockMinimo],
      ['Estado', estados[recurso.estado]],
    ]) {
      const grupo = nodo('div');
      grupo.append(nodo('dt', etiqueta), nodo('dd', valor));
      campos.append(grupo);
    }
    const acciones = nodo('div', undefined, 'dialogo-botones');
    acciones.append(boton('Consumir', 'consumo', id), boton('Reabastecer', 'reabastecimiento', id), boton('Eliminar', 'eliminar', id));
    detalleOperacion.append(campos, acciones);
    formularioOperacion.hidden = true;
    dialogoOperacion.showModal();
  } catch (error) {
    mostrarAviso(error.message, 'error');
  }
}

function operarRegistro(accion, id) {
  if (accion === 'alimentacion') {
    const animal = animales.find((registro) => registro.id === id);
    if (!animal) return;
    abrirOperacion({
      titulo: `Alimentar a ${animal.nombre}`,
      descripcion: `La ración diaria es de ${animal.racionDiaria} unidades.`,
      boton: 'Alimentar',
      metodo: 'PATCH',
      ruta: `/api/animales/${id}/alimentacion`,
    });
    return;
  }

  const recurso = recursos.find((registro) => registro.id === id);
  if (!recurso) return;
  const rutaBase = `/api/recursos/${id}`;
  if (accion === 'eliminar') {
    abrirOperacion({
      titulo: `Eliminar ${recurso.nombre}`,
      descripcion: 'El recurso debe tener cero unidades para poder eliminarlo.',
      boton: 'Eliminar recurso',
      metodo: 'DELETE',
      ruta: rutaBase,
      protegida: true,
    });
    return;
  }

  const reabastecimiento = accion === 'reabastecimiento';
  abrirOperacion({
    titulo: `${reabastecimiento ? 'Reabastecer' : 'Consumir'} · ${recurso.nombre}`,
    descripcion: `Existencias actuales: ${recurso.cantidad} unidades.`,
    boton: reabastecimiento ? 'Solicitar reabastecimiento' : 'Registrar consumo',
    metodo: 'PATCH',
    ruta: `${rutaBase}/${accion}`,
    protegida: true,
    campos: [cantidad(1)],
    consultarAntes: reabastecimiento ? rutaBase : undefined,
  });
}

porId('formulario-clave').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const entrada = porId('clave');
  const valor = entrada.value.trim();
  if (!valor) {
    entrada.setCustomValidity('Escribe la clave Bearer.');
    entrada.reportValidity();
    return;
  }
  clave = valor;
  entrada.value = '';
  actualizarAcceso();
  dialogoClave.close();
  mostrarAviso('Clave guardada en esta pestaña.');
});
porId('clave').addEventListener('input', (evento) => evento.target.setCustomValidity(''));
dialogoClave.addEventListener('close', () => {
  porId('clave').value = '';
  porId('clave').setCustomValidity('');
});

function bloquearOperacion(bloqueada) {
  for (const control of dialogoOperacion.querySelectorAll('button, input, select')) {
    control.disabled = bloqueada;
  }
}

formularioOperacion.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (!operacion || enviarOperacion.disabled) return;
  const actual = operacion;
  const entradas = [...formularioOperacion.querySelectorAll('input, select')];
  const datos = entradas.length ? Object.fromEntries(entradas.map((entrada) => [
    entrada.name,
    entrada.type === 'number' ? entrada.valueAsNumber : entrada.value.trim(),
  ])) : undefined;

  bloquearOperacion(true);
  errorOperacion.hidden = true;
  try {
    const previo = actual.consultarAntes ? await solicitar('GET', actual.consultarAntes) : undefined;
    const { estado, cuerpo } = await solicitar(actual.metodo, actual.ruta, {
      datos,
      protegida: actual.protegida,
      registrar: true,
      antes: previo?.cuerpo.cantidad,
    });
    dialogoOperacion.close();
    const mensaje = estado === 202 ? cuerpo.mensaje : 'Operación completada';
    mostrarAviso(`HTTP ${estado} · ${mensaje}.`, tipoRespuesta(estado));
    actualizarDatos();
  } catch (error) {
    errorOperacion.textContent = error.message;
    errorOperacion.hidden = false;
  } finally {
    bloquearOperacion(false);
  }
});

dialogoOperacion.addEventListener('cancel', (evento) => {
  if (enviarOperacion.disabled) evento.preventDefault();
});

document.addEventListener('click', (evento) => {
  const control = evento.target.closest('[data-accion]');
  if (!control) return;
  const { accion } = control.dataset;
  const id = Number(control.dataset.id);

  if (accion === 'cerrar') control.closest('dialog').close();
  else if (accion === 'clave') abrirClave();
  else if (accion === 'quitar-clave') {
    clave = '';
    actualizarAcceso();
    dialogoClave.close();
    mostrarAviso('Clave retirada de esta pestaña.');
  } else if (accion === 'actualizar') actualizarDatos({ avisar: true });
  else if (operacionesNuevas[accion]) abrirOperacion(operacionesNuevas[accion]);
  else if (accion === 'detalle-recurso') mostrarDetalle(id);
  else operarRegistro(accion, id);
});

function actualizarNavegacion() {
  const seccion = location.hash || '#resumen';
  for (const enlace of document.querySelectorAll('.navegacion a')) {
    if (enlace.hash === seccion) enlace.setAttribute('aria-current', 'location');
    else enlace.removeAttribute('aria-current');
  }
}

llenarOpciones(porId('filtro-categoria'), categorias);
llenarOpciones(porId('filtro-estado'), estados);
llenarOpciones(porId('filtro-especie'), especies);
porId('buscar-recurso').addEventListener('input', mostrarRecursos);
porId('filtro-categoria').addEventListener('change', mostrarRecursos);
porId('filtro-estado').addEventListener('change', mostrarRecursos);
porId('filtro-especie').addEventListener('change', mostrarAnimales);
window.addEventListener('hashchange', actualizarNavegacion);
actualizarNavegacion();
actualizarDatos();
