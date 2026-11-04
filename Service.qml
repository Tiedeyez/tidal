pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import Quickshell.Hyprland
import Quickshell.Io
import Quickshell.Wayland
import qs.Commons

// Tidal: a 16-bit waterfall for your desktop. Two small fragment shaders:
//   shaders/tidal.frag  the falls, the plunge pool, the mist and the Omarchy
//                       wordmark emerging from the water (the desktop under
//                       the bar), drawn at screen / pixelSize and scaled up
//                       nearest-neighbour;
//   shaders/bar.frag    the brink of the falls, drawn behind a top bar that
//                       the Tidal theme makes transparent.
// Both redraw `fps` times a second and share one clock, so a surge of water
// passes from the brink down into the pool.
//
// Runs only while the active theme is one of `themes` (default: "tidal").
// The falls pause while a fullscreen or tiled window covers the workspace;
// the brink pauses only under a fullscreen window. Reads a few files, writes
// nothing, runs no processes (DISCLOSURE.md).
//
// Optional settings, in this plugin's entry in ~/.config/omarchy/shell.json:
//   { "id": "tiedeyez.tidal", "pixelSize": 5, "fps": 12, "pauseUnderWindows": true,
//     "barWater": true, "themes": ["tidal"] }
Item {
  id: root

  readonly property string pluginId: "tiedeyez.tidal"

  // ---- settings ------------------------------------------------------------
  property var settings: ({})
  property string barPosition: "top"
  function setting(key, fallback, lo, hi) {
    var v = settings[key]
    return typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : fallback
  }
  function flag(key, fallback) { return typeof settings[key] === "boolean" ? settings[key] : fallback }
  readonly property int pixelSize: setting("pixelSize", 5, 1, 16)
  readonly property int fps: setting("fps", 12, 1, 30)
  readonly property bool pauseUnderWindows: flag("pauseUnderWindows", true)
  // "*" in themes = every theme
  readonly property var themes: Array.isArray(settings.themes) ? settings.themes : ["tidal"]
  // the brink needs a top bar; the theme makes the bar transparent so it shows
  readonly property bool barWater: flag("barWater", true) && barPosition === "top"
  readonly property int barHeight: Style.bar.sizeHorizontal
  // start the clock this many seconds into the loop (for testing the wrap)
  readonly property int clockOffset: setting("clockOffset", 0, 0, 959)

  FileView {
    path: Quickshell.env("HOME") + "/.config/omarchy/shell.json"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      try {
        var config = JSON.parse(text())
        var list = Array.isArray(config.plugins) ? config.plugins : []
        var found = ({})
        for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === root.pluginId) found = list[i]
        root.settings = found
        root.barPosition = config.bar && typeof config.bar.position === "string" ? config.bar.position : "top"
      } catch (e) { root.settings = ({}) }
    }
    onLoadFailed: root.settings = ({})
  }

  // ---- only on the chosen themes -------------------------------------------
  property string themeName: ""
  readonly property bool active: themes.indexOf("*") >= 0 || themes.indexOf(themeName) >= 0
  FileView {
    path: Quickshell.env("HOME") + "/.local/state/omarchy/current/theme.name"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.themeName = String(text() || "").trim()
    onLoadFailed: root.themeName = ""
  }

  // ---- one clock -------------------------------------------------------------
  // Every motion in both shaders is a whole number of cycles per `loop`
  // seconds, so wrapping the clock there shows no jump.
  readonly property real loop: 960
  property real clock: 0
  onClockOffsetChanged: clock = clockOffset
  readonly property bool anyVisible: {
    if (!active) return false
    var ws = screens.instances
    for (var i = 0; i < ws.length; i++) if (ws[i] && !ws[i].covered) return true
    var bs = barStrips.instances
    for (var j = 0; j < bs.length; j++) if (bs[j] && !bs[j].covered) return true
    return false
  }
  Timer {
    interval: Math.round(1000 / root.fps)
    repeat: true
    running: root.anyVisible
    property double last: Date.now()
    onRunningChanged: last = Date.now()
    onTriggered: {
      var now = Date.now()
      var dt = Math.min((now - last) / 1000, 0.25)
      last = now
      root.clock = (root.clock + dt) % root.loop
    }
  }

  // ---- what covers the desktop (tiled or fullscreen windows) ---------------
  Timer { id: toplevelRefresh; interval: 60; onTriggered: Hyprland.refreshToplevels() }
  Connections {
    target: Hyprland
    enabled: root.active && root.pauseUnderWindows
    function onRawEvent(event) {
      var n = event.name
      if (n === "openwindow" || n === "closewindow" || n === "movewindowv2" || n === "changefloatingmode")
        toplevelRefresh.restart()
    }
  }
  onActiveChanged: if (active) Hyprland.refreshToplevels()

  // ---- the falls ---------------------------------------------------------------
  Variants {
    id: screens
    model: root.active ? Quickshell.screens : []

    PanelWindow {
      id: panel
      required property var modelData
      screen: modelData

      readonly property var monitor: Hyprland.monitorFor(modelData)
      readonly property var workspace: monitor ? monitor.activeWorkspace : null
      readonly property bool tiled: {
        if (!root.pauseUnderWindows || !workspace || !workspace.toplevels) return false
        var list = workspace.toplevels.values
        for (var i = 0; i < list.length; i++) {
          var o = list[i] ? list[i].lastIpcObject : null
          if (o && o.floating === false) return true
        }
        return false
      }
      readonly property bool covered: !!(workspace && workspace.hasFullscreen) || tiled
      property real shownClock: root.clock
      Connections {
        target: root
        function onClockChanged() { if (!panel.covered) panel.shownClock = root.clock }
      }

      color: "#0f2d64"
      anchors { top: true; bottom: true; left: true; right: true }
      // the brink behind the bar is its own surface, so the falls start below it
      margins.top: root.barWater ? root.barHeight : 0
      exclusionMode: ExclusionMode.Ignore
      WlrLayershell.namespace: "tiedeyez-tidal"
      WlrLayershell.layer: WlrLayer.Bottom
      WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
      mask: Region {}     // clicks fall through to the desktop

      Item {
        id: canvas
        readonly property real dpr: panel.devicePixelRatio || 1
        readonly property int texW: Math.max(2, Math.ceil(panel.width * dpr / root.pixelSize))
        readonly property int texH: Math.max(2, Math.ceil(panel.height * dpr / root.pixelSize))
        width: texW * root.pixelSize / dpr
        height: texH * root.pixelSize / dpr
        anchors.top: parent.top
        anchors.horizontalCenter: parent.horizontalCenter
        layer.enabled: true
        layer.smooth: false               // hard pixel edges
        layer.textureSize: Qt.size(texW, texH)

        ShaderEffect {
          anchors.fill: parent
          fragmentShader: Qt.resolvedUrl("shaders/tidal.frag.qsb")
          property real time: panel.shownClock
          property vector2d res: Qt.vector2d(canvas.texW, canvas.texH)
          property var logo: logoImage
          Image {
            id: logoImage
            source: Qt.resolvedUrl("logo.png")
            visible: false
            smooth: false
          }
        }
      }
    }
  }

  // ---- the brink, behind the top bar --------------------------------------------
  // Its own small surface, so it keeps moving while the falls are paused under
  // windows (the bar is always on screen); it stops only under a fullscreen
  // window, which hides the bar too.
  Variants {
    id: barStrips
    model: root.active && root.barWater ? Quickshell.screens : []

    PanelWindow {
      id: strip
      required property var modelData
      screen: modelData
      readonly property var monitor: Hyprland.monitorFor(modelData)
      readonly property bool covered: !!(monitor && monitor.activeWorkspace && monitor.activeWorkspace.hasFullscreen)
      property real shownClock: root.clock
      Connections {
        target: root
        function onClockChanged() { if (!strip.covered) strip.shownClock = root.clock }
      }

      color: "#0f2d64"
      anchors { top: true; left: true; right: true }
      implicitHeight: root.barHeight
      exclusionMode: ExclusionMode.Ignore
      WlrLayershell.namespace: "tiedeyez-tidal-brink"
      WlrLayershell.layer: WlrLayer.Bottom
      WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
      mask: Region {}

      Item {
        id: stripCanvas
        readonly property int px: 2
        readonly property real dpr: strip.devicePixelRatio || 1
        readonly property int texW: Math.max(2, Math.ceil(strip.width * dpr / px))
        readonly property int texH: Math.max(2, Math.ceil(strip.height * dpr / px))
        width: texW * px / dpr
        height: texH * px / dpr
        anchors.top: parent.top
        anchors.horizontalCenter: parent.horizontalCenter
        layer.enabled: true
        layer.smooth: false
        layer.textureSize: Qt.size(texW, texH)
        ShaderEffect {
          anchors.fill: parent
          fragmentShader: Qt.resolvedUrl("shaders/bar.frag.qsb")
          property real time: strip.shownClock
          property vector2d res: Qt.vector2d(stripCanvas.texW, stripCanvas.texH)
        }
      }
    }
  }
}
