# Disclosure: Tidal Falls

What Tidal puts on your computer, written from the source at this commit.

## What it is and what runs it

Tidal is an Omarchy shell plugin of kind `service`. Its entry point, `Service.qml`, runs inside `omarchy-shell` (Quickshell) **with your user account's full access, unsandboxed**, like every Omarchy plugin. It loads only after you enable it, and draws only while the active theme is one of its `themes` setting (default: `tidal`).

## What it needs

- Omarchy's shell (Quickshell with Qt 6) and a GPU that Qt Quick can run fragment shaders on.
- Nothing else. There are no extra packages, scripts, daemons or services.

## What it writes

Nothing. The plugin creates no files, folders, caches or settings. The companion theme in `theme/tidal/` is only copied if you copy it yourself (see the README).

## What it reads

| What | How | Why |
|---|---|---|
| `shaders/tidal.frag.qsb` and `shaders/bar.frag.qsb` (in the plugin folder) | Qt's `ShaderEffect` loads them | The compiled shaders that draw the falls and the brink. They rebuild byte-for-byte from the `.frag` files; see [shaders/PROVENANCE.md](shaders/PROVENANCE.md) |
| `logo.png` (in the plugin folder) | A hidden Qt `Image`, handed to the shader as a texture | The Omarchy wordmark's shape |
| The plugin's own entry in `~/.config/omarchy/shell.json` (the object with `"id": "tiedeyez.tidal"`) and that file's `bar.position` | `FileView`, watched for changes; parsed as JSON. Only the keys `pixelSize`, `fps`, `pauseUnderWindows`, `barWater`, `themes` and `clockOffset` are used, numbers range-checked | Optional settings, and whether the bar is at the top (the brink is drawn only then) |
| `~/.local/state/omarchy/current/theme.name` | `FileView`, watched for changes; the name is compared with the `themes` setting | Draw only on the chosen themes |
| The bar's height | Omarchy's own `Style.bar.sizeHorizontal` (from `qs.Commons`) | Make the brink exactly as tall as the bar |
| Each monitor's active workspace, and whether it has a fullscreen window | Quickshell's built-in `Quickshell.Hyprland` module, from Hyprland's event socket | Pause while a fullscreen window covers the screen |
| Each workspace's windows, and whether each is floating | Quickshell's `Hyprland.refreshToplevels()`, which asks Hyprland for its client list; re-asked 60 ms after a window opens, closes, moves or changes floating mode (only the raw event's name is used) | `pauseUnderWindows`. Hyprland's client list also carries each window's class and title; Quickshell receives them, and Tidal reads only the `floating` flag |
| The list of screens | `Quickshell.screens` | One set of surfaces per screen |

## What it shows on screen

Two click-through layer-shell surfaces per screen on the `bottom` layer (above your normal wallpaper, below your windows): `tiedeyez-tidal` (the falls, below the bar) and `tiedeyez-tidal-brink` (behind the bar). Both have an empty input region, so every click goes to the desktop; neither takes keyboard focus.

## What it does not do

No network access, no processes, no shell commands, no clipboard, no notifications, no IPC handlers, no timers other than its own frame clock and a 60 ms window-list refresh.

## The companion theme

`theme/tidal/` is a normal Omarchy theme: `colors.toml`, `icons.theme` (Yaru-blue-dark), `shell.bar.toml` (sets the bar's `background-alpha` to 0 so the brink shows through), `hyprland.lua` (border colours, flat look, short one-shot animations; nothing runs), a recoloured Omarchy wallpaper and unlock image, and a preview. It does nothing until you copy it into `~/.config/omarchy/themes/` and select it.
