import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useAtom, useSetAtom } from "jotai";
import { CircuitBoard, Globe, Info, Settings } from "lucide-react";
import { motion } from "motion/react";
import { aboutOpenAtom, localeAtom, settingsOpenAtom, shaderStyleAtom } from "@/atoms/ui-atoms";
import type { ShaderStyle } from "@/workers/render/shaders";
import { CircuitSelector } from "./CircuitSelector";

const SHADER_STYLES: ShaderStyle[] = ["clean", "glow", "phosphor"];

function isShaderStyle(v: string): v is ShaderStyle {
  return SHADER_STYLES.includes(v as ShaderStyle);
}

const toolbarContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};
const toolbarItem = {
  hidden: { opacity: 0, y: -6 },
  show: { opacity: 1, y: 0 },
};

export function Toolbar() {
  const [shaderStyle, setShaderStyle] = useAtom(shaderStyleAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setAboutOpen = useSetAtom(aboutOpenAtom);
  const [locale, setLocale] = useAtom(localeAtom);

  return (
    <motion.header
      className="flex items-center gap-4 px-4 py-2 border-b border-surface0 bg-mantle/80 backdrop-blur-sm"
      variants={toolbarContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div
        variants={toolbarItem}
        className="flex items-center gap-2 font-bold text-lavender"
      >
        <CircuitBoard size={18} strokeWidth={2.25} />
        <span className="readout tracking-[0.15em]">DFF·SIM</span>
      </motion.div>

      <motion.div variants={toolbarItem}>
        <CircuitSelector />
      </motion.div>

      <motion.div variants={toolbarItem} className="ml-auto flex items-center gap-3">
        <ToggleGroup.Root
          type="single"
          value={shaderStyle}
          onValueChange={(v) => {
            if (isShaderStyle(v)) setShaderStyle(v);
          }}
          className="flex rounded overflow-hidden border border-surface1"
          aria-label="Shader style"
        >
          {SHADER_STYLES.map((style, i) => (
            <ToggleGroup.Item
              key={style}
              value={style}
              className="readout px-3 py-1 text-[10px] uppercase tracking-widest bg-surface0 text-subtext0 data-[state=on]:bg-surface2 data-[state=on]:text-text hover:bg-surface1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lavender focus-visible:ring-inset"
              aria-label={`${style} shader · press ${i + 1}`}
            >
              {style}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>

        <div className="h-6 w-px bg-surface1" aria-hidden />

        <motion.button
          type="button"
          onClick={() => setSettingsOpen(true)}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.94 }}
          className="p-1.5 rounded hover:bg-surface0 text-subtext0 hover:text-text"
          aria-label="Settings"
        >
          <Settings size={16} />
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setAboutOpen(true)}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.94 }}
          className="p-1.5 rounded hover:bg-surface0 text-subtext0 hover:text-text"
          aria-label="About"
        >
          <Info size={16} />
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setLocale(locale === "en" ? "zh-CN" : "en")}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.94 }}
          className="p-1.5 rounded hover:bg-surface0 text-subtext0 hover:text-text"
          aria-label="Language"
        >
          <Globe size={16} />
        </motion.button>
      </motion.div>
    </motion.header>
  );
}
