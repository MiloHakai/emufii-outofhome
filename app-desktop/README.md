# Emufii Desktop

**Desktop Version adapted and worked by [Noobiez16](https://github.com/Noobiez16)**

**Play your emulators online with friends, using a six-character code.**<br>
Desktop edition of Emufii supporting **Windows**, **Linux (amd64 + arm64)**, and **macOS (x64 + arm64)**.

---

## Essence & Design Direction

Emufii Desktop faithfully preserves the design contract, aesthetics, and interaction mechanics of the project:

- **"HOME MENU" Aesthetic**: A handheld console's home menu rather than an ordinary desktop app.
  - Three floors: **Day** (cold silver `#E6E9EE`), **Night** (blued black `#0F1218`), and **OLED** (pure black `#000000`).
  - **Moulded Plastic Plates**: Real vertical drop shadows (`0 28px 70px -20px`), lit top bevels (`inset 0 1px 0`), hairline edge borders, and 0.97 press scaling.
  - **Signature Teal Accent** (same as Android) with 3 cuts: Bright for the cursor (`#3FCFC0`, `#5CE0D2` on dark shells), Deep for primary fills on light shells (`#0E9C8F`), and Ink (`#0A4A44`) for text on accent. Optional custom accents (Coral, Cyan, Purple, Green, Yellow, Red, Blue).
  - **Rounded M+ 1c Typography**: Locally bundled Rounded M+ font weights (Regular, Medium, Bold, ExtraBold, Black).
  - **Zero-Latency Sound Effects Engine**: Built on the Web Audio API playing the original interface audio (`sfx_hover`, `sfx_click`, `sfx_confirm`, `sfx_pop`, `sfx_notify`, `sfx_toggle`, `sfx_tick`).
  - **Spring Physics & Screen Blooms**: Mathematical spring pulsations matching the trailer motion (`morph`, `enter`, `exit`, `rise`, `pop`, `cursor`, `tint`, `draw`).
  - **Built for keyboard and mouse**: hover feedback, right-click menus, drag and drop, shortcuts, and a focus ring that only shows up when you navigate with the keyboard. A gamepad still works (D-pad / stick to move, A to confirm, B to go back).

---

## Keyboard and mouse

| Action | Shortcut |
| --- | --- |
| Search the library | `Ctrl+F` or `/` |
| Join a session with a code | `Ctrl+J` |
| Open sessions | `Ctrl+O` |
| Friends | `Ctrl+Shift+F` |
| Settings | `Ctrl+,` |
| Grid / carousel / list | `Ctrl+1` / `Ctrl+2` / `Ctrl+3` |
| Rescan ROM folders | `F5` |
| Back / close | `Esc`, `Alt+←` or the mouse back button |
| Move between games | Arrow keys, `Tab` |
| Open the focused game | `Enter` |
| Rename / hide the focused game | `F2` / `Del` |
| Game menu | Right-click, `Shift+F10` or the menu key |

Drop game files or folders anywhere in the window to add them to the library.

---

## Desktop Emulator Integration & Automation

Emufii Desktop directly configures and launches desktop emulators across Windows, Linux, and macOS:

1. **PSP (PPSSPP)**:
   - Auto-detects `PPSSPPWindows64.exe` (Windows), `ppsspp` / `PPSSPPSDL` / Flatpak `org.ppsspp.PPSSPP` (Linux), `PPSSPPSDL.app` (macOS).
   - Writes `PSP/SYSTEM/<DISC_ID>_ppsspp.ini` with:
     ```ini
     [Network]
     EnableWlan = True
     EnableAdhocServer = True
     proAdhocServer = 10.66.1.1
     AdhocServerRelayMode = 2
     ```
   - Automatically boots the emulator with the chosen ROM.

2. **PS2 (PCSX2)**:
   - Auto-detects `pcsx2-qt.exe` (Windows), `pcsx2-qt` / Flatpak `net.pcsx2.PCSX2` (Linux), `PCSX2.app` (macOS).
   - Bundles and prepares the network configuration memory card `EmuFii_Network.ps2` (`emufii-ps2-net.ps2`).
   - Writes `inis/gamesettings/<SERIAL>_<ELF_CRC>.ini` with `[DEV9/Eth]` Local Link settings and assigns slot 1 memory card.
   - Launches PCSX2 with `-batch` and the ROM path.

3. **GameCube / Wii (Dolphin)**:
   - Auto-detects `Dolphin.exe`, `dolphin-emu`, or `/Applications/Dolphin.app`.
   - Displays Netplay room connection details and copyable parameters.

4. **DS (melonDS / WatermelonDS)**:
   - Auto-detects melonDS or WatermelonDS on desktop.
   - Supports local wireless netplay and Kaeru WFC multiplayer.

5. **3DS (Azahar / Citra / Lime3DS)**:
   - Auto-detects Azahar, Citra, or Lime3DS desktop installations.

6. **Switch (Eden / Ryujinx)**:
   - Auto-detects Eden or Ryujinx with Switch LDN multiplayer.

---

## Building and Packaging

### Prerequisites
- Node.js 20+
- npm 10+

### Development
```bash
cd app-desktop
npm install
npm run build
npm start
```

### Build Distribution Binaries

- **Linux (amd64 and arm64 AppImage, deb, tar.gz)**:
  ```bash
  npm run dist:linux
  ```
- **Windows (x64 and arm64 NSIS installer and portable exe)**:
  ```bash
  npm run dist:win
  ```
- **macOS (Intel and Apple Silicon universal dmg and zip)**:
  ```bash
  npm run dist:mac
  ```
- **All Platforms**:
  ```bash
  npm run dist:all
  ```
Binaries are output to `app-desktop/release/`.

---

## Credits & Acknowledgements

- **Original Project**: Emufii Android edition by [jojodogm-ctrl](https://github.com/jojodogm-ctrl/emufii) and contributors (@sofianeelhor, @BrianJr03).
- **Desktop Version**: Adapted and worked by **[Noobiez16](https://github.com/Noobiez16)**.
- **Emulators & Projects**: Supported thanks to [Eden](https://eden-emu.dev), [Azahar](https://azahar-emu.org), [Dolphin](https://dolphin-emu.org), [PPSSPP](https://www.ppsspp.org), [PCSX2](https://pcsx2.net), [melonDS](https://melonds.kuribo64.net), [WatermelonDS](https://github.com/SapphireRhodonite/WatermelonDS), and [Kaeru WFC](https://kaeru.world).

---

## License

GNU AGPL-3.0.
Rounded M+ 1c font software is licensed under the SIL Open Font License 1.1 (`ROUNDED-MPLUS-OFL.txt`).
