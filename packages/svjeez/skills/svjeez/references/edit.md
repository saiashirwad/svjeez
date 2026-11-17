# Revising a scene by its values

A small revision changes how much, not what: "slow the second beat", "make the dot bigger", "a warmer orange", "less bounce". Do it through the scene's values instead of editing source by hand. `svjeez values` lists every number, color, ease and param the editor shows a control for, each under a key. `svjeez set` writes new values into those literals and touches nothing else in the file. Both need `npm i -D @svjeez/live` and run no browser.

```sh
npx svjeez values scene.tsx --filter enter
npx svjeez set scene.tsx default:enter.0.over=0.9 default:enter.2=out
npx svjeez check scene.tsx
npx svjeez frames scene.tsx --times 1.2,1.6,2.1 --sheet --out frames/
```

```
scene.tsx:29:32  default:enter.0.at    number  1.2       0..4s step 0.05
scene.tsx:29:43  default:enter.0.over  number  0.5       0..4s step 0.05
scene.tsx:29:64  default:enter.2       ease    ease.pop
```

```
default:enter.0.over  0.5 -> 0.9
default:enter.2  ease.pop -> ease.out
scene.tsx:29
-         animation={enter({ at: 1.2, over: 0.5 }, { scale: 0 }, ease.pop)}
+         animation={enter({ at: 1.2, over: 0.9 }, { scale: 0 }, ease.out)}
set 2 values in scene.tsx.
keys unchanged.
```

Then check and look, as for any change: a longer beat can now overlap the next one, and only a frame shows that. `--dry-run` prints the same lines and writes nothing.

Edit the source instead when the change is structural: a new element or beat, a motion that should start from something else, beats in a new order, a span that should follow another (`s.next(0.2)` rather than a second number), or anything that changes what a value means. Set what a value is; write code for what it depends on.

## Keys

| Key | The literal |
| --- | --- |
| `params.title` | The value of a param in `export const params`. `params.n.max` is its range's top, which `set` takes but `values` does not list. |
| `legs.1.over` | Inside a top-level const, by its path: `over` of item 1 of `legs`. |
| `default:circle.cx` | The `cx` attribute of a `<circle>` in the default export. A named function or const is its own name, as in `Wheel:circle.cx`. |
| `default:enter.0.at` | `at` in argument 0 of a call to `enter(…)`. |
| `default:to.1` | Argument 1 of `.to(…)`, its span or length. `default:stagger.2` is a stagger's step. |
| `default:r` | A const inside the function. |
| `…#1`, `…#2` | The second and third literal held the same way in that function, in source order. |
| `default#3` | The fourth literal in that function that nothing nameable holds: a ternary's branch, a return value. |

A key stays with its literal when values change and when other declarations change. Adding or removing a literal held the same way before it renumbers it, and `default#N` keys renumber with any such literal in the function. After editing the source, run `svjeez values` again before the next `set`. `set` re-reads the file after writing and prints `keys shifted` if its own write moved one.

To find a beat, filter by the recipe or the call that places it (`--filter enter`, `--filter stagger`) and read the `at` values in order: "the second beat" is the second-earliest `at`. A beat built with `stagger` or `.next` moves with the span it comes from, so set that one.

## Values

| Kind | Write | Notes |
| --- | --- | --- |
| `number` | `1.5`, `-12`, `30_000` | Keeps the decimals the literal had: `1.2` set to 2 is `2.0`. A number a scene declares in its params must stay in the declared range. Widen it first with `params.n.max=20`. Any other range is only a guess at a control's travel, and `set` writes past it. |
| `color` | `#ff8800`, `#f80`, `#ff880080` | Keeps the quotes the literal had. Hex only. |
| `ease` | `out`, `ease.inOut`, `bezier(0.3, 1.6, 0.6, 1)` | x1 and x2 stay in 0 to 1. Quote it in the shell. |
| `choice` | one of its options | `values` lists them. |
| `text` | any line | A text param, at most its `maxLength`. |

`set` checks every pair before it writes any, and names each bad key with the keys nearest it and each bad value with the form it needs. It exits 1 and writes nothing when any is wrong.

`values` does not list strings other than params (titles, path data, labels), a number another computes from (set the one it comes from), or a literal that spans lines. Edit those in the source. `--json` prints `{ file, values }`, each value `{ key, kind, value, text, label, line, column }` with `range` (`min`, `max`, `step`, `unit`, `declared`) for a number, `options` for a choice and `maxLength` for a text param.

To read a param's declared range, `values` and `set` load the scene module, as `svjeez svg` does, but only when the file declares `params`. When it will not load, they print a note and guess the ranges instead.
