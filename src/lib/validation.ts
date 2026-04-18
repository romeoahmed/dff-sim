import { z } from "zod";

export const voltageSpecSchema = z
  .object({
    logicHighMin: z.number(),
    logicLowMax: z.number(),
    outputHighMin: z.number(),
    outputHighMax: z.number(),
    outputLowMax: z.number(),
    systemMax: z.number(),
    clampMin: z.number(),
  })
  .refine((s) => s.outputLowMax < s.logicLowMax, {
    message: "outputLowMax must be less than logicLowMax",
  })
  .refine((s) => s.logicLowMax < s.logicHighMin, {
    message: "logicLowMax must be less than logicHighMin",
  })
  .refine((s) => s.logicHighMin <= s.outputHighMin, {
    message: "logicHighMin must be <= outputHighMin",
  })
  .refine((s) => s.outputHighMin <= s.outputHighMax, {
    message: "outputHighMin must be <= outputHighMax",
  })
  .refine((s) => s.outputHighMax <= s.systemMax, {
    message: "outputHighMax must be <= systemMax",
  })
  .refine((s) => s.clampMin < s.outputLowMax, {
    message: "clampMin must be less than outputLowMax",
  });

export const circuitDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  components: z.array(
    z.object({
      type: z.string().min(1),
      id: z.string().min(1),
      params: z.record(z.string(), z.unknown()),
    }),
  ),
  nets: z.array(
    z.object({
      id: z.string().min(1),
      driver: z.object({
        componentId: z.string(),
        port: z.string(),
      }),
      loads: z.array(
        z.object({
          componentId: z.string(),
          port: z.string(),
        }),
      ),
    }),
  ),
  probes: z.array(
    z.object({
      netId: z.string(),
      label: z.string(),
      color: z.string(),
      channelIndex: z.number().int().nonnegative(),
    }),
  ),
  controls: z.array(
    z.object({
      type: z.enum(["slider", "toggle", "momentary"]),
      targetComponent: z.string(),
      param: z.string(),
      label: z.string(),
      min: z.number().optional(),
      max: z.number().optional(),
      defaultValue: z.union([z.number(), z.boolean()]).optional(),
    }),
  ),
});
