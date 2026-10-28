import type { CodeRole } from "svjeez/extras";

/**
 * TextMate scope prefix to role. A token takes the role of its longest matching prefix, so `keyword.operator`
 * beats `keyword`, and a scope that no row matches stays plain. Shiki does the matching, through a theme built
 * from this table.
 */
export const SCOPES = {
  comment: "comment",
  punctuation: "punct",
  "meta.brace": "punct",
  "punctuation.definition.comment": "comment",
  "punctuation.definition.string": "string",

  keyword: "keyword",
  "keyword.operator": "punct",
  "keyword.operator.new": "keyword",
  "keyword.operator.expression": "keyword",
  "keyword.operator.word": "keyword",
  "keyword.operator.logical.python": "keyword",
  "keyword.other.unit": "number",
  storage: "keyword",
  "storage.type.primitive": "type",
  "storage.type.built-in": "type",

  string: "string",
  "constant.numeric": "number",
  "constant.language": "constant",
  "constant.character": "constant",
  "constant.other": "constant",
  "support.constant": "constant",
  "variable.language": "constant",
  "variable.other.enummember": "constant",

  "variable.other.normal.shell": "variable",
  "punctuation.definition.variable": "variable",
  "support.variable": "variable",
  "meta.object-literal.key": "variable",
  "support.type.property-name": "variable",
  "punctuation.support.type.property-name": "variable",
  "punctuation.definition.constant": "constant",
  "storage.type.string": "string",
  "entity.name.tag.yaml": "variable",

  "entity.name.function": "fn",
  "support.function": "fn",

  "entity.name.type": "type",
  "entity.name.class": "type",
  "entity.name.namespace": "type",
  "entity.name.struct": "type",
  "entity.name.trait": "type",
  "entity.name.enum": "type",
  "entity.name.lifetime": "type",
  "entity.other.inherited-class": "type",
  "support.type": "type",
  "support.class": "type",

  "entity.name.tag": "tag",
  "entity.other.attribute-name": "type",
  "entity.other.attribute-name.id": "fn",

  "markup.heading": "keyword",
  "markup.inline.raw": "string",
  "fenced_code.block.language": "constant",
  "markup.quote": "comment",
  "markup.underline.link": "fn",
  "markup.list": "punct",
  "markup.inserted": "green",
  "markup.deleted": "red",
  "markup.changed": "yellow",
  "meta.diff.header": "comment",
  "meta.diff.range": "cyan",
  "meta.separator.diff": "cyan",
  "punctuation.definition.inserted": "green",
  "punctuation.definition.deleted": "red",
  "punctuation.definition.changed": "yellow",
  "punctuation.definition.heading": "keyword",
  invalid: "red",
} as const satisfies Record<string, CodeRole>;
