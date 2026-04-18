import { useLingui } from "@lingui/react/macro";
import { useAtom, useSetAtom } from "jotai";
import { CircuitBoard, Globe, Info, Moon, Settings, Sun } from "lucide-react";
import { motion } from "motion/react";
import {
  aboutOpenAtom,
  localeAtom,
  settingsOpenAtom,
  shaderStyleAtom,
  themeAtom,
} from "@/atoms/ui-atoms";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ShaderStyle } from "@/workers/render/shaders";
import { CircuitSelector } from "./CircuitSelector";

const SHADER_STYLES: ShaderStyle[] = ["clean", "glow", "phosphor"];

function isShaderStyle(v: string): v is ShaderStyle {
  return (SHADER_STYLES as readonly string[]).includes(v);
}

const toolbarContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};
const toolbarItem = {
  hidden: { opacity: 0, y: -6 },
  show: { opacity: 1, y: 0 },
};

const iconButtonClass =
  "inline-flex items-center justify-center w-8 h-8 rounded-full text-fg-muted " +
  "hover:bg-panel-muted hover:text-fg transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel";

export function Toolbar({ className = "" }: { className?: string }) {
  const [shaderStyle, setShaderStyle] = useAtom(shaderStyleAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setAboutOpen = useSetAtom(aboutOpenAtom);
  const [locale, setLocale] = useAtom(localeAtom);
  const [theme, setTheme] = useAtom(themeAtom);
  const { t } = useLingui();

  return (
    <motion.header
      className={`h-12 flex items-center gap-4 px-4 border-b border-border bg-panel/80 backdrop-blur-[20px] backdrop-saturate-[180%] ${className}`}
      variants={toolbarContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div
        variants={toolbarItem}
        className="flex items-center gap-2 text-fg text-display"
        style={{ fontSize: 17 }}
      >
        <CircuitBoard size={18} strokeWidth={2.25} className="text-accent" />
        <span className="readout tracking-[0.15em]">DFF·SIM</span>
      </motion.div>

      <motion.div variants={toolbarItem}>
        <CircuitSelector />
      </motion.div>

      <motion.div variants={toolbarItem} className="ml-auto flex items-center gap-2">
        <ToggleGroup
          type="single"
          value={shaderStyle}
          onValueChange={(v) => {
            if (isShaderStyle(v)) setShaderStyle(v);
          }}
          className="flex p-0.5 rounded-full bg-panel-muted border border-border"
          aria-label={t`Shader style`}
        >
          {SHADER_STYLES.map((style, i) => (
            <ToggleGroupItem
              key={style}
              value={style}
              className="readout px-3 h-7 rounded-full text-[10px] uppercase tracking-widest text-fg-muted data-[state=on]:bg-panel-raised data-[state=on]:text-fg data-[state=on]:shadow-sm hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
              aria-label={t`${style} shader · press ${i + 1}`}
            >
              {style}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="h-6 w-px bg-border" aria-hidden />

        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={iconButtonClass}
          aria-label={theme === "dark" ? t`Switch to light theme` : t`Switch to dark theme`}
          title={theme === "dark" ? t`Light theme` : t`Dark theme`}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className={iconButtonClass}
          aria-label={t`Settings`}
        >
          <Settings size={16} />
        </button>
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className={iconButtonClass}
          aria-label={t`About`}
        >
          <Info size={16} />
        </button>
        <button
          type="button"
          onClick={() => setLocale(locale === "en" ? "zh-CN" : "en")}
          className={iconButtonClass}
          aria-label={t`Language`}
        >
          <Globe size={16} />
        </button>
      </motion.div>
    </motion.header>
  );
}
