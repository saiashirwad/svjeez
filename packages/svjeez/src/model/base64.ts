export const base64 = (bytes: Uint8Array): string => {
  const CHUNK = 0x8000;
  let binary = "";

  for (let at = 0; at < bytes.length; at += CHUNK)
    binary += String.fromCharCode(...bytes.subarray(at, at + CHUNK));

  return btoa(binary);
};
