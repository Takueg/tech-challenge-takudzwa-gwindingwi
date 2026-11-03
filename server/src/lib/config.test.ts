import { describe, expect, it } from "vitest";
import { parsePort } from "./config.js";

describe("parsePort", () => {
  it("uses the fallback when nothing is set", () => {
    expect(parsePort(undefined, 4000)).toBe(4000);
  });

  it("reads a valid port", () => {
    expect(parsePort("8080", 4000)).toBe(8080);
  });

  it.each(["abc", "0", "70000", "80.5", ""])("refuses %j rather than starting on the wrong port", (value) => {
    expect(() => parsePort(value, 4000)).toThrow(/PORT/);
  });
});
