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

### macOS beta unsigned

This build is not yet signed/notarized by Apple. To install via Terminal:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/arjosweb/shutdown-timer-widget/main/scripts/install-macos.sh)"
```

Alternative for those who already have `wget` installed:

```bash
wget -qO- https://raw.githubusercontent.com/arjosweb/shutdown-timer-widget/main/scripts/install-macos.sh | /bin/bash
```

The script downloads `downloads/macos/v-1.0.2.zip`, extracts the DMG, installs the app in `~/Applications`, removes local quarantine, and opens the app.

To uninstall the app installed by this script:

1. Close **Shutdown Timer** if it is open.
2. Open **Finder**.
3. In the top menu, click **Go > Go to Folder...**.
4. Type `~/Applications` and press **Enter**.
5. Locate **Shutdown Timer.app**.
6. Drag the app to **Trash**.
7. Empty the **Trash** if you want to permanently remove it.

### Development

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

## Generate Zip Releases

To generate macOS, Linux, and Windows builds and organize the zip files by platform:

```bash
npm run release:zip
```

The script runs:
- multi-platform build (`npm run pack:all`);
- filter artifacts in `dist/` (`.dmg`, `.AppImage`, `.exe`);
- create one `.zip` per artifact;
- final organization in `downloads/`.

Expected output structure:

```text
downloads/
  macos/
    <file>.dmg.zip
  linux/
    <file>.AppImage.zip
  windows/
    <file>.exe.zip
```

Notes:
- On macOS, generating Windows/Linux artifacts may require additional cross-build toolchain.
- If you already have artifacts in `dist/` and only want to zip without rebuilding, run:
  ```bash
  bash ./scripts/build-release-zips.sh --no-build
  ```
- For local use (when only one platform's artifact exists), allow the absence of the others:
  ```bash
  bash ./scripts/build-release-zips.sh --no-build --allow-missing
  ```

## Project Structure

- `src/main.ts`: Electron main process, manages the window and system events.
- `src/services/`: Timer logic and integration with system commands (`shutdownService.ts`).
- `renderer/`: User interface (HTML/CSS).
- `src/renderer/`: User interface logic in TypeScript.

---

## Developed by

**ARJOS Tecnologia**
- **GitHub**: [arjosweb](https://github.com/arjosweb)

This project is **Open Source** under the [MIT](LICENSE) license.
