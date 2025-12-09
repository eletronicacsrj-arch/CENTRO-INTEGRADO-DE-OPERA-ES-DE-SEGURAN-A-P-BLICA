

export type GroupName = 
  | 'GRES' 
  | 'ROMU' 
  | 'GOC' 
  | 'PMP' 
  | 'GTRAN' 
  | 'INSPETORIA' 
  | 'MOTOTRAN' 
  | 'GID' 
  | 'DEPÓSITO PÚBLICO' 
  | 'COMANDO'
  | 'PRÉDIOS PÚBLICOS'
  | 'APREENSÃO DE ANIMAIS';

export enum IncidentStatus {
  PENDING = 'PENDENTE',
  ACKNOWLEDGED = 'EM ANDAMENTO', // Changed from 'EM ATENDIMENTO'
  RESOLVED = 'FINALIZADA',       // Changed from 'FINALIZADO'
  CANCELLED = 'CANCELADO'
}

export interface Incident {
  id: string;
  targetGroup: GroupName;
  description: string;
  detailedDescription?: string; // AI Enhanced
  location?: string;
  status: IncidentStatus;
  category?: string;      // New: Natureza da ocorrência
  subCategory?: string;   // New: Detalhe (ex: Moto, Preso)
  attachments?: string[]; // New: Base64 images
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  from: string;
  to?: string; // Target recipient (e.g., 'CIOSP' or 'GRES')
  content: string;
  createdAt: number;
}

export interface AppState {
  role: 'CIOSP' | GroupName | null;
  incidents: Incident[];
  customIcons: Record<string, string>; // GroupName -> Base64 Image
  messages: Message[];
}

export const GROUPS: GroupName[] = [
  'GRES', 'ROMU', 'GOC', 'PMP', 'GTRAN', 
  'INSPETORIA', 'MOTOTRAN', 'GID', 'DEPÓSITO PÚBLICO', 'COMANDO',
  'PRÉDIOS PÚBLICOS', 'APREENSÃO DE ANIMAIS'
];

// Incident Categories configuration
export const INCIDENT_CATEGORIES: Record<string, string[]> = {
  "VIA CIOSP": [], // Origem CIOSP
  "Ação Pró-Ativa": [], // Origem Viatura (Self-Dispatch)
  "Desacato": [],
  "Desobediência": [],
  "Maria da Penha": [
      "VIOLÊNCIA FÍSICA",
      "VIOLÊNCIA SEXUAL",
      "VIOLÊNCIA MORAL",
      "VIOLÊNCIA PSICOLÓGICA",
      "VIOLÊNCIA PATRIMONIAL",
      "DESCUMPRIMENTO DE MEDIDAS PROTETIVAS DE URGÊNCIA",
      "MONITORAMENTO PREVENTIVO",
      "ORIENTAÇÃO E ACOLHIMENTO"
  ],
  "Tráfico": [],
  "Lesão corporal": [],
  "Trânsito": ["ACIDENTE C/VÍTIMA", "ACIDENTE S/VÍTIMA", "ALCOOLEMIA", "AUTUAÇÕES"],
  "Mediação de conflito": [],
  "Veículo apreendido": ["Moto", "Carro", "Bugre", "Quadriciclo"],
  "Condução para delegacia": ["Preso"],
  "Abordagens": ["Moto", "Carro", "Taxi", "Buggy", "Quadriciclos", "Pessoas", "Ônibus"],
  "Escolar": ["OCORRÊNCIA ATENDIDA", "PATRULHAMENTO PREVENTIVO", "ATIVIDADES SOCIAIS", "UNIDADE ESCOLAR"],
  "Apoio": [
      "POSTURA",
      "AMBIENTAL",
      "PROEIS",
      "PMERJ",
      "GOC",
      "GRES",
      "PATRULHA MARIA DA PENHA",
      "GTRAN",
      "GID",
      "ROMU",
      "INSPETORIA",
      "COMANDO",
      "DEPÓSITO PÚBLICO",
      "APREENSÃO DE ANIMAIS",
      "SECRETARIA DE SAÚDE",
      "SECRETARIA DE EDUCAÇÃO",
      "SECRETARIA DE TURISMO"
  ],
  "Apreensão": [
    "ARMAS DE FOGO CURTAS",
    "ARMAS DE FOGO LONGAS",
    "FACA",
    "ESTILETE",
    "FACÃO",
    "OUTRO OBJETO PERFUROCORTANTE",
    "MUNIÇÕES",
    "MACONHA",
    "COCAÍNA",
    "ECSTASY",
    "LSD",
    "ANFETAMINAS",
    "NOVAS SUBSTÂNCIAS"
  ]
};

// List of Schools for the "UNIDADE ESCOLAR" sub-option
export const SCHOOL_LIST: string[] = [
  "Creche Vicente Rodrigues",
  "Creche Adir Firmo",
  "Creche Mª Cândida",
  "Creche Mª do Socorro",
  "Creche Helena Saraiva",
  "Creche Emília Correa",
  "Creche Sotero Teixeira de Souza",
  "Creche Iêda Corrêa",
  "Creche Adolpho Béranger",
  "Escola Vera Felizardo",
  "CIEP",
  "Escola João Torres",
  "Escola Henrique Melman",
  "Sotero Teixeira de Souza",
  "Escola Adolpho Béranger",
  "Escola Francisco Luiz Sobrinho",
  "Escola Francisco Porto",
  "C.E. Frederico",
  "C.E. 20 de julho",
  "Cenaq",
  "Socec Colégio Pio XII"
];

// Multi-Tenancy Interface
export interface Central {
    id: string;
    name: string;
    password?: string; // Simple client-side auth
}

// Connection Types
export type PacketType = 
  | 'SYNC_STATE' 
  | 'CMD_ADD_INCIDENT' 
  | 'CMD_UPDATE_STATUS' 
  | 'CMD_SEND_MESSAGE' 
  | 'CMD_DELETE_MESSAGE' 
  | 'CMD_EMERGENCY'
  | 'CMD_DELETE_INCIDENT'
  | 'CMD_CLEAR_HISTORY';

export interface DataPacket {
  type: PacketType;
  payload: any;
}

export interface SyncPayload {
  incidents: Incident[];
  messages: Message[];
  icons: Record<string, string>;
  sounds: Record<string, string>;
  watermark: string | null;
  customNames: Record<string, string>;
  appTitle: string | null;
  commandLabel: string | null;
  crestLeft: string | null;
  crestRight: string | null;
  customCategories?: Record<string, string[]>; // New: Support for editable categories
}
