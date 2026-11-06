import { useLayoutEffect, useRef } from "react";
import "@/screens/tools/RunOutput.css";

/** A command's output in a keyboard-scrollable block that follows new lines unless the reader scrolled up. */
export function RunOutput({ output, label }: { output: string; label: string }) {
  const block = useRef<HTMLPreElement>(null);
  const following = useRef(true);

  useLayoutEffect(() => {
    const element = block.current;
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [output]);

  const onScroll = () => {
    const element = block.current;
    if (element) following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
  };

  return <pre ref={block} className="tool-output" tabIndex={0} aria-label={label} onScroll={onScroll}>{output}</pre>;
}
