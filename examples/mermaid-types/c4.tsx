import { show } from "./show";

export default show(
  "C4 diagram",
  `C4Container
  title Internet banking
  Person(customer, "Customer", "A bank customer with accounts")
  System_Boundary(bank, "Internet Banking") {
    Container(web, "Web app", "React", "Delivers the banking UI")
    Container(api, "API", "Java, Spring", "Serves accounts and payments")
    ContainerDb(db, "Database", "PostgreSQL", "Stores users and audit logs")
  }
  System_Ext(mainframe, "Mainframe", "Core banking records")
  System_Ext(mail, "E-mail system", "Sends notifications")
  Rel(customer, web, "Uses", "HTTPS")
  Rel(web, api, "Calls", "JSON/HTTPS")
  Rel(api, db, "Reads and writes", "JDBC")
  BiRel(api, mainframe, "Syncs", "XML")
  Rel(api, mail, "Sends e-mail", "SMTP")
  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")`,
);
