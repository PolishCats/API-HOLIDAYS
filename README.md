# NEW-API

Dashboard web que consume la API de feriados de Colombia y visualiza los datos con Plotly.

## Ejecutar en local

1. Verifica que tienes Node.js 18+.
2. Ejecuta `npm start`.
3. Abre `http://localhost:3000`.

Si el puerto 3000 está ocupado, el servidor intentará automáticamente 3001, 3002, etc. Usa la URL que aparece en la consola.

El frontend consulta `/api/holidays`, y el servidor local hace proxy hacia `https://api-colombia.com/api/v1/Holiday`.
Si ese endpoint no está disponible (404), el servidor usa respaldo automático con `date.nager.at` para Colombia.

## Archivos principales

- `index.html`: estructura de la página.
- `styles.css`: estilos responsive y diseño visual.
- `app.js`: renderizado de tablas, métricas y gráficas en Plotly.
- `server.js`: servidor HTTP local + proxy de API.
