# Proveedores de precios

Un proveedor es cualquier objeto con esta forma:

```js
{
  id: 'mi-super',
  nombre: 'Mi Super',
  tipo: 'api' | 'scraper' | 'simulado',
  competidor: { id, nombre, sitio, pais, moneda, regiones, permite_consulta_automatizada, condiciones },
  async buscar(texto, { limite }) { return [/* publicaciones */] }
}
```

Cada publicación devuelta debe tener: `sku, titulo, marca, categoria, precio_regular,
precio_promocional, promocion, moneda, disponible, regiones, url, publicado`.

Reglas para una fuente real:
- Respetar `robots.txt` y los términos de uso. Si no permiten consulta automatizada,
  poner `permite_consulta_automatizada: false` (el agente la omite y lo informa).
- Nunca completar precios faltantes: si no hay precio, no se devuelve la publicación.
- Siempre devolver la `url` original para que el precio sea verificable.
