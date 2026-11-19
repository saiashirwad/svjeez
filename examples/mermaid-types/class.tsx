import { show } from "./show";

export default show(
  "Class diagram",
  `classDiagram
  direction TB
  class Animal {
    <<abstract>>
    +String name
    +int age
    +speak() String
  }
  class Duck {
    +swim()
    +quack()
  }
  class Fish {
    -int sizeInFeet
    -canEat()
  }
  class Pond {
    +List~Duck~ ducks
  }
  Animal <|-- Duck
  Animal <|-- Fish
  Pond "1" o-- "*" Duck : hosts
  Pond *-- Fish : contains`,
);
