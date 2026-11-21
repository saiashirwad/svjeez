/// <reference types="@svjeez/vite/client" />

declare module "*.css";

declare module "*?raw" {
  const text: string;
  export default text;
}
