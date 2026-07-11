"use client";

import { StatusStepper } from "@/components/ui/StatusStepper";

interface QuotationStageTrackerProps {
  quotation: any;
  onRfqClick?: () => void;
  onNegotiationClick?: () => void;
}

export default function QuotationStageTracker({ quotation, onRfqClick, onNegotiationClick }: QuotationStageTrackerProps) {
  return (
    <section className="crm-card p-5">
      <StatusStepper
        steps={[
          { label: "RFQ", key: "rfq", reached: !!quotation.rfq, active: false, onClick: onRfqClick, clickable: !!quotation.rfq?.id },
          { label: "Quotation", key: "quotation", reached: true, active: true },
          { label: "Negotiation", key: "negotiation", reached: !!quotation.negotiation, active: false, onClick: onNegotiationClick, clickable: !!quotation.negotiation?.id },
          { label: quotation.status === "Accepted" ? "Won" : quotation.status === "Rejected" ? "Lost" : "Won/Lost", key: "outcome", reached: ["Accepted", "Rejected"].includes(quotation.status), active: false, terminal: quotation.status === "Rejected" ? "danger" : quotation.status === "Accepted" ? "success" : undefined },
        ]}
      />
    </section>
  );
}
