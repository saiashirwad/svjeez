/** @jsxImportSource svjeez */
import { render } from "svjeez";
import { defaults, text, type Values } from "svjeez/params";

export const params = {
  title: text("Launch", { maxLength: 12 }),
};

export default (p: Values<typeof params> = defaults(params)) =>
  render(
    { width: 400, height: 240, duration: 2, title: p.title },
    <>
      <rect width={400} height={240} fill="#15131A" />
      <text x={40} y={130} fontSize={40} fill="#FF5D8F">
        {p.title}
      </text>
    </>,
  );
