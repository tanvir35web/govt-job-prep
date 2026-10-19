"use client";

import { useSyncExternalStore } from "react";

// Browser fullscreen for the Reels feed. A web page cannot hide the browser's own bars any other way.
// Supported by Chrome on Android and desktop browsers; iPhone Safari has no fullscreen for pages, so
// there the controls stay hidden and installing the app to the home screen is the way to lose the bars.

function subscribe(callback: () => void) {
  document.addEventListener("fullscreenchange", callback);
  return () => document.removeEventListener("fullscreenchange", callback);
}

const noopSubscribe = () => () => {};

/** True where the page may go fullscreen. Always false during server rendering. */
export function useFullscreenSupported() {
  return useSyncExternalStore(
    noopSubscribe,
    () => document.fullscreenEnabled === true,
    () => false,
  );
}

/** True while the page is fullscreen. */
export function useIsFullscreen() {
  return useSyncExternalStore(
    subscribe,
    () => document.fullscreenElement !== null,
    () => false,
  );
}

/** Must run inside a tap or click handler; browsers refuse fullscreen otherwise. Failures are ignored. */
export function enterFullscreen() {
  if (!document.fullscreenEnabled || document.fullscreenElement) return;
  document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
}

export function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

/** On phones and tablets only: a desktop user clicking a reel does not expect the window to take over the screen. */
export function enterFullscreenOnTouch() {
  if (window.matchMedia("(pointer: coarse)").matches) enterFullscreen();
}
