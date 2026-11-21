import { useState } from "react";
import * as Radix from "@radix-ui/react-tabs";
import { Scene } from "@svjeez/react";
import { over } from "./overlay.ts";
import tabsArt from "../tabs/index.tsx?svjeez&inline";

const tabs = [
  {
    value: "overview",
    label: "Overview",
    text: "Everything at a glance. Projects, activity and health.",
  },
  { value: "usage", label: "Usage", text: "Usage this month. Requests and storage, by day." },
  { value: "billing", label: "Billing", text: "Plan and invoices. Payment, receipts and seats." },
];

// Radix owns the selection and the arrow keys; its triggers and panels sit over the scene's tabs and panel.
export const Tabs = () => {
  const [tab, setTab] = useState("overview");

  return (
    <Radix.Root className="stage" value={tab} onValueChange={setTab} style={{ width: 480 }}>
      <Scene scene={tabsArt} state={tab} style={{ width: "100%" }} />
      <Radix.List className="row" aria-label="Account" style={over(tabsArt, 60, 24, 360, 40)}>
        {tabs.map(({ value, label }) => (
          <Radix.Trigger key={value} value={value} className="control ghost">
            {label}
          </Radix.Trigger>
        ))}
      </Radix.List>
      {tabs.map(({ value, text }) => (
        <Radix.Content
          key={value}
          value={value}
          className="ghost"
          style={over(tabsArt, 180, 140, 240, 60)}
        >
          {text}
        </Radix.Content>
      ))}
    </Radix.Root>
  );
};
