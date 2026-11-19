import { show } from "./show";

export default show(
  "Requirement diagram",
  `requirementDiagram
  requirement checkout_req {
    id: 1
    text: Orders must be payable online.
    risk: high
    verifymethod: test
  }
  functionalRequirement payment_req {
    id: 1.1
    text: Card payments must be authorised within two seconds.
    risk: medium
    verifymethod: demonstration
  }
  performanceRequirement latency_req {
    id: 1.2
    text: Checkout responds in under 300 ms.
    risk: low
    verifymethod: analysis
  }
  element checkout_service {
    type: service
    docref: docs/checkout.md
  }
  element load_test {
    type: test suite
    docref: github.com/shop/loadtests
  }
  checkout_req - contains -> payment_req
  checkout_req - contains -> latency_req
  checkout_service - satisfies -> payment_req
  load_test - verifies -> latency_req
  checkout_req <- copies - checkout_service`,
);
