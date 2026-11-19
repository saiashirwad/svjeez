import { show } from "./show";

export default show(
  "Treemap",
  `treemap-beta
  title Monthly budget
  "Housing"
    "Rent": 1800
    "Utilities": 240
    "Insurance": 120
  "Food"
    "Groceries": 620
    "Eating out": 280
  "Transport"
    "Car": 410
    "Transit": 90
  "Fun"
    "Streaming": 40
    "Travel": 350
    "Hobbies": 160`,
);
