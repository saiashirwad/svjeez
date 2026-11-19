import { Shape, Stack, rect, scene } from "svjeez";

export default scene({ size: [100, 60], duration: 2, title: "Unpainted" }, () => (
  <Stack>
    <Shape geometry={rect(10, 10)} fill="#FF0000" />
    <Shape geometry={rect(10, 10)} />
  </Stack>
));
