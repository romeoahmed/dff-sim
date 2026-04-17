import { flavors } from "@catppuccin/palette";

const macchiato = flavors.macchiato;

export const theme = {
  base: macchiato.colors.base.hex,
  mantle: macchiato.colors.mantle.hex,
  crust: macchiato.colors.crust.hex,
  surface0: macchiato.colors.surface0.hex,
  surface1: macchiato.colors.surface1.hex,
  surface2: macchiato.colors.surface2.hex,
  text: macchiato.colors.text.hex,
  subtext0: macchiato.colors.subtext0.hex,
  subtext1: macchiato.colors.subtext1.hex,
  overlay0: macchiato.colors.overlay0.hex,
  overlay1: macchiato.colors.overlay1.hex,
  green: macchiato.colors.green.hex,
  blue: macchiato.colors.blue.hex,
  red: macchiato.colors.red.hex,
  yellow: macchiato.colors.yellow.hex,
  mauve: macchiato.colors.mauve.hex,
  teal: macchiato.colors.teal.hex,
  lavender: macchiato.colors.lavender.hex,
  peach: macchiato.colors.peach.hex,
  sky: macchiato.colors.sky.hex,
  pink: macchiato.colors.pink.hex,
  flamingo: macchiato.colors.flamingo.hex,
  rosewater: macchiato.colors.rosewater.hex,
  maroon: macchiato.colors.maroon.hex,
  sapphire: macchiato.colors.sapphire.hex,
} as const;

export function toCssVars(): string {
  return Object.entries(theme)
    .map(([name, hex]) => `  --color-${name}: ${hex};`)
    .join("\n");
}
