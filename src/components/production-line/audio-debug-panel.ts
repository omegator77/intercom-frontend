/**
 * Temporary on-device diagnostics for remote audio (open the app once with ?audiodebug=1; the flag is
 * kept for the browser session). Shows what the audio element and the Web Audio graph report and offers
 * switches to find out which of them actually changes what is audible on Android. Does nothing without
 * the flag.
 */
import { getGainControl } from "./audio-gain-control.ts";

const FLAG = "audiodebug";
const PANEL_ID = "audio-debug-panel";

const flagged = (): boolean => {
  try {
    return window.sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
};

// Read at load: the app may redirect and drop the query string long before the first audio element
// exists.
try {
  if (new URLSearchParams(window.location.search).has(FLAG)) {
    window.sessionStorage.setItem(FLAG, "1");
  }
} catch {
  // storage unavailable: the panel simply stays off
}

if (flagged()) {
  const showBadge = () => {
    const badge = document.createElement("div");
    badge.textContent = "audiodebug aktiv";
    badge.style.cssText =
      "position:fixed;top:0;left:0;z-index:99999;background:#c00;color:#fff;font:11px monospace;padding:2px 6px;";
    document.body.append(badge);
  };
  if (document.body) showBadge();
  else document.addEventListener("DOMContentLoaded", showBadge);
}

const nativeGet = (prop: "muted" | "volume") =>
  Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, prop)?.get;
const nativeSet = (prop: "muted" | "volume") =>
  Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, prop)?.set;

const createdElements: HTMLAudioElement[] = [];

const TRACE_LIMIT = 40;
const traceLines: string[] = [];
const traceStart = Date.now();

/** Diagnostics: a short timeline of what happens to the audio elements (shown in the panel). */
export const trace = (message: string) => {
  traceLines.push(
    `${((Date.now() - traceStart) / 1000).toFixed(1)}s ${message}`
  );
  if (traceLines.length > TRACE_LIMIT) traceLines.shift();
};

/** Called for every audio element the app creates: the panel lists all of them, not just the last. */
export const noteAudioElementCreated = (element: HTMLAudioElement) => {
  createdElements.push(element);
  trace(`element #${createdElements.length} created`);
};

let appList: HTMLAudioElement[] | null | undefined;
let appListUpdates = 0;

/** The call card reports the list it works with, so the panel can show what the app really holds. */
export const reportAppAudioElements = (
  elements: HTMLAudioElement[] | null | undefined
) => {
  appList = elements;
  appListUpdates += 1;
  trace(
    `call card now sees ${elements == null ? String(elements) : `${elements.length} element(s)`}`
  );
};

export const showAudioDebug = (
  element: HTMLAudioElement,
  stream: MediaStream
): void => {
  if (!flagged()) return;

  document.getElementById(PANEL_ID)?.remove();
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;z-index:99999;max-height:50vh;overflow:auto;" +
    "background:rgba(0,0,0,.88);color:#fff;font:12px/1.35 monospace;padding:8px;";
  const info = document.createElement("pre");
  info.style.cssText = "margin:0 0 6px;white-space:pre-wrap;";
  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;";
  panel.append(info, buttons);
  document.body.append(panel);

  const original = stream.getAudioTracks()[0];
  const control = getGainControl(element);
  const silentTrack = control?.silent.getAudioTracks()[0];

  const addButton = (label: string, action: () => void) => {
    const button = document.createElement("button");
    button.textContent = label;
    button.style.cssText = "padding:6px 8px;font:12px monospace;";
    button.addEventListener("click", () => {
      try {
        action();
      } catch (e) {
        info.textContent = `error: ${String(e)}`;
      }
    });
    buttons.append(button);
  };

  addButton("WebAudio gain 0 / 1", () => {
    if (!control) throw new Error("no gain control on this element");
    control.gain.gain.value = control.gain.gain.value > 0 ? 0 : 1;
  });
  addButton("Original-Track enabled an/aus", () => {
    original.enabled = !original.enabled;
  });
  addButton("Klon im Element enabled an/aus", () => {
    if (!silentTrack) throw new Error("no silent clone on this element");
    silentTrack.enabled = !silentTrack.enabled;
  });
  addButton("Element nativ muted an/aus", () => {
    nativeSet("muted")?.call(element, !nativeGet("muted")?.call(element));
  });
  addButton("Context resume", () => {
    control?.ctx.resume().catch(() => undefined);
  });

  const update = () => {
    const c = control?.ctx;
    info.textContent = [
      `UA: ${navigator.userAgent.slice(0, 110)}`,
      `webaudio: ${control ? "attached" : "NOT attached"} ctx=${c?.state ?? "-"} ` +
        `rate=${c?.sampleRate ?? "-"} outLat=${(c as AudioContext | undefined)?.outputLatency ?? "-"} ` +
        `gain=${control?.gain.gain.value ?? "-"}`,
      `element: nativeMuted=${nativeGet("muted")?.call(element)} ` +
        `paused=${element.paused} readyState=${element.readyState}`,
      `original track: enabled=${original?.enabled} muted=${original?.muted} state=${original?.readyState}`,
      `element's silent clone: ${silentTrack ? `enabled=${silentTrack.enabled}` : "none"}`,
      `audio elements created in this page: ${createdElements.length} (the panel controls belong to the LAST one)`,
      `trace (newest last):\n${traceLines.join("\n")}`,
      `call card's own list: ${
        appList == null
          ? String(appList)
          : `${appList.length} element(s): ${
              appList
                .map((el) => `#${createdElements.indexOf(el) + 1 || "?"}`)
                .join(" ") || "-"
            }`
      } (updated x${appListUpdates})`,
      ...createdElements.map((el, i) => {
        const ctl = getGainControl(el);
        return (
          `#${i + 1}${el === element ? "*" : " "} app set volume x${ctl?.stats.volumeSets ?? "-"} ` +
          `(last ${ctl?.stats.lastVolume ?? "-"}) muted x${ctl?.stats.mutedSets ?? "-"} ` +
          `(last ${ctl?.stats.lastMuted ?? "-"}) gain=${ctl?.gain.gain.value ?? "-"} ` +
          `ctx=${ctl?.ctx.state ?? "-"} paused=${el.paused}`
        );
      }),
    ].join("\n");
  };
  update();
  const timer = window.setInterval(() => {
    if (!panel.isConnected) {
      window.clearInterval(timer);
      return;
    }
    update();
  }, 500);
};
