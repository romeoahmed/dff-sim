import { useSetAtom, useStore } from "jotai";
import { useEffect, useRef } from "react";
import { circuitDefAtom, paramAtomFamily } from "@/atoms/simulation-atoms";
import { shaderStyleAtom } from "@/atoms/ui-atoms";

export function useKeyboardShortcuts(options: { onOpenHelp: () => void }) {
  const setShaderStyle = useSetAtom(shaderStyleAtom);
  const store = useStore();

  const onOpenHelpRef = useRef(options.onOpenHelp);
  useEffect(() => {
    onOpenHelpRef.current = options.onOpenHelp;
  }, [options.onOpenHelp]);

  useEffect(() => {
    function bump(key: string, delta: number) {
      const def = store.get(circuitDefAtom);
      if (!def) return;
      const ctrl = def.controls.find((c) => c.param === key);
      if (!ctrl) return;
      const atom = paramAtomFamily(`${ctrl.targetComponent}.${ctrl.param}`);
      const current = store.get(atom);
      const next = Math.max(ctrl.min ?? 0, Math.min(ctrl.max ?? 100, Number(current) + delta));
      store.set(atom, next);
    }

    function toggle(key: string) {
      const def = store.get(circuitDefAtom);
      if (!def) return;
      const ctrl = def.controls.find((c) => c.param === key);
      if (!ctrl) return;
      const atom = paramAtomFamily(`${ctrl.targetComponent}.${ctrl.param}`);
      const current = store.get(atom);
      store.set(atom, !current);
    }

    function momentary(key: string, active: boolean) {
      const def = store.get(circuitDefAtom);
      if (!def) return;
      const ctrl = def.controls.find((c) => c.param === key);
      if (!ctrl) return;
      const atom = paramAtomFamily(`${ctrl.targetComponent}.${ctrl.param}`);
      store.set(atom, active);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.repeat) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          toggle("targetLogic");
          break;
        case "r":
        case "R":
          momentary("reset", true);
          break;
        case "[":
          bump("noise", -5);
          break;
        case "]":
          bump("noise", 5);
          break;
        case "-":
          bump("speed", -5);
          break;
        case "=":
          bump("speed", 5);
          break;
        case "1":
          setShaderStyle("clean");
          break;
        case "2":
          setShaderStyle("glow");
          break;
        case "3":
          setShaderStyle("phosphor");
          break;
        case "?":
          onOpenHelpRef.current();
          break;
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "r" || e.key === "R") momentary("reset", false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [store, setShaderStyle]);
}
