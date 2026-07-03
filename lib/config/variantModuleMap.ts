export type ModuleSearchItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  keywords: string[];
  type: 'module' | 'submodule' | 'setting';
  parentLabel?: string;
};

// ─── V1 base items ────────────────────────────────────────────────────────────
const V1_ITEMS: ModuleSearchItem[] = [
  // Modules
  { key: 'dashboard',       label: 'Dashboard',          href: '/dashboard',                             icon: '📊', keywords: ['home', 'overview', 'kpi'],                type: 'module' },
  { key: 'leads',           label: 'Leads',              href: '/leads',                                 icon: '👤', keywords: ['lead', 'prospect'],                        type: 'module' },
  { key: 'accounts',        label: 'Accounts',           href: '/customer-master',                       icon: '🏢', keywords: ['customer', 'account', 'company'],           type: 'module' },
  { key: 'contacts',        label: 'Contacts',           href: '/contacts',                              icon: '📋', keywords: ['contact', 'person', 'people'],              type: 'module' },
  { key: 'activities',      label: 'Activities',         href: '/activities',                            icon: '📞', keywords: ['call', 'meeting', 'email', 'note', 'log'],   type: 'module' },
  { key: 'pipeline',        label: 'Sales Pipeline',     href: '/sales-pipeline/pipeline-list',          icon: '📈', keywords: ['deal', 'opportunity', 'pipeline'],           type: 'module' },
  { key: 'quotations',      label: 'Quotation Management', href: '/quotations',                          icon: '💰', keywords: ['quote', 'quotation', 'proposal'],            type: 'module' },
  { key: 'tasks',           label: 'Tasks',              href: '/tasks',                                 icon: '✅', keywords: ['task', 'todo', 'pending'],                   type: 'module' },
  { key: 'followups',       label: 'Follow Ups',         href: '/follow-up',                             icon: '🔔', keywords: ['follow', 'followup', 'reminder'],             type: 'module' },
  { key: 'reports',         label: 'Reports',            href: '/reports',                               icon: '📑', keywords: ['report', 'analytics', 'export'],              type: 'module' },
  // Sub-modules
  { key: 'leads-new',       label: 'New Leads',          href: '/leads?status=New',                      icon: '👤', keywords: ['new lead', 'add lead'],                      type: 'submodule', parentLabel: 'Leads' },
  { key: 'leads-followup',  label: "Today's Follow-up",  href: '/leads?status=TodayFollowUp',            icon: '👤', keywords: ['followup today', 'due today'],                type: 'submodule', parentLabel: 'Leads' },
  { key: 'leads-upcoming',  label: "Upcoming Follow-ups",  href: '/leads?status=UpcomingFollowUp',            icon: '👤', keywords: ['upcoming', 'followup', 'due'],                type: 'submodule', parentLabel: 'Leads' },
  { key: 'leads-lost',      label: 'Lost Leads',         href: '/leads?status=Lost',                     icon: '👤', keywords: ['lost', 'lost lead'],                          type: 'submodule', parentLabel: 'Leads' },
  // Settings
  { key: 'settings-users',        label: 'Users',               href: '/user-master',              icon: '⚙️', keywords: ['user', 'team', 'member'],          type: 'setting' },
  { key: 'settings-roles',        label: 'Roles & Permissions', href: '/settings/roles',           icon: '⚙️', keywords: ['role', 'permission', 'access'],    type: 'setting' },
  { key: 'settings-lead-sources', label: 'Lead Sources',        href: '/settings/lead-sources',    icon: '⚙️', keywords: ['source', 'lead source'],           type: 'setting' },
  { key: 'settings-email',        label: 'Email Templates',     href: '/settings/email-templates', icon: '⚙️', keywords: ['email template', 'template'],      type: 'setting' },
];

// ─── V2 extras ────────────────────────────────────────────────────────────────
const V2_EXTRAS: ModuleSearchItem[] = [
  { key: 'rfq',               label: 'RFQ Management',     href: '/rfq',                                            icon: '📄', keywords: ['rfq', 'request for quote', 'costing'],     type: 'module' },
  { key: 'visits',            label: 'Customer Visits',    href: '/visits',                                         icon: '🚗', keywords: ['visit', 'field', 'site visit'],             type: 'module' },
  { key: 'catalogue',         label: 'Product Catalogue',  href: '/catalogue',                                      icon: '📦', keywords: ['product', 'catalogue', 'catalog'],          type: 'module' },
  { key: 'deals',             label: 'Deals',              href: '/deals',                                          icon: '🤝', keywords: ['deal', 'won', 'active deal'],               type: 'module' },
  { key: 'forecast',          label: 'Forecast',           href: '/forecast',                                       icon: '🎯', keywords: ['forecast', 'revenue', 'sales target'],      type: 'module' },
  // Pipeline sub-modules
  { key: 'pipeline-qualified',   label: 'Qualified',       href: '/sales-pipeline/pipeline-list?tab=Qualified',          icon: '📈', keywords: ['qualified', 'sql'],              type: 'submodule', parentLabel: 'Sales Pipeline' },
  { key: 'pipeline-meeting',     label: 'Meeting Scheduled',href: '/sales-pipeline/pipeline-list?tab=MeetingScheduled',   icon: '📈', keywords: ['meeting', 'demo', 'scheduled'],  type: 'submodule', parentLabel: 'Sales Pipeline' },
  { key: 'pipeline-demo',        label: 'Demo Conducted',   href: '/sales-pipeline/pipeline-list?tab=DemoConducted',      icon: '📈', keywords: ['demo', 'conducted'],            type: 'submodule', parentLabel: 'Sales Pipeline' },
  // V2 settings
  { key: 'settings-pipeline',  label: 'Pipeline Stages',    href: '/settings/pipeline-stages',    icon: '⚙️', keywords: ['pipeline stage', 'stage'],            type: 'setting' },
  { key: 'settings-notif',     label: 'Notification Rules', href: '/settings/notification-rules', icon: '⚙️', keywords: ['notification', 'alert', 'rule'],      type: 'setting' },
  { key: 'settings-whatsapp',  label: 'WhatsApp Templates', href: '/settings/whatsapp-templates', icon: '⚙️', keywords: ['whatsapp', 'wa template'],            type: 'setting' },
  { key: 'settings-products',  label: 'Product Categories', href: '/settings/product-categories', icon: '⚙️', keywords: ['product category', 'category'],       type: 'setting' },
];

// ─── V3 extras ────────────────────────────────────────────────────────────────
const V3_EXTRAS: ModuleSearchItem[] = [
  { key: 'samples',          label: 'Sample Management', href: '/samples',        icon: '🧪', keywords: ['sample', 'test sample', 'sample request'],   type: 'module' },
  { key: 'negotiation-mgmt', label: 'Negotiation Mgmt', href: '/negotiations',   icon: '🤝', keywords: ['negotiation', 'negotiate', 'deal terms'],     type: 'module' },
  { key: 'purchase-orders',  label: 'Purchase Orders',  href: '/purchase-orders', icon: '📋', keywords: ['po', 'purchase order', 'order'],              type: 'module' },
  { key: 'approvals',        label: 'Approval Center',  href: '/approvals',      icon: '✔️', keywords: ['approval', 'approve', 'pending approval'],    type: 'module' },
  // V3 settings
  { key: 'settings-approval',label: 'Approval Matrix',    href: '/settings/approval-matrix',    icon: '⚙️', keywords: ['approval', 'approve', 'matrix'],         type: 'setting' },
  { key: 'settings-loss',    label: 'Loss Reason Master', href: '/settings/loss-reason-master', icon: '⚙️', keywords: ['loss reason', 'lost reason', 'why lost'], type: 'setting' },
  { key: 'settings-custom',  label: 'Custom Fields',      href: '/settings/custom-fields',      icon: '⚙️', keywords: ['custom field', 'custom', 'field'],        type: 'setting' },
];

// ─── V4 extras ────────────────────────────────────────────────────────────────
const V4_EXTRAS: ModuleSearchItem[] = [
  { key: 'competitors',         label: 'Competitor Mgmt',  href: '/competitors',   icon: '⚔️', keywords: ['competitor', 'competition', 'rival', 'win loss'],  type: 'module' },
  { key: 'key-accounts',        label: 'Key Account Mgmt', href: '/key-accounts',  icon: '👑', keywords: ['key account', 'strategic', 'kam'],                  type: 'module' },
  { key: 'territory-mgmt',      label: 'Territory Mgmt',   href: '/territories',   icon: '🗺️', keywords: ['territory', 'region', 'zone', 'area'],              type: 'module' },
  { key: 'target-mgmt',         label: 'Target Mgmt',      href: '/targets',       icon: '🏆', keywords: ['target', 'quota', 'achievement'],                    type: 'module' },
  // V4 settings
  { key: 'settings-territory',  label: 'Territories',        href: '/settings/territories',        icon: '⚙️', keywords: ['territory', 'region', 'zone'],         type: 'setting' },
  { key: 'settings-competitor', label: 'Competitor Master',  href: '/settings/competitor-master',  icon: '⚙️', keywords: ['competitor', 'competition', 'rival'],  type: 'setting' },
];

// ─── Build complete maps by composing ─────────────────────────────────────────
export const VARIANT_MODULE_MAP: Record<number, ModuleSearchItem[]> = {
  1: V1_ITEMS,
  2: [...V1_ITEMS, ...V2_EXTRAS],
  3: [...V1_ITEMS, ...V2_EXTRAS, ...V3_EXTRAS],
  4: [...V1_ITEMS, ...V2_EXTRAS, ...V3_EXTRAS, ...V4_EXTRAS],
};

// Search function — call this from the search component
export function searchModules(query: string, variant: number): ModuleSearchItem[] {
  if (!query || query.trim().length < 1) return [];
  const q = query.toLowerCase().trim();
  const items = VARIANT_MODULE_MAP[variant] ?? VARIANT_MODULE_MAP[1];
  return items.filter(item =>
    item.label.toLowerCase().includes(q) ||
    item.key.toLowerCase().includes(q) ||
    item.keywords.some(kw => kw.toLowerCase().includes(q)) ||
    (item.parentLabel?.toLowerCase().includes(q))
  ).slice(0, 8);
}
