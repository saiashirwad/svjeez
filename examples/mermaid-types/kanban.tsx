import { show } from "./show";

export default show(
  "Kanban board",
  `kanban
  todo[Todo]
    docs[Write the launch blog post]@{ assigned: 'mia', priority: 'Low' }
    bug[Checkout fails on expired cards]@{ ticket: SHOP-214, assigned: 'raj', priority: 'Very High' }
  doing[In progress]
    api[Rework the orders API so it pages results and returns stable cursors]@{ ticket: SHOP-198, assigned: 'lena', priority: 'High' }
  review[In review]
    search[Faceted search]@{ ticket: SHOP-176, assigned: 'omar' }
  done[Done]
    cart[Cart summary]@{ ticket: SHOP-150 }
    login[Single sign-on]@{ ticket: SHOP-131, priority: 'Very Low' }`,
);
