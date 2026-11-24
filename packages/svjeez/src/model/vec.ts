import type { Vec } from "./ir";

export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];

export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];

export const times = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];

export const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1];

export const cross = (a: Vec, b: Vec): number => a[0] * b[1] - a[1] * b[0];
