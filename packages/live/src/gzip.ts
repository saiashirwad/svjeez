/** How many bytes `text` takes gzipped, measured the way a browser reports it. */
export const gzipSize = async (text: string): Promise<number> => {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));

  return (await new Response(stream).arrayBuffer()).byteLength;
};
