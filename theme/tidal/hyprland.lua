-- Tidal: a 16-bit waterfall. Omarchy's own flat look (rounding 0, no blur, no
-- shadow) with a foam-to-deep-water border; the only moving parts are the
-- waterfall and its brink (plugin tiedeyez.tidal), which pause under
-- windows.
--
-- Hyprland config is additive: what another theme switched on stays on
-- unless this file switches it off, so blur, shadows, rounding and looping
-- borders from a previous theme are reset here explicitly.
--
-- In Lua a gradient must be a table; a "rgba() rgba() 45deg" string is an
-- invalid colour here.

local active_border_color = { colors = { "rgba(6cc6eeff)", "rgba(174f9cff)" }, angle = 45 }
local inactive_border_color = "rgba(142c62ff)"

hl.config({
  debug = {
    damage_tracking = 1,
  },

  animations = {
    enabled = true,
  },

  general = {
    col = {
      active_border = active_border_color,
      inactive_border = inactive_border_color,
    },
  },

  group = {
    col = {
      border_active = active_border_color,
      border_inactive = inactive_border_color,
    },
  },

  decoration = {
    rounding = 0,
    rounding_power = 2.0,
    blur = {
      enabled = false,
      size = 1,
      passes = 1,
      noise = 0.0,
      contrast = 1.0,
      brightness = 1.0,
      vibrancy = 0.0,
      vibrancy_darkness = 0.0,
      popups = false,
      new_optimizations = false,
    },
    shadow = {
      enabled = false,
      range = 0,
      render_power = 0,
      color = "rgba(00000000)",
      color_inactive = "rgba(00000000)",
    },
  },
})

-- Opaque windows: nothing behind them is composited, and the wallpaper can
-- pause when tiled windows cover it.
o.window({ tag = "default-opacity" }, { opacity = "1 1" })

-- No glass on the shell's layers (a previous theme may have added it).
hl.layer_rule({ match = { namespace = "^(omarchy-bar|omarchy-notifications|omarchy-osd)$" }, blur = false })
hl.layer_rule({ match = { namespace = "^(omarchy-keyboard-panel|omarchy-menu|omarchy-polkit|omarchy-reminders)$" }, blur = false })

-- Short one-shot motion, close to Omarchy's defaults. A looping borderangle
-- would repaint every frame, so it stays off.
hl.curve("tide", { type = "bezier", points = { { 0.22, 1 }, { 0.36, 1 } } })
hl.animation({ leaf = "windows", enabled = true, speed = 5, bezier = "tide" })
hl.animation({ leaf = "windowsIn", enabled = true, speed = 4, bezier = "tide", style = "popin 85%" })
hl.animation({ leaf = "windowsOut", enabled = true, speed = 4, bezier = "tide", style = "popin 85%" })
hl.animation({ leaf = "windowsMove", enabled = true, speed = 5, bezier = "tide" })
hl.animation({ leaf = "fadeIn", enabled = true, speed = 4, bezier = "tide" })
hl.animation({ leaf = "fadeOut", enabled = true, speed = 4, bezier = "tide" })
hl.animation({ leaf = "border", enabled = true, speed = 5, bezier = "tide" })
hl.animation({ leaf = "borderangle", enabled = false })
hl.animation({ leaf = "workspaces", enabled = true, speed = 5, bezier = "tide", style = "slide" })
hl.animation({ leaf = "specialWorkspace", enabled = true, speed = 5, bezier = "tide", style = "slidevert" })
hl.animation({ leaf = "layersIn", enabled = true, speed = 4, bezier = "tide", style = "fade" })
hl.animation({ leaf = "layersOut", enabled = true, speed = 4, bezier = "tide", style = "fade" })
hl.animation({ leaf = "fadeLayersIn", enabled = true, speed = 4, bezier = "tide" })
hl.animation({ leaf = "fadeLayersOut", enabled = true, speed = 4, bezier = "tide" })
