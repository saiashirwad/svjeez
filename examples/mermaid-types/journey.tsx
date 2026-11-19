import { show } from "./show";

export default show(
  "User journey",
  `journey
  title Ordering lunch
  section Browse
    Open the app: 4: Me
    Find a place: 2: Me, Friend
  section Order
    Pick dishes: 5: Me, Friend
    Pay: 3: Me
  section Wait
    Track courier: 2: Me
    Eat: 5: Me, Friend`,
);
