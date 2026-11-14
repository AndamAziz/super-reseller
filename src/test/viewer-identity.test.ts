import { describe, it, expect } from "vitest";
import { viewerIp, deviceIp } from "@/lib/stream-proxy.server";

describe("viewer identity for connection counting", () => {
  it("skips a Cloudflare relay IP and uses the viewer's forwarded address", () => {
    const h = new Headers({ "cf-connecting-ip": "2a06:98c0:3600::103", "x-forwarded-for": "89.245.182.175, 2a06:98c0:3600::103" });
    expect(viewerIp(h)).toBe("89.245.182.175");
  });
  it("uses the connecting IP when it is a real viewer", () => {
    expect(viewerIp(new Headers({ "cf-connecting-ip": "176.222.63.150", "x-forwarded-for": "1.2.3.4" }))).toBe("176.222.63.150");
  });
  it("treats rotating IPv6 privacy addresses in one /64 as one device", () => {
    expect(deviceIp("2a07:8241:fff:1107:0:89:0:4da")).toBe(deviceIp("2a07:8241:0fff:1107:abcd::1"));
    expect(deviceIp("2a07:8241:fff:1107::1")).not.toBe(deviceIp("2a07:8241:fff:1108::1"));
  });
  it("keeps IPv4 addresses distinct per device", () => {
    expect(deviceIp("89.245.182.175")).not.toBe(deviceIp("89.245.182.176"));
  });
});
