/**
 * The film's own size, gzipped, as the site reports it. A film can't measure itself while it is being made, so this is
 * written down: after changing the film, build it (bun run film:svg) and update this if `gzip -c film.svg | wc -c`
 * rounds to a different number.
 */
export const FILM_SIZE = "46 KB";
