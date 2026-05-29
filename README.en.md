# <img src="assets/icon.png" width="48" height="48" valign="middle"> Shutdown Timer Widget

An elegant and minimalist floating timer widget for macOS, Windows, and Linux, designed with a native style (glassmorphism/translucency) to schedule computer shutdowns.

🌐 **Languages / Idiomas**:
- [Português (Brasil)](README.md)
- [English](README.en.md)
- [Español](README.es.md)

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue?style=flat-square&logo=github)](https://github.com/arjosweb/shutdown-timer-widget)
![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat-square&logo=node.js&logoColor=white)

![Screenshot](screenshot.png)

## Features

- **Premium Design**: Modern interface with blur effect, transparency, and smooth borders.
- **Multiplatform**: Native support for macOS. Windows and Linux versions are in *(Beta)*.
- **Visual Timer**: Clear countdown with estimated shutdown time.
- **Controls**: Start, Stop, Restart, and Shutdown Now.
- **Free Inputs**: Define hours, minutes, and seconds as needed.
- **Notifications**: System warning notification before shutdown.
- **Secure**: Executes the native shutdown command for each operating system.

## Prerequisites

- macOS, Windows, or Linux.
- Node.js installed.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/arjosweb/shutdown-timer-widget.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## How to Run (Development)

To start the widget in development mode:

```bash
npm start
```

> **Note on Permissions**: When clicking "Start" or "Shutdown", the system may request your administrator password or superuser permission. This is necessary to execute the operating system's shutdown command.

## How to Generate Executables (Build)

To generate distribution versions for different platforms:

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
- **All Platforms**:
  ```bash
  npm run pack:all
  ```

The generated files will be in the `dist/` folder.

## Project Structure

- `src/main.ts`: Electron main process, manages the window and system events.
- `src/services/`: Timer logic and integration with system commands (`shutdownService.ts`).
- `renderer/`: User interface (HTML/CSS).
- `src/renderer/`: User interface logic in TypeScript.

---

## Developed by

**Artur Medeiros (ARJOS Tech)**
- **Email**: [contato@arjos.com.br](mailto:contato@arjos.com.br)
- **GitHub**: [arjosweb](https://github.com/arjosweb)

This project is **Open Source** under the [MIT](LICENSE) license.
