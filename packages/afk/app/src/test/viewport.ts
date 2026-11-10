interface HappyDomWindow { happyDOM: { setViewport: (viewport: { width: number; height: number }) => void } }

/** Makes `(max-width: 760px)` match, as on a phone, until called with false. */
export function narrow(on: boolean): void {
  (window as unknown as HappyDomWindow).happyDOM.setViewport({ width: on ? 390 : 1024, height: on ? 844 : 768 });
}
