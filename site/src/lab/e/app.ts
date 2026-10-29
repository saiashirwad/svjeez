import "./bin";
import { paintCard } from "./card";
import { paintControls } from "./controls";
import { paintOverlay } from "./overlay";
import { compileCurrent } from "./preview";
import { markCurrent, restoreShelf, startShelf } from "./shelf";
import { onSet, set, state } from "./state";

// What each change repaints, in order.
onSet(paintCard);
onSet(paintControls);
onSet(paintOverlay);
onSet(compileCurrent);
onSet(markCurrent);

startShelf();
set(state.genome, { shelve: true });
void restoreShelf();
