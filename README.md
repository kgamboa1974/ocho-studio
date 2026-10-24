# OCHO Studio 1.2.0

Mezclador web de rutinas de cheerleading por bloques de ocho tiempos.

Demo: https://kgamboa1974.github.io/ocho-studio/

## Crear tu mezcla

- La vista inicial Cuentas de 8 tiene ocho columnas numeradas: cada celda es un tiempo (beat). Cada fila muestra su número y el tiempo transcurrido inicial/final.
- Importa MP3 desde Música, Efectos o Voces. Los archivos aparecen en la biblioteca con su duración en segundos y tiempos según el BPM.
- Arrastra cualquier sonido a una celda de cualquiera de las tres capas. Cuatro tiempos ocupan cuatro celdas. Si el clip pasa del tiempo 8, se muestra su continuación en la fila siguiente sin duplicar ni cortar el audio.
- Arrastra la línea azul para situar la reproducción en cualquier instante y fila. También puedes arrastrar la franja superior de cada fila o cambiar a la vista horizontal Pistas.
- Suelta el audio cerca de la línea azul para alinear su inicio exactamente con ella. También puedes usar Añadir en la línea o Alinear a la línea. Ajustar a celdas fija los inicios al comienzo de cada tiempo; desmárcalo para posiciones libres.
- En el inspector, ajusta el inicio en segundos, la duración en tiempos, recortes, volumen y fundidos.
- Exporta WAV o guarda el proyecto editable con sus audios. Autoriza el micrófono para grabar voces.

Los archivos se procesan en el navegador y el guardado automático usa IndexedDB del navegador y sitio actuales. Guarda copias descargables de tus proyectos para conservarlos o pasarlos a otro equipo. El tempo ajusta la cuadrícula y el clic sin cambiar la velocidad del audio.

Sitio estático sin dependencias de servidor ni cuentas de aplicación. Se verificaron con Chromium la importación MP3, el arrastre y alineación, la representación proporcional de duración, continuidad entre filas, persistencia, micrófono simulado, diseño móvil y exportación WAV audible. El micrófono físico y Safari no se han validado en un Mac real.

Publicación: Settings → Pages → Deploy from a branch → main → /(root) → Save.
