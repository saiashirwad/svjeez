import { make } from "./compile";

export default function build(): string {
  return make("wide");
}
