import { useEffect, useRef, useState } from 'react';

export function CommandPanel({ value, label = 'Terminal' }: { value: string; label?: string }) {
  const [message, setMessage] = useState('');
  const [needsManualCopy, setNeedsManualCopy] = useState(false);
  const code = useRef<HTMLElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setNeedsManualCopy(false);
      setMessage('Copied. Nothing has been run.');
      timer.current = window.setTimeout(() => setMessage(''), 3500);
    } catch {
      setNeedsManualCopy(true);
      setMessage('Clipboard unavailable. Select the command and copy it manually.');
    }
  }

  function selectCommand() {
    if (!code.current) return;
    const range = document.createRange();
    range.selectNodeContents(code.current);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    code.current.focus();
  }

  return <div className="command-panel">
    <div className="command-panel-bar"><span>{label}</span><button type="button" onClick={copy} aria-label={`Copy command: ${value}`}>Copy</button></div>
    <pre><code ref={code} tabIndex={needsManualCopy ? 0 : undefined}>{value}</code></pre>
    <div className="command-panel-status" role="status"><span>{message}</span>{needsManualCopy && <button type="button" onClick={selectCommand}>Select command</button>}</div>
  </div>;
}
