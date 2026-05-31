# <img src="assets/icon.png" width="48" height="48" valign="middle"> Shutdown Timer Widget

Un widget de temporizador flotante, elegante y minimalista para macOS, Windows y Linux, diseñado con un estilo nativo (glassmorphism/translucidez) para programar el apagado del ordenador.

🌐 **Languages / Idiomas**:
- [Português (Brasil)](README.md)
- [English](README.en.md)
- [Español](README.es.md)


[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue?style=flat-square&logo=github)](https://github.com/arjosweb/shutdown-timer-widget)
![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat-square&logo=node.js&logoColor=white)

![Screenshot](screenshot.png)

## Características

- **Diseño Premium**: Interfaz moderna con efecto de desenfoque (blur), transparencia y bordes suaves.
- **Multiplataforma**: Soporte nativo para macOS. Las versiones para Windows y Linux están en fase *(Beta)*.
- **Temporizador Visual**: Cuenta regresiva clara con hora estimada de apagado.
- **Controles**: Iniciar, Parar, Reiniciar y Apagar Ahora.
- **Entradas Libres**: Defina horas, minutos y segundos según sea necesario.
- **Notificaciones**: Advertencia del sistema antes del apagado.
- **Seguro**: Ejecuta el comando de apagado nativo de cada sistema operativo.

## Requisitos previos

- macOS, Windows o Linux.
- Node.js instalado.

## Instalación

### macOS beta sin firmar

Esta compilación aún no está firmada/notarizada por Apple. Para instalar vía Terminal:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/arjosweb/shutdown-timer-widget/main/scripts/install-macos.sh)"
```

Alternativa para quienes ya tienen `wget` instalado:

```bash
wget -qO- https://raw.githubusercontent.com/arjosweb/shutdown-timer-widget/main/scripts/install-macos.sh | /bin/bash
```

El script descarga `downloads/macos/v-1.0.2.zip`, extrae el DMG, instala la app en `~/Applications`, elimina la cuarentena local y abre la app.

Para desinstalar la app instalada por este script:

1. Cierre **Shutdown Timer** si está abierto.
2. Abra **Finder**.
3. En el menú superior, haga clic en **Ir > Ir a la Carpeta...**.
4. Escriba `~/Applications` y presione **Enter**.
5. Busque **Shutdown Timer.app**.
6. Arrastre la app a la **Papelera**.
7. Vacíe la **Papelera** si desea eliminar definitivamente.

### Desarrollo

1. Clone el repositorio:
   ```bash
   git clone https://github.com/arjosweb/shutdown-timer-widget.git
   ```
2. Instale las dependencias:
   ```bash
   npm install
   ```

## Cómo ejecutar (Desarrollo)

Para iniciar el widget en modo de desarrollo:

```bash
npm start
```

> **Nota sobre permisos**: Al hacer clic en "Iniciar" o "Apagar", el sistema puede solicitar su contraseña de administrador o permiso de superusuario. Esto es necesario para ejecutar el comando de apagado del sistema operativo.

## Cómo generar los ejecutables (Build)

Para generar las versiones de distribución para diferentes plataformas:

- **macOS (.dmg)**:
  ```bash
  npm run pack:mac
  ```
- **Windows (.exe portable)**: *(Beta)*
  ```bash
  npm run pack:win
  ```
- **Linux (AppImage / .deb)**: *(Beta)*
  ```bash
  npm run pack:linux
  ```
- **Todas las plataformas**:
  ```bash
  npm run pack:all
  ```

Los archivos generados estarán en la carpeta `dist/`.

## Generar lanzamientos comprimidos (ZIP)

Para generar builds de macOS, Linux y Windows y organizar los archivos zip por plataforma:

```bash
npm run release:zip
```

El script ejecuta:
- build multiplataforma (`npm run pack:all`);
- filtro de artefactos en `dist/` (`.dmg`, `.AppImage`, `.exe`);
- creación de un `.zip` por artefacto;
- organización final en `downloads/`.

Estructura de salida esperada:

```text
downloads/
  macos/
    <archivo>.dmg.zip
  linux/
    <archivo>.AppImage.zip
  windows/
    <archivo>.exe.zip
```

Notas:
- En macOS, generar artefactos de Windows/Linux puede depender de toolchain adicional de cross-build.
- Si ya tiene artefactos en `dist/` y solo desea comprimir sin rebuild, ejecute:
  ```bash
  bash ./scripts/build-release-zips.sh --no-build
  ```
- Para uso local (cuando exista artefacto de una sola plataforma), permita la ausencia de los demás:
  ```bash
  bash ./scripts/build-release-zips.sh --no-build --allow-missing
  ```

## Estructura del proyecto

- `src/main.ts`: Proceso principal de Electron, gestiona la ventana y los eventos del sistema.
- `src/services/`: Lógica del temporizador e integración con los comandos del sistema (`shutdownService.ts`).
- `renderer/`: Interfaz de usuario (HTML/CSS).
- `src/renderer/`: Lógica de la interfaz de usuario en TypeScript.

---

## Desarrollado por

**ARJOS Tecnologia**
- **GitHub**: [arjosweb](https://github.com/arjosweb)

Este proyecto es **código abierto** bajo la licencia [MIT](LICENSE).
