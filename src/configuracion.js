export const ENCARGADO_PESEBRE = 'ENCARGADO_PESEBRE';
export const PASTOR = 'PASTOR';

export function leerConfiguracion(entorno = process.env) {
  const puerto = Number(entorno.PUERTO ?? '3000');
  const encargado = entorno.API_KEY_ENCARGADO_PESEBRE?.trim();
  const pastor = entorno.API_KEY_PASTOR?.trim();
  const urlMercado = entorno.MERCADO_SOAP_URL?.trim();

  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65_535) {
    throw new Error('PUERTO debe ser un entero entre 1 y 65535');
  }
  if (!/^\S+$/.test(encargado ?? '') || !/^\S+$/.test(pastor ?? '')) {
    throw new Error('Configura API_KEY_ENCARGADO_PESEBRE y API_KEY_PASTOR sin espacios');
  }
  if (encargado === pastor) {
    throw new Error('Las claves de ENCARGADO_PESEBRE y PASTOR deben ser distintas');
  }

  if (urlMercado) {
    const url = URL.parse(urlMercado);
    if (!url || !['http:', 'https:'].includes(url.protocol)) {
      throw new Error('MERCADO_SOAP_URL debe ser una URL HTTP o HTTPS');
    }
  }

  return {
    puerto,
    clavesPorRol: { 
      [ENCARGADO_PESEBRE]: encargado, 
      [PASTOR]: pastor 
    },
    mercadoSoap: { 
      url: urlMercado, 
      accion: entorno.MERCADO_SOAP_ACTION?.trim() 
    },
  };
}
