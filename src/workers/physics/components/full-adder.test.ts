import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import type { Port } from "@/lib/types";
import { FullAdder } from "./full-adder";

const deps = { config: DefaultPhysicsConfig, rng: Math.random };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;
const H = outputHighMax;
const L = 0.0;

function makeFa(): { fa: FullAdder; a: Port; b: Port; cin: Port; sum: Port; cout: Port } {
  const fa = new FullAdder("fa0", {}, deps);
  const a = fa.inputs.get("a");
  const b = fa.inputs.get("b");
  const cin = fa.inputs.get("cin");
  const sum = fa.outputs.get("sum");
  const cout = fa.outputs.get("cout");
  if (!a || !b || !cin || !sum || !cout) throw new Error("FullAdder port missing");
  return { fa, a, b, cin, sum, cout };
}

function isHigh(v: number): boolean {
  return v > logicHighMin;
}

describe("FullAdder", () => {
  it("has a, b, cin input ports, sum, cout output ports, and kind combinational", () => {
    const { fa } = makeFa();
    expect(fa.inputs.has("a")).toBe(true);
    expect(fa.inputs.has("b")).toBe(true);
    expect(fa.inputs.has("cin")).toBe(true);
    expect(fa.outputs.has("sum")).toBe(true);
    expect(fa.outputs.has("cout")).toBe(true);
    expect(fa.kind).toBe("combinational");
  });

  it("0+0+0 = sum:0 cout:0", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = L;
    b.voltage = L;
    cin.voltage = L;
    fa.evaluate();
    expect(isHigh(sum.voltage)).toBe(false);
    expect(isHigh(cout.voltage)).toBe(false);
  });

  it("1+0+0 = sum:1 cout:0", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = H;
    b.voltage = L;
    cin.voltage = L;
    fa.evaluate();
    expect(isHigh(sum.voltage)).toBe(true);
    expect(isHigh(cout.voltage)).toBe(false);
  });

  it("0+1+0 = sum:1 cout:0", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = L;
    b.voltage = H;
    cin.voltage = L;
    fa.evaluate();
    expect(isHigh(sum.voltage)).toBe(true);
    expect(isHigh(cout.voltage)).toBe(false);
  });

  it("1+1+0 = sum:0 cout:1", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = H;
    b.voltage = H;
    cin.voltage = L;
    fa.evaluate();
    expect(isHigh(sum.voltage)).toBe(false);
    expect(isHigh(cout.voltage)).toBe(true);
  });

  it("0+0+1 = sum:1 cout:0", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = L;
    b.voltage = L;
    cin.voltage = H;
    fa.evaluate();
    expect(isHigh(sum.voltage)).toBe(true);
    expect(isHigh(cout.voltage)).toBe(false);
  });

  it("1+0+1 = sum:0 cout:1", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = H;
    b.voltage = L;
    cin.voltage = H;
    fa.evaluate();
    expect(isHigh(sum.voltage)).toBe(false);
    expect(isHigh(cout.voltage)).toBe(true);
  });

  it("0+1+1 = sum:0 cout:1", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = L;
    b.voltage = H;
    cin.voltage = H;
    fa.evaluate();
    expect(isHigh(sum.voltage)).toBe(false);
    expect(isHigh(cout.voltage)).toBe(true);
  });

  it("1+1+1 = sum:1 cout:1", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = H;
    b.voltage = H;
    cin.voltage = H;
    fa.evaluate();
    expect(isHigh(sum.voltage)).toBe(true);
    expect(isHigh(cout.voltage)).toBe(true);
  });
});
