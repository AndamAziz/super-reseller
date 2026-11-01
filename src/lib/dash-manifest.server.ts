import { DOMParser, XMLSerializer, type Element as XmlElement } from "@xmldom/xmldom";
import { signTarget, unb64u, allowedUrl } from "./stream-proxy.server";

const encode = (value: string) => btoa(String.fromCharCode(...new TextEncoder().encode(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const tokens = /\$(RepresentationID|Number|Bandwidth|Time)(%0\d+d)?\$/g;

/** Only substitutions from an exact, server-signed DASH template are accepted. */
export async function resolveDashTarget(params: URLSearchParams, scope: string): Promise<URL | null> {
  let raw: string;
  try { raw = unb64u(params.get("t") ?? ""); } catch { return null; }
  const template = await allowedUrl(raw, params.get("s") ?? "", `${scope}:dash-template`);
  if (!template) return null;
  let valid = true;
  const resolved = template.toString().replace(tokens, (_match, name: string, padding: string | undefined) => {
    const value = params.get(`d${name}`) ?? "";
    if (name === "RepresentationID" ? !/^[a-zA-Z0-9_-]{1,128}$/.test(value) : !/^\d{1,20}$/.test(value)) { valid = false; return ""; }
    const width = padding ? Number(padding.slice(2, -1)) : 0;
    if (width > 20) { valid = false; return ""; }
    return width ? value.padStart(width, "0") : value;
  }).replace(/\$\$/g, "$");
  if (!valid || /\$[^$]*\$/.test(resolved)) return null;
  const result = new URL(resolved);
  // Substitutions cannot change scheme, host, or insert slash/path traversal.
  return result.origin === template.origin ? result : null;
}

export async function rewriteDash(text: string, from: string, prefix: string, scope: string): Promise<string> {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("Unsupported DASH document declarations");
  const doc = new DOMParser({ onError: (level, message) => { if (level === "fatalError" || level === "error") throw new Error(message); } }).parseFromString(text, "application/xml");
  if (doc.documentElement.localName !== "MPD") throw new Error("Invalid DASH manifest");
  const children = (el: XmlElement, name?: string) => Array.from(el.childNodes).filter((node): node is XmlElement => node.nodeType === 1 && (!name || (node as XmlElement).localName === name));
  const link = async (value: string, base: string) => {
    const full = new URL(value, base).toString();
    if (!/^https?:/.test(full)) throw new Error("Unsupported DASH resource scheme");
    const separator = prefix.includes("?") ? "&" : "?";
    if (/\$(RepresentationID|Number|Bandwidth|Time)/.test(full)) {
      const names = [...full.matchAll(tokens)].map((match) => match[1]);
      let out = `${prefix}${separator}t=${encode(full)}&s=${await signTarget(`${scope}:dash-template`, full)}`;
      for (const name of new Set(names)) out += `&d${name}=$${name}$`;
      return out;
    }
    return `${prefix}${separator}u=${encode(full)}&s=${await signTarget(scope, full)}`;
  };
  const walk = async (el: XmlElement, inheritedBase: string, inheritedTemplates: XmlElement[]) => {
    if (el.hasAttribute("xlink:href")) throw new Error("DASH external XML links are unsupported");
    const bases = children(el, "BaseURL");
    const base = bases[0]?.textContent?.trim() ? new URL(bases[0].textContent.trim(), inheritedBase).toString() : inheritedBase;
    for (const item of bases) el.removeChild(item);
    const own = children(el).filter((item) => ["SegmentTemplate", "SegmentList", "SegmentBase"].includes(item.localName));
    const inherited = [...inheritedTemplates];
    for (const item of own) {
      const previous = inherited.find((old) => old.localName === item.localName);
      const merged = item.cloneNode(true) as XmlElement;
      if (previous) {
        for (const attr of Array.from(previous.attributes)) if (!merged.hasAttribute(attr.name)) merged.setAttribute(attr.name, attr.value);
        if (!children(merged).length) for (const child of children(previous)) merged.appendChild(child.cloneNode(true));
      }
      const index = inherited.findIndex((old) => old.localName === item.localName);
      if (index >= 0) inherited.splice(index, 1);
      inherited.push(merged); el.removeChild(item);
    }
    if (el.localName === "Representation") {
      if (inherited.length) for (const template of inherited) el.appendChild(template.cloneNode(true));
      const rewrittenBase = doc.createElementNS(doc.documentElement.namespaceURI, "BaseURL");
      rewrittenBase.textContent = await link(base, inheritedBase);
      el.insertBefore(rewrittenBase, el.firstChild);
      for (const resource of Array.from(el.getElementsByTagName("*"))) {
        for (const attr of ["media", "initialization", "sourceURL", "index"]) {
          if (resource.hasAttribute(attr)) resource.setAttribute(attr, await link(resource.getAttribute(attr) ?? "", base));
        }
      }
      return;
    }
    for (const child of children(el)) {
      if (["Location", "PatchLocation"].includes(child.localName)) {
        if (child.localName === "PatchLocation") throw new Error("DASH patches are unsupported");
        child.textContent = await link(child.textContent ?? "", base);
      } else if (child.localName === "UTCTiming" && /http/.test(child.getAttribute("schemeIdUri") ?? "")) {
        child.setAttribute("value", await link(child.getAttribute("value") ?? "", base));
      } else await walk(child, base, inherited);
    }
  };
  await walk(doc.documentElement, from, []);
  return new XMLSerializer().serializeToString(doc);
}