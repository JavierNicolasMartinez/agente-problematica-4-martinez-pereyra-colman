/**
 * Punto de entrada del backend.
 *   npm start     → levanta la API en http://127.0.0.1:3001
 *   npm run dev   → igual, pero se reinicia al guardar cambios
 */
import { crearApp } from './src/app.js';
import { config } from './src/config.js';
import { catalogo } from './src/repositorios/catalogoRepositorio.js';

const app = crearApp();

const invalidas = catalogo.filasInvalidas();
if (invalidas.length) console.warn(`[catálogo] ${invalidas.length} filas inválidas ignoradas (líneas ${invalidas.slice(0, 10).join(', ')}).`);

app.listen(config.puerto, config.host, () => {
  console.log(`Agente de precios Ragnar escuchando en http://${config.host}:${config.puerto}`);
  console.log(`Catálogo: ${catalogo.total()} productos.`);
});
