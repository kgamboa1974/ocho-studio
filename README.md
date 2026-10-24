# OCHO Studio

Mezclador web de rutinas de cheerleading por bloques de ocho tiempos. Solo contiene la aplicación OCHO; no incluye el código de REA ni credenciales.

## Publicar la demo

En este repositorio: Settings → Pages → Deploy from a branch → main → /(root) → Save.

La dirección prevista es https://kgamboa1974.github.io/ocho-studio/ cuando GitHub confirme la publicación.

## Probar

Reproduce la mezcla de ejemplo. Desde Efectos, importa uno o varios MP3 propios y arrástralos a Música, Efectos o Voces. Los archivos siguen visibles en la biblioteca; los clips pueden moverse entre pistas y ajustarse en el inspector. Exporta el resultado como WAV o guarda el proyecto editable con sus audios. Autoriza el micrófono para grabar voces.

Los archivos se procesan en el navegador y el guardado automático usa IndexedDB del navegador actual. Guarda copias descargables de tus proyectos para conservarlos o pasarlos a otro equipo. El tempo ajusta la cuadrícula y el clic, sin cambiar la velocidad del audio.

Sitio estático sin dependencias de servidor ni cuentas de aplicación. Pruebas de Chromium completadas para reproducción, importación MP3 múltiple, arrastre y movimiento entre pistas, persistencia, reapertura de proyectos, micrófono simulado y exportación WAV audible. El micrófono físico y Safari no se han validado en un Mac real.
