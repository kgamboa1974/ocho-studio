# OCHO Studio 1.3.0

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

## Teclado y edición por tramos

- Haz clic en un clip y pulsa ⌫ (Delete de Mac / Backspace). Fn+Delete también funciona. Se quita el clip, no el archivo de la biblioteca.
- Mantén el botón derecho mientras arrastras la línea azul o la franja de la fila para seleccionar parte del audio. Control+arrastre también selecciona un tramo.
- El panel de edición situado debajo de la cuadrícula permite elegir el clip seleccionado, una pista o todas las pistas y borrar el tramo, silenciarlo, cambiar su volumen o aplicar entrada/salida gradual.
- Borrar un tramo deja un hueco y conserva la posición y el audio anterior/posterior. Los efectos quedan incluidos al guardar el proyecto o exportar WAV.
- Esc quita la selección. ⌘Z o el botón Deshacer recupera las últimas ediciones de esta sesión. El historial no se conserva después de recargar. Los atajos de audio se desactivan mientras escribes en un campo.

La versión 1.3.0 se verificó con 9 pruebas del motor y pruebas de Chromium para selección, edición, persistencia y audio PCM exportado.
