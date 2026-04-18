import { describe, expect, it } from "vitest";
import { WaveformBuffer } from "./waveform-buffer";

describe("WaveformBuffer", () => {
  it("initializes with N channels of given length", () => {
    const buf = new WaveformBuffer(3, 2048);
    expect(buf.channelCount).toBe(3);
    expect(buf.length).toBe(2048);
    expect(buf.writePointer).toBe(0);
  });

  it("throws if length is not power of 2", () => {
    expect(() => new WaveformBuffer(3, 1000)).toThrow();
  });

  it("push advances write pointer with bitwise wrap", () => {
    const buf = new WaveformBuffer(2, 4);
    buf.push([1.0, 2.0]);
    buf.push([3.0, 4.0]);
    expect(buf.writePointer).toBe(2);
    buf.push([5.0, 6.0]);
    buf.push([7.0, 8.0]);
    expect(buf.writePointer).toBe(0);
  });

  it("stores values in per-channel arrays", () => {
    const buf = new WaveformBuffer(2, 4);
    buf.push([1.0, 10.0]);
    buf.push([2.0, 20.0]);
    expect(buf.getChannel(0)[0]).toBe(1.0);
    expect(buf.getChannel(0)[1]).toBe(2.0);
    expect(buf.getChannel(1)[0]).toBe(10.0);
    expect(buf.getChannel(1)[1]).toBe(20.0);
  });

  it("reset clears all channels and pointer", () => {
    const buf = new WaveformBuffer(2, 4);
    buf.push([1.0, 2.0]);
    buf.reset();
    expect(buf.writePointer).toBe(0);
    expect(buf.getChannel(0)[0]).toBe(0);
  });

  it("throws if push values length doesn't match channelCount", () => {
    const buf = new WaveformBuffer(2, 4);
    expect(() => buf.push([1.0])).toThrow();
    expect(() => buf.push([1.0, 2.0, 3.0])).toThrow();
  });
});
