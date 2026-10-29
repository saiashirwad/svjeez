import { $ } from "../util";
import { certificate, specimenNo, taxon } from "./genome";
import { PARTS } from "./edit";
import { state } from "./state";

export const paintCard = () => {
  const { genome, lineage } = state;
  $("[data-no]").textContent = `No. ${specimenNo(genome)}`;
  $("[data-lineage]").textContent = lineage;
  $("[data-name]").textContent = taxon(genome);
  const cert = certificate(genome);
  $("[data-stamp]").dataset.grade = String(cert.grade);
  $("[data-verdict]").textContent = cert.verdict;
  for (const part of PARTS) {
    const n = part === "eyes" ? `${genome.eyes}${genome.bodyEyes ? `+${genome.bodyEyes}` : ""}` : String(genome[part]);
    $(`[data-count="${part}"]`).textContent = n;
    $<HTMLButtonElement>(`[data-less="${part}"]`).disabled = genome[part] === 0 && !(part === "eyes" && genome.bodyEyes);
  }
};

export const restamp = () =>
  $("[data-stamp]").animate(
    [{ transform: "rotate(-8deg) scale(1.6)", opacity: 0 }, { transform: "rotate(-4deg) scale(1)", opacity: 1 }],
    { duration: 260, easing: "cubic-bezier(.3,1.6,.5,1)" },
  );
