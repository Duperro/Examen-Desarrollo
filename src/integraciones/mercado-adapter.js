import { DOMParser, onErrorStopParsing } from '@xmldom/xmldom';

const SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const MERCADO = 'http://belen.beatlech/mercado';
const TIEMPO_LIMITE_MS = 3_000;
const LIMITE_RESPUESTA = 64 * 1024;

async function leerXml(cuerpo) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let xml = '';

  for await (const fragmento of cuerpo) {
    total += fragmento.byteLength;
    if (total > LIMITE_RESPUESTA) throw new Error('Respuesta SOAP demasiado grande');
    xml += decoder.decode(fragmento, { stream: true });
  }

  return xml + decoder.decode();
}

function interpretarRespuesta(xml) {
  const documento = new DOMParser({ onError: onErrorStopParsing }).parseFromString(xml, 'text/xml');
  const envoltura = documento.documentElement;
  if (documento.doctype || envoltura?.namespaceURI !== SOAP || envoltura.localName !== 'Envelope') {
    return null;
  }

  const cuerpo = Array.from(envoltura.getElementsByTagNameNS(SOAP, 'Body'))
    .find((elemento) => elemento.parentNode === envoltura);
  if (!cuerpo || cuerpo.getElementsByTagNameNS(SOAP, 'Fault').length > 0) return null;

  const resultados = cuerpo.getElementsByTagNameNS(MERCADO, 'resultado');
  if (resultados.length !== 1) return null;

  const resultado = resultados.item(0).textContent.trim();
  if (resultado === 'DISPONIBLE' || resultado === 'SIN_EXISTENCIAS') return resultado;
  return null;
}

export class MercadoAdapter {
  constructor({ url, accion = '' } = {}) {
    this.url = url;
    this.accion = accion;
  }

  async consultarExistencias({ categoria, cantidad }) {
    if (!this.url) return null;

    // El servicio entrega una categoría del enum y una cantidad entera validada.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${SOAP}" xmlns:mb="${MERCADO}">
  <soapenv:Body>
    <mb:ConsultarExistenciasRequest>
      <mb:categoria>${categoria}</mb:categoria>
      <mb:cantidad>${cantidad}</mb:cantidad>
    </mb:ConsultarExistenciasRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const respuesta = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${this.accion}"` },
        body: xml,
        redirect: 'error',
        signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      });
      if (!respuesta.ok) {
        await respuesta.body?.cancel();
        return null;
      }
      return interpretarRespuesta(await leerXml(respuesta.body));
    } catch {
      return null;
    }
  }
}
