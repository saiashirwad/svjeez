import { voxel, type Skin } from "svjeez";

const art = voxel.texture;

const grassTop = art({ a: "#7cbd4d", b: "#69a83e", c: "#58953a", d: "#8ccb5a" }, `
  abababba
  bbadbbab
  cbbabcbb
  babbdabb
  bbabbbab
  abcbabbc
  bbabdbab
  babbabba
`);

const dirt = art({ a: "#866043", b: "#6f4d34", c: "#97704f", d: "#5e4029" }, `
  abaacaba
  babbabac
  aabdabba
  cabaabab
  babcbaab
  aabbabda
  babaabbc
  abdabaab
`);

const grassSide = art({ g: "#7cbd4d", h: "#58953a", a: "#866043", b: "#6f4d34", c: "#97704f" }, `
  gghggggh
  ghgghghg
  habgahgb
  abaacaba
  babbabac
  aabbabba
  cabaabab
  babcbaab
`);

const stone = art({ a: "#8a8a8a", b: "#777777", c: "#9c9c9c", d: "#666666" }, `
  abacabab
  bbabbcab
  abbdabba
  cabaabbc
  babbadab
  aabcbaab
  bdabbaba
  abaabbac
`);

const sand = art({ a: "#e4d59b", b: "#d5c385", c: "#efe3b0" }, `
  abaacaba
  babbabac
  aababbaa
  cabaabab
  babcbaab
  aabbabba
  babaabbc
  abbabaab
`);

const logSide = art({ a: "#6b5230", b: "#82643a", c: "#594326" }, `
  abbacbab
  babbcabb
  abbabbab
  cbabbabc
  babbabab
  abbcbbab
  babbabba
  abbabcab
`);

const logTop = art({ a: "#6b5230", b: "#b8945a", c: "#a07d48", d: "#c9a66b" }, `
  aaaaaaaa
  abbbbbba
  abcccbba
  abcdcbba
  abcdcbba
  abcccbba
  abbbbbba
  aaaaaaaa
`);

const leaves = art({ a: "#3f8f2a", b: "#2f7a1f", c: "#56a83a", d: "#25601a" }, `
  abacabda
  babbcabb
  cabdabab
  babbabca
  adbabbab
  babcbdab
  abbabaab
  cababbad
`);

const planks = art({ a: "#b8945a", b: "#a07d48", c: "#c9a66b", d: "#8c6a38" }, `
  accaaacc
  aaaabaaa
  dddddddd
  aaccaaac
  baaaaaba
  dddddddd
  caaabaca
  aaaaaaaa
`);

const roof = art({ a: "#7a5230", b: "#68441f", c: "#8a6038", d: "#523416" }, `
  accaaacc
  aaaabaaa
  dddddddd
  aaccaaac
  baaaaaba
  dddddddd
  caaabaca
  aaaaaaaa
`);

const water = art({ a: "#2f6fe0b8", b: "#4a85f0b8", c: "#6a9ff5b8" }, `
  aaabaaaa
  abaaaaca
  aaaabaaa
  aacaaaba
  baaaaaaa
  aaabaaca
  aaaaabaa
  caabaaaa
`);

const ice = art({ a: "#a5d4f0d8", b: "#c4e6f8d8", c: "#8cc3e6d8" }, `
  aabaaaca
  abaaabaa
  aaaaaaba
  caabaaaa
  aaaacaab
  abaaaaaa
  aacaabaa
  baaaaaca
`);

const snowTop = art({ a: "#f6f9ff", b: "#e3ebf6", c: "#d3deee" }, `
  aaabaaaa
  abaaaaca
  aaaabaaa
  aacaaaba
  baaaaaaa
  aaabaaca
  aaaaabaa
  caabaaaa
`);

const snowSide = art({ s: "#f6f9ff", t: "#e3ebf6", a: "#866043", b: "#6f4d34", c: "#97704f" }, `
  ssstssss
  stsssstt
  tbsatsbs
  abaacaba
  babbabac
  aabbabba
  cabaabab
  babcbaab
`);

const snowCap = art({ s: "#f6f9ff", t: "#e3ebf6", ".": null }, `
  ssstssss
  stsssstt
  t.s.ts.s
  ........
  ........
  ........
  ........
  ........
`);

const flowerRed = art({ ".": null, g: "#3f8f2a", r: "#d83a3a", y: "#f2d24a" }, `
  ........
  ........
  ..rr....
  .rrrr...
  ..ryr...
  ...g.r..
  ...ggrr.
  ...g....
`);

const flowerYellow = art({ ".": null, g: "#3f8f2a", y: "#f2d24a", o: "#e89a2a" }, `
  ........
  ........
  ....yy..
  ...yooy.
  ....yy..
  ..g.g...
  ..gggg..
  ....g...
`);

const glass = art({ a: "#bfe6f5a0", b: "#e8f8ffb0", f: "#a07d48" }, `
  ffffffff
  fabaaaaf
  fbaaaaaf
  faaaaabf
  faaaabaf
  faaabaaf
  fabaaaaf
  ffffffff
`);

const lampOff = art({ a: "#6e5a3a", b: "#59482e", c: "#7f6a45" }, `
  abacabab
  bbabbcab
  abbbabba
  cabaabbc
  babbabab
  aabcbaab
  bbabbaba
  abaabbac
`);

const lampOn = art({ a: "#ffd45e", b: "#ffb938", c: "#fff0a8", d: "#e8962a" }, `
  abacabab
  bcabbcab
  abbdabca
  cabaabbc
  babbcbab
  adbcbaab
  bbabbaba
  abaabbac
`);

const cloud = art({ a: "#ffffff", b: "#f1f5fa" }, `
  aaaabaaa
  abaaaaab
  aaaaabaa
  baaaaaaa
  aaabaaba
  aaaaaaaa
  abaabaaa
  aaaaaaab
`);

export const SKIN = {
  grass: { side: grassSide, top: grassTop },
  dirt,
  stone,
  sand,
  log: { side: logSide, top: logTop },
  leaves,
  planks,
  roof,
  water,
  ice,
  snow: { side: snowSide, top: snowTop },
  snowCap: { side: snowCap, top: snowTop },
  flowerRed,
  flowerYellow,
  glass,
  lampOff,
  lampOn,
  cloud,
} as const satisfies Record<string, Skin>;
