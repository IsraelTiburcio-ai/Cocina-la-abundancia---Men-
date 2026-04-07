# Cocina La Abundancia — Deploy automático en GitHub Pages

## Cómo funciona el deploy automático
- El sitio se publica automáticamente con GitHub Actions.
- Cada `push` a la rama `main` dispara el workflow de deploy.
- El workflow publica el sitio estático desde la raíz del proyecto.
- Luego valida que carguen assets críticos (`Portada.png`, `styles.css`, `script.js`, `menu-data.js` y archivos de `Menú V2`).

## Cómo actualizar promociones
- Edita textos y secciones visibles en `index.html`.
- Haz commit y push a `main`.
- GitHub Pages publicará los cambios automáticamente.

## Cómo cambiar precios
- Edita precios y disponibilidad en `menu-data.js`.
- Haz commit y push a `main`.
- El deploy corre solo y publica los cambios.

## Cómo cambiar imágenes
- Reemplaza imágenes en la raíz o en `Menú V2`.
- Si cambian nombres, actualiza referencias en `index.html` y/o `styles.css`.
- Haz commit y push a `main`.

## Nota importante
- Cualquier push a `main` publica cambios automáticamente.
- Si GitHub Pages falla por acentos o espacios en nombres de archivos/rutas, la siguiente fase será normalizar nombres a ASCII y actualizar referencias.
