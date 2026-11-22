import { useEffect, useState } from "react";
import type { Json, JsonObject, Prop, UiHint } from "@svjeez/live";
import { isBoolean, isNumber, isString, optionsOf } from "./guards.ts";

const EASES = ["ease.linear", "ease.in", "ease.out", "ease.inOut", "ease.pop"];

const HEX = /^#[0-9a-f]{6}$/i;

interface ValueProps {
  readonly value: Json;
  readonly schema: JsonObject;
  readonly ui?: UiHint | undefined;
  readonly onCommit: (value: Json) => void;
}

interface DraftProps {
  readonly value: string | number;
  readonly onCommit: (value: Json) => void;
}

/** A text or number box that sends its value on Enter or blur, so typing does not edit the source key by key. */
const Draft = ({ value, onCommit }: DraftProps) => {
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
export const ValueControl = ({ value, schema, ui, onCommit }: ValueProps) => {
  const control = ui?.control;
  const options = optionsOf(schema);
  const minimum = schema["minimum"];
  const maximum = schema["maximum"];
  const step = ui?.["step"];

  if (control === "slider" && isNumber(value))
    return (
      <label className="slider">
        <input
          type="range"
          min={isNumber(minimum) ? minimum : 0}
          max={isNumber(maximum) ? maximum : 100}
          step={isNumber(step) ? step : 1}
          value={value}
          onChange={(event) => onCommit(Number(event.target.value))}
        />
        <output>{value}</output>
      </label>
    );

  if (control === "segmented" && options.length > 0)
    return (
      <div className="segmented" role="group">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={option === value ? "on" : ""}
            onClick={() => onCommit(option)}
          >
            {option}
          </button>
        ))}
      </div>
    );

  if (isString(value) && options.length > 0)
    return (
      <select className="input" value={value} onChange={(event) => onCommit(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    );

  if (isString(value) && EASES.includes(value))
    return (
      <select className="input" value={value} onChange={(event) => onCommit(event.target.value)}>
        {EASES.map((ease) => (
          <option key={ease}>{ease}</option>
        ))}
      </select>
    );

  if (isString(value) && (schema["format"] === "color" || HEX.test(value)) && HEX.test(value))
    return (
      <label className="color">
        <input type="color" value={value} onChange={(event) => onCommit(event.target.value)} />
        <code>{value}</code>
      </label>
    );

  if (isNumber(value)) return <Draft value={value} onCommit={onCommit} />;

  if (isBoolean(value))
    return (
      <input type="checkbox" checked={value} onChange={(event) => onCommit(event.target.checked)} />
    );

  if (isString(value)) return <Draft value={value} onCommit={onCommit} />;

  return <code>{JSON.stringify(value)}</code>;
};

interface PropFieldProps {
  readonly name: string;
  readonly prop: Prop;
  readonly onCommit: (value: Json) => void;
}

/** A prop row: a control when the source holds a literal, otherwise why it cannot be edited and what it says. */
export const PropField = ({ name, prop, onCommit }: PropFieldProps) => (
  <div className="field">
    <span className="field-name">{name}</span>
    {prop.editable ? (
      <ValueControl value={prop.value} schema={prop.schema} ui={prop.ui} onCommit={onCommit} />
    ) : (
      <span className="pill" title={`not editable: ${prop.reason}`}>
        <b>{prop.reason}</b>
        <code>{prop.text}</code>
      </span>
    )}
  </div>
);
