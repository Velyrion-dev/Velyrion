declare module 'lucide-react' {
  import * as React from 'react';
  export interface LucideProps extends React.SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    strokeWidth?: string | number;
  }
  export type LucideIcon = React.ForwardRefExoticComponent<
    LucideProps & React.RefAttributes<SVGSVGElement>
  >;

  export const LayoutDashboard: LucideIcon;
  export const Radio: LucideIcon;
  export const Activity: LucideIcon;
  export const BarChart3: LucideIcon;
  export const Bot: LucideIcon;
  export const Cpu: LucideIcon;
  export const Network: LucideIcon;
  export const GitFork: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const ShieldAlert: LucideIcon;
  export const AlertOctagon: LucideIcon;
  export const HeartPulse: LucideIcon;
  export const Award: LucideIcon;
  export const FileCheck: LucideIcon;
  export const History: LucideIcon;
  export const FlaskConical: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Building2: LucideIcon;
  export const Webhook: LucideIcon;
  export const Settings: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const Shield: LucideIcon;
  export const Dna: LucideIcon;
  export const Zap: LucideIcon;
  export const SearchCode: LucideIcon;
  export const Coins: LucideIcon;
  export const Crosshair: LucideIcon;
  export const Trophy: LucideIcon;
  export const SlidersHorizontal: LucideIcon;
  export const Grid: LucideIcon;
  export const Lock: LucideIcon;
  export const FileText: LucideIcon;
  export const [key: string]: any;
}
