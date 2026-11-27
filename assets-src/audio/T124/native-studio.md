# Audacity production studio

The host Mac session was locked. A dedicated Ubuntu 24.04 ARM64 virtual machine on that Mac ran the official Audacity 4.0.2 Linux ARM64 release inside a private Xvfb desktop. The release image SHA-256 is `88b1e16dd40a5b7d36bec5789b03f66bda34a7b964e19f338951bf6034d9db9c`. Compare the release digest before extracting the executable with `--appimage-extract`. [Audacity 4.0.2 release](https://github.com/audacity/audacity/releases/tag/Audacity-4.0.2)

The task used Lima 2.3.0 with Apple Virtualization.framework, 4 vCPUs, 4 GiB of guest memory and no host-directory mounts. It copied in only the release application, the task scripts and prepared audio. Xvfb listened exclusively on its private Unix socket. The virtual display handled no host desktop or owner audio. The production image used Xvfb, Openbox, xdotool, dbus-x11, python3-pyatspi, at-spi2-core, the Qt XCB dependencies and Mesa software rendering.

In a guest desktop session begin Xvfb at 1440 × 900 × 24, then Openbox, AT-SPI and the extracted official application. Use a private D-Bus session with `QT_LINUX_ACCESSIBILITY_ALWAYS_ON=1`, `QT_ACCESSIBILITY=1`, `QT_QUICK_BACKEND=software` and `LIBGL_ALWAYS_SOFTWARE=1`. Complete the guest's first-run wizard offline, enable local saves/exports and dismiss its welcome dialog. Choose the WAV Microsoft format, 48,000 Hz and signed 24-bit PCM. The retained script checks those settings before exporting. Place the release `squashfs-root`, `prepared`, `projects` and `masters` directories under the guest working directory.

```sh
python3 native-roundtrip.py workshop Stereo
```

The script verifies an exclusive Xvfb Audacity session and refuses to replace an existing source or master. It observes the track in the native app, saves through its file dialog, quits, verifies SQLite integrity, then launches a second app process on the exact project. It verifies the named track again and exports with Audacity's own WAV encoder. Retain the produced .aup4, WAV and per-cue run record after closing the app and checking the source hash against its pre-reopen value. Compare all output samples against the intended input. The first title pass used those steps interactively, as its record states.

The source project has one editable named stereo track spanning exactly one authored cycle. The preceding raw generation and loop-edit script preserve the original material outside the cut and the parameters of each overlap. Regenerate the prepared input with `prepare.py` in the repository. Only edition-specific frame counts from the native master and browser decode establish final playback bounds.
