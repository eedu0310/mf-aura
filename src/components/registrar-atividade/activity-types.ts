import {
  MapPin,
  Phone,
  MessageCircle,
  Mail,
  FileText,
  Users,
  DollarSign,
  Target,
  Heart,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export type ActivityTypeId =
  | "visita"
  | "ligacao"
  | "whatsapp"
  | "email"
  | "orcamento"
  | "reuniao"
  | "venda"
  | "prospeccao"
  | "posvenda"
  | "treinamento";

export const TIPOS_ATIVIDADE: {
  id: ActivityTypeId;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "visita", label: "Visita", icon: MapPin },
  { id: "ligacao", label: "Ligação", icon: Phone },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "email", label: "E-mail", icon: Mail },
  { id: "orcamento", label: "Orçamento", icon: FileText },
  { id: "reuniao", label: "Reunião", icon: Users },
  { id: "venda", label: "Venda", icon: DollarSign },
  { id: "prospeccao", label: "Prospecção", icon: Target },
  { id: "posvenda", label: "Pós-venda", icon: Heart },
  { id: "treinamento", label: "Treinamento", icon: BookOpen },
];
