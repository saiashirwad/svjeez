import { useEffect, useId, useState } from "react";
import type { Json, JsonObject, Prop, UiHint } from "@svjeez/live";
import { isBoolean, isNumber, isString, optionsOf } from "./guards.ts";

const EASES = ["ease.linear", "ease.in", "ease.out", "ease.inOut", "ease.pop"];

const HEX = /^#[0-9a-f]{6}$/i;

interface ValueProps {
  readonly value: Json;
  readonly schema: JsonObject;
  readonly ui?: UiHint | undefined;
  /** The id of the control's input, so a `<label htmlFor>` can name it. */
  readonly id?: string | undefined;
  readonly onCommit: (value: Json) => void;
}

interface DraftProps {
  readonly value: string | number;
  readonly id?: string | undefined;
  readonly onCommit: (value: Json) => void;
}

/** A text or number box that sends its value on Enter or blur, so typing does not edit the source key by key. */
const Draft = ({ value, id, onCommit }: DraftProps) => {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    if (draft === String(value)) return;

    if (isNumber(value)) {
      const parsed = Number(draft);

      if (Number.isFinite(parsed)) onCommit(parsed);
      else setDraft(String(value));

      return;
    }

    onCommit(draft);
  };

  return (
    <input
      id={id}
      className="input"
      type={isNumber(value) ? "number" : "text"}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
};

/** One control for one JSON value, chosen from its schema and `x-ui` hint, then from the shape of the value. */
export const ValueControl = ({ value, schema, ui, id, onCommit }: ValueProps) => {
  const control = ui?.control;
  const options = optionsOf(schema);
  const minimum = schema["minimum"];
  const maximum = schema["maximum"];
  const step = ui?.["step"];

  if (control === "slider" && isNumber(value)) {
    const low = isNumber(minimum) ? minimum : 0;
    const high = isNumber(maximum) ? maximum : 100;
    const filled = high > low ? ((value - low) / (high - low)) * 100 : 0;

    return (
      <label className="slider">
        <input
          id={id}
          type="range"
          min={low}
          max={high}
          style={{ backgroundSize: `${Math.min(100, Math.max(0, filled))}% 100%` }}
          step={isNumber(step) ? step : 1}
          value={value}
          onChange={(event) => onCommit(Number(event.target.value))}
        />
        <output>{value}</output>
      </label>
    );
  }

  if (control === "segmented" && options.length > 0)
    return (
      <div className="segmented" role="group" id={id}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={option === value ? "on" : ""}
            aria-pressed={option === value}
            onClick={() => onCommit(option)}
          >
            {option}
          </button>
        ))}
      </div>
    );

  if (isString(value) && options.length > 0)
    return (
      <select
        id={id}
        className="input"
        value={value}
        onChange={(event) => onCommit(event.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    );

  if (isString(value) && EASES.includes(value))
    return (
      <select
        id={id}
        className="input"
        value={value}
        onChange={(event) => onCommit(event.target.value)}
      >
        {EASES.map((ease) => (
          <option key={ease}>{ease}</option>
        ))}
      </select>
    );

  if (isString(value) && (schema["format"] === "color" || HEX.test(value)) && HEX.test(value))
    return (
      <label className="color">
        <input
          id={id}
          type="color"
          className="swatch"
          value={value}
          onChange={(event) => onCommit(event.target.value)}
        />
        <code>{value}</code>
      </label>
    );

  if (isNumber(value)) return <Draft value={value} id={id} onCommit={onCommit} />;

  if (isBoolean(value))
    return (
      <input
        id={id}
        type="checkbox"
        className="checkbox"
        checked={value}
        onChange={(event) => onCommit(event.target.checked)}
      />
    );

  if (isString(value)) return <Draft value={value} id={id} onCommit={onCommit} />;

  const json = JSON.stringify(value);

  return (
    <span className="chip" title={json}>
      <code>{json}</code>
    </span>
  );
};

interface PropFieldProps {
  readonly name: string;
  readonly prop: Prop;
  readonly onCommit: (value: Json) => void;
}

/** A prop row: a control when the source holds a literal, otherwise why it cannot be edited and what it says. */
export const PropField = ({ name, prop, onCommit }: PropFieldProps) => {
  const id = useId();

  return (
    <div className="field">
      <label className="field-name" htmlFor={prop.editable ? id : undefined}>
        {name}
      </label>
      {prop.editable ? (
        <ValueControl
          value={prop.value}
          schema={prop.schema}
          ui={prop.ui}
          id={id}
          onCommit={onCommit}
        />
      ) : (
        <span className="chip" title={`Read-only ${prop.reason}: ${prop.text}`}>
          <span className="chip-reason">{prop.reason}</span>
          <code>{prop.text}</code>
        </span>
      )}
    </div>
  );
};
