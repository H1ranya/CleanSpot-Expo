export type Severity = 'Low' | 'Medium' | 'High';

export interface SeverityOption {
  level: Severity;
  label: string;
  description: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
}

export const SEVERITY_OPTIONS: readonly SeverityOption[] = [
  {
    level: 'Low',
    label: 'Low',
    description: 'Minor littering, small item, non-hazardous',
    color: '#15803D',
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  {
    level: 'Medium',
    label: 'Medium',
    description: 'Overflowing bin, medium pile, partial street obstruction',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  {
    level: 'High',
    label: 'High',
    description: 'Severe illegal dumping, hazardous material, major blockade',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
] as const;

export function getSeverityOption(severity: Severity): SeverityOption {
  return (
    SEVERITY_OPTIONS.find((opt) => opt.level === severity) || SEVERITY_OPTIONS[0]
  );
}
