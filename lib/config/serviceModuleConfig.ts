export interface ServiceStatusDef {
  id: string;
  label: string;
  color: string; // Tailwind/CSS color variables or hex codes
}

export interface FieldDef {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "number" | "boolean" | "relation";
  required?: boolean;
  options?: { value: string; label: string }[];
  relationModel?: string; // e.g. 'Customer', 'ServiceTeam', 'User'
  dependsOn?: string; // field id whose value filters this field's options (e.g. "customerId")
  placeholderWhenEmpty?: string; // placeholder shown when dependsOn field is not yet selected
}

export interface ColumnDef {
  id: string;
  label: string;
  type: "text" | "date" | "badge" | "currency" | "relation";
  relationKey?: string; // e.g., 'customer.name'
}

export interface ServiceModuleConfig {
  id: string;
  routeBase: string;
  displayTitle: string;
  entityLabel: string;
  iconName: string; // Lucide icon identifier
  statuses: ServiceStatusDef[];
  statusOrder: string[];
  allowedTransitions: Record<string, string[]>;
  listColumns: ColumnDef[];
  filterDefinitions: {
    id: string;
    label: string;
    type: "select" | "date-range" | "boolean";
    options?: { value: string; label: string }[];
  }[];
  formFields: FieldDef[];
  detailSections: {
    id: string;
    title: string;
    fields: string[];
  }[];
  allowedActions: {
    id: string;
    label: string;
    variant: "primary" | "secondary" | "danger" | "success";
    requiredStatus?: string[];
  }[];
  badgeColorRules: Record<string, string>;
  reportMappings: {
    metricId: string;
    chartType: "bar" | "pie" | "line";
  };
}

export const serviceModulesConfig: Record<string, ServiceModuleConfig> = {
  requests: {
    id: "requests",
    routeBase: "/service/requests",
    displayTitle: "Service Requests",
    entityLabel: "Request",
    iconName: "FileQuestion",
    statuses: [
      { id: "New", label: "New", color: "var(--brand-primary, #FF6901)" },
      { id: "Assigned", label: "Assigned", color: "#2090FF" },
      { id: "In Progress", label: "In Progress", color: "#EAB308" },
      { id: "Pending Customer", label: "Pending Customer", color: "#A855F7" },
      { id: "Resolved", label: "Resolved", color: "#10B981" },
      { id: "Closed", label: "Closed", color: "#6B7280" },
    ],
    statusOrder: ["New", "Assigned", "In Progress", "Pending Customer", "Resolved", "Closed"],
    allowedTransitions: {
      New: ["Assigned", "Closed"],
      Assigned: ["In Progress", "Pending Customer", "Closed"],
      "In Progress": ["Pending Customer", "Resolved", "Closed"],
      "Pending Customer": ["In Progress", "Resolved", "Closed"],
      Resolved: ["Closed", "In Progress"],
      Closed: ["New"],
    },
    listColumns: [
      { id: "requestCode", label: "Request Code", type: "text" },
      { id: "customerId", label: "Customer", type: "relation", relationKey: "customer.name" },
      { id: "assetId", label: "Asset", type: "relation", relationKey: "asset.productName" },
      { id: "priority", label: "Priority", type: "badge" },
      { id: "status", label: "Status", type: "badge" },
      { id: "createdAt", label: "Created At", type: "date" },
    ],
    filterDefinitions: [
      { id: "priority", label: "Priority", type: "select", options: [
        { value: "Low", label: "Low" },
        { value: "Medium", label: "Medium" },
        { value: "High", label: "High" },
        { value: "Critical", label: "Critical" }
      ]},
      { id: "status", label: "Status", type: "select", options: [
        { value: "New", label: "New" },
        { value: "Assigned", label: "Assigned" },
        { value: "In Progress", label: "In-Progress" },
        { value: "Resolved", label: "Resolved" }
      ]}
    ],
    formFields: [
      { id: "customerId", label: "Customer", type: "relation", relationModel: "Customer", required: true },
      { id: "assetId", label: "Customer Asset", type: "relation", relationModel: "CustomerAsset", required: true, dependsOn: "customerId", placeholderWhenEmpty: "Select a customer first" },
      { id: "title", label: "Subject", type: "text", required: true },
      { id: "description", label: "Description", type: "textarea" },
      { id: "priorityId", label: "Priority Level", type: "relation", relationModel: "PriorityLevel", required: true },
      { id: "categoryId", label: "Service Category", type: "relation", relationModel: "ServiceCategory", required: true },
      { id: "teamId", label: "Service Team", type: "relation", relationModel: "ServiceTeam" },
      { id: "engineerId", label: "Service Engineer", type: "relation", relationModel: "ServiceEngineer" },
    ],
    detailSections: [
      { id: "general", title: "General Information", fields: ["title", "description", "status", "priorityId", "categoryId"] },
      { id: "assignment", title: "Assignment & SLA", fields: ["teamId", "engineerId", "createdAt", "updatedAt"] },
      { id: "customer_details", title: "Customer & Asset", fields: ["customerId", "assetId"] }
    ],
    allowedActions: [
      { id: "assign", label: "Assign Engineer", variant: "primary", requiredStatus: ["New", "Assigned"] },
      { id: "resolve", label: "Mark Resolved", variant: "success", requiredStatus: ["In Progress", "Assigned"] },
      { id: "close", label: "Close Request", variant: "secondary", requiredStatus: ["Assigned", "In Progress", "Resolved"] },
    ],
    badgeColorRules: {
      New: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      Assigned: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      "In Progress": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      "Pending Customer": "bg-purple-500/10 text-purple-500 border-purple-500/20",
      Resolved: "bg-green-500/10 text-green-500 border-green-500/20",
      Closed: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    },
    reportMappings: {
      metricId: "total_requests",
      chartType: "bar",
    },
  },
  complaints: {
    id: "complaints",
    routeBase: "/service/complaints",
    displayTitle: "Customer Complaints",
    entityLabel: "Complaint",
    iconName: "AlertTriangle",
    statuses: [
      { id: "New", label: "New", color: "#EF4444" },
      { id: "Investigating", label: "Investigating", color: "#F59E0B" },
      { id: "Resolved", label: "Resolved", color: "#10B981" },
      { id: "Closed", label: "Closed", color: "#6B7280" },
    ],
    statusOrder: ["New", "Investigating", "Resolved", "Closed"],
    allowedTransitions: {
      New: ["Investigating"],
      Investigating: ["Resolved"],
      Resolved: ["Closed", "Investigating"],
      Closed: ["New"],
    },
    listColumns: [
      { id: "complaintCode", label: "Complaint Code", type: "text" },
      { id: "customerId", label: "Customer", type: "relation", relationKey: "customer.name" },
      { id: "complaintTypeId", label: "Type", type: "relation", relationKey: "complaintType.name" },
      { id: "severity", label: "Severity", type: "badge" },
      { id: "status", label: "Status", type: "badge" },
      { id: "createdAt", label: "Created At", type: "date" },
    ],
    filterDefinitions: [
      { id: "status", label: "Status", type: "select", options: [
        { value: "New", label: "New" },
        { value: "Investigating", label: "Investigating" },
        { value: "Resolved", label: "Resolved" }
      ]}
    ],
    formFields: [
      { id: "customerId", label: "Customer", type: "relation", relationModel: "Customer", required: true },
      { id: "assetId", label: "Customer Asset", type: "relation", relationModel: "CustomerAsset", dependsOn: "customerId", placeholderWhenEmpty: "Select a customer first" },
      { id: "complaintTypeId", label: "Complaint Type", type: "relation", relationModel: "ComplaintType", required: true },
      { id: "details", label: "Complaint Details", type: "textarea", required: true },
      { id: "priorityId", label: "Priority", type: "relation", relationModel: "PriorityLevel", required: true },
    ],
    detailSections: [
      { id: "general", title: "Complaint Information", fields: ["complaintTypeId", "details", "status", "priorityId"] },
      { id: "customer_details", title: "Customer & Asset", fields: ["customerId", "assetId"] }
    ],
    allowedActions: [
      { id: "investigate", label: "Start Investigation", variant: "primary", requiredStatus: ["New"] },
      { id: "resolve", label: "Resolve Complaint", variant: "success", requiredStatus: ["Investigating"] },
      { id: "close", label: "Close Complaint", variant: "secondary", requiredStatus: ["Resolved"] },
      { id: "reopen", label: "Not Resolved / Reopen", variant: "danger", requiredStatus: ["Resolved"] },
    ],
    badgeColorRules: {
      New: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      Investigating: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      Resolved: "bg-green-500/10 text-green-500 border-green-500/20",
      Closed: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    },
    reportMappings: {
      metricId: "total_complaints",
      chartType: "pie",
    },
  },
  defects: {
    id: "defects",
    routeBase: "/service/defects",
    displayTitle: "Product Defects",
    entityLabel: "Defect",
    iconName: "HelpCircle",
    statuses: [
      { id: "New", label: "New", color: "#2090FF" },
      { id: "Under Investigation", label: "Under Investigation", color: "#F59E0B" },
      { id: "Corrective Action", label: "Corrective Action", color: "#10B981" },
      { id: "Closed", label: "Closed", color: "#6B7280" },
    ],
    statusOrder: ["New", "Under Investigation", "Corrective Action", "Closed"],
    allowedTransitions: {
      New: ["Under Investigation"],
      "Under Investigation": ["Corrective Action"],
      "Corrective Action": ["Closed"],
      Closed: ["Under Investigation"],
    },
    listColumns: [
      { id: "defectCode", label: "Defect Code", type: "text" },
      { id: "defectTypeId", label: "Defect Type", type: "relation", relationKey: "defectType.name" },
      { id: "assetId", label: "Asset", type: "relation", relationKey: "asset.productName" },
      { id: "status", label: "Status", type: "badge" },
      { id: "createdAt", label: "Created At", type: "date" },
    ],
    filterDefinitions: [
      { id: "status", label: "Status", type: "select", options: [
        { value: "New", label: "New" },
        { value: "Under Investigation", label: "Under Investigation" },
        { value: "Corrective Action", label: "Corrective Action" }
      ]}
    ],
    formFields: [
      { id: "defectTypeId", label: "Defect Type", type: "relation", relationModel: "DefectType", required: true },
      { id: "assetId", label: "Customer Asset", type: "relation", relationModel: "CustomerAsset", required: true },
      { id: "description", label: "Defect Details", type: "textarea", required: true },
      { id: "priorityId", label: "Priority", type: "relation", relationModel: "PriorityLevel", required: true },
    ],
    detailSections: [
      { id: "general", title: "Defect Details", fields: ["defectTypeId", "description", "status", "priorityId"] },
      { id: "asset_details", title: "Asset Information", fields: ["assetId"] }
    ],
    allowedActions: [
      { id: "investigate", label: "Start Investigation", variant: "primary", requiredStatus: ["New"] },
      { id: "corrective", label: "Log Corrective Action", variant: "success", requiredStatus: ["Under Investigation"] },
      { id: "close", label: "Close Defect", variant: "secondary", requiredStatus: ["Corrective Action"] },
      { id: "reopen", label: "Reopen Defect", variant: "danger", requiredStatus: ["Closed"] },
    ],
    badgeColorRules: {
      New: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      "Under Investigation": "bg-amber-500/10 text-amber-500 border-amber-500/20",
      "Corrective Action": "bg-green-500/10 text-green-500 border-green-500/20",
      Closed: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    },
    reportMappings: {
      metricId: "total_defects",
      chartType: "bar",
    },
  },
  installations: {
    id: "installations",
    routeBase: "/service/installations",
    displayTitle: "Equipment Installations",
    entityLabel: "Installation",
    iconName: "Hammer",
    statuses: [
      { id: "Scheduled", label: "Scheduled", color: "#3B82F6" },
      { id: "In Progress", label: "In Progress", color: "#F59E0B" },
      { id: "Completed", label: "Completed", color: "#10B981" },
    ],
    statusOrder: ["Scheduled", "In Progress", "Completed"],
    allowedTransitions: {
      Scheduled: ["In Progress"],
      "In Progress": ["Completed", "Scheduled"],
      Completed: [],
    },
    listColumns: [
      { id: "installationCode", label: "Commission Code", type: "text" },
      { id: "customerId", label: "Customer", type: "relation", relationKey: "customer.name" },
      { id: "assetId", label: "Asset", type: "relation", relationKey: "asset.productName" },
      { id: "status", label: "Status", type: "badge" },
      { id: "createdAt", label: "Created At", type: "date" },
    ],
    filterDefinitions: [
      { id: "status", label: "Status", type: "select", options: [
        { value: "Scheduled", label: "Scheduled" },
        { value: "In Progress", label: "In Progress" },
        { value: "Completed", label: "Completed" }
      ]}
    ],
    formFields: [
      { id: "customerId", label: "Customer", type: "relation", relationModel: "Customer", required: true },
      { id: "assetId", label: "Customer Asset", type: "relation", relationModel: "CustomerAsset", required: true, dependsOn: "customerId", placeholderWhenEmpty: "Select a customer first" },
      { id: "teamId", label: "Service Team", type: "relation", relationModel: "ServiceTeam" },
      { id: "engineerId", label: "Service Engineer", type: "relation", relationModel: "ServiceEngineer" },
      { id: "notes", label: "Installation Notes", type: "textarea" },
    ],
    detailSections: [
      { id: "general", title: "Installation Info", fields: ["status", "notes"] },
      { id: "assignment", title: "Assignments", fields: ["teamId", "engineerId"] },
      { id: "customer_details", title: "Customer & Asset", fields: ["customerId", "assetId"] }
    ],
    allowedActions: [
      { id: "start", label: "Start Installation", variant: "primary", requiredStatus: ["Scheduled"] },
      { id: "reschedule", label: "Reschedule", variant: "secondary", requiredStatus: ["Scheduled"] },
      { id: "complete", label: "Mark Completed", variant: "success", requiredStatus: ["In Progress"] },
      { id: "fail", label: "Mark Failed / Needs Follow-up", variant: "danger", requiredStatus: ["In Progress"] },
    ],
    badgeColorRules: {
      Scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      "In Progress": "bg-amber-500/10 text-amber-500 border-amber-500/20",
      Completed: "bg-green-500/10 text-green-500 border-green-500/20",
    },
    reportMappings: {
      metricId: "total_installations",
      chartType: "bar",
    },
  },
  warranty_amc: {
    id: "warranty_amc",
    routeBase: "/service/warranty-amc",
    displayTitle: "Warranty & AMC Claims",
    entityLabel: "Contract/Claim",
    iconName: "LifeBuoy",
    statuses: [
      { id: "Active", label: "Active", color: "#10B981" },
      { id: "Expired", label: "Expired", color: "#EF4444" },
    ],
    statusOrder: ["Active", "Expired"],
    allowedTransitions: {
      Active: ["Expired"],
      Expired: ["Active"],
    },
    listColumns: [
      { id: "serialNumber", label: "Serial Number", type: "text" },
      { id: "productName", label: "Product Name", type: "text" },
      { id: "status", label: "Status", type: "badge" },
    ],
    filterDefinitions: [],
    formFields: [],
    detailSections: [],
    allowedActions: [],
    badgeColorRules: {
      Active: "bg-green-500/10 text-green-500 border-green-500/20",
      Expired: "bg-red-500/10 text-red-500 border-red-500/20",
    },
    reportMappings: {
      metricId: "warranty_coverage",
      chartType: "pie",
    },
  },
  visits: {
    id: "visits",
    routeBase: "/service/visits",
    displayTitle: "Service Visits",
    entityLabel: "Visit",
    iconName: "Calendar",
    statuses: [
      { id: "Scheduled", label: "Scheduled", color: "#3B82F6" },
      { id: "Completed", label: "Completed", color: "#10B981" },
      { id: "Overdue", label: "Overdue", color: "#EF4444" },
    ],
    statusOrder: ["Scheduled", "Completed", "Overdue"],
    allowedTransitions: {
      Scheduled: ["Completed"],
      Completed: [],
      Overdue: ["Completed"],
    },
    listColumns: [
      { id: "visitDate", label: "Visit Date", type: "date" },
      { id: "customerId", label: "Customer", type: "relation", relationKey: "customer.name" },
      { id: "assetId", label: "Asset", type: "relation", relationKey: "customerAsset.productName" },
      { id: "engineerId", label: "Engineer", type: "relation", relationKey: "engineer.user.name" },
      { id: "source", label: "Source", type: "text" },
      { id: "status", label: "Status", type: "badge" },
    ],
    filterDefinitions: [
      { id: "status", label: "Status", type: "select", options: [
        { value: "Scheduled", label: "Scheduled" },
        { value: "Completed", label: "Completed" },
        { value: "Overdue", label: "Overdue" }
      ]},
      { id: "engineerId", label: "Engineer", type: "select", options: [] },
    ],
    formFields: [
      { id: "customerId", label: "Customer", type: "relation", relationModel: "Customer", required: true },
      { id: "assetId", label: "Customer Asset", type: "relation", relationModel: "CustomerAsset", required: true, dependsOn: "customerId", placeholderWhenEmpty: "Select a customer first" },
      { id: "engineerId", label: "Service Engineer", type: "relation", relationModel: "ServiceEngineer", required: true },
      { id: "visitDate", label: "Visit Date", type: "date", required: true },
      { id: "notes", label: "Purpose / Notes", type: "textarea" },
    ],
    detailSections: [
      { id: "general", title: "Visit Information", fields: ["visitDate", "status", "notes", "outcomeNotes"] },
      { id: "assignments", title: "Engineer & Customer", fields: ["engineerId", "customerId", "assetId"] }
    ],
    allowedActions: [
      { id: "complete", label: "Mark Completed", variant: "success", requiredStatus: ["Scheduled", "Overdue"] },
    ],
    badgeColorRules: {
      Scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      Completed: "bg-green-500/10 text-green-500 border-green-500/20",
      Overdue: "bg-red-500/10 text-red-500 border-red-500/20",
    },
    reportMappings: {
      metricId: "total_visits",
      chartType: "bar",
    },
  },
};

