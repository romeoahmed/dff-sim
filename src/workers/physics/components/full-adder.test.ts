import { describe, expect, it } from "vitest";
import { DefaultPhysicsConfig } from "@/lib/constants";
import { createSeededRng } from "@/lib/rng";
import type { Port } from "@/lib/types";
import { settle } from "../test-helpers";
import { FullAdder } from "./full-adder";

const deps = { config: DefaultPhysicsConfig, rng: createSeededRng(5) };
const { logicHighMin, outputHighMax } = DefaultPhysicsConfig.voltage;
const H = outputHighMax;
const L = 0.0;
const dt = DefaultPhysicsConfig.simulation.physicsDt;
const settleTime = DefaultPhysicsConfig.gates.tPD * 20;

function makeFa(): {
  fa: FullAdder;
  a: Port;
  b: Port;
  cin: Port;
  sum: Port;
  cout: Port;
} {
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
  it("0+0+0 = sum:0 cout:0", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = L;
    b.voltage = L;
    cin.voltage = L;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(false);
    expect(isHigh(cout.voltage)).toBe(false);
  });
  it("1+0+0 = sum:1 cout:0", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = H;
    b.voltage = L;
    cin.voltage = L;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(true);
    expect(isHigh(cout.voltage)).toBe(false);
  });
  it("0+1+0 = sum:1 cout:0", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = L;
    b.voltage = H;
    cin.voltage = L;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(true);
    expect(isHigh(cout.voltage)).toBe(false);
  });
  it("1+1+0 = sum:0 cout:1", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = H;
    b.voltage = H;
    cin.voltage = L;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(false);
    expect(isHigh(cout.voltage)).toBe(true);
  });
  it("0+0+1 = sum:1 cout:0", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = L;
    b.voltage = L;
    cin.voltage = H;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(true);
    expect(isHigh(cout.voltage)).toBe(false);
  });
  it("1+0+1 = sum:0 cout:1", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = H;
    b.voltage = L;
    cin.voltage = H;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(false);
    expect(isHigh(cout.voltage)).toBe(true);
  });
  it("0+1+1 = sum:0 cout:1", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = L;
    b.voltage = H;
    cin.voltage = H;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(false);
    expect(isHigh(cout.voltage)).toBe(true);
  });
  it("1+1+1 = sum:1 cout:1", () => {
    const { fa, a, b, cin, sum, cout } = makeFa();
    a.voltage = H;
    b.voltage = H;
    cin.voltage = H;
    settle(fa, dt, settleTime);
    expect(isHigh(sum.voltage)).toBe(true);
    expect(isHigh(cout.voltage)).toBe(true);
  });
});
