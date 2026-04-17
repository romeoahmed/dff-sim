// WebGPU 标志常量 — TypeScript 内置 lib 仅提供类型别名，不声明运行时对象变量
declare const GPUShaderStage: {
  readonly VERTEX: 1;
  readonly FRAGMENT: 2;
  readonly COMPUTE: 4;
};

declare const GPUBufferUsage: {
  readonly MAP_READ: 1;
  readonly MAP_WRITE: 2;
  readonly COPY_SRC: 4;
  readonly COPY_DST: 8;
  readonly INDEX: 16;
  readonly VERTEX: 32;
  readonly UNIFORM: 64;
  readonly STORAGE: 128;
  readonly INDIRECT: 256;
  readonly QUERY_RESOLVE: 512;
};

// The font package lacks TypeScript type declarations;
// these must be declared manually here to avoid `TS2307` errors.
declare module "@fontsource-variable/ibm-plex-sans" {
  const css: string;
  export default css;
}
declare module "@fontsource/ibm-plex-mono/400.css" {
  const css: string;
  export default css;
}
declare module "@fontsource/ibm-plex-mono/500.css" {
  const css: string;
  export default css;
}
declare module "@fontsource/ibm-plex-mono/600.css" {
  const css: string;
  export default css;
}
