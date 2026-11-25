/** @jsxImportSource react */
import { memo, useEffect } from "react";

export default memo(function Omitted({ label, onDone }: { label: string; onDone: () => void }) {
  useEffect(() => onDone(), [onDone]);

  return (
    <button id="omitted" onClick={() => onDone()}>
      {label}
    </button>
  );
});
