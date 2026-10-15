# Enigma2

Siga y controle sus **receptores Enigma2 de satélite, cable o TDT** (VU+,
Dreambox, Zgemma, Octagon, GigaBlue, Edision…) desde Gladys, por su red local,
a través de su interfaz web **OpenWebif**: enciéndalos o póngalos en reposo,
ajuste el volumen, cambie de canal entre sus favoritos, vea el canal y el
programa en pantalla, sepa cuándo hay una grabación en curso y muestre un
mensaje en la televisión cuando llamen a la puerta.

> **Desarrollada sin el hardware: sus comentarios son bienvenidos.** Esta
> integración se ha escrito y probado con las respuestas documentadas por
> OpenWebif y con respuestas reales publicadas por los proyectos Home Assistant
> y openwebifpy, no con un receptor real. Si algo no funciona como se
> describe, indíquelo en el
> [foro de Gladys](https://community.gladysassistant.com) o en las
> [issues](https://github.com/guim31/gladys-enigma2/issues).

Esta integración no está relacionada con ningún fabricante de receptores.

## Lo que necesita

- Gladys Assistant 5.1.0 o posterior.
- Un receptor con una imagen **Enigma2** (openATV, OpenPLi, OpenViX, VTi,
  Dreambox OS con OpenWebif…) y el plugin **OpenWebif**, instalado y activo en
  la mayoría de imágenes. Abra `http://<dirección del receptor>/` en un
  navegador: si aparece la página de OpenWebif, la integración podrá
  alcanzarla.
- El receptor y Gladys en la misma red. Una dirección IP fija para el receptor
  (reserva DHCP en su router) evita sorpresas.
- Si OpenWebif pide un inicio de sesión: el usuario (normalmente `root`) y su
  contraseña.

## Configuración

En Gladys, **Integraciones → Instalar desde GitHub**, y después abra la
integración **Enigma2** y su pestaña **Configuración**. Hasta tres receptores,
cada uno con:

- **Dirección**: la dirección IP o el nombre del receptor, por ejemplo
  `192.168.1.20`. Añada `https://` delante para HTTPS, y `:puerto` detrás si
  OpenWebif no escucha en el puerto estándar (`192.168.1.20:8080`).
- **Usuario** y **Contraseña**: solo si OpenWebif pide un inicio de sesión. Si
  solo se rellena la contraseña, se usa el usuario `root`.
- **Nombre**: el nombre del dispositivo en Gladys; vacío, la marca y el modelo
  que indica el receptor.

Las opciones son comunes a todos los receptores:

- **Aceptar un certificado autofirmado**: OpenWebif sirve HTTPS con un
  certificado autofirmado. Márquelo solo para sus propios receptores.
- **Bouquet de favoritos**: el bouquet de TV ofrecido como lista de canales,
  por su nombre tal como lo muestra el receptor. Vacío: el primer bouquet de TV.
- **Intervalo de actualización**: 10 segundos, 30 segundos (por defecto) o
  1 minuto.
- **Idioma de los textos**: los nombres de las funciones dados al añadir un
  dispositivo y los textos publicados como estados (canal, programa). Francés
  por defecto.

Guarde y pulse **Probar los receptores**: una línea por receptor, con su
modelo, su versión de OpenWebif y el número de canales encontrados, o lo que ha
fallado. Después vaya a la pestaña **Descubrimiento** y añada cada receptor a
Gladys.

## El dispositivo de cada receptor

Un dispositivo por receptor, reconocido por la dirección MAC que indica (el
mismo dispositivo aunque cambie su dirección).

| Función                       | Qué hace                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| Encendido / reposo            | Encendido o **en reposo**. Nunca se usa el reposo profundo: ya no se podría despertar el receptor. |
| Volumen                       | El volumen del receptor, de 0 a 100 %.                                                             |
| Subir / bajar volumen         | Botones, un paso cada uno.                                                                         |
| Silenciar                     | Un botón: cada pulsación quita o devuelve el sonido.                                               |
| Canal siguiente / bajar canal | Botones, dentro del bouquet de favoritos (del último canal se vuelve al primero).                  |
| Último canal                  | Un botón: vuelve al canal visto justo antes.                                                       |
| Número de canal               | La posición del canal en el bouquet de favoritos; escribir un número cambia a ese canal.           |
| Canales favoritos             | La lista de canales del bouquet: elegir uno cambia a ese canal.                                    |
| Canal actual                  | Su nombre, «En reposo» o «Inaccesible».                                                            |
| Programa actual               | Inicio, fin y título, según la guía de programas del receptor.                                     |
| Programa siguiente            | Lo mismo para el programa siguiente.                                                               |
| Grabación en curso            | Sí mientras el receptor graba (también desde el reposo).                                           |

Un receptor que no responde a dos lecturas seguidas (apagado, en reposo
profundo, desconectado de la red) se muestra en reposo con el canal
«Inaccesible», hasta que vuelva a responder.

## Panel

El widget **Receptor Enigma2** muestra, para el receptor elegido en sus
ajustes: el canal y los programas actual y siguiente, el volumen (en directo),
el estado, la grabación y el sonido, y cuatro botones:
**Encendido / reposo**, **Canal −**, **Canal +** y **Silenciar**. En reposo,
solo queda el botón de encendido.

Las funciones del dispositivo también se pueden colocar en los widgets de
dispositivos habituales: el control de volumen, la lista de canales, los
botones del mando.

## Escenas

### Disparadores

Ninguno, a propósito: cualquier cambio que merezca esperarse es un estado del
dispositivo, que el editor de escenas ya ofrece («el receptor se enciende»,
«empieza la grabación», «el canal actual es…»).

### Acciones

- **Mostrar un mensaje en la TV**: un texto sobre la imagen, como información,
  advertencia o alerta, durante un número de segundos dado (0: hasta cerrarlo
  con el mando). El texto admite variables de escena.
- **Cambiar de canal**: por su número en el bouquet de favoritos o por su
  nombre (sin tener en cuenta mayúsculas ni acentos, basta el principio del
  nombre). Su salida, el nombre del canal, sirve para las acciones siguientes
  de la escena.

La acción habitual **Controlar un dispositivo** maneja el encendido y el
volumen.

### Ideas de escenas

- **Timbre**: cuando llamen a la puerta, mostrar «Hay alguien en la puerta» en
  la TV durante 15 segundos, como advertencia.
- **Buenas noches**: a la 1:00, si el receptor sigue encendido, ponerlo en
  reposo.
- **Hora del telediario**: a las 20:00 entre semana, si el receptor está
  encendido, cambiar a su canal de noticias.
- **Lavadora**: cuando baje la potencia del enchufe de la lavadora, mostrar
  «La colada ha terminado» en la TV.

## Actualización y carga

La integración lee ella misma cada receptor, con el intervalo elegido: una
llamada a `/api/statusinfo`, más `/api/getcurrent` (guía de programas) cuando
está encendido — dos pequeñas peticiones a un dispositivo de su red local, sin
cuota ni nube. El bouquet de favoritos se vuelve a leer cada hora (y con
**Probar los receptores**). Solo se envían los cambios a Gladys, más un valor
sin cambios cada seis horas. Un receptor solo se lee una vez añadido su
dispositivo a Gladys.

## Solución de problemas

- **«Ningún receptor responde»**: compruebe la dirección en un navegador desde
  un ordenador de la misma red; compruebe que OpenWebif está activo en el
  receptor (Menú → Plugins). Un receptor en reposo profundo no responde.
- **«Un receptor rechaza el usuario o la contraseña»**: OpenWebif pide un
  inicio de sesión; rellene el usuario (normalmente `root`) y la contraseña
  del receptor.
- **Falla el HTTPS**: marque **Aceptar un certificado autofirmado**, o use la
  dirección HTTP.
- **Lista de canales vacía o incorrecta**: rellene el **Bouquet de favoritos**
  con el nombre exacto de un bouquet de TV del receptor, pulse **Probar los
  receptores** y actualice el dispositivo en la pestaña Descubrimiento.
- **«Sin guía de programas»**: el receptor no tiene datos EPG para ese canal
  (frecuente en algunos canales locales o de radio).
- Registros detallados: `LOG_LEVEL=debug` en el contenedor de la integración.

## Límites

- Desarrollada sin el hardware: probada con respuestas de OpenWebif
  documentadas y publicadas, no con un receptor real.
- Hasta tres receptores. Solo se ofrecen los bouquets de TV, 200 canales como
  máximo.
- Un receptor en **reposo profundo** no se puede despertar por la red (la
  mayoría no admite Wake-on-LAN): use el reposo.
- Los receptores no se descubren automáticamente: introduzca su dirección.
- Sin logotipo de canal (picon) ni captura de pantalla, sin gestión de
  temporizadores.
- Los nombres de las funciones se fijan al añadir el dispositivo: cambie el
  idioma antes de añadirlo.
