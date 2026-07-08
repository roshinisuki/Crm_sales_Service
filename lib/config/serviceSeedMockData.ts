export interface ServiceRequest {
  id: string;
  requestCode: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  priorityId: string;
  categoryId: string;
  createdAt: string;
  dueDate: string;
  customer: { name: string };
  asset: { productName: string; purchaseDate?: string; warrantyExpiryDate?: string; amcExpiryDate?: string };
  team: { name: string };
  engineer: { user: { name: string } };
}

export interface ServiceComplaint {
  id: string;
  complaintCode: string;
  details: string;
  status: string;
  severity: string;
  createdAt: string;
  customer: { name: string };
  complaintType: { name: string };
  asset: { productName: string; purchaseDate?: string };
}

export interface ServiceDefect {
  id: string;
  defectCode: string;
  description: string;
  status: string;
  createdAt: string;
  defectType: { name: string };
  asset: { productName: string; purchaseDate?: string; warrantyExpiryDate?: string };
  priority: { name: string };
  priorityId: string;
  defectTypeId: string;
}

export interface ServiceInstallation {
  id: string;
  installationCode: string;
  status: string;
  createdAt: string;
  notes: string;
  customer: { name: string };
  asset: { productName: string; purchaseDate?: string; warrantyExpiryDate?: string };
  team: { name: string };
  engineer: { user: { name: string } };
}

export interface ServiceVisit {
  id: string;
  visitDate: string;
  status: string;
  notes: string;
  customer: { name: string };
  engineer: { user: { name: string } };
}

export const mockRequests: ServiceRequest[] = [
  {
    id: "req-1",
    requestCode: "REQ-2026-001",
    title: "Air compressor motor overheating issue",
    description: "The auxiliary air compressor motor shuts down automatically due to thermal overload.",
    status: "In Progress",
    priority: "Critical",
    priorityId: "pri-crit",
    categoryId: "cat-PM",
    createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(), // 36h ago
    dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2h left
    customer: { name: "Apex Engineering Solutions" },
    asset: { productName: "Air Compressor AC-400" },
    team: { name: "Field Service Team North" },
    engineer: { user: { name: "System Admin" } }
  },
  {
    id: "req-2",
    requestCode: "REQ-2026-002",
    title: "Hydraulic pump fluid pressure leak",
    description: "Slow leak detected at the primary valve gasket.",
    status: "Assigned",
    priority: "High",
    priorityId: "pri-high",
    categoryId: "cat-repair",
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    customer: { name: "Vertex Manufacturing Corp" },
    asset: { productName: "Hydraulic Press Pump H-200" },
    team: { name: "Field Service Team South" },
    engineer: { user: { name: "Vikram Iyer" } }
  },
  {
    id: "req-3",
    requestCode: "REQ-2026-003",
    title: "Preventive maintenance visit due",
    description: "Scheduled bi-annual PM checklist alignment.",
    status: "New",
    priority: "Medium",
    priorityId: "pri-med",
    categoryId: "cat-PM",
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    customer: { name: "Tata Motors Ltd." },
    asset: { productName: "Industrial Water Chiller WC-10" },
    team: { name: "AMC Support Team" },
    engineer: { user: { name: "Arjun Mehta" } }
  },
  {
    id: "req-4",
    requestCode: "REQ-2026-004",
    title: "Calibration request for load sensors",
    description: "Sensors read discrepancy values on conveyor 4.",
    status: "New",
    priority: "Low",
    priorityId: "pri-low",
    categoryId: "cat-calib",
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    customer: { name: "JSW Steel Ltd." },
    asset: { productName: "Electronic Control Panel CP-80" },
    team: { name: "AMC Support Team" },
    engineer: { user: { name: "Priya Nair" } }
  },
  {
    id: "req-5",
    requestCode: "REQ-2026-005",
    title: "Overheating in control relay room",
    description: "Relays showing thermal trip warning signs.",
    status: "Pending Customer",
    priority: "Critical",
    priorityId: "pri-crit",
    categoryId: "cat-repair",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(), // Overdue
    customer: { name: "Ashok Leyland Industries" },
    asset: { productName: "Electronic Control Panel CP-80" },
    team: { name: "Escalation Desk" },
    engineer: { user: { name: "Deepa Krishnan" } }
  },
  {
    id: "req-6",
    requestCode: "REQ-2026-006",
    title: "Chiller circuit 2 gas leak restoration",
    description: "Gas pressure dropped below 2 bars.",
    status: "Resolved",
    priority: "High",
    priorityId: "pri-high",
    categoryId: "cat-repair",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    customer: { name: "L&T Heavy Engineering" },
    asset: { productName: "Industrial Water Chiller WC-10" },
    team: { name: "Warranty Resolution Team" },
    engineer: { user: { name: "Karthik Reddy" } }
  },
  {
    id: "req-7",
    requestCode: "REQ-2026-007",
    title: "Closed spare part installation check",
    description: "Verification complete for compressor spare motor.",
    status: "Closed",
    priority: "Medium",
    priorityId: "pri-med",
    categoryId: "cat-spare",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    customer: { name: "TVS Motor Company" },
    asset: { productName: "Air Compressor AC-400" },
    team: { name: "Installation Team" },
    engineer: { user: { name: "Arjun Mehta" } }
  }
];

export const mockComplaints: ServiceComplaint[] = [
  {
    id: "comp-1",
    complaintCode: "COMP-2026-001",
    details: "Valves leaking hazardous pneumatic fluid repeatedly.",
    status: "New",
    severity: "High",
    createdAt: new Date().toISOString(),
    customer: { name: "Vertex Manufacturing Corp" },
    complaintType: { name: "Leakage issue" },
    asset: { productName: "High Flow Filtration Unit FU-15" }
  },
  {
    id: "comp-2",
    complaintCode: "COMP-2026-002",
    details: "Control panel screen flickering and unresponsive to manual logic inputs.",
    status: "Under Investigation",
    severity: "Critical",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    customer: { name: "JSW Steel Ltd." },
    complaintType: { name: "Product not working" },
    asset: { productName: "Electronic Control Panel CP-80" }
  },
  {
    id: "comp-3",
    complaintCode: "COMP-2026-003",
    details: "Extreme noise coming from air intake valve during compression phase.",
    status: "Resolved",
    severity: "Medium",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    customer: { name: "Tata Motors Ltd." },
    complaintType: { name: "Noise/vibration" },
    asset: { productName: "Air Compressor AC-400" }
  },
  {
    id: "comp-4",
    complaintCode: "COMP-2026-004",
    details: "Delayed response for breakdown assistance call raised yesterday.",
    status: "Closed",
    severity: "Low",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    customer: { name: "Apex Engineering Solutions" },
    complaintType: { name: "Delay in service" },
    asset: { productName: "Calibration Pressure Vessel PV-45" }
  }
];

export const mockDefects: ServiceDefect[] = [
  {
    id: "def-1",
    defectCode: "DF-2026-001",
    description: "Cylinder valve seal failure at high temperature range.",
    status: "New",
    createdAt: new Date().toISOString(),
    defectType: { name: "Component failure" },
    asset: { productName: "Air Compressor AC-400" },
    priority: { name: "High" },
    priorityId: "pri-high",
    defectTypeId: "dt-comp"
  },
  {
    id: "def-2",
    defectCode: "DF-2026-002",
    description: "PCB microchip burnt out due to voltage surge.",
    status: "Under Investigation",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    defectType: { name: "Electrical defect" },
    asset: { productName: "Electronic Control Panel CP-80" },
    priority: { name: "Critical" },
    priorityId: "pri-crit",
    defectTypeId: "dt-elec"
  },
  {
    id: "def-3",
    defectCode: "DF-2026-003",
    description: "Gasket dimensions are slightly off, preventing airtight vacuum seal.",
    status: "Corrective Action",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    defectType: { name: "Manufacturing defect" },
    asset: { productName: "High Flow Filtration Unit FU-15" },
    priority: { name: "Medium" },
    priorityId: "pri-med",
    defectTypeId: "dt-mfg"
  },
  {
    id: "def-4",
    defectCode: "DF-2026-004",
    description: "Impeller alignment bending detected during inspection cycles.",
    status: "Closed",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    defectType: { name: "Mechanical defect" },
    asset: { productName: "Hydraulic Press Pump H-200" },
    priority: { name: "Low" },
    priorityId: "pri-low",
    defectTypeId: "dt-mech"
  }
];

export const mockInstallations: ServiceInstallation[] = [
  {
    id: "inst-1",
    installationCode: "COMM-2026-001",
    status: "Scheduled",
    createdAt: new Date().toISOString(),
    notes: "Requires full alignment calibration before load setup.",
    customer: { name: "Apex Engineering Solutions" },
    asset: { productName: "Air Compressor AC-400" },
    team: { name: "Installation Team" },
    engineer: { user: { name: "Arjun Mehta" } }
  },
  {
    id: "inst-2",
    installationCode: "COMM-2026-002",
    status: "In Progress",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    notes: "Piping connections set. Wiring integration underway.",
    customer: { name: "GreenFlow Engineering" },
    asset: { productName: "Industrial Water Chiller WC-10" },
    team: { name: "Installation Team" },
    engineer: { user: { name: "Karthik Reddy" } }
  },
  {
    id: "inst-3",
    installationCode: "COMM-2026-003",
    status: "Completed",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Full system test complete. Output metrics logged.",
    customer: { name: "Tata Motors Ltd." },
    asset: { productName: "Hydraulic Press Pump H-200" },
    team: { name: "Field Service Team South" },
    engineer: { user: { name: "Priya Nair" } }
  }
];

export const mockVisits: ServiceVisit[] = [
  {
    id: "visit-1",
    visitDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // today 2h later
    status: "Scheduled",
    notes: "Monthly scheduled checkup of the hydraulic pumps.",
    customer: { name: "Vertex Manufacturing Corp" },
    engineer: { user: { name: "Vikram Iyer" } }
  },
  {
    id: "visit-2",
    visitDate: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // today 3h ago
    status: "Emergency",
    notes: "Plant shutdown due to control relay overload. Immediate diagnostic visit.",
    customer: { name: "Ashok Leyland Industries" },
    engineer: { user: { name: "Deepa Krishnan" } }
  },
  {
    id: "visit-3",
    visitDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Completed",
    notes: "PM health check logged. Gasket seals replaced and verified.",
    customer: { name: "JSW Steel Ltd." },
    engineer: { user: { name: "Priya Nair" } }
  },
  {
    id: "visit-4",
    visitDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
    status: "Overdue",
    notes: "Scheduled diagnostic test missed due to technician delay.",
    customer: { name: "L&T Heavy Engineering" },
    engineer: { user: { name: "Arjun Mehta" } }
  }
];
