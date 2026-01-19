# Guía de Gestión: Agregar Tratamientos y Profesionales

Actualmente, la información de la aplicación se gestiona directamente en el archivo `script.js`. Sigue estos pasos para agregar nuevo contenido.

## 1. Abrir el archivo de configuración
Abre el archivo `script.js` ubicado en la carpeta principal de tu proyecto.
Busca al principio del archivo la sección `const state = { ... }`.

## 2. Agregar un Nuevo Tratamiento (Servicio)
Dentro de `state`, busca la lista `services: [ ... ]`.
Para agregar uno nuevo, añade un bloque como este al final de la lista (asegúrate de poner una coma `,` después del anterior):

```javascript
{ 
    id: 5, // Asegúrate de que este ID sea único (sigue la numeración)
    name: "Nuevo Tratamiento", 
    duration: 60, // Duración en minutos
    price: 1500, // Precio
    icon: "sparkles", // Icono (ver lista abajo)
    description: "Descripción breve del servicio." 
}
```

**Iconos disponibles**: `sparkles`, `sun`, `gem`, `heart`, `star`, `moon`, `feather`.
(Puedes ver más iconos en [Lucide Icons](https://lucide.dev/icons)).

## 3. Agregar un Nuevo Profesional
Dentro de `state`, busca la lista `professionals: [ ... ]`.
Añade un nuevo bloque al final:

```javascript
{ 
    id: 4, // ID único
    name: "Nombre del Profesional", 
    specialty: "Especialidad", 
    serviceIds: [1, 5] // IMPORTANTE: Lista de IDs de los servicios que realiza
}
```

> **Nota Importante**: En `serviceIds`, debes poner los números (`id`) de los tratamientos que este profesional puede realizar. Si agregaste un servicio con ID 5, asegúrate de incluir el `5` aquí para que aparezca disponible.

## 4. Guardar y Publicar
1.  Guarda los cambios en `script.js` (`Ctrl + S`).
2.  Si ya publicaste la web, necesitarás regenerar la carpeta `dist` y volver a subirla.
