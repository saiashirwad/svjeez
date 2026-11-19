import { Icon, type IconData, type IconProps } from "@svjeez/icons";
import * as lucide from "@svjeez/icons/lucide";
import { checkFilled, rocket } from "@svjeez/icons/tabler";

export const icons: readonly IconData[] = [rocket, checkFilled, lucide.circle];

export const props: IconProps = { icon: rocket, color: "#000000", size: 48 };

export const node = Icon(props);
