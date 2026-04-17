/// <reference types="vite/client" />

declare module "*.wgsl?raw" {
  const content: string;
  export default content;
}

declare module "*.po" {
  import type { Messages } from "@lingui/core";
  const messages: Messages;
  export { messages };
}
