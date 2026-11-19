import { show } from "./show";

export default show(
  "Entity relationship diagram",
  `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "ordered in"
  CUSTOMER {
    string id PK
    string name
    string email UK
  }
  ORDER {
    int id PK
    string customer_id FK
    date placed
  }
  LINE_ITEM {
    int order_id FK
    int product_id FK
    int quantity
  }
  PRODUCT {
    int id PK
    string title
    float price
  }`,
);
