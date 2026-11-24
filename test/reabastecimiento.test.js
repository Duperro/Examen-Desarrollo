import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { crearAplicacion } from '../src/aplicacion.js';
import { leerConfiguracion } from '../src/configuracion.js';

const SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const MERCADO = 'http://belen.beatlech/mercado';

async function iniciar(t, manejarSolicitud) {
  const servidor = createServer(manejarSolicitud);
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(() => new Promise((resolver) => {
    servidor.close(resolver);
    servidor.closeAllConnections();
  }));
  return `http://127.0.0.1:${servidor.address().port}`;
}

async function iniciarMercado(t, responder) {
  return iniciar(t, async (solicitud, respuesta) => {
    const fragmentos = [];
    for await (const fragmento of solicitud) fragmentos.push(fragmento);
    const xml = Buffer.concat(fragmentos).toString('utf8');
    const documento = new DOMParser().parseFromString(xml, 'text/xml');
    const operacion = documento.getElementsByTagNameNS(MERCADO, 'ConsultarExistenciasRequest').item(0);
    const categoria = operacion?.getElementsByTagNameNS(MERCADO, 'categoria').item(0)?.textContent;
    const cantidad = Number(operacion?.getElementsByTagNameNS(MERCADO, 'cantidad').item(0)?.textContent);
    await responder({ operacion, categoria, cantidad, solicitud, respuesta });
  });
}

function responderSoap(respuesta, resultado, estado = 200) {
  const contenido = resultado === 'FAULT'
    ? '<s:Fault><faultcode>s:Server</faultcode><faultstring>Mercado cerrado</faultstring></s:Fault>'
    : `<m:ConsultarExistenciasResponse><m:resultado>${resultado}</m:resultado></m:ConsultarExistenciasResponse>`;
  respuesta.writeHead(estado, { 'Content-Type': 'text/xml; charset=utf-8' });
  respuesta.end(`<s:Envelope xmlns:s="${SOAP}" xmlns:m="${MERCADO}"><s:Body>${contenido}</s:Body></s:Envelope>`);
}

async function iniciarApi(t, urlMercado, accion) {
  const encargado = randomUUID();
  const pastor = randomUUID();
  const configuracion = leerConfiguracion({
    API_KEY_ENCARGADO_PESEBRE: encargado,
    API_KEY_PASTOR: pastor,
    MERCADO_SOAP_URL: urlMercado,
    MERCADO_SOAP_ACTION: accion,
  });
  const url = await iniciar(t, crearAplicacion(configuracion));

  async function solicitar(metodo, ruta, datos, clave) {
    const headers = {};
    if (datos !== undefined) headers['Content-Type'] = 'application/json';
    if (clave) headers.Authorization = `Bearer ${clave}`;
    const respuesta = await fetch(url + ruta, {
      method: metodo,
      headers,
      body: datos === undefined ? undefined : JSON.stringify(datos),
      signal: AbortSignal.timeout(5_500),
    });
    return {
      estado: respuesta.status,
      datos: respuesta.status === 204 ? undefined : await respuesta.json(),
    };
  }

  return {
    solicitar,
    encargado,
    pastor,
    async crear(cantidad) {
      const respuesta = await solicitar('POST', '/api/recursos', {
        nombre: 'Paja de prueba',
        categoria: 'PAJA',
        cantidad,
        stockMinimo: 5,
      }, encargado);
      assert.equal(respuesta.estado, 201);
      return `/api/recursos/${respuesta.datos.id}`;
    },
    reabastecer(ruta, cantidad) {
      return solicitar('PATCH', `${ruta}/reabastecimiento`, { cantidad }, encargado);
    },
  };
}

test('envía SOAP 1.1 y guarda el resultado correcto para existencias, rechazo y Fault', async (t) => {
  const consultas = [];
  const accion = 'urn:ConsultarExistencias';
  const mercado = await iniciarMercado(t, ({ operacion, categoria, cantidad, solicitud, respuesta }) => {
    consultas.push({
      categoria,
      cantidad,
      metodo: solicitud.method,
      ruta: solicitud.url,
      cuerpoSoap: operacion?.parentNode.namespaceURI === SOAP && operacion.parentNode.localName === 'Body',
      accion: solicitud.headers.soapaction,
      tipo: solicitud.headers['content-type'],
      autorizacion: solicitud.headers.authorization,
    });
    if (cantidad === 30) return responderSoap(respuesta, 'SIN_EXISTENCIAS');
    if (cantidad === 999) return responderSoap(respuesta, 'FAULT', 500);
    if (cantidad === 998) return responderSoap(respuesta, 'FAULT');
    if (cantidad === 997) return respuesta.end('<respuesta-mal-formada');
    responderSoap(respuesta, 'DISPONIBLE');
  });
  const api = await iniciarApi(t, mercado + '/soap', accion);
  const ruta = await api.crear(2);
  const reabastecimiento = `${ruta}/reabastecimiento`;

  assert.equal((await api.solicitar('PATCH', reabastecimiento, { cantidad: 20 })).estado, 401);
  assert.equal((await api.solicitar('PATCH', reabastecimiento, { cantidad: 20 }, api.pastor)).estado, 403);
  assert.equal((await api.reabastecer(ruta, 0)).estado, 400);
  assert.equal((await api.reabastecer('/api/recursos/99', 20)).estado, 404);
  assert.equal(consultas.length, 0);

  const exito = await api.reabastecer(ruta, 20);
  assert.equal(exito.estado, 200);
  assert.equal(exito.datos.cantidad, 22);
  assert.equal(exito.datos.estado, 'DISPONIBLE');
  assert.deepEqual(consultas[0], {
    categoria: 'PAJA',
    cantidad: 20,
    metodo: 'POST',
    ruta: '/soap',
    cuerpoSoap: true,
    accion: `"${accion}"`,
    tipo: 'text/xml; charset=utf-8',
    autorizacion: undefined,
  });

  const rechazo = await api.reabastecer(ruta, 30);
  assert.equal(rechazo.estado, 422);
  assert.equal(rechazo.datos.codigo, 'SIN_EXISTENCIAS');
  assert.equal(rechazo.datos.ruta, reabastecimiento);
  assert.ok(Array.isArray(rechazo.datos.detalles));
  assert.equal((await api.solicitar('GET', ruta)).datos.cantidad, 22);

  for (const cantidad of [999, 998, 997]) {
    const pendiente = await api.reabastecer(ruta, cantidad);
    assert.equal(pendiente.estado, 202);
    assert.equal(pendiente.datos.estado, 'REABASTECIMIENTO_PENDIENTE');
    assert.equal(pendiente.datos.cantidad, 22);
    assert.match(pendiente.datos.mensaje, /pendiente/);
  }
  const { datos: almacenado } = await api.solicitar('GET', ruta);
  assert.equal(almacenado.estado, 'REABASTECIMIENTO_PENDIENTE');
  assert.equal(almacenado.cantidad, 22);
  const recuperado = await api.reabastecer(ruta, 1);
  assert.equal(recuperado.estado, 200);
  assert.equal(recuperado.datos.estado, 'DISPONIBLE');
  assert.equal(recuperado.datos.cantidad, 23);
});

test('vence a los tres segundos incluso cuando ya llegaron los encabezados', async (t) => {
  const mercado = await iniciarMercado(t, ({ cantidad, respuesta }) => {
    if (cantidad === 2) {
      respuesta.writeHead(200, { 'Content-Type': 'text/xml' });
      respuesta.write(`<s:Envelope xmlns:s="${SOAP}">`);
    }
  });
  const api = await iniciarApi(t, mercado);
  const ruta = await api.crear(4);
  const inicio = performance.now();
  const respuestas = await Promise.all([api.reabastecer(ruta, 1), api.reabastecer(ruta, 2)]);
  assert.ok(performance.now() - inicio >= 2_900);
  for (const respuesta of respuestas) {
    assert.equal(respuesta.estado, 202);
    assert.equal(respuesta.datos.cantidad, 4);
    assert.equal(respuesta.datos.estado, 'REABASTECIMIENTO_PENDIENTE');
  }
  assert.equal((await api.solicitar('GET', ruta)).datos.estado, 'REABASTECIMIENTO_PENDIENTE');
});

test('aplica la respuesta SOAP sobre el stock que dejó un consumo simultáneo', async (t) => {
  const consultaRecibida = Promise.withResolvers();
  const liberarMercado = Promise.withResolvers();
  const mercado = await iniciarMercado(t, async ({ respuesta }) => {
    consultaRecibida.resolve();
    await liberarMercado.promise;
    responderSoap(respuesta, 'DISPONIBLE');
  });
  const api = await iniciarApi(t, mercado);
  const ruta = await api.crear(10);
  const solicitud = api.reabastecer(ruta, 2);
  await Promise.race([consultaRecibida.promise, solicitud.then(() => assert.fail('El Mercado no recibió la consulta'))]);
  try {
    const consumo = await api.solicitar('PATCH', `${ruta}/consumo`, { cantidad: 9 }, api.encargado);
    assert.equal(consumo.estado, 200);
    assert.equal(consumo.datos.cantidad, 1);
  } finally {
    liberarMercado.resolve();
  }

  const respuesta = await solicitud;
  assert.equal(respuesta.estado, 200);
  assert.equal(respuesta.datos.cantidad, 3);
  assert.equal(respuesta.datos.estado, 'BAJO_STOCK');
});
