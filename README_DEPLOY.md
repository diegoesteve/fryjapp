# Instrucciones de Despliegue - JuliEsteve

¡Tu aplicación está lista para ser publicada!

La carpeta `dist` contiene todos los archivos optimizados y necesarios para el sitio web.

## Opciones de Publicación Gratuita

### 1. Netlify (Recomendado)
1. Ve a [Netlify Drop](https://app.netlify.com/drop).
2. Arrastra la carpeta `dist` generada dentro del recuadro en la página.
3. ¡Listo! Tu sitio estará online en segundos.

### 2. Vercel
1. Instala Vercel CLI: `npm i -g vercel` (si tienes Node.js) o usa la web.
2. Ejecuta `vercel` dentro de la carpeta `dist`.

### 3. GitHub Pages
1. Sube el contenido de `dist` a un repositorio en GitHub.
2. Ve a Settings > Pages y selecciona la rama principal.

## Contenido del Build
- `index.html`: Página principal.
- `styles.css`: Estilos visuales.
- `script.js`: Lógica de la aplicación.
- `assets/`: Imágenes y recursos.

_Generado por Antigravity_
