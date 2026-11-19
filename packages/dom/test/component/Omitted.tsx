/** @jsxImportSource react */
import { memo, useEffect } from "react";

// Calls `onDone` unguarded, on mount and on click: it throws unless the browser supplies one.
export default memo(function Omitted({ label, onDone }: { label: string; onDone: () => void }) {
  useEffect(() => onDone(), [onDone]);

  return (
    <button id="omitted" onClick={() => onDone()}>
      {label}
    </button>
  );
});
