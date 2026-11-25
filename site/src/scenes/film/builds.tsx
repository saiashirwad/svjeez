import { Group, span, type SceneElement, type Span } from "svjeez";
import { Listing } from "./listing";
import { CODE_COLUMN, shown, spring } from "./kit";

export interface BuildsProps {
  readonly name: string;
  /** The file with its first n pieces in place. */
  readonly file: (n: number) => string;
  /** When each piece lands in the file, in the slide's seconds. */
  readonly lands: readonly number[];
  /** How long the slide lasts. */
  readonly over: number;
  /** What the pieces draw, given when each one starts playing. */
  readonly result: (plays: readonly number[]) => SceneElement;
}

/** A beat after a piece lands, it plays. */
export const playsOf = (lands: readonly number[]): number[] => lands.map((t) => t + 0.6);

export const Builds = ({ name, file, lands, over, result }: BuildsProps): SceneElement => {
  const steps: Span[] = lands.map((t) => span(t, spring.settle));

  return (
    <Group motion={shown(over, 0.1)}>
      <Listing
        name={name}
        size={20}
        states={[0, ...lands.map((_, i) => i + 1)].map(file)}
        steps={steps}
        edits={0}
        full={{ box: CODE_COLUMN }}
      />
      {result(playsOf(lands))}
    </Group>
  );
};
