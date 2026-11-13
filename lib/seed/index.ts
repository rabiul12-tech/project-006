import {
  Activity,
  GoodsReceipt,
  Product,
  ProductCategory,
  PurchaseOrder,
  ReorderRule,
  SavedReport,
  StockAdjustment,
  StockMovement,
  StockoraData,
  StockReservation,
  StockTransfer,
  Supplier,
  SupplierProduct,
  TeamMember,
  Warehouse,
  WorkspaceSettings,
} from '@/types/erp';
import { calculateInventoryValue, calculatePurchaseOrderLine, calculatePurchaseOrderTotals } from '@/lib/calculations';

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  businessName: 'Stockora Global Logistics Inc.',
  organizationTagline: 'Every Product. Every Movement. Under Control.',
  companyLogoText: 'STOCKORA',
  defaultCurrency: 'USD',
  dateFormat: 'yyyy-MM-dd',
  numberFormat: 'en-US',
  defaultWarehouseId: 'wh-01',
  unitsOfMeasure: ['pcs', 'box', 'set', 'roll', 'kg', 'unit', 'pack'],
  valuationMethod: 'MOVING_WEIGHTED_AVERAGE',
  defaultLowStockThreshold: 25,
  poPrefix: 'PO',
  transferPrefix: 'TRF',
  adjustmentPrefix: 'ADJ',
  receiptPrefix: 'GRN',
  allowNegativeStock: false,
  allowOverReceipt: false,
  defaultTaxRate: 8.25,
  notificationsEnabled: true,
  lowStockAlertsEnabled: true,
};

/**
 * Generates an internally consistent, deterministic enterprise dataset for STOCKORA ERP.
 * - 5 Warehouses
 * - 15 Categories
 * - 30 Suppliers
 * - 60 Core Products + 24 Variants (with High-Stock, Low-Stock, and Out-of-Stock items)
 * - Purchase Orders (Draft, Ordered, Partially Received, Received, Cancelled)
 * - Goods Receipts, Stock Transfers (Draft, In Transit, Completed with paired ledger entries), Adjustments, Reservations
 * - Complete Stock Movement Ledger where every warehouse balance derives accurately from movements
 */
export function generateDeterministicSeedData(): StockoraData {
  const warehouses: Warehouse[] = [
    {
      id: 'wh-01',
      name: 'Newark East Coast Hub',
      code: 'EWR-01',
      location: '480 Port Logistics Blvd, Newark, NJ 07114',
      manager: 'Marcus Vance',
      capacityDescription: '85,000 sq ft · 12,000 pallet positions · Climate Controlled',
      maxCapacityUnits: 25000,
      status: 'ACTIVE',
      isDefault: true,
      createdAt: '2025-11-15T08:00:00.000Z',
    },
    {
      id: 'wh-02',
      name: 'Chicago Midwest Distribution',
      code: 'ORD-02',
      location: '1920 O’Hare Cargo Way, Elk Grove Village, IL 60007',
      manager: 'Elena Rostova',
      capacityDescription: '110,000 sq ft · High-Bay Automated Racking',
      maxCapacityUnits: 32000,
      status: 'ACTIVE',
      createdAt: '2025-11-18T08:00:00.000Z',
    },
    {
      id: 'wh-03',
      name: 'Dallas South Central Fulfillment',
      code: 'DFW-03',
      location: '3100 Stemmons Industrial Pkwy, Dallas, TX 75247',
      manager: 'Carlos Mendez',
      capacityDescription: '64,000 sq ft · Cross-Dock & Bulk Storage',
      maxCapacityUnits: 18000,
      status: 'ACTIVE',
      createdAt: '2025-12-01T08:00:00.000Z',
    },
    {
      id: 'wh-04',
      name: 'Seattle Pacific Northwest Depot',
      code: 'SEA-04',
      location: '750 Duwamish Waterway Dr, Seattle, WA 98108',
      manager: 'Hannah Lin',
      capacityDescription: '52,000 sq ft · Precision Components & Cold Chain',
      maxCapacityUnits: 15000,
      status: 'ACTIVE',
      createdAt: '2025-12-10T08:00:00.000Z',
    },
    {
      id: 'wh-05',
      name: 'Atlanta Southeast Regional Annex',
      code: 'ATL-05',
      location: '2200 Fulton Industrial Pkwy, Atlanta, GA 30336',
      manager: 'Devon Brooks',
      capacityDescription: '45,000 sq ft · Regional Express Dispatch',
      maxCapacityUnits: 12000,
      status: 'ACTIVE',
      createdAt: '2026-01-05T08:00:00.000Z',
    },
  ];

  const categories: ProductCategory[] = [
    { id: 'cat-01', name: 'Industrial Automation & PLC', code: 'AUTO', description: 'Programmable logic controllers, I/O modules, and DIN-rail relays', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-02', name: 'Precision Optical Sensors', code: 'SENS', description: 'Laser distance, photoelectric, and inductive proximity sensors', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-03', name: 'Pneumatic Actuators & Valves', code: 'PNEU', description: 'Solenoid manifolds, ISO cylinders, and FRL air preparation units', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-04', name: 'Electrical Switchgear & Breakers', code: 'ELEC', description: 'Molded case circuit breakers, contactors, and surge protectors', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-05', name: 'Servo Drives & Motion Control', code: 'MOTN', description: 'Brushless AC servo motors, planetary gearheads, and encoders', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-06', name: 'Hydraulic Manifold Assemblies', code: 'HYDR', description: 'High-pressure proportional valves, hydraulic pumps, and seals', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-07', name: 'Robotics End-of-Arm Tooling', code: 'ROBO', description: 'Vacuum grippers, parallel pneumatic fingers, and quick-changers', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-08', name: 'Thermal & Process Controllers', code: 'THRM', description: 'PID temperature controllers, RTD thermocouples, and SSRs', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-09', name: 'Machine Vision & Illumination', code: 'VISN', description: 'GigE area-scan cameras, telecentric lenses, and LED ring lights', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-10', name: 'Structural Fasteners & Hardware', code: 'FAST', description: '316 stainless socket head cap screws, T-slot nuts, and anchors', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-11', name: 'Safety Light Curtains & Interlocks', code: 'SAFE', description: 'Type 4 safety light curtains, E-stop stations, and laser scanners', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-12', name: 'Power Supplies & Transformers', code: 'POWR', description: '24V DC DIN-rail switched mode power supplies and UPS modules', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-13', name: 'Industrial Networking & Gateways', code: 'NETW', description: 'Managed PoE Ethernet switches, EtherCAT couplers, and IO-Link masters', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-14', name: 'Material Handling & Conveyance', code: 'MATL', description: 'Motorized drive rollers, modular belt links, and load cells', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
    { id: 'cat-15', name: 'Packaging & Labeling Consumables', code: 'PACK', description: 'Thermal transfer ribbons, synthetic barcode labels, and ESD bags', status: 'ACTIVE', createdAt: '2025-11-15T08:00:00.000Z' },
  ];

  const supplierNames = [
    ['KronoTech Automation GmbH', 'Stefan Richter', 'Munich, Germany', 'Net 45'],
    ['Vanguard Sensorics Corp', 'Claire Vance', 'Boston, MA', 'Net 30'],
    ['Aether Pneumatics Ltd', 'Kenji Takahashi', 'Osaka, Japan', 'Net 60'],
    ['VoltEdge Switchgear Inc', 'Darius Sterling', 'Charlotte, NC', 'Net 30'],
    ['NexMotion Servo Systems', 'Ingrid Lindqvist', 'Gothenburg, Sweden', 'Net 45'],
    ['HydraForce Precision Co', 'Robert Kowalski', 'Milwaukee, WI', 'Net 30'],
    ['GripMatrix Robotics', 'Mei-Ling Zhou', 'Shenzhen, China', 'Net 30'],
    ['ThermoLogic Instruments', 'Arthur Pendelton', 'Manchester, UK', 'Net 30'],
    ['OptiCore Vision Systems', 'Lukas Weber', 'Zurich, Switzerland', 'Net 45'],
    ['TitanAlloy Fasteners', 'Maria Gonzalez', 'Monterrey, Mexico', 'Net 15'],
    ['SafeGuard Interlock AG', 'henrik Becker', 'Stuttgart, Germany', 'Net 45'],
    ['DeltaCore Power Solutions', 'Priya Patel', 'Austin, TX', 'Net 30'],
    ['EtherLink Industrial Net', 'Thomas O’Connor', 'Dublin, Ireland', 'Net 30'],
    ['ConveyAll Modular Systems', 'Bram Van Der Berg', 'Rotterdam, Netherlands', 'Net 60'],
    ['PackLine Barcode Supplies', 'Sarah Jenkins', 'Columbus, OH', 'Net 15'],
    ['Apex Linear Motion', 'Matteo Rossi', 'Milan, Italy', 'Net 45'],
    ['Nordic Fluid Controls', 'Soren Kierk', 'Copenhagen, Denmark', 'Net 30'],
    ['Pacific Cable & Harness', 'David Kim', 'San Jose, CA', 'Net 30'],
    ['IronClad Enclosures LLC', 'Gregory Walsh', 'Pittsburgh, PA', 'Net 30'],
    ['Precision Gearworks', 'Jean-Luc Moreau', 'Lyon, France', 'Net 45'],
    ['Quantum Encoder Tech', 'Yuki Sato', 'Tokyo, Japan', 'Net 60'],
    ['Summit Industrial Supply', 'Rachel Adams', 'Denver, CO', 'Net 30'],
    ['Omega Valve & Fitting', 'Carlos Silva', 'Sao Paulo, Brazil', 'Net 45'],
    ['ClearView Optics Group', 'Hanna Novak', 'Prague, Czechia', 'Net 30'],
    ['PrimePack ESD Materials', 'Kevin Zhang', 'Taipei, Taiwan', 'Net 30'],
    ['Sentinel Safety Devices', 'Fiona Gallagher', 'Glasgow, UK', 'Net 30'],
    ['MagnaDrive Motors', 'Viktor Petrov', 'Toronto, Canada', 'Net 30'],
    ['AeroSeal Gaskets & O-Rings', 'Laura Chen', 'Houston, TX', 'Net 15'],
    ['MicroLink Fieldbus Systems', 'Andreas Meier', 'Vienna, Austria', 'Net 45'],
    ['Global Warehouse Equipment', 'Nathaniel Cole', 'Memphis, TN', 'Net 30'],
  ];

  const suppliers: Supplier[] = supplierNames.map(([company, contact, loc, terms], idx) => {
    const num = String(idx + 1).padStart(2, '0');
    const cat1 = categories[idx % categories.length].id;
    const cat2 = categories[(idx + 3) % categories.length].id;
    return {
      id: `sup-${num}`,
      code: `SUP-${100 + idx}`,
      companyName: company,
      contactName: contact,
      email: `orders@${company.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14)}.com`,
      phone: `+1 (800) 555-${String(2100 + idx * 17).slice(-4)}`,
      location: loc,
      status: 'ACTIVE',
      preferredCategoryIds: [cat1, cat2],
      paymentTerms: terms,
      rating: Number((4.2 + ((idx * 7) % 9) * 0.1).toFixed(1)),
      createdAt: '2025-11-15T08:00:00.000Z',
    };
  });

  const productCatalogDefinitions: Array<{
    sku: string;
    name: string;
    catIdx: number;
    brand: string;
    uom: string;
    cost: number;
    price: number;
    reorderPoint: number;
    targetStock: number;
    stockProfile: 'HIGH' | 'NORMAL' | 'LOW' | 'OUT';
  }> = [
    { sku: 'PLC-KR-800', name: 'KronoTech Modular PLC CPU 800-ETH', catIdx: 0, brand: 'KronoTech', uom: 'unit', cost: 420.00, price: 685.00, reorderPoint: 25, targetStock: 90, stockProfile: 'HIGH' },
    { sku: 'PLC-KR-16DI', name: '16-Channel Digital Input Module 24VDC', catIdx: 0, brand: 'KronoTech', uom: 'unit', cost: 115.00, price: 189.00, reorderPoint: 40, targetStock: 140, stockProfile: 'NORMAL' },
    { sku: 'PLC-KR-16DO', name: '16-Channel Digital Output Relay Module', catIdx: 0, brand: 'KronoTech', uom: 'unit', cost: 128.50, price: 210.00, reorderPoint: 40, targetStock: 140, stockProfile: 'LOW' },
    { sku: 'PLC-KR-8AI', name: '8-Channel Precision Analog Input 4-20mA', catIdx: 0, brand: 'KronoTech', uom: 'unit', cost: 215.00, price: 345.00, reorderPoint: 20, targetStock: 75, stockProfile: 'OUT' },
    { sku: 'SNS-VG-L500', name: 'Time-of-Flight Laser Distance Sensor 5m', catIdx: 1, brand: 'Vanguard', uom: 'pcs', cost: 185.00, price: 299.00, reorderPoint: 35, targetStock: 120, stockProfile: 'HIGH' },
    { sku: 'SNS-VG-P18', name: 'M18 Inductive Proximity Sensor 8mm PNP', catIdx: 1, brand: 'Vanguard', uom: 'pcs', cost: 32.00, price: 58.00, reorderPoint: 80, targetStock: 300, stockProfile: 'NORMAL' },
    { sku: 'SNS-VG-retro', name: 'Polarized Retroreflective Photo Sensor', catIdx: 1, brand: 'Vanguard', uom: 'pcs', cost: 64.00, price: 112.00, reorderPoint: 50, targetStock: 160, stockProfile: 'LOW' },
    { sku: 'SNS-VG-ULT', name: 'Ultrasonic Level Transmitter IP68', catIdx: 1, brand: 'Vanguard', uom: 'pcs', cost: 240.00, price: 390.00, reorderPoint: 20, targetStock: 70, stockProfile: 'NORMAL' },
    { sku: 'PNU-AE-C63', name: 'ISO 15552 Double-Acting Cylinder 63x200mm', catIdx: 2, brand: 'Aether', uom: 'unit', cost: 142.00, price: 235.00, reorderPoint: 30, targetStock: 100, stockProfile: 'HIGH' },
    { sku: 'PNU-AE-VM8', name: '8-Station EtherCAT Solenoid Valve Island', catIdx: 2, brand: 'Aether', uom: 'set', cost: 510.00, price: 825.00, reorderPoint: 15, targetStock: 50, stockProfile: 'LOW' },
    { sku: 'PNU-AE-FRL', name: 'Modular Air Prep FRL Combo 1/2" NPT', catIdx: 2, brand: 'Aether', uom: 'set', cost: 88.00, price: 149.00, reorderPoint: 35, targetStock: 110, stockProfile: 'NORMAL' },
    { sku: 'PNU-AE-TUB10', name: 'Polyurethane Pneumatic Tubing 10mm Blue (100m)', catIdx: 2, brand: 'Aether', uom: 'roll', cost: 45.00, price: 79.00, reorderPoint: 45, targetStock: 150, stockProfile: 'HIGH' },
    { sku: 'ELC-VE-CB100', name: '3-Pole Molded Case Circuit Breaker 100A', catIdx: 3, brand: 'VoltEdge', uom: 'unit', cost: 165.00, price: 275.00, reorderPoint: 25, targetStock: 90, stockProfile: 'NORMAL' },
    { sku: 'ELC-VE-MC40', name: 'IEC Magnetic Contactor 40A 24VDC Coil', catIdx: 3, brand: 'VoltEdge', uom: 'unit', cost: 54.00, price: 92.00, reorderPoint: 50, targetStock: 180, stockProfile: 'LOW' },
    { sku: 'ELC-VE-SPD2', name: 'Type 2 DIN-Rail Surge Arrester 40kA', catIdx: 3, brand: 'VoltEdge', uom: 'unit', cost: 78.00, price: 132.00, reorderPoint: 30, targetStock: 100, stockProfile: 'OUT' },
    { sku: 'ELC-VE-TB25', name: 'Push-In Feed-Through Terminal Block 2.5mm (50pk)', catIdx: 3, brand: 'VoltEdge', uom: 'box', cost: 36.00, price: 65.00, reorderPoint: 60, targetStock: 220, stockProfile: 'HIGH' },
    { sku: 'MOT-NX-SV750', name: '750W AC Brushless Servo Motor w/ Brake', catIdx: 4, brand: 'NexMotion', uom: 'unit', cost: 390.00, price: 640.00, reorderPoint: 20, targetStock: 65, stockProfile: 'NORMAL' },
    { sku: 'MOT-NX-DR750', name: 'Digital EtherCAT Servo Amplifier 750W', catIdx: 4, brand: 'NexMotion', uom: 'unit', cost: 460.00, price: 745.00, reorderPoint: 20, targetStock: 65, stockProfile: 'LOW' },
    { sku: 'MOT-NX-PG10', name: 'Inline Planetary Gearhead 10:1 Low Backlash', catIdx: 4, brand: 'NexMotion', uom: 'unit', cost: 280.00, price: 455.00, reorderPoint: 18, targetStock: 60, stockProfile: 'NORMAL' },
    { sku: 'MOT-NX-ENC', name: 'Absolute Multi-Turn Optical Rotary Encoder', catIdx: 4, brand: 'NexMotion', uom: 'pcs', cost: 195.00, price: 320.00, reorderPoint: 25, targetStock: 80, stockProfile: 'HIGH' },
    { sku: 'HYD-HF-PV06', name: 'CETOP 03 Proportional Directional Valve', catIdx: 5, brand: 'HydraForce', uom: 'unit', cost: 540.00, price: 880.00, reorderPoint: 12, targetStock: 45, stockProfile: 'LOW' },
    { sku: 'HYD-HF-GP22', name: 'High-Pressure External Gear Pump 22cc/rev', catIdx: 5, brand: 'HydraForce', uom: 'unit', cost: 365.00, price: 595.00, reorderPoint: 15, targetStock: 50, stockProfile: 'NORMAL' },
    { sku: 'HYD-HF-SK90', name: 'Viton Hydraulic Cylinder Seal Kit 90mm', catIdx: 5, brand: 'HydraForce', uom: 'set', cost: 42.00, price: 76.00, reorderPoint: 50, targetStock: 180, stockProfile: 'HIGH' },
    { sku: 'HYD-HF-ACC', name: 'Nitrogen Bladder Hydraulic Accumulator 4L', catIdx: 5, brand: 'HydraForce', uom: 'unit', cost: 310.00, price: 499.00, reorderPoint: 15, targetStock: 50, stockProfile: 'OUT' },
    { sku: 'ROB-GM-PG50', name: '2-Finger Parallel Pneumatic Gripper 50mm', catIdx: 6, brand: 'GripMatrix', uom: 'unit', cost: 275.00, price: 449.00, reorderPoint: 20, targetStock: 70, stockProfile: 'NORMAL' },
    { sku: 'ROB-GM-VG4', name: '4-Cup Cobot Vacuum Area Gripper System', catIdx: 6, brand: 'GripMatrix', uom: 'set', cost: 620.00, price: 995.00, reorderPoint: 12, targetStock: 40, stockProfile: 'LOW' },
    { sku: 'ROB-GM-TC20', name: 'Robotic Quick Tool Changer 20kg Payload', catIdx: 6, brand: 'GripMatrix', uom: 'set', cost: 480.00, price: 780.00, reorderPoint: 15, targetStock: 50, stockProfile: 'NORMAL' },
    { sku: 'ROB-GM-SC30', name: 'Silicone Bellows Suction Cups 30mm (10pk)', catIdx: 6, brand: 'GripMatrix', uom: 'pack', cost: 28.00, price: 52.00, reorderPoint: 60, targetStock: 200, stockProfile: 'HIGH' },
    { sku: 'THR-TL-PID48', name: '1/16 DIN Dual-Loop PID Temperature Controller', catIdx: 7, brand: 'ThermoLogic', uom: 'unit', cost: 95.00, price: 162.00, reorderPoint: 35, targetStock: 120, stockProfile: 'NORMAL' },
    { sku: 'THR-TL-RTD6', name: 'Pt100 Class A Armor RTD Probe 150mm', catIdx: 7, brand: 'ThermoLogic', uom: 'pcs', cost: 38.00, price: 68.00, reorderPoint: 50, targetStock: 180, stockProfile: 'HIGH' },
    { sku: 'THR-TL-SSR50', name: 'Zero-Cross Solid State Relay 50A w/ Heatsink', catIdx: 7, brand: 'ThermoLogic', uom: 'unit', cost: 46.00, price: 82.00, reorderPoint: 45, targetStock: 150, stockProfile: 'LOW' },
    { sku: 'VIS-OC-CAM5M', name: '5MP Global Shutter GigE Machine Vision Camera', catIdx: 8, brand: 'OptiCore', uom: 'unit', cost: 580.00, price: 940.00, reorderPoint: 15, targetStock: 45, stockProfile: 'NORMAL' },
    { sku: 'VIS-OC-LENS16', name: '16mm C-Mount Low-Distortion Industrial Lens', catIdx: 8, brand: 'OptiCore', uom: 'pcs', cost: 210.00, price: 350.00, reorderPoint: 20, targetStock: 65, stockProfile: 'LOW' },
    { sku: 'VIS-OC-RING', name: 'High-Intensity Overdrive Strobe LED Ring Light', catIdx: 8, brand: 'OptiCore', uom: 'unit', cost: 165.00, price: 275.00, reorderPoint: 25, targetStock: 80, stockProfile: 'NORMAL' },
    { sku: 'FST-TA-M8X25', name: '316SS Socket Head Cap Screws M8x25 (100pk)', catIdx: 9, brand: 'TitanAlloy', uom: 'box', cost: 24.00, price: 45.00, reorderPoint: 90, targetStock: 350, stockProfile: 'HIGH' },
    { sku: 'FST-TA-TNUT8', name: 'Roll-In Spring T-Slot Nuts Series 40 M8 (100pk)', catIdx: 9, brand: 'TitanAlloy', uom: 'box', cost: 31.00, price: 56.00, reorderPoint: 80, targetStock: 300, stockProfile: 'NORMAL' },
    { sku: 'FST-TA-ANC12', name: 'Heavy-Duty Seismic Wedge Anchors M12x120 (25pk)', catIdx: 9, brand: 'TitanAlloy', uom: 'box', cost: 48.00, price: 84.00, reorderPoint: 40, targetStock: 140, stockProfile: 'LOW' },
    { sku: 'SAF-SG-LC600', name: 'Type 4 Finger-Safe Light CurtainPair 600mm', catIdx: 10, brand: 'SafeGuard', uom: 'set', cost: 690.00, price: 1120.00, reorderPoint: 12, targetStock: 40, stockProfile: 'NORMAL' },
    { sku: 'SAF-SG-RFID', name: 'Non-Contact Coded RFID Safety Door Switch', catIdx: 10, brand: 'SafeGuard', uom: 'pcs', cost: 125.00, price: 210.00, reorderPoint: 35, targetStock: 120, stockProfile: 'HIGH' },
    { sku: 'SAF-SG-ESTP', name: 'Illuminated Twist-Release E-Stop Enclosure IP67', catIdx: 10, brand: 'SafeGuard', uom: 'pcs', cost: 44.00, price: 78.00, reorderPoint: 50, targetStock: 170, stockProfile: 'LOW' },
    { sku: 'PWR-DC-24V20', name: '480W 24VDC 20A 3-Phase DIN-Rail Power Supply', catIdx: 11, brand: 'DeltaCore', uom: 'unit', cost: 155.00, price: 255.00, reorderPoint: 30, targetStock: 100, stockProfile: 'HIGH' },
    { sku: 'PWR-DC-UPS24', name: 'DC Buffer & Uninterruptible Controller Module', catIdx: 11, brand: 'DeltaCore', uom: 'unit', cost: 190.00, price: 315.00, reorderPoint: 20, targetStock: 70, stockProfile: 'OUT' },
    { sku: 'NET-EL-SW8P', name: '8-Port Managed Industrial Gigabit PoE+ Switch', catIdx: 12, brand: 'EtherLink', uom: 'unit', cost: 340.00, price: 560.00, reorderPoint: 20, targetStock: 75, stockProfile: 'NORMAL' },
    { sku: 'NET-EL-IOL8', name: '8-Port IP67 Fieldbus IO-Link Master Block', catIdx: 12, brand: 'EtherLink', uom: 'unit', cost: 285.00, price: 470.00, reorderPoint: 25, targetStock: 85, stockProfile: 'LOW' },
    { sku: 'MAT-CA-MDR50', name: '24V Brushless Motorized Conveyor Roller 500mm', catIdx: 13, brand: 'ConveyAll', uom: 'pcs', cost: 135.00, price: 225.00, reorderPoint: 40, targetStock: 140, stockProfile: 'HIGH' },
    { sku: 'MAT-CA-LC500', name: 'Stainless S-Beam Tension/Compression Load Cell 500kg', catIdx: 13, brand: 'ConveyAll', uom: 'pcs', cost: 175.00, price: 290.00, reorderPoint: 20, targetStock: 65, stockProfile: 'NORMAL' },
    { sku: 'PCK-PL-LBL46', name: 'Synthetic Matte Thermal Labels 4x6" (1000/roll)', catIdx: 14, brand: 'PackLine', uom: 'roll', cost: 22.00, price: 42.00, reorderPoint: 100, targetStock: 400, stockProfile: 'HIGH' },
    { sku: 'PCK-PL-RBN110', name: 'Resin-Enhanced Wax Barcode Ribbon 110mmx450m', catIdx: 14, brand: 'PackLine', uom: 'roll', cost: 16.50, price: 32.00, reorderPoint: 80, targetStock: 300, stockProfile: 'LOW' },
  ];

  const products: Product[] = [];
  const supplierProducts: SupplierProduct[] = [];
  const reorderRules: ReorderRule[] = [];
  const stockMovements: StockMovement[] = [];

  productCatalogDefinitions.forEach((def, idx) => {
    const prodId = `prd-${String(idx + 1).padStart(3, '0')}`;
    const category = categories[def.catIdx];
    const preferredSupplier = suppliers[idx % suppliers.length];
    const altSupplier = suppliers[(idx + 7) % suppliers.length];
    const barcode = `890425${String(100000 + idx * 137).slice(-6)}`;

    const variants =
      idx % 2 === 0
        ? [
            {
              id: `var-${prodId}-1`,
              productId: prodId,
              sku: `${def.sku}-STD`,
              barcode: `${barcode}1`,
              name: `${def.name} — Standard Pack`,
              size: 'Standard',
              color: 'Industrial Gray',
              packaging: 'Single Box',
              unitCost: def.cost,
              sellingPrice: def.price,
              status: 'ACTIVE' as const,
            },
            {
              id: `var-${prodId}-2`,
              productId: prodId,
              sku: `${def.sku}-BLK`,
              barcode: `${barcode}2`,
              name: `${def.name} — Bulk Carton`,
              size: 'Large',
              color: 'Anodized Black',
              packaging: 'Case of 5',
              unitCost: Number((def.cost * 0.95).toFixed(2)),
              sellingPrice: Number((def.price * 0.96).toFixed(2)),
              status: 'ACTIVE' as const,
            },
          ]
        : [];

    products.push({
      id: prodId,
      sku: def.sku,
      barcode,
      name: def.name,
      categoryId: category.id,
      brand: def.brand,
      description: `Enterprise-grade ${def.name.toLowerCase()} engineered for high-cycle industrial automation and warehouse fulfillment environments. Tested to IEC/ISO standards.`,
      unitOfMeasure: def.uom,
      sellingPrice: def.price,
      purchaseCost: def.cost,
      movingAverageCost: def.cost,
      preferredSupplierId: preferredSupplier.id,
      status: 'ACTIVE',
      reorderPoint: def.reorderPoint,
      targetStock: def.targetStock,
      variants,
      createdAt: '2025-11-20T09:00:00.000Z',
      updatedAt: '2026-10-15T14:30:00.000Z',
    });

    supplierProducts.push(
      {
        id: `sp-${prodId}-1`,
        supplierId: preferredSupplier.id,
        productId: prodId,
        supplierSku: `${preferredSupplier.code}-${def.sku}`,
        unitCost: def.cost,
        leadTimeDays: 7 + (idx % 10),
        minimumOrderQuantity: 5 + (idx % 4) * 5,
        isPreferred: true,
      },
      {
        id: `sp-${prodId}-2`,
        supplierId: altSupplier.id,
        productId: prodId,
        supplierSku: `${altSupplier.code}-${def.sku}-ALT`,
        unitCost: Number((def.cost * 1.06).toFixed(2)),
        leadTimeDays: 12 + (idx % 7),
        minimumOrderQuantity: 10,
        isPreferred: false,
      }
    );

    reorderRules.push({
      id: `rr-${prodId}`,
      productId: prodId,
      warehouseId: 'ALL',
      reorderPoint: def.reorderPoint,
      targetStock: def.targetStock,
      preferredSupplierId: preferredSupplier.id,
      autoFlag: true,
    });

    // Generate Opening Balances across the 5 warehouses based on stockProfile
    warehouses.forEach((wh, whIdx) => {
      let qty = 0;
      if (def.stockProfile === 'OUT') {
        qty = 0;
      } else if (def.stockProfile === 'LOW') {
        // Keep total across warehouses at or below reorderPoint
        qty = whIdx < 2 ? Math.max(2, Math.floor(def.reorderPoint / 4)) : 0;
      } else if (def.stockProfile === 'HIGH') {
        qty = Math.round(def.targetStock * 0.35) + whIdx * 8;
      } else {
        qty = Math.round(def.targetStock * 0.22) + (whIdx % 3) * 5;
      }

      if (qty > 0) {
        stockMovements.push({
          id: `mov-open-${prodId}-${wh.id}`,
          timestamp: `2026-01-${String(2 + (idx % 20)).padStart(2, '0')}T08:30:00.000Z`,
          productId: prodId,
          sku: def.sku,
          productName: def.name,
          warehouseId: wh.id,
          movementType: 'OPENING_BALANCE',
          quantityDelta: qty,
          beforeQuantity: 0,
          afterQuantity: qty,
          unitCostSnapshot: def.cost,
          totalValueSnapshot: calculateInventoryValue(qty, def.cost),
          sourceReference: `OPEN-2026-${def.sku}`,
          sourceId: `open-${prodId}-${wh.id}`,
          reason: 'FY2026 Verified Opening Stock Balance',
          actor: wh.manager,
        });
      }
    });
  });

  // Helper to get running on-hand during seed generation
  const getRunningOnHand = (prodId: string, whId: string) =>
    stockMovements
      .filter(
        (m) =>
          m.productId === prodId &&
          m.warehouseId === whId &&
          m.movementType !== 'RESERVATION' &&
          m.movementType !== 'RESERVATION_RELEASE'
      )
      .reduce((sum, m) => sum + m.quantityDelta, 0);

  // Create realistic Purchase Orders & Goods Receipts
  const purchaseOrders: PurchaseOrder[] = [];
  const goodsReceipts: GoodsReceipt[] = [];

  for (let i = 0; i < 24; i++) {
    const poId = `po-seed-${String(i + 1).padStart(3, '0')}`;
    const poNumber = `PO-2026-${String(1001 + i)}`;
    const supplier = suppliers[i % suppliers.length];
    const warehouse = warehouses[i % warehouses.length];
    const p1 = products[(i * 2) % products.length];
    const p2 = products[(i * 2 + 3) % products.length];

    const statusCycle: PurchaseOrder['status'][] = [
      'RECEIVED',
      'PARTIALLY_RECEIVED',
      'ORDERED',
      'RECEIVED',
      'DRAFT',
      'CANCELLED',
    ];
    const status = statusCycle[i % statusCycle.length];

    const qty1 = 20 + (i % 5) * 10;
    const qty2 = 15 + (i % 4) * 5;
    const rec1 = status === 'RECEIVED' ? qty1 : status === 'PARTIALLY_RECEIVED' ? Math.floor(qty1 / 2) : 0;
    const rec2 = status === 'RECEIVED' ? qty2 : status === 'PARTIALLY_RECEIVED' ? Math.floor(qty2 / 3) : 0;

    const l1Math = calculatePurchaseOrderLine({
      quantityOrdered: qty1,
      unitCost: p1.purchaseCost,
      discountAmount: i % 3 === 0 ? 50 : 0,
      taxRate: 8.25,
    });
    const l2Math = calculatePurchaseOrderLine({
      quantityOrdered: qty2,
      unitCost: p2.purchaseCost,
      discountAmount: 0,
      taxRate: 8.25,
    });

    const lines = [
      {
        id: `pol-${poId}-1`,
        poId,
        productId: p1.id,
        sku: p1.sku,
        productName: p1.name,
        quantityOrdered: qty1,
        quantityReceived: rec1,
        unitCost: p1.purchaseCost,
        discountAmount: l1Math.discountAmount,
        taxRate: 8.25,
        lineSubtotal: l1Math.lineSubtotal,
        lineTax: l1Math.lineTax,
        lineTotal: l1Math.lineTotal,
      },
      {
        id: `pol-${poId}-2`,
        poId,
        productId: p2.id,
        sku: p2.sku,
        productName: p2.name,
        quantityOrdered: qty2,
        quantityReceived: rec2,
        unitCost: p2.purchaseCost,
        discountAmount: 0,
        taxRate: 8.25,
        lineSubtotal: l2Math.lineSubtotal,
        lineTax: l2Math.lineTax,
        lineTotal: l2Math.lineTotal,
      },
    ];

    const totals = calculatePurchaseOrderTotals(lines, 125);
    const month = String(2 + Math.floor(i / 3)).padStart(2, '0');
    const day = String(5 + (i % 20)).padStart(2, '0');
    const orderDate = `2026-${month}-${day}T10:15:00.000Z`;
    const expectedDate = `2026-${month}-${String(Math.min(28, Number(day) + 7)).padStart(2, '0')}T17:00:00.000Z`;

    purchaseOrders.push({
      id: poId,
      poNumber,
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      orderDate,
      expectedDeliveryDate: expectedDate,
      status,
      lines,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      shippingCharges: totals.shippingCharges,
      totalAmount: totals.totalAmount,
      notes: `Standard replenishment order for ${warehouse.code}.`,
      createdBy: warehouse.manager,
      createdAt: orderDate,
      updatedAt: expectedDate,
    });

    if (status === 'RECEIVED' || status === 'PARTIALLY_RECEIVED') {
      const grnId = `grn-seed-${String(goodsReceipts.length + 1).padStart(3, '0')}`;
      const grnNumber = `GRN-2026-${String(1001 + goodsReceipts.length)}`;
      const rejected1 = i % 4 === 1 ? 2 : 0;

      goodsReceipts.push({
        id: grnId,
        grnNumber,
        poId,
        poNumber,
        supplierId: supplier.id,
        warehouseId: warehouse.id,
        receivedDate: expectedDate,
        receivedBy: warehouse.manager,
        notes: rejected1 > 0 ? '2 units had outer carton moisture damage; quarantined and rejected.' : 'All cartons inspected and verified in good condition.',
        lines: [
          {
            id: `grnl-${grnId}-1`,
            receiptId: grnId,
            poLineId: lines[0].id,
            productId: p1.id,
            sku: p1.sku,
            productName: p1.name,
            receivedQuantity: rec1 + rejected1,
            acceptedQuantity: rec1,
            rejectedQuantity: rejected1,
            unitCost: p1.purchaseCost,
            rejectionReason: rejected1 > 0 ? 'Outer packaging damage on arrival' : undefined,
          },
          {
            id: `grnl-${grnId}-2`,
            receiptId: grnId,
            poLineId: lines[1].id,
            productId: p2.id,
            sku: p2.sku,
            productName: p2.name,
            receivedQuantity: rec2,
            acceptedQuantity: rec2,
            rejectedQuantity: 0,
            unitCost: p2.purchaseCost,
          },
        ],
        createdAt: expectedDate,
      });

      // Only post ledger receipts for HIGH or NORMAL stock profile products so LOW/OUT remain low/out
      const def1 = productCatalogDefinitions[(i * 2) % products.length];
      if (rec1 > 0 && (def1.stockProfile === 'HIGH' || def1.stockProfile === 'NORMAL')) {
        const before1 = getRunningOnHand(p1.id, warehouse.id);
        stockMovements.push({
          id: `mov-grn-${grnId}-1`,
          timestamp: expectedDate,
          productId: p1.id,
          sku: p1.sku,
          productName: p1.name,
          warehouseId: warehouse.id,
          movementType: 'PURCHASE_RECEIPT',
          quantityDelta: rec1,
          beforeQuantity: before1,
          afterQuantity: before1 + rec1,
          unitCostSnapshot: p1.purchaseCost,
          totalValueSnapshot: calculateInventoryValue(rec1, p1.purchaseCost),
          sourceReference: `${grnNumber} (${poNumber})`,
          sourceId: grnId,
          reason: `Goods receipt against ${poNumber}`,
          actor: warehouse.manager,
        });
      }
    }
  }

  // Create Inter-Warehouse Stock Transfers (Completed, In Transit, Draft)
  const stockTransfers: StockTransfer[] = [];
  for (let i = 0; i < 14; i++) {
    const trfId = `trf-seed-${String(i + 1).padStart(3, '0')}`;
    const trfNumber = `TRF-2026-${String(1001 + i)}`;
    const sourceWh = warehouses[i % warehouses.length];
    const destWh = warehouses[(i + 1) % warehouses.length];
    // Pick a HIGH stock product so source always has plenty of stock
    const highStockIndices = [0, 4, 8, 11, 15, 19, 22, 27, 29, 34, 38, 40, 44, 46];
    const prod = products[highStockIndices[i % highStockIndices.length]];
    const qty = 6 + (i % 4) * 2;

    const status: StockTransfer['status'] =
      i < 8 ? 'COMPLETED' : i < 11 ? 'IN_TRANSIT' : i === 11 ? 'DRAFT' : 'CANCELLED';

    const dateStr = `2026-0${3 + (i % 6)}-${String(10 + i).padStart(2, '0')}T11:20:00.000Z`;
    const dispStr = `2026-0${3 + (i % 6)}-${String(11 + i).padStart(2, '0')}T14:00:00.000Z`;
    const recStr = `2026-0${3 + (i % 6)}-${String(13 + i).padStart(2, '0')}T16:30:00.000Z`;

    stockTransfers.push({
      id: trfId,
      transferNumber: trfNumber,
      sourceWarehouseId: sourceWh.id,
      destinationWarehouseId: destWh.id,
      status,
      transferDate: dateStr,
      dispatchedAt: status === 'COMPLETED' || status === 'IN_TRANSIT' ? dispStr : undefined,
      receivedAt: status === 'COMPLETED' ? recStr : undefined,
      cancelledAt: status === 'CANCELLED' ? dispStr : undefined,
      referenceNotes: `Regional stock rebalancing between ${sourceWh.code} and ${destWh.code}`,
      createdBy: sourceWh.manager,
      lines: [
        {
          id: `trfl-${trfId}-1`,
          transferId: trfId,
          productId: prod.id,
          sku: prod.sku,
          productName: prod.name,
          quantity: qty,
          unitCostSnapshot: prod.movingAverageCost,
        },
      ],
      createdAt: dateStr,
    });

    if (status === 'COMPLETED' || status === 'IN_TRANSIT') {
      const beforeSource = getRunningOnHand(prod.id, sourceWh.id);
      stockMovements.push({
        id: `mov-trf-out-${trfId}`,
        timestamp: dispStr,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        warehouseId: sourceWh.id,
        movementType: 'TRANSFER_OUT',
        quantityDelta: -qty,
        beforeQuantity: beforeSource,
        afterQuantity: beforeSource - qty,
        unitCostSnapshot: prod.movingAverageCost,
        totalValueSnapshot: calculateInventoryValue(qty, prod.movingAverageCost),
        sourceReference: trfNumber,
        sourceId: trfId,
        reason: `Dispatched to ${destWh.name} (${destWh.code})`,
        actor: sourceWh.manager,
      });
    }

    if (status === 'COMPLETED') {
      const beforeDest = getRunningOnHand(prod.id, destWh.id);
      stockMovements.push({
        id: `mov-trf-in-${trfId}`,
        timestamp: recStr,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        warehouseId: destWh.id,
        movementType: 'TRANSFER_IN',
        quantityDelta: qty,
        beforeQuantity: beforeDest,
        afterQuantity: beforeDest + qty,
        unitCostSnapshot: prod.movingAverageCost,
        totalValueSnapshot: calculateInventoryValue(qty, prod.movingAverageCost),
        sourceReference: trfNumber,
        sourceId: trfId,
        reason: `Received from ${sourceWh.name} (${sourceWh.code})`,
        actor: destWh.manager,
      });
    }
  }

  // Create Stock Adjustments distributed across the last 30 days
  const stockAdjustments: StockAdjustment[] = [];
  const adjReasons: StockAdjustment['reason'][] = [
    'Stock Count Correction',
    'Damaged',
    'Found',
    'Lost',
    'Expired',
  ];

  const anchorTime = new Date('2026-11-13T15:10:00.000Z').getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < 24; i++) {
    const adjId = `adj-seed-${String(i + 1).padStart(3, '0')}`;
    const adjNumber = `ADJ-2026-${String(1001 + i)}`;
    const wh = warehouses[i % warehouses.length];
    const highIndices = [0, 1, 4, 5, 8, 10, 11, 12, 15, 16, 18, 19];
    const prod = products[highIndices[i % highIndices.length]];
    const reason = adjReasons[i % adjReasons.length];
    const isPositive = reason === 'Found' || (reason === 'Stock Count Correction' && i % 2 === 0);
    const qty = 2 + (i % 4);
    const beforeQty = getRunningOnHand(prod.id, wh.id);

    if (!isPositive && beforeQty < qty) continue;
    const afterQty = isPositive ? beforeQty + qty : beforeQty - qty;
    // Spread across the last 30 days with increasing frequency in recent days
    const daysAgo = Math.max(0, 29 - Math.floor((i * 29) / 23) - (i % 2));
    const ts = new Date(anchorTime - daysAgo * dayMs).toISOString();

    stockAdjustments.push({
      id: adjId,
      adjustmentNumber: adjNumber,
      warehouseId: wh.id,
      productId: prod.id,
      sku: prod.sku,
      productName: prod.name,
      adjustmentType: isPositive ? 'POSITIVE' : 'NEGATIVE',
      quantity: qty,
      beforeQuantity: beforeQty,
      afterQuantity: afterQty,
      unitCostSnapshot: prod.movingAverageCost,
      reason,
      notes: `Cycle count verification batch #CC-${200 + i}`,
      actor: wh.manager,
      createdAt: ts,
    });

    stockMovements.push({
      id: `mov-adj-${adjId}`,
      timestamp: ts,
      productId: prod.id,
      sku: prod.sku,
      productName: prod.name,
      warehouseId: wh.id,
      movementType: isPositive ? 'POSITIVE_ADJUSTMENT' : 'NEGATIVE_ADJUSTMENT',
      quantityDelta: isPositive ? qty : -qty,
      beforeQuantity: beforeQty,
      afterQuantity: afterQty,
      unitCostSnapshot: prod.movingAverageCost,
      totalValueSnapshot: calculateInventoryValue(qty, prod.movingAverageCost),
      sourceReference: adjNumber,
      sourceId: adjId,
      reason: `${reason} — Cycle count verification batch #CC-${200 + i}`,
      actor: wh.manager,
    });
  }

  // Create active Stock Reservations
  const reservations: StockReservation[] = [
    {
      id: 'res-seed-001',
      productId: products[0].id,
      sku: products[0].sku,
      warehouseId: 'wh-01',
      quantity: 5,
      referenceDocument: 'SO-2026-8841 (Assembly Line Allocation)',
      status: 'ACTIVE',
      createdAt: '2026-10-20T09:30:00.000Z',
    },
    {
      id: 'res-seed-002',
      productId: products[4].id,
      sku: products[4].sku,
      warehouseId: 'wh-02',
      quantity: 8,
      referenceDocument: 'SO-2026-8892 (Automation Retrofit Project)',
      status: 'ACTIVE',
      createdAt: '2026-10-24T11:15:00.000Z',
    },
    {
      id: 'res-seed-003',
      productId: products[8].id,
      sku: products[8].sku,
      warehouseId: 'wh-01',
      quantity: 4,
      referenceDocument: 'SO-2026-8904 (Customer Priority Hold)',
      status: 'ACTIVE',
      createdAt: '2026-11-01T14:00:00.000Z',
    },
  ];

  // Sort movements newest first for display
  stockMovements.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const activities: Activity[] = [
    {
      id: 'act-seed-01',
      timestamp: '2026-11-12T16:40:00.000Z',
      eventType: 'GOODS_RECEIVED',
      title: 'Goods Receipt GRN-2026-1012 posted',
      description: 'Accepted 30 units for PO-2026-1018 into Newark East Coast Hub (EWR-01)',
      actor: 'Marcus Vance',
      relatedDocumentId: goodsReceipts[0]?.id,
      relatedDocumentNumber: goodsReceipts[0]?.grnNumber,
      relatedRoute: '/dashboard/receiving',
    },
    {
      id: 'act-seed-02',
      timestamp: '2026-11-12T14:15:00.000Z',
      eventType: 'TRANSFER_DISPATCHED',
      title: 'Stock Transfer TRF-2026-1009 dispatched',
      description: 'In transit from Dallas South Central (DFW-03) to Seattle Pacific Depot (SEA-04)',
      actor: 'Carlos Mendez',
      relatedDocumentId: stockTransfers[8]?.id,
      relatedDocumentNumber: 'TRF-2026-1009',
      relatedRoute: '/dashboard/transfers',
    },
    {
      id: 'act-seed-03',
      timestamp: '2026-11-11T11:20:00.000Z',
      eventType: 'ADJUSTMENT_POSTED',
      title: 'Stock Adjustment ADJ-2026-1008 posted',
      description: 'Cycle count adjustment verified at Chicago Midwest Distribution (ORD-02)',
      actor: 'Elena Rostova',
      relatedDocumentId: stockAdjustments[0]?.id,
      relatedDocumentNumber: 'ADJ-2026-1008',
      relatedRoute: '/dashboard/adjustments',
    },
    {
      id: 'act-seed-04',
      timestamp: '2026-11-10T09:45:00.000Z',
      eventType: 'PO_CREATED',
      title: 'Purchase Order PO-2026-1021 issued',
      description: 'Issued replenishment order to KronoTech Automation GmbH',
      actor: 'Marcus Vance',
      relatedDocumentId: purchaseOrders[2]?.id,
      relatedDocumentNumber: 'PO-2026-1021',
      relatedRoute: '/dashboard/purchase-orders',
    },
    {
      id: 'act-seed-05',
      timestamp: '2026-11-09T15:05:00.000Z',
      eventType: 'PRODUCT_EDITED',
      title: 'Updated reorder threshold for PLC-KR-8AI',
      description: 'Adjusted reorder point and target stock parameters for Q4 demand.',
      actor: 'Hannah Lin',
      relatedDocumentId: 'prd-004',
      relatedDocumentNumber: 'PLC-KR-8AI',
      relatedRoute: '/dashboard/products/prd-004',
    },
  ];

  const savedReports: SavedReport[] = [
    {
      id: 'rep-01',
      name: 'Monthly Executive Valuation Summary',
      reportType: 'INVENTORY_VALUATION',
      warehouseFilter: 'ALL',
      categoryFilter: 'ALL',
      dateRange: '30d',
      createdAt: '2026-10-01T09:00:00.000Z',
    },
    {
      id: 'rep-02',
      name: 'Critical Low-Stock & Reorder Action List',
      reportType: 'REORDER',
      warehouseFilter: 'ALL',
      categoryFilter: 'ALL',
      dateRange: 'all',
      createdAt: '2026-10-12T10:30:00.000Z',
    },
    {
      id: 'rep-03',
      name: 'Newark Hub (EWR-01) Full Stock Audit',
      reportType: 'WAREHOUSE_INVENTORY',
      warehouseFilter: 'wh-01',
      categoryFilter: 'ALL',
      dateRange: 'all',
      createdAt: '2026-10-25T14:00:00.000Z',
    },
  ];

  const teamMembers: TeamMember[] = [
    {
      id: 'tm-01',
      name: 'Alex Morgan',
      role: 'VP of Supply Chain & Inventory Control',
      email: 'a.morgan@stockora-logistics.com',
      department: 'Executive Operations',
      warehouseScope: 'All Warehouses (Global)',
      status: 'ACTIVE',
      lastActive: 'Online now',
    },
    {
      id: 'tm-02',
      name: 'Marcus Vance',
      role: 'Regional Warehouse Director',
      email: 'm.vance@stockora-logistics.com',
      department: 'Warehouse Operations',
      warehouseScope: 'EWR-01 · Newark East Coast Hub',
      status: 'ACTIVE',
      lastActive: '14 mins ago',
    },
    {
      id: 'tm-03',
      name: 'Elena Rostova',
      role: 'Senior Inventory Controller',
      email: 'e.rostova@stockora-logistics.com',
      department: 'Inventory Control',
      warehouseScope: 'ORD-02 · Chicago Midwest Distribution',
      status: 'ACTIVE',
      lastActive: '1 hour ago',
    },
    {
      id: 'tm-04',
      name: 'Carlos Mendez',
      role: 'Fulfillment & Transfer Lead',
      email: 'c.mendez@stockora-logistics.com',
      department: 'Logistics & Transfers',
      warehouseScope: 'DFW-03 · Dallas South Central',
      status: 'ACTIVE',
      lastActive: '2 hours ago',
    },
    {
      id: 'tm-05',
      name: 'Hannah Lin',
      role: 'Procurement & Purchasing Manager',
      email: 'h.lin@stockora-logistics.com',
      department: 'Purchasing',
      warehouseScope: 'SEA-04 · Seattle Pacific Depot',
      status: 'ACTIVE',
      lastActive: '3 hours ago',
    },
    {
      id: 'tm-06',
      name: 'Devon Brooks',
      role: 'Receiving & Quality Assurance Supervisor',
      email: 'd.brooks@stockora-logistics.com',
      department: 'Goods Receiving',
      warehouseScope: 'ATL-05 · Atlanta Southeast Annex',
      status: 'ACTIVE',
      lastActive: 'Yesterday',
    },
  ];

  return {
    version: '1.0.0',
    products,
    categories,
    warehouses,
    suppliers,
    supplierProducts,
    purchaseOrders,
    goodsReceipts,
    stockTransfers,
    stockAdjustments,
    stockMovements,
    reservations,
    reorderRules,
    activities,
    savedReports,
    teamMembers,
    processedOperationIds: ['seed-init-v1'],
  };
}
