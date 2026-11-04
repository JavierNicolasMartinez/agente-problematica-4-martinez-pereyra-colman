/**
 * Configuración central. Todo valor ajustable se lee de variables de entorno
 * con un valor por defecto seguro. Ver backend/.env.example.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function entero(valor, porDefecto) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

export const config = Object.freeze({
  entorno: process.env.NODE_ENV || 'development',
  puerto: entero(process.env.PORT, 3001),
  host: process.env.HOST || '127.0.0.1',
  origenesPermitidos: (process.env.ORIGENES_PERMITIDOS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map((o) => o.trim()).filter(Boolean),
  rutaCatalogo: path.join(raiz, 'data', 'catalogo_ragnar.csv'),
  rutaFuentes: path.join(raiz, 'data', 'fuentes'),
  rutaTiposCambio: path.join(raiz, 'data', 'tipos_cambio.json'),
  rutaFrontend: process.env.RUTA_FRONTEND || path.join(raiz, '..', 'frontend', 'dist'),
  // Análisis
  umbralSignificativoPct: entero(process.env.UMBRAL_SIGNIFICATIVO_PCT, 10),
  toleranciaEnLineaPct: 1,
  // Límites de uso
  maxProductosPorConsulta: entero(process.env.MAX_PRODUCTOS_POR_CONSULTA, 120),
  maxLargoMensaje: 500,
  maxSesiones: 500,
  maxInformesPorSesion: 25,
  vidaSesionMs: 1000 * 60 * 60 * 2,
  consultasPorMinuto: entero(process.env.CONSULTAS_POR_MINUTO, 30),
});
