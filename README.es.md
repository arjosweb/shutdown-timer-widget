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

## Estructura del proyecto

- `src/main.ts`: Proceso principal de Electron, gestiona la ventana y los eventos del sistema.
- `src/services/`: Lógica del temporizador e integración con los comandos del sistema (`shutdownService.ts`).
- `renderer/`: Interfaz de usuario (HTML/CSS).
- `src/renderer/`: Lógica de la interfaz de usuario en TypeScript.

---

## Desarrollado por

**Artur Medeiros (ARJOS Tech)**
- **Correo electrónico**: [contato@arjos.com.br](mailto:contato@arjos.com.br)
- **GitHub**: [arjosweb](https://github.com/arjosweb)

Este proyecto es **código abierto** bajo la licencia [MIT](LICENSE).
