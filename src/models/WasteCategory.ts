export type WasteCategoryId =
  | 'plastic'
  | 'glass'
  | 'paper'
  | 'food_waste'
  | 'electronic_waste'
  | 'construction_waste'
  | 'mixed_waste'
  | 'other'
  | (string & {});

export interface WasteCategory {
  id: WasteCategoryId;
  name: string;
  description: string;
  iconName: string; // Ionicons identifier
  color: string;
  backgroundColor: string;
  disposalInfo?: string;
}

export const WASTE_CATEGORIES: readonly WasteCategory[] = [
  {
    id: 'plastic',
    name: 'Plastic',
    description: 'Bottles, bags, packaging, containers, plastic wraps',
    iconName: 'cube-outline',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    disposalInfo: 'Empty and rinse containers before recycling. Clean plastics go into blue recycling bins. Film plastics should be dropped off at designated collection points.',
  },
  {
    id: 'glass',
    name: 'Glass',
    description: 'Bottles, jars, broken glass, glassware',
    iconName: 'wine-outline',
    color: '#0D9488',
    backgroundColor: '#CCFBF1',
    disposalInfo: 'Rinse glass bottles and jars thoroughly. Remove metal or plastic lids. Broken window panes and ceramics must not be mixed with container glass.',
  },
  {
    id: 'paper',
    name: 'Paper',
    description: 'Cardboard, newspapers, office paper, boxes',
    iconName: 'document-text-outline',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    disposalInfo: 'Keep clean and dry. Flatten cardboard boxes to conserve bin space. Soiled, waxed, or grease-stained paper cannot be recycled.',
  },
  {
    id: 'food_waste',
    name: 'Food Waste',
    description: 'Organic waste, leftover food, decomposing produce',
    iconName: 'nutrition-outline',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    disposalInfo: 'Deposit in designated green organic bins or local compost. Keep separate from plastics, packaging, and treated wood.',
  },
  {
    id: 'electronic_waste',
    name: 'Electronic Waste',
    description: 'Appliances, batteries, cables, computers, phones',
    iconName: 'hardware-chip-outline',
    color: '#7C3AED',
    backgroundColor: '#EDE9FE',
    disposalInfo: 'Never dispose of e-waste or batteries in household bins due to toxic heavy metals and fire risk. Take to certified e-waste drop-off points.',
  },
  {
    id: 'construction_waste',
    name: 'Construction Waste',
    description: 'Concrete, tiles, bricks, wood, renovation debris',
    iconName: 'construct-outline',
    color: '#EA580C',
    backgroundColor: '#FFEDD5',
    disposalInfo: 'Heavy construction and renovation debris must be hauled to authorized construction waste transfer stations or bulk dumpsters.',
  },
  {
    id: 'mixed_waste',
    name: 'Mixed Waste',
    description: 'Unsorted general refuse, multi-material dumping',
    iconName: 'trash-outline',
    color: '#475569',
    backgroundColor: '#F1F5F9',
    disposalInfo: 'General non-recyclable refuse destined for municipal sanitary processing. Please sort recyclables whenever possible.',
  },
  {
    id: 'other',
    name: 'Other',
    description: 'Hazardous, bulky, or uncategorized items',
    iconName: 'help-circle-outline',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    disposalInfo: 'Hazardous chemicals, paint, medical waste, or unidentified debris require special handling. Contact local municipal environmental authorities.',
  },
] as const;

export function getWasteCategoryById(id: string): WasteCategory | undefined {
  return WASTE_CATEGORIES.find((cat) => cat.id === id);
}

export function getWasteCategoryName(id: string): string {
  const category = getWasteCategoryById(id);
  return category ? category.name : 'Unknown';
}
