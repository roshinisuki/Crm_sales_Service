import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ════════════════════════════════════════════════════════════
// CATEGORY DEFINITIONS (8 categories, shared structure per tenant)
// ════════════════════════════════════════════════════════════

const CATEGORIES = [
  { name: 'Industrial Pumps', description: 'Centrifugal, submersible, and process pumps for industrial use' },
  { name: 'Valves & Actuators', description: 'Gate, globe, butterfly, ball, and control valves' },
  { name: 'Electric Motors', description: 'AC induction, servo, and geared motors' },
  { name: 'Control Panels', description: 'MCC, PCC, and automation control panels' },
  { name: 'Automation Components', description: 'PLCs, VFDs, sensors, relays, and HMI panels' },
  { name: 'Water Treatment Systems', description: 'RO plants, softeners, and demineralization systems' },
  { name: 'Filtration Units', description: 'Bag filters, cartridge filters, and strainers' },
  { name: 'Process Equipment', description: 'Heat exchangers, pressure vessels, mixers, and reactors' },
];

// ════════════════════════════════════════════════════════════
// PRODUCTS — 6 per category × 8 categories = 48 products per tenant
// ════════════════════════════════════════════════════════════

type SeedSpec = { specKey: string; specValue: string; unit: string; displayOrder: number };
type SeedFile = { title: string; fileName: string; fileUrl: string; version?: string };
type SeedProduct = {
  productCode: string; name: string; description: string; unit: string;
  basePrice: number; isActive: boolean;
  specs: SeedSpec[]; datasheet?: SeedFile; brochure?: SeedFile;
};

const PRODUCTS_BY_CATEGORY: Record<string, SeedProduct[]> = {

  'Industrial Pumps': [
    {
      productCode: 'PMP-CENT-001', name: 'Kirloskar Star-1 Centrifugal Pump',
      description: 'Single-stage centrifugal pump for water and mild chemicals. The Kirloskar Star-1 is a reliable single-stage end suction centrifugal pump designed for general industrial water supply, irrigation, and mild chemical transfer applications. Cast iron construction with bronze impeller ensures long service life.',
      unit: 'Nos', basePrice: 18500, isActive: true,
      specs: [
        { specKey: 'Flow Rate', specValue: '150', unit: 'LPM', displayOrder: 1 },
        { specKey: 'Head', specValue: '30', unit: 'Metres', displayOrder: 2 },
        { specKey: 'Power Rating', specValue: '1.5', unit: 'kW', displayOrder: 3 },
        { specKey: 'Speed', specValue: '2900', unit: 'RPM', displayOrder: 4 },
        { specKey: 'Inlet/Outlet Size', specValue: '40/32', unit: 'mm', displayOrder: 5 },
        { specKey: 'Operating Temp', specValue: '0–80', unit: '°C', displayOrder: 6 },
        { specKey: 'Material (Casing)', specValue: 'CI Grade FG 260', unit: '', displayOrder: 7 },
        { specKey: 'Efficiency', specValue: '72', unit: '%', displayOrder: 8 },
      ],
      datasheet: { title: 'Star-1 Technical Datasheet', fileName: 'kirloskar_star1_datasheet.pdf', fileUrl: '/files/datasheets/kirloskar_star1_datasheet.pdf', version: 'v2.1' },
      brochure: { title: 'Kirloskar Star Series Brochure', fileName: 'kirloskar_star_series.pdf', fileUrl: '/files/brochures/kirloskar_star_series.pdf' },
    },
    {
      productCode: 'PMP-SUBM-001', name: 'Grundfos SP5-18 Submersible Pump',
      description: 'Deep well submersible pump for borewell applications. Stainless steel submersible pump engineered for borewell water extraction with high efficiency and corrosion resistance, suitable for agricultural and municipal water supply.',
      unit: 'Nos', basePrice: 42000, isActive: true,
      specs: [
        { specKey: 'Flow Rate', specValue: '5', unit: 'm³/hr', displayOrder: 1 },
        { specKey: 'Max Head', specValue: '173', unit: 'Metres', displayOrder: 2 },
        { specKey: 'Motor Power', specValue: '2.2', unit: 'kW', displayOrder: 3 },
        { specKey: 'Voltage', specValue: '415', unit: 'V', displayOrder: 4 },
        { specKey: 'Borewell Dia', specValue: '100', unit: 'mm', displayOrder: 5 },
        { specKey: 'Stages', specValue: '18', unit: 'Nos', displayOrder: 6 },
      ],
      datasheet: { title: 'SP5-18 Product Datasheet', fileName: 'grundfos_sp5_18.pdf', fileUrl: '/files/datasheets/grundfos_sp5_18.pdf' },
    },
    {
      productCode: 'PMP-PROC-001', name: 'Flowserve Mark 3 Process Pump',
      description: 'ANSI/ASME B73.1 compliant horizontal process pump. Heavy-duty horizontal process pump built to ANSI standards for chemical, petrochemical, and general industrial process applications requiring high reliability.',
      unit: 'Nos', basePrice: 125000, isActive: true,
      specs: [
        { specKey: 'Flow Rate', specValue: '50–500', unit: 'm³/hr', displayOrder: 1 },
        { specKey: 'Max Pressure', specValue: '16', unit: 'bar', displayOrder: 2 },
        { specKey: 'Max Temperature', specValue: '260', unit: '°C', displayOrder: 3 },
        { specKey: 'Casing Material', specValue: 'SS 316L', unit: '', displayOrder: 4 },
        { specKey: 'Seal Type', specValue: 'Mechanical Seal', unit: '', displayOrder: 5 },
      ],
      brochure: { title: 'Flowserve ANSI Pumps Brochure', fileName: 'flowserve_ansi_brochure.pdf', fileUrl: '/files/brochures/flowserve_ansi_brochure.pdf' },
    },
    {
      productCode: 'PMP-GEAR-001', name: 'Roto Pumps RDV Gear Pump',
      description: 'Rotary gear pump for viscous fluid transfer. Designed for transferring viscous fluids such as oils, syrups, and chemicals with consistent flow and minimal pulsation.',
      unit: 'Nos', basePrice: 65000, isActive: true,
      specs: [
        { specKey: 'Flow Rate', specValue: '25', unit: 'm³/hr', displayOrder: 1 },
        { specKey: 'Max Pressure', specValue: '10', unit: 'bar', displayOrder: 2 },
        { specKey: 'Viscosity Range', specValue: '1–100000', unit: 'cSt', displayOrder: 3 },
        { specKey: 'Material', specValue: 'Cast Steel', unit: '', displayOrder: 4 },
      ],
    },
    {
      productCode: 'PMP-DOSE-001', name: 'ProMinent Gamma Dosing Pump',
      description: 'Precision diaphragm dosing pump for chemical dosing. High-precision solenoid diaphragm metering pump for accurate chemical dosing in water treatment and industrial process applications.',
      unit: 'Nos', basePrice: 38500, isActive: true,
      specs: [
        { specKey: 'Max Flow Rate', specValue: '20', unit: 'L/hr', displayOrder: 1 },
        { specKey: 'Max Pressure', specValue: '10', unit: 'bar', displayOrder: 2 },
        { specKey: 'Dosing Accuracy', specValue: '±1', unit: '%', displayOrder: 3 },
        { specKey: 'Stroke Rate', specValue: '180', unit: 'strokes/min', displayOrder: 4 },
      ],
      datasheet: { title: 'Gamma X Dosing Pump Manual', fileName: 'prominent_gamma_x.pdf', fileUrl: '/files/datasheets/prominent_gamma_x.pdf' },
    },
    {
      productCode: 'PMP-VERT-001', name: 'KSB Etaline Vertical Inline Pump',
      description: 'Vertical inline pump for HVAC and building services. Space-saving vertical inline centrifugal pump ideal for HVAC circulation, cooling systems, and building water services.',
      unit: 'Nos', basePrice: 56000, isActive: true,
      specs: [
        { specKey: 'Flow Rate', specValue: '40', unit: 'm³/hr', displayOrder: 1 },
        { specKey: 'Head', specValue: '25', unit: 'Metres', displayOrder: 2 },
        { specKey: 'Power', specValue: '5.5', unit: 'kW', displayOrder: 3 },
        { specKey: 'Connection', specValue: 'Flanged DN65', unit: '', displayOrder: 4 },
      ],
    },
  ],

  'Valves & Actuators': [
    {
      productCode: 'VLV-GATE-001', name: 'L&T Gate Valve PN16 DN80',
      description: 'Flanged gate valve for on/off service, PN16 rated. Cast iron gate valve for isolation duty in water and utility pipelines, flanged ends, PN16 pressure class.',
      unit: 'Nos', basePrice: 3200, isActive: true,
      specs: [
        { specKey: 'Size (DN)', specValue: '80', unit: 'mm', displayOrder: 1 },
        { specKey: 'Pressure Rating', specValue: '16', unit: 'bar', displayOrder: 2 },
        { specKey: 'Body Material', specValue: 'Cast Iron', unit: '', displayOrder: 3 },
        { specKey: 'Trim Material', specValue: 'SS410', unit: '', displayOrder: 4 },
        { specKey: 'End Connection', specValue: 'Flanged PN16', unit: '', displayOrder: 5 },
        { specKey: 'Temperature Range', specValue: '-10 to 200', unit: '°C', displayOrder: 6 },
      ],
      datasheet: { title: 'Gate Valve Technical Datasheet', fileName: 'lt_gate_valve_dn80.pdf', fileUrl: '/files/datasheets/lt_gate_valve_dn80.pdf' },
    },
    {
      productCode: 'VLV-BFLY-001', name: 'AUDCO Butterfly Valve DN150 Wafer Type',
      description: 'Wafer type butterfly valve for water and utility services. Lightweight wafer-style butterfly valve for quick installation between flanges, suitable for water, air, and mild chemical services.',
      unit: 'Nos', basePrice: 4800, isActive: true,
      specs: [
        { specKey: 'Size (DN)', specValue: '150', unit: 'mm', displayOrder: 1 },
        { specKey: 'Pressure Rating', specValue: '10', unit: 'bar', displayOrder: 2 },
        { specKey: 'Body Material', specValue: 'Ductile Iron', unit: '', displayOrder: 3 },
        { specKey: 'Disc Material', specValue: 'SS 316', unit: '', displayOrder: 4 },
        { specKey: 'Liner', specValue: 'EPDM', unit: '', displayOrder: 5 },
      ],
    },
    {
      productCode: 'VLV-BALL-001', name: 'Audco 2-Piece Ball Valve DN50',
      description: 'Full bore ball valve for shutoff applications. Two-piece body ball valve with full bore design, suitable for oil, gas, and chemical isolation duties.',
      unit: 'Nos', basePrice: 2400, isActive: true,
      specs: [
        { specKey: 'Size (DN)', specValue: '50', unit: 'mm', displayOrder: 1 },
        { specKey: 'Pressure Class', specValue: '150', unit: 'lb', displayOrder: 2 },
        { specKey: 'Body Material', specValue: 'SS316', unit: '', displayOrder: 3 },
        { specKey: 'Seat Material', specValue: 'PTFE', unit: '', displayOrder: 4 },
      ],
    },
    {
      productCode: 'VLV-GLOB-001', name: 'Forbes Marshall Globe Control Valve',
      description: 'Pneumatic globe control valve for flow regulation. Single-seated globe control valve with pneumatic actuator for precise flow and pressure regulation in process lines.',
      unit: 'Nos', basePrice: 48000, isActive: true,
      specs: [
        { specKey: 'Size', specValue: '25', unit: 'mm', displayOrder: 1 },
        { specKey: 'Cv Value', specValue: '12', unit: '', displayOrder: 2 },
        { specKey: 'Actuator Type', specValue: 'Pneumatic Diaphragm', unit: '', displayOrder: 3 },
        { specKey: 'Max Pressure', specValue: '40', unit: 'bar', displayOrder: 4 },
      ],
      datasheet: { title: 'Globe Control Valve Datasheet', fileName: 'fm_globe_control_valve.pdf', fileUrl: '/files/datasheets/fm_globe_control_valve.pdf' },
    },
    {
      productCode: 'VLV-CHCK-001', name: 'L&T Swing Check Valve DN100',
      description: 'Non-return swing check valve for backflow prevention. Cast iron swing check valve preventing reverse flow in pumping systems, suitable for water and wastewater applications.',
      unit: 'Nos', basePrice: 5500, isActive: true,
      specs: [
        { specKey: 'Size (DN)', specValue: '100', unit: 'mm', displayOrder: 1 },
        { specKey: 'Pressure Rating', specValue: '16', unit: 'bar', displayOrder: 2 },
        { specKey: 'Body Material', specValue: 'Cast Iron', unit: '', displayOrder: 3 },
      ],
    },
    {
      productCode: 'VLV-ACTR-001', name: 'Rotork IQ3 Electric Actuator',
      description: 'Intelligent electric valve actuator with diagnostics. Modular electric actuator for valve automation with non-intrusive setup, data logging, and remote diagnostics capability.',
      unit: 'Nos', basePrice: 95000, isActive: true,
      specs: [
        { specKey: 'Output Torque', specValue: '20–80', unit: 'Nm', displayOrder: 1 },
        { specKey: 'Supply Voltage', specValue: '380–480', unit: 'V', displayOrder: 2 },
        { specKey: 'IP Rating', specValue: 'IP68', unit: '', displayOrder: 3 },
        { specKey: 'Communication', specValue: 'Modbus/Profibus', unit: '', displayOrder: 4 },
      ],
      brochure: { title: 'Rotork IQ3 Brochure', fileName: 'rotork_iq3_brochure.pdf', fileUrl: '/files/brochures/rotork_iq3_brochure.pdf' },
    },
  ],

  'Electric Motors': [
    {
      productCode: 'MOT-AC-001', name: 'ABB M2BAX 3-Phase Induction Motor 7.5kW',
      description: 'IE3 premium efficiency 3-phase induction motor. High-efficiency IE3 class induction motor designed for continuous industrial duty, foot-mounted with cast iron frame.',
      unit: 'Nos', basePrice: 28500, isActive: true,
      specs: [
        { specKey: 'Power Rating', specValue: '7.5', unit: 'kW', displayOrder: 1 },
        { specKey: 'Voltage', specValue: '415', unit: 'V', displayOrder: 2 },
        { specKey: 'Frequency', specValue: '50', unit: 'Hz', displayOrder: 3 },
        { specKey: 'Speed', specValue: '1450', unit: 'RPM', displayOrder: 4 },
        { specKey: 'Efficiency', specValue: '91.0', unit: '%', displayOrder: 5 },
        { specKey: 'Frame Size', specValue: '132M', unit: '', displayOrder: 6 },
        { specKey: 'IP Rating', specValue: 'IP55', unit: '', displayOrder: 7 },
        { specKey: 'Insulation', specValue: 'Class F', unit: '', displayOrder: 8 },
        { specKey: 'Starting Current (FLC)', specValue: '15.2', unit: 'A', displayOrder: 9 },
      ],
      datasheet: { title: 'M2BAX Technical Datasheet', fileName: 'abb_m2bax_132ma.pdf', fileUrl: '/files/datasheets/abb_m2bax_132ma.pdf' },
    },
    {
      productCode: 'MOT-AC-002', name: 'Siemens SIMOTICS SD Motor 15kW',
      description: 'Standard motor for industrial general purpose applications. Robust foot-mounted induction motor suitable for pumps, fans, compressors and general industrial drive applications.',
      unit: 'Nos', basePrice: 52000, isActive: true,
      specs: [
        { specKey: 'Power Rating', specValue: '15', unit: 'kW', displayOrder: 1 },
        { specKey: 'Speed', specValue: '1480', unit: 'RPM', displayOrder: 2 },
        { specKey: 'Efficiency', specValue: '92.1', unit: '%', displayOrder: 3 },
        { specKey: 'Voltage', specValue: '415', unit: 'V', displayOrder: 4 },
        { specKey: 'IP Rating', specValue: 'IP55', unit: '', displayOrder: 5 },
        { specKey: 'Frame', specValue: '160M', unit: '', displayOrder: 6 },
      ],
    },
    {
      productCode: 'MOT-SERVO-001', name: 'Yaskawa Sigma-7 Servo Motor 1kW',
      description: 'High-precision servo motor for automation systems. Compact servo motor with high response speed and precision positioning, ideal for CNC and packaging machinery.',
      unit: 'Nos', basePrice: 78000, isActive: true,
      specs: [
        { specKey: 'Rated Output', specValue: '1.0', unit: 'kW', displayOrder: 1 },
        { specKey: 'Rated Speed', specValue: '3000', unit: 'RPM', displayOrder: 2 },
        { specKey: 'Rated Torque', specValue: '3.18', unit: 'Nm', displayOrder: 3 },
        { specKey: 'Encoder', specValue: '24-bit Absolute', unit: '', displayOrder: 4 },
      ],
    },
    {
      productCode: 'MOT-GEAR-001', name: 'Bonfiglioli Helical Gearmotor 2.2kW',
      description: 'Helical bevel gearmotor for conveyor drive applications. Compact helical gear unit combined with motor for material handling and conveyor systems with high efficiency power transmission.',
      unit: 'Nos', basePrice: 34500, isActive: true,
      specs: [
        { specKey: 'Power', specValue: '2.2', unit: 'kW', displayOrder: 1 },
        { specKey: 'Output Speed', specValue: '45', unit: 'RPM', displayOrder: 2 },
        { specKey: 'Ratio', specValue: '32:1', unit: '', displayOrder: 3 },
        { specKey: 'Mounting', specValue: 'Foot Mounted', unit: '', displayOrder: 4 },
      ],
    },
    {
      productCode: 'MOT-AC-003', name: 'Crompton Greaves TEFC Motor 3kW',
      description: 'Totally enclosed fan cooled motor for dusty environments. TEFC enclosure motor suitable for harsh industrial environments with dust and moisture exposure.',
      unit: 'Nos', basePrice: 16500, isActive: true,
      specs: [
        { specKey: 'Power', specValue: '3', unit: 'kW', displayOrder: 1 },
        { specKey: 'Speed', specValue: '1440', unit: 'RPM', displayOrder: 2 },
        { specKey: 'IP Rating', specValue: 'IP55', unit: '', displayOrder: 3 },
      ],
    },
    {
      productCode: 'MOT-HT-001', name: 'ABB HT Induction Motor 110kW',
      description: 'High tension motor for heavy industrial drives. High-voltage squirrel cage induction motor for large fans, pumps, and compressors in heavy industries such as cement and steel.',
      unit: 'Nos', basePrice: 485000, isActive: true,
      specs: [
        { specKey: 'Power', specValue: '110', unit: 'kW', displayOrder: 1 },
        { specKey: 'Voltage', specValue: '6600', unit: 'V', displayOrder: 2 },
        { specKey: 'Speed', specValue: '1485', unit: 'RPM', displayOrder: 3 },
        { specKey: 'Efficiency', specValue: '95.8', unit: '%', displayOrder: 4 },
      ],
      datasheet: { title: 'HT Motor Technical Manual', fileName: 'abb_ht_motor_ami355l.pdf', fileUrl: '/files/datasheets/abb_ht_motor_ami355l.pdf' },
      brochure: { title: 'ABB HT Motors Brochure', fileName: 'abb_ht_motors_brochure.pdf', fileUrl: '/files/brochures/abb_ht_motors_brochure.pdf' },
    },
  ],

  'Control Panels': [
    {
      productCode: 'PNL-MCC-001', name: 'Siemens MCC Panel 415V 200A',
      description: 'Motor Control Centre for industrial motor management. Type-tested low voltage switchboard for centralized control and protection of multiple motors in industrial plants.',
      unit: 'Nos', basePrice: 185000, isActive: true,
      specs: [
        { specKey: 'Voltage', specValue: '415', unit: 'V', displayOrder: 1 },
        { specKey: 'Current Rating', specValue: '200', unit: 'A', displayOrder: 2 },
        { specKey: 'IP Rating', specValue: 'IP42', unit: '', displayOrder: 3 },
        { specKey: 'Busbar Material', specValue: 'Copper', unit: '', displayOrder: 4 },
        { specKey: 'Short Circuit', specValue: '50', unit: 'kA', displayOrder: 5 },
        { specKey: 'Mounting', specValue: 'Floor standing', unit: '', displayOrder: 6 },
      ],
      datasheet: { title: 'SIVACON S8 Technical Manual', fileName: 'siemens_sivacon_s8.pdf', fileUrl: '/files/datasheets/siemens_sivacon_s8.pdf' },
      brochure: { title: 'Siemens Panel Solutions Brochure', fileName: 'siemens_panels_brochure.pdf', fileUrl: '/files/brochures/siemens_panels_brochure.pdf' },
    },
    {
      productCode: 'PNL-PCC-001', name: 'L&T Power Control Centre Panel',
      description: 'Power distribution panel for plant electrical systems. Robust power control centre for incoming and outgoing power feeder management at industrial substations.',
      unit: 'Nos', basePrice: 220000, isActive: true,
      specs: [
        { specKey: 'Current Rating', specValue: '630', unit: 'A', displayOrder: 1 },
        { specKey: 'Voltage', specValue: '415', unit: 'V', displayOrder: 2 },
        { specKey: 'Short Circuit Rating', specValue: '50', unit: 'kA', displayOrder: 3 },
        { specKey: 'Form', specValue: 'Form 4b', unit: '', displayOrder: 4 },
      ],
    },
    {
      productCode: 'PNL-APFC-001', name: 'Schneider APFC Panel 100kVAR',
      description: 'Automatic power factor correction panel. Capacitor-based panel for automatic power factor correction to reduce reactive power penalty and improve electrical efficiency.',
      unit: 'Nos', basePrice: 145000, isActive: true,
      specs: [
        { specKey: 'Capacity', specValue: '100', unit: 'kVAR', displayOrder: 1 },
        { specKey: 'Voltage', specValue: '415', unit: 'V', displayOrder: 2 },
        { specKey: 'Steps', specValue: '8', unit: '', displayOrder: 3 },
      ],
    },
    {
      productCode: 'PNL-DG-001', name: 'Kirloskar DG Synchronizing Panel',
      description: 'DG set synchronization and load sharing panel. Auto synchronizing panel for multiple diesel generator sets with load sharing, AMF, and protection functions.',
      unit: 'Nos', basePrice: 320000, isActive: true,
      specs: [
        { specKey: 'DG Capacity', specValue: '500', unit: 'kVA', displayOrder: 1 },
        { specKey: 'Control Type', specValue: 'PLC Based', unit: '', displayOrder: 2 },
        { specKey: 'Sync Sets', specValue: 'Up to 4', unit: '', displayOrder: 3 },
      ],
    },
    {
      productCode: 'PNL-VFD-001', name: 'ABB VFD Drive Panel 75kW',
      description: 'VFD control panel for variable speed motor drives. Panel-mounted variable frequency drive system for energy-efficient motor speed control in pump and fan applications.',
      unit: 'Nos', basePrice: 285000, isActive: true,
      specs: [
        { specKey: 'Power', specValue: '75', unit: 'kW', displayOrder: 1 },
        { specKey: 'Voltage', specValue: '415', unit: 'V', displayOrder: 2 },
        { specKey: 'Cooling', specValue: 'Forced Air', unit: '', displayOrder: 3 },
      ],
    },
    {
      productCode: 'PNL-RELAY-001', name: 'Siemens Protection Relay Panel',
      description: 'Numerical protection relay panel for substations. Multifunction numerical protection relay panel offering overcurrent, earth fault, and differential protection for transformers and feeders.',
      unit: 'Nos', basePrice: 165000, isActive: true,
      specs: [
        { specKey: 'Protection Functions', specValue: 'OC/EF/Diff', unit: '', displayOrder: 1 },
        { specKey: 'Communication', specValue: 'IEC 61850', unit: '', displayOrder: 2 },
      ],
    },
  ],

  'Automation Components': [
    {
      productCode: 'AUT-VFD-001', name: 'Schneider ATV320 VFD 5.5kW',
      description: 'Variable frequency drive for motor speed control. Compact and versatile drive for simple machines, ideal for pumps, fans, and conveyors with energy-saving capabilities.',
      unit: 'Nos', basePrice: 22000, isActive: true,
      specs: [
        { specKey: 'Power', specValue: '5.5', unit: 'kW', displayOrder: 1 },
        { specKey: 'Input Voltage', specValue: '380–480', unit: 'V', displayOrder: 2 },
        { specKey: 'Output Frequency', specValue: '0–500', unit: 'Hz', displayOrder: 3 },
        { specKey: 'IP Rating', specValue: 'IP20', unit: '', displayOrder: 4 },
        { specKey: 'Control Type', specValue: 'V/f + Vector', unit: '', displayOrder: 5 },
      ],
    },
    {
      productCode: 'AUT-PLC-001', name: 'Allen Bradley MicroLogix 1100 PLC',
      description: 'Compact PLC with Ethernet and data logging. Entry-level programmable controller offering Ethernet connectivity, trending, and data logging for small to medium automation applications.',
      unit: 'Nos', basePrice: 38000, isActive: true,
      specs: [
        { specKey: 'I/O Points', specValue: '16', unit: 'Points', displayOrder: 1 },
        { specKey: 'Memory', specValue: '8', unit: 'KB', displayOrder: 2 },
        { specKey: 'Communication', specValue: 'Ethernet/IP + RS232', unit: '', displayOrder: 3 },
        { specKey: 'Supply Voltage', specValue: '24', unit: 'VDC', displayOrder: 4 },
        { specKey: 'Operating Temp', specValue: '0–60', unit: '°C', displayOrder: 5 },
      ],
    },
    {
      productCode: 'AUT-HMI-001', name: 'Delta HMI Touch Panel 10 inch',
      description: 'Color touch screen HMI for machine operation. High resolution touch panel for operator interface in industrial machinery, with multiple communication protocol support.',
      unit: 'Nos', basePrice: 32000, isActive: true,
      specs: [
        { specKey: 'Screen Size', specValue: '10.1', unit: 'inch', displayOrder: 1 },
        { specKey: 'Resolution', specValue: '1024x600', unit: 'px', displayOrder: 2 },
        { specKey: 'Communication', specValue: 'RS232/485/Ethernet', unit: '', displayOrder: 3 },
      ],
    },
    {
      productCode: 'AUT-SENS-001', name: 'Pepperl+Fuchs Proximity Sensor',
      description: 'Inductive proximity sensor for position detection. Industrial inductive proximity sensor for metallic object detection in automation and conveyor systems.',
      unit: 'Nos', basePrice: 2800, isActive: true,
      specs: [
        { specKey: 'Sensing Range', specValue: '8', unit: 'mm', displayOrder: 1 },
        { specKey: 'Output', specValue: 'PNP NO', unit: '', displayOrder: 2 },
        { specKey: 'Supply Voltage', specValue: '10–30', unit: 'VDC', displayOrder: 3 },
        { specKey: 'IP Rating', specValue: 'IP67', unit: '', displayOrder: 4 },
      ],
    },
    {
      productCode: 'AUT-RELAY-001', name: 'Phoenix Contact Interface Relay',
      description: 'Relay module for PLC signal interfacing. Plug-in relay module for isolating and interfacing PLC outputs to higher power industrial loads.',
      unit: 'Nos', basePrice: 850, isActive: true,
      specs: [
        { specKey: 'Coil Voltage', specValue: '24', unit: 'VDC', displayOrder: 1 },
        { specKey: 'Contact Rating', specValue: '6', unit: 'A', displayOrder: 2 },
      ],
    },
    {
      productCode: 'AUT-SCADA-001', name: 'GE iFIX SCADA Software License',
      description: 'SCADA software for plant-wide process monitoring. Industrial automation software platform for real-time monitoring, control, and data acquisition across plant operations.',
      unit: 'License', basePrice: 285000, isActive: true,
      specs: [
        { specKey: 'License Type', specValue: 'Unlimited Tags', unit: '', displayOrder: 1 },
        { specKey: 'Compatibility', specValue: 'OPC UA/DA', unit: '', displayOrder: 2 },
      ],
      datasheet: { title: 'iFIX SCADA Datasheet', fileName: 'ge_ifix_scada.pdf', fileUrl: '/files/datasheets/ge_ifix_scada.pdf' },
    },
  ],

  'Water Treatment Systems': [
    {
      productCode: 'WTR-RO-001', name: 'Ion Exchange RO Plant 5000 LPH',
      description: 'Reverse osmosis plant for industrial water purification. Skid-mounted RO system for removing dissolved solids from feed water, suitable for boiler feed and process water applications.',
      unit: 'Set', basePrice: 1250000, isActive: true,
      specs: [
        { specKey: 'Capacity', specValue: '5000', unit: 'LPH', displayOrder: 1 },
        { specKey: 'Recovery Rate', specValue: '75', unit: '%', displayOrder: 2 },
        { specKey: 'Membrane Type', specValue: 'Thin Film Composite', unit: '', displayOrder: 3 },
        { specKey: 'Feed TDS', specValue: 'Up to 2000', unit: 'ppm', displayOrder: 4 },
      ],
      datasheet: { title: 'Industrial RO Plant Datasheet', fileName: 'ion_exchange_ro_5000.pdf', fileUrl: '/files/datasheets/ion_exchange_ro_5000.pdf' },
      brochure: { title: 'Water Treatment Solutions Brochure', fileName: 'ion_exchange_brochure.pdf', fileUrl: '/files/brochures/ion_exchange_brochure.pdf' },
    },
    {
      productCode: 'WTR-SOFT-001', name: 'Thermax Water Softener Twin Bed',
      description: 'Automatic twin bed water softener for hardness removal. Ion exchange resin-based softener for removing calcium and magnesium hardness from process and boiler feed water.',
      unit: 'Set', basePrice: 285000, isActive: true,
      specs: [
        { specKey: 'Capacity', specValue: '2000', unit: 'LPH', displayOrder: 1 },
        { specKey: 'Resin Volume', specValue: '500', unit: 'Litres', displayOrder: 2 },
        { specKey: 'Regeneration', specValue: 'Automatic', unit: '', displayOrder: 3 },
      ],
    },
    {
      productCode: 'WTR-DM-001', name: 'VA Tech Wabag DM Plant',
      description: 'Demineralization plant for high purity process water. Two-bed demineralizer producing high purity water for boiler feed and power plant applications, with automatic regeneration.',
      unit: 'Set', basePrice: 950000, isActive: true,
      specs: [
        { specKey: 'Capacity', specValue: '3000', unit: 'LPH', displayOrder: 1 },
        { specKey: 'Output Conductivity', specValue: '<5', unit: 'µS/cm', displayOrder: 2 },
      ],
    },
    {
      productCode: 'WTR-UV-001', name: 'Eltek UV Disinfection System',
      description: 'UV sterilization system for water disinfection. Chemical-free UV disinfection system for eliminating bacteria and pathogens in drinking and process water.',
      unit: 'Set', basePrice: 185000, isActive: true,
      specs: [
        { specKey: 'Flow Capacity', specValue: '3000', unit: 'LPH', displayOrder: 1 },
        { specKey: 'UV Dose', specValue: '40', unit: 'mJ/cm²', displayOrder: 2 },
      ],
    },
    {
      productCode: 'WTR-ETP-001', name: 'Praj ETP Package Plant',
      description: 'Effluent treatment plant for industrial wastewater. Compact package plant for biological and physico-chemical treatment of industrial effluent before discharge or reuse.',
      unit: 'Set', basePrice: 2850000, isActive: true,
      specs: [
        { specKey: 'Capacity', specValue: '50', unit: 'KLD', displayOrder: 1 },
        { specKey: 'Treatment Type', specValue: 'SBR + Filtration', unit: '', displayOrder: 2 },
      ],
      brochure: { title: 'ETP Solutions Brochure', fileName: 'praj_etp_brochure.pdf', fileUrl: '/files/brochures/praj_etp_brochure.pdf' },
    },
    {
      productCode: 'WTR-STP-001', name: 'VA Tech Wabag STP MBBR System',
      description: 'Sewage treatment plant using MBBR technology. Moving bed biofilm reactor based sewage treatment plant for residential and industrial township applications.',
      unit: 'Set', basePrice: 1850000, isActive: true,
      specs: [
        { specKey: 'Capacity', specValue: '100', unit: 'KLD', displayOrder: 1 },
        { specKey: 'Technology', specValue: 'MBBR', unit: '', displayOrder: 2 },
      ],
    },
  ],

  'Filtration Units': [
    {
      productCode: 'FLT-BAG-001', name: 'Eaton Bag Filter Housing Single',
      description: 'Single bag filter housing for liquid filtration. Stainless steel bag filter housing for removing suspended solids from process liquids, with quick-open lid design.',
      unit: 'Nos', basePrice: 45000, isActive: true,
      specs: [
        { specKey: 'Flow Rate', specValue: '20', unit: 'm³/hr', displayOrder: 1 },
        { specKey: 'Bag Size', specValue: 'Size 2', unit: '', displayOrder: 2 },
        { specKey: 'Material', specValue: 'SS304', unit: '', displayOrder: 3 },
        { specKey: 'Max Pressure', specValue: '10', unit: 'bar', displayOrder: 4 },
      ],
    },
    {
      productCode: 'FLT-CART-001', name: 'Pall Cartridge Filter Housing 5 Round',
      description: 'Multi-cartridge filter housing for fine filtration. High-capacity cartridge filter housing accommodating 5 cartridges for polishing filtration in process applications.',
      unit: 'Nos', basePrice: 68000, isActive: true,
      specs: [
        { specKey: 'Cartridges', specValue: '5', unit: 'Nos', displayOrder: 1 },
        { specKey: 'Material', specValue: 'SS316L', unit: '', displayOrder: 2 },
        { specKey: 'Max Pressure', specValue: '10', unit: 'bar', displayOrder: 3 },
      ],
    },
    {
      productCode: 'FLT-STRN-001', name: 'Y-Type Strainer DN100',
      description: 'Y-type strainer for pipeline debris filtration. Inline Y-strainer protecting downstream equipment from pipeline debris and particulate contamination.',
      unit: 'Nos', basePrice: 8500, isActive: true,
      specs: [
        { specKey: 'Size', specValue: '100', unit: 'mm', displayOrder: 1 },
        { specKey: 'Mesh Size', specValue: '40', unit: 'Mesh', displayOrder: 2 },
        { specKey: 'Material', specValue: 'Cast Iron', unit: '', displayOrder: 3 },
      ],
    },
    {
      productCode: 'FLT-SAND-001', name: 'Pressure Sand Filter Vessel',
      description: 'Pressure sand filter for suspended solids removal. FRP vessel with multi-media sand bed for removing turbidity and suspended solids from feed water.',
      unit: 'Nos', basePrice: 125000, isActive: true,
      specs: [
        { specKey: 'Flow Capacity', specValue: '15', unit: 'm³/hr', displayOrder: 1 },
        { specKey: 'Vessel Material', specValue: 'FRP', unit: '', displayOrder: 2 },
      ],
    },
    {
      productCode: 'FLT-CARB-001', name: 'Activated Carbon Filter Vessel',
      description: 'Activated carbon filter for chlorine and odor removal. Granular activated carbon filter for removing residual chlorine, organic matter, and odor from process water.',
      unit: 'Nos', basePrice: 138000, isActive: true,
      specs: [
        { specKey: 'Flow Capacity', specValue: '15', unit: 'm³/hr', displayOrder: 1 },
        { specKey: 'Carbon Type', specValue: 'Coconut Shell GAC', unit: '', displayOrder: 2 },
      ],
    },
  ],

  'Process Equipment': [
    {
      productCode: 'PRC-HEX-001', name: 'Alfa Laval Plate Heat Exchanger',
      description: 'Gasketed plate heat exchanger for process cooling/heating. High efficiency plate heat exchanger for liquid-to-liquid heat transfer in process cooling, heating, and HVAC applications.',
      unit: 'Nos', basePrice: 285000, isActive: true,
      specs: [
        { specKey: 'Heat Duty', specValue: '500', unit: 'kW', displayOrder: 1 },
        { specKey: 'Plates', specValue: '50', unit: 'Nos', displayOrder: 2 },
        { specKey: 'Material', specValue: 'SS316', unit: '', displayOrder: 3 },
        { specKey: 'Max Pressure', specValue: '16', unit: 'bar', displayOrder: 4 },
      ],
      datasheet: { title: 'M10-BFG Heat Exchanger Datasheet', fileName: 'alfa_laval_m10_bfg.pdf', fileUrl: '/files/datasheets/alfa_laval_m10_bfg.pdf' },
    },
    {
      productCode: 'PRC-VESL-001', name: 'Pressure Vessel ASME Stamped',
      description: 'ASME certified pressure vessel for process storage. Carbon steel pressure vessel designed and fabricated to ASME Section VIII standards for process fluid storage.',
      unit: 'Nos', basePrice: 450000, isActive: true,
      specs: [
        { specKey: 'Capacity', specValue: '3000', unit: 'Litres', displayOrder: 1 },
        { specKey: 'Design Pressure', specValue: '10', unit: 'bar', displayOrder: 2 },
        { specKey: 'Material', specValue: 'Carbon Steel', unit: '', displayOrder: 3 },
      ],
    },
    {
      productCode: 'PRC-MIX-001', name: 'Industrial Agitator Mixer 5HP',
      description: 'Top entry agitator for tank mixing applications. Heavy-duty top entry mixer for blending and mixing operations in process tanks, suitable for chemical and pharma industries.',
      unit: 'Nos', basePrice: 165000, isActive: true,
      specs: [
        { specKey: 'Power', specValue: '5', unit: 'HP', displayOrder: 1 },
        { specKey: 'Speed', specValue: '60–120', unit: 'RPM', displayOrder: 2 },
        { specKey: 'Material', specValue: 'SS316', unit: '', displayOrder: 3 },
      ],
    },
    {
      productCode: 'PRC-BOIL-001', name: 'Thermax IBR Steam Boiler 2TPH',
      description: 'IBR-certified steam boiler for process steam generation. Fully automatic IBR-approved fire tube boiler for generating saturated steam for industrial process applications.',
      unit: 'Set', basePrice: 1850000, isActive: true,
      specs: [
        { specKey: 'Capacity', specValue: '2', unit: 'TPH', displayOrder: 1 },
        { specKey: 'Working Pressure', specValue: '10.54', unit: 'kg/cm²', displayOrder: 2 },
        { specKey: 'Fuel', specValue: 'Natural Gas/HSD', unit: '', displayOrder: 3 },
      ],
      brochure: { title: 'Thermax Boilers Brochure', fileName: 'thermax_boilers_brochure.pdf', fileUrl: '/files/brochures/thermax_boilers_brochure.pdf' },
    },
    {
      productCode: 'PRC-COMP-001', name: 'Atlas Copco Screw Compressor 37kW',
      description: 'Oil-injected rotary screw air compressor. Energy-efficient screw compressor for industrial compressed air systems with variable speed drive option.',
      unit: 'Nos', basePrice: 985000, isActive: true,
      specs: [
        { specKey: 'Power', specValue: '37', unit: 'kW', displayOrder: 1 },
        { specKey: 'FAD', specValue: '6.3', unit: 'm³/min', displayOrder: 2 },
        { specKey: 'Max Pressure', specValue: '13', unit: 'bar', displayOrder: 3 },
      ],
      datasheet: { title: 'GA37+ Compressor Datasheet', fileName: 'atlas_copco_ga37.pdf', fileUrl: '/files/datasheets/atlas_copco_ga37.pdf' },
    },
    {
      productCode: 'PRC-REAC-001', name: 'Glass Lined Reactor Vessel 2000L',
      description: 'Glass lined reactor for pharma and chemical processing. Corrosion-resistant glass lined reactor vessel for batch chemical reactions in pharmaceutical and specialty chemical manufacturing.',
      unit: 'Nos', basePrice: 1250000, isActive: true,
      specs: [
        { specKey: 'Capacity', specValue: '2000', unit: 'Litres', displayOrder: 1 },
        { specKey: 'Design Pressure', specValue: '6', unit: 'bar', displayOrder: 2 },
        { specKey: 'Lining', specValue: 'Glass Lined GL-2000', unit: '', displayOrder: 3 },
      ],
    },
  ],
};

// ════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ════════════════════════════════════════════════════════════

async function seedCatalogueForCompany(companyId: string, companyName: string) {
  console.log(`\n📦 Seeding catalogue for ${companyName} (${companyId})...`);

  let categoryCount = 0;
  let productCount = 0;
  let specCount = 0;
  let datasheetCount = 0;
  let brochureCount = 0;

  for (const cat of CATEGORIES) {
    const existing = await prisma.productCategory.findFirst({
      where: { companyId, name: cat.name }
    });
    const category = existing || await prisma.productCategory.create({
      data: { companyId, ...cat, isActive: true }
    });
    categoryCount++;

    const products = PRODUCTS_BY_CATEGORY[cat.name] ?? [];

    for (const prod of products) {
      const { specs, datasheet, brochure, ...productData } = prod;

      const product = await prisma.product.upsert({
        where: { companyId_productCode: { companyId, productCode: prod.productCode } },
        update: {
          ...productData,
          categoryId: category.id,
        },
        create: {
          companyId,
          categoryId: category.id,
          ...productData,
        },
      });
      productCount++;

      // Specs — delete and recreate (idempotent, always fresh)
      await prisma.productSpecification.deleteMany({ where: { productId: product.id } });
      if (specs.length > 0) {
        await prisma.productSpecification.createMany({
          data: specs.map(s => ({ ...s, productId: product.id, companyId })),
        });
        specCount += specs.length;
      }

      // Datasheet
      if (datasheet) {
        const existing = await prisma.productDatasheet.findFirst({
          where: { productId: product.id, fileName: datasheet.fileName },
        });
        if (!existing) {
          await prisma.productDatasheet.create({
            data: { ...datasheet, productId: product.id, companyId, isActive: true },
          });
          datasheetCount++;
        }
      }

      // Brochure
      if (brochure) {
        const existing = await prisma.productBrochure.findFirst({
          where: { productId: product.id, fileName: brochure.fileName },
        });
        if (!existing) {
          await prisma.productBrochure.create({
            data: { ...brochure, productId: product.id, companyId, isActive: true },
          });
          brochureCount++;
        }
      }
    }
  }

  console.log(`   ✅ ${categoryCount} categories, ${productCount} products, ${specCount} specs, ${datasheetCount} datasheets, ${brochureCount} brochures`);
}

async function main() {
  console.log('🌱 Starting Product Catalogue full demo seed...');

  // Find all companies with variant 2, 3, or 4
  const companies = await prisma.company.findMany({
    where: { variant: { in: [2, 3, 4] } },
    orderBy: { name: 'asc' }
  });

  if (companies.length === 0) {
    console.log('⚠️  No V2/V3/V4 companies found in the database — skipping');
    return;
  }

  for (const company of companies) {
    await seedCatalogueForCompany(company.id, company.name);
  }

  console.log('\n🎉 Product Catalogue seed complete!');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
