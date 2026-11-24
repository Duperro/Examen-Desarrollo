export function responderJson(respuesta, estado, datos, encabezados = {}) {
  if (datos === undefined) {
    respuesta.writeHead(estado, encabezados);
    respuesta.end();
    return;
  }

  const cuerpo = JSON.stringify(datos);
  respuesta.writeHead(estado, { ...encabezados, 'Content-Type': 'application/json; charset=utf-8' });
  respuesta.end(cuerpo);
}
