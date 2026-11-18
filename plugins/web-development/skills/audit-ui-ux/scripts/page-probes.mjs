#!/usr/bin/env node
/**
 * Deterministic in-page accessibility and layout probes.
 *
 * Print a self-contained browser expression and evaluate it in the audited page:
 *   node page-probes.mjs [--limit 40] [--focus] [--inventory] [--max-text-nodes 3000]
 * The expression returns JSON-serializable results. Rects are document coordinates in CSS px.
 */

import { fileURLToPath } from "node:url";

export function parseColor(value) {
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  if (text === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = text.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      digits = [...digits].map((digit) => digit + digit).join("");
    }
    if (digits.length !== 6 && digits.length !== 8) return null;
    const channel = (index) => parseInt(digits.slice(index, index + 2), 16);
    return {
      r: channel(0),
      g: channel(2),
      b: channel(4),
      a: digits.length === 8 ? Math.round((channel(6) / 255) * 1000) / 1000 : 1,
    };
  }
  const rgb = text.match(/^rgba?\(([^)]+)\)$/);
  if (!rgb) return null;
  const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const component = (part) =>
    part.endsWith("%") ? (parseFloat(part) / 100) * 255 : parseFloat(part);
  const alphaPart = parts[3];
  const alpha =
    alphaPart === undefined
      ? 1
      : alphaPart.endsWith("%")
        ? parseFloat(alphaPart) / 100
        : parseFloat(alphaPart);
  const color = {
    r: component(parts[0]),
    g: component(parts[1]),
    b: component(parts[2]),
    a: alpha,
  };
  return Object.values(color).every(Number.isFinite) ? color : null;
}

export function blendColors(top, bottom) {
  const alpha = top.a + bottom.a * (1 - top.a);
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (channel) =>
    (top[channel] * top.a + bottom[channel] * bottom.a * (1 - top.a)) / alpha;
  return { r: mix("r"), g: mix("g"), b: mix("b"), a: alpha };
}

export function relativeLuminance(color) {
  const linear = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

export function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  return Math.round(ratio * 100) / 100;
}

export function isLargeText(fontSizePx, fontWeight) {
  const weight = Number.parseInt(fontWeight, 10) || (fontWeight === "bold" ? 700 : 400);
  return fontSizePx >= 24 || (fontSizePx >= 18.66 && weight >= 700);
}

export function requiredContrast(fontSizePx, fontWeight) {
  return isLargeText(fontSizePx, fontWeight) ? 3 : 4.5;
}

/** Color tokens inside a computed background-image, such as a gradient. */
export function extractColors(value) {
  return String(value).match(/(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\)|#[0-9a-f]{3,8}\b|\btransparent\b/gi) ?? [];
}

export function formatColor(color) {
  const round = (value) => Math.round(value);
  return color.a >= 1
    ? `rgb(${round(color.r)}, ${round(color.g)}, ${round(color.b)})`
    : `rgba(${round(color.r)}, ${round(color.g)}, ${round(color.b)}, ${Math.round(color.a * 100) / 100})`;
}

/** Runs inside the audited page. Every helper it calls is serialized beside it. */
export function runProbes(options = {}) {
  const limit = options.limit ?? 40;
  const maxTextNodes = options.maxTextNodes ?? 3000;
  const doc = document;
  const view = window;
  const scrollX = view.scrollX;
  const scrollY = view.scrollY;
  const white = { r: 255, g: 255, b: 255, a: 1 };
  // Modern color syntaxes (oklch, color(), lab) are normalized by painting one canvas pixel.
  const canvasContext = doc.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const toRgb = (value) => {
    const parsed = parseColor(value);
    if (parsed || !canvasContext || !value) return parsed;
    canvasContext.clearRect(0, 0, 1, 1);
    canvasContext.fillStyle = "#000";
    canvasContext.fillStyle = value;
    if (canvasContext.fillStyle === "#000000" && !/^(black|#000|#000000|rgb\(0,\s*0,\s*0\))$/i.test(value)) {
      return null;
    }
    canvasContext.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = canvasContext.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: Math.round((a / 255) * 1000) / 1000 };
  };

  const capped = () => ({ total: 0, items: [] });
  const push = (bucket, item) => {
    bucket.total += 1;
    if (bucket.items.length < limit) bucket.items.push(item);
  };
  const clip = (text, length = 80) => {
    const clean = (text ?? "").replace(/\s+/g, " ").trim();
    return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
  };
  const rectOf = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.left + scrollX),
      y: Math.round(rect.top + scrollY),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    };
  };
  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = view.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0;
  };
  const selectorFor = (element) => {
    const parts = [];
    let current = element;
    while (current && current.nodeType === 1 && current !== doc.body && parts.length < 5) {
      if (current.id && doc.querySelectorAll(`#${CSS.escape(current.id)}`).length === 1) {
        parts.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      let part = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((child) => child.tagName === current.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      current = parent;
    }
    return parts.join(" > ") || "body";
  };

  const textOf = (element) => clip(element.textContent ?? "", 120);
  const accessibleName = (element) => {
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => doc.getElementById(id)?.textContent ?? "")
        .join(" ");
      if (text.trim()) return { name: clip(text), source: "aria-labelledby" };
    }
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) return { name: clip(ariaLabel), source: "aria-label" };
    const tag = element.tagName.toLowerCase();
    if (["input", "select", "textarea"].includes(tag)) {
      if (["button", "submit", "reset"].includes(element.type) && element.value) {
        return { name: clip(element.value), source: "value" };
      }
      const labels = element.labels ? [...element.labels] : [];
      const labelText = labels.map((label) => label.textContent ?? "").join(" ");
      if (labelText.trim()) return { name: clip(labelText), source: "label" };
    }
    if (tag === "img") {
      const alt = element.getAttribute("alt");
      if (alt && alt.trim()) return { name: clip(alt), source: "alt" };
    }
    if (!["input", "select", "textarea"].includes(tag)) {
      const imageAlts = [...element.querySelectorAll("img[alt], [role=img][aria-label]")]
        .map((image) => image.getAttribute("alt") || image.getAttribute("aria-label") || "")
        .join(" ");
      const text = `${element.innerText ?? element.textContent ?? ""} ${imageAlts}`;
      if (text.trim()) return { name: clip(text), source: "content" };
    }
    const title = element.getAttribute("title");
    if (title && title.trim()) return { name: clip(title), source: "title" };
    const placeholder = element.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) return { name: clip(placeholder), source: "placeholder" };
    return { name: "", source: "none" };
  };

  // Returns every plausible backdrop color. Gradients contribute each stop, so contrast is a range.
  const effectiveBackgrounds = (element) => {
    const layers = [];
    let current = element;
    let opaque = false;
    while (current && current.nodeType === 1 && !opaque) {
      const style = view.getComputedStyle(current);
      const image = style.backgroundImage;
      if (image && image !== "none") {
        if (/url\(/i.test(image)) {
          return { colors: null, reason: `background-image url on ${selectorFor(current)}` };
        }
        const stops = extractColors(image).map(toRgb);
        if (stops.length === 0 || stops.some((stop) => !stop)) {
          return { colors: null, reason: `unparsed gradient on ${selectorFor(current)}` };
        }
        layers.push({ stops });
      }
      const color = toRgb(style.backgroundColor);
      if (!color) return { colors: null, reason: `unparsed-color ${style.backgroundColor}` };
      if (color.a > 0) layers.push({ stops: [color] });
      opaque = color.a >= 1;
      current = current.parentElement;
    }
    let candidates = [white];
    for (const layer of layers.reverse()) {
      const next = [];
      for (const base of candidates) for (const stop of layer.stops) next.push(blendColors(stop, base));
      const unique = new Map(next.map((color) => [formatColor(color), color]));
      candidates = [...unique.values()].slice(0, 24);
    }
    return { colors: candidates, reason: "", gradient: layers.some((layer) => layer.stops.length > 1) };
  };

  // Contrast of text-bearing elements.
  const contrast = { checked: 0, failures: capped(), unknown: capped() };
  const textParents = new Set();
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.textContent && node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  let visitedTextNodes = 0;
  while (walker.nextNode() && visitedTextNodes < maxTextNodes) {
    visitedTextNodes += 1;
    const parent = walker.currentNode.parentElement;
    if (parent && !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(parent.tagName)) {
      textParents.add(parent);
    }
  }
  for (const element of textParents) {
    if (!isVisible(element)) continue;
    const style = view.getComputedStyle(element);
    const fontSize = parseFloat(style.fontSize);
    const required = requiredContrast(fontSize, style.fontWeight);
    const foreground = toRgb(style.color);
    const base = {
      selector: selectorFor(element),
      text: clip(element.textContent, 60),
      fontSize,
      fontWeight: style.fontWeight,
      required,
      rect: rectOf(element),
    };
    contrast.checked += 1;
    const backgrounds = effectiveBackgrounds(element);
    if (!foreground || !backgrounds.colors) {
      push(contrast.unknown, { ...base, reason: foreground ? backgrounds.reason : `unparsed-color ${style.color}` });
      continue;
    }
    const pairs = backgrounds.colors.map((background) => {
      const shown = foreground.a < 1 ? blendColors(foreground, background) : foreground;
      return { ratio: contrastRatio(shown, background), shown, background };
    });
    pairs.sort((left, right) => left.ratio - right.ratio);
    const worst = pairs[0];
    const best = pairs[pairs.length - 1];
    const detail = {
      ...base,
      ratio: worst.ratio,
      foreground: formatColor(worst.shown),
      background: formatColor(worst.background),
      ...(backgrounds.gradient ? { gradient: true, bestRatio: best.ratio } : {}),
    };
    if (best.ratio < required) push(contrast.failures, detail);
    else if (worst.ratio < required) {
      push(contrast.unknown, { ...detail, reason: "gradient: fails on part of the backdrop; check where the text sits" });
    }
  }

  // Interactive elements: names and target size.
  const interactiveSelector = [
    "a[href]",
    "button",
    "input:not([type=hidden])",
    "select",
    "textarea",
    "summary",
    "[role=button]",
    "[role=link]",
    "[role=checkbox]",
    "[role=radio]",
    "[role=switch]",
    "[role=tab]",
    "[role=menuitem]",
    "[role=option]",
    "[role=combobox]",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  const interactive = [...doc.querySelectorAll(interactiveSelector)].filter(isVisible);
  const names = { missing: capped(), placeholderOnly: capped(), labelNotInName: capped() };
  const targets = capped();
  for (const element of interactive) {
    const { name, source } = accessibleName(element);
    const item = { selector: selectorFor(element), rect: rectOf(element) };
    if (!name) push(names.missing, { ...item, tag: element.tagName.toLowerCase() });
    else if (source === "placeholder") push(names.placeholderOnly, { ...item, name });
    else if (source === "aria-label" || source === "aria-labelledby") {
      // Visible label text, ignoring decoration hidden from assistive technology.
      const copy = element.cloneNode(true);
      copy.querySelectorAll("[aria-hidden=true]").forEach((node) => node.remove());
      const visible = clip(copy.textContent ?? "", 80).toLowerCase();
      if (visible && !name.toLowerCase().includes(visible)) {
        push(names.labelNotInName, { ...item, name, visible });
      }
    }
    const rect = element.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 24) {
      const style = view.getComputedStyle(element);
      const parentText = element.parentElement?.textContent ?? "";
      const inline =
        element.tagName === "A" &&
        style.display.startsWith("inline") &&
        parentText.trim().length > (element.textContent ?? "").trim().length + 20;
      push(targets, { ...item, name, width: Math.round(rect.width), height: Math.round(rect.height), inline });
    }
  }

  // Obscured controls: the element at a control's centre belongs to something else, such as a
  // sticky banner, overlay, or chat widget (WCAG 2.4.11 and FL-18).
  const obscured = capped();
  for (const element of interactive) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (x < 0 || y < 0 || x > view.innerWidth || y > view.innerHeight) continue;
    const top = doc.elementFromPoint(x, y);
    if (top && top !== element && !element.contains(top) && !top.contains(element)) {
      push(obscured, {
        selector: selectorFor(element),
        name: accessibleName(element).name,
        rect: rectOf(element),
        coveredBy: selectorFor(top),
        coverText: clip(top.textContent, 60),
      });
    }
  }

  // Images.
  const images = capped();
  for (const image of doc.querySelectorAll("img, svg[role=img], [role=img]")) {
    if (!isVisible(image)) continue;
    const tag = image.tagName.toLowerCase();
    const missing =
      tag === "img" ? !image.hasAttribute("alt") : !accessibleName(image).name;
    if (missing) push(images, { selector: selectorFor(image), rect: rectOf(image), src: clip(image.getAttribute("src") ?? "", 100) });
  }

  // Headings.
  const headingList = [...doc.querySelectorAll("h1, h2, h3, h4, h5, h6, [role=heading]")]
    .filter(isVisible)
    .map((heading) => ({
      level: Number(heading.getAttribute("aria-level")) || Number(heading.tagName.slice(1)) || 2,
      text: clip(heading.textContent, 80),
      selector: selectorFor(heading),
    }));
  const headingIssues = [];
  const h1Count = headingList.filter((heading) => heading.level === 1).length;
  if (h1Count !== 1) headingIssues.push(`${h1Count} level-1 headings`);
  headingList.forEach((heading, index) => {
    const previous = headingList[index - 1];
    if (previous && heading.level > previous.level + 1) {
      headingIssues.push(`Skips from h${previous.level} to h${heading.level} at "${heading.text}"`);
    }
  });

  // Landmarks and page.
  const count = (selector) => doc.querySelectorAll(selector).length;
  const landmarks = {
    main: count("main, [role=main]"),
    nav: count("nav, [role=navigation]"),
    header: count("header, [role=banner]"),
    footer: count("footer, [role=contentinfo]"),
    skipLink: [...doc.querySelectorAll("a[href^='#']")].some((link) => /skip|main|content/i.test(link.textContent ?? "")),
  };

  // Overflow and truncation.
  const viewportWidth = doc.documentElement.clientWidth;
  const overflow = {
    page: doc.documentElement.scrollWidth > viewportWidth + 1,
    scrollWidth: doc.documentElement.scrollWidth,
    viewportWidth,
    offenders: capped(),
  };
  const truncation = capped();
  const allElements = [...doc.body.querySelectorAll("*")];
  const reported = new Set();
  for (const element of allElements) {
    if (!isVisible(element)) continue;
    const rect = element.getBoundingClientRect();
    const style = view.getComputedStyle(element);
    if (overflow.page && rect.right + scrollX > viewportWidth + 1 && style.position !== "fixed") {
      let ancestor = element.parentElement;
      let nested = false;
      while (ancestor) {
        if (reported.has(ancestor)) nested = true;
        ancestor = ancestor.parentElement;
      }
      if (!nested) {
        reported.add(element);
        push(overflow.offenders, { selector: selectorFor(element), rect: rectOf(element), right: Math.round(rect.right + scrollX) });
      }
    }
    const text = element.textContent ?? "";
    // Skip visually hidden text (sr-only patterns render at 1 px) and containers.
    if (!text.trim() || element.children.length > 3 || rect.width <= 2 || rect.height <= 2) continue;
    const clipsX =
      element.scrollWidth > element.clientWidth + 1 &&
      (style.textOverflow === "ellipsis" || ["hidden", "clip"].includes(style.overflowX));
    const clamp = style.webkitLineClamp && style.webkitLineClamp !== "none";
    const clipsY = clamp && element.scrollHeight > element.clientHeight + 1;
    if (clipsX || clipsY) {
      push(truncation, {
        selector: selectorFor(element),
        rect: rectOf(element),
        fullText: clip(text, 160),
        title: element.getAttribute("title") ?? "",
        kind: clipsY ? "line-clamp" : "horizontal",
      });
    }
  }

  // Focus order.
  const tabbable = interactive.filter(
    (element) => !element.disabled && element.getAttribute("tabindex") !== "-1",
  );
  const focusables = {
    count: tabbable.length,
    positiveTabindex: tabbable
      .filter((element) => Number(element.getAttribute("tabindex")) > 0)
      .slice(0, limit)
      .map((element) => ({ selector: selectorFor(element), tabindex: Number(element.getAttribute("tabindex")) })),
  };

  // Optional focus-indicator heuristic. Focusing can trigger page handlers, so it is opt-in.
  let focus;
  if (options.focus) {
    focus = { checked: 0, noVisibleChange: capped(), note: "Heuristic: compares styles before and after programmatic focus." };
    const snapshot = (element) => {
      const style = view.getComputedStyle(element);
      return [
        style.outlineStyle,
        style.outlineWidth,
        style.outlineColor,
        style.boxShadow,
        style.borderColor,
        style.backgroundColor,
        style.color,
        style.textDecorationLine,
      ].join("|");
    };
    const previousFocus = doc.activeElement;
    for (const element of tabbable.slice(0, limit * 2)) {
      const before = snapshot(element);
      element.focus({ preventScroll: true });
      const after = snapshot(element);
      element.blur();
      focus.checked += 1;
      if (before === after) push(focus.noVisibleChange, { selector: selectorFor(element), rect: rectOf(element), name: accessibleName(element).name });
    }
    if (previousFocus && previousFocus.focus) previousFocus.focus({ preventScroll: true });
  }

  // Optional style inventory: the values the page actually uses, for comparison with tokens.
  let inventory;
  if (options.inventory) {
    const tallies = { color: new Map(), background: new Map(), border: new Map(), fontSize: new Map(), fontFamily: new Map(), radius: new Map(), shadow: new Map() };
    const tally = (map, value, element) => {
      if (!value) return;
      const entry = map.get(value) ?? { value, count: 0, example: selectorFor(element) };
      entry.count += 1;
      map.set(value, entry);
    };
    const normalized = (value) => {
      const color = toRgb(value);
      return color && color.a > 0 ? formatColor(color) : "";
    };
    for (const element of allElements) {
      if (!isVisible(element)) continue;
      const style = view.getComputedStyle(element);
      const hasText = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
      if (hasText) {
        tally(tallies.color, normalized(style.color), element);
        tally(tallies.fontSize, style.fontSize, element);
        tally(tallies.fontFamily, style.fontFamily.split(",")[0].replace(/["']/g, "").trim(), element);
      }
      tally(tallies.background, normalized(style.backgroundColor), element);
      if (parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== "none") {
        tally(tallies.border, normalized(style.borderTopColor), element);
      }
      if (style.borderTopLeftRadius !== "0px") tally(tallies.radius, style.borderTopLeftRadius, element);
      if (style.boxShadow !== "none") tally(tallies.shadow, style.boxShadow, element);
    }
    inventory = Object.fromEntries(
      Object.entries(tallies).map(([key, map]) => [key, [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit * 2)]),
    );
  }

  return {
    page: {
      url: view.location.href,
      title: doc.title,
      lang: doc.documentElement.getAttribute("lang") ?? "",
      viewport: { width: view.innerWidth, height: view.innerHeight, dpr: view.devicePixelRatio },
      scroll: { x: scrollX, y: scrollY },
      document: { width: doc.documentElement.scrollWidth, height: doc.documentElement.scrollHeight },
    },
    contrast,
    targets,
    obscured,
    names: names.missing,
    placeholderOnly: names.placeholderOnly,
    labelNotInName: names.labelNotInName,
    images,
    headings: { list: headingList.slice(0, limit * 2), issues: headingIssues },
    landmarks,
    overflow,
    truncation,
    focusables,
    ...(focus ? { focus } : {}),
    ...(inventory ? { inventory } : {}),
    limits: { limit, maxTextNodes, textNodesVisited: visitedTextNodes },
  };
}

const HELPERS = [
  parseColor,
  blendColors,
  relativeLuminance,
  contrastRatio,
  isLargeText,
  requiredContrast,
  extractColors,
  formatColor,
  runProbes,
];

export function probeSource(options = {}) {
  const helpers = HELPERS.map((helper) => helper.toString()).join("\n");
  return `(() => {\n${helpers}\nreturn runProbes(${JSON.stringify(options)});\n})()`;
}

export function parseCliOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--focus") options.focus = true;
    else if (argument === "--inventory") options.inventory = true;
    else if (argument === "--limit" || argument === "--max-text-nodes") {
      const value = Number(args[index + 1]);
      if (!Number.isInteger(value) || value < 1) throw new Error(`${argument} needs a positive integer`);
      options[argument === "--limit" ? "limit" : "maxTextNodes"] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.stdout.write(`${probeSource(parseCliOptions(process.argv.slice(2)))}\n`);
  } catch (error) {
    console.error(error.message);
    console.error("Usage: page-probes.mjs [--limit <n>] [--max-text-nodes <n>] [--focus] [--inventory]");
    process.exit(2);
  }
}
