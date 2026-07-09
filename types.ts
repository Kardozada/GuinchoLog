export enum UserRole {
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER'
}

export interface User {
  id: string;
  name: string;
  email: string;
  cpf?: string; // Added CPF field
  role: UserRole;
  avatarUrl?: string;
}

export enum PaymentMethod {
  CASH = 'DINHEIRO',
  CREDIT = 'CREDITO',
  DEBIT = 'DEBITO',
  ON_TERM = 'A PRAZO',
  PIX = 'PIX'
}

export interface ServiceItem {
  id: string;
  startTime: string;
  endTime: string;
  departure: string;
  destination: string;
  towedVehicle: string;
  towedPlate: string;
  clientName: string;
  clientPhone: string;
  paymentMethod: PaymentMethod;
  value: number;
  proofImage?: string; // Base64 string da foto do valor/comprovante
}

export interface ExpenseItem {
  id: string;
  description: string;
  value: number;
}

export interface EditHistoryEntry {
  editedBy: string; // Nome do Admin
  editedAt: string; // ISO Date
  changes: string;  // Descrição do que mudou
}

export interface DailyLog {
  id: string;
  userId: string;
  driverName: string;
  date: string; // YYYY-MM-DD
  vehicleId: string; // The Tow Truck (VTR) used
  kmStart?: number; // Opcional agora
  kmEnd?: number;   // Opcional agora
  services: ServiceItem[];
  expenses: ExpenseItem[];
  observations: string;
  totalInvoiced: number;
  totalLiquidCash: number;
  totalLiquidTerm: number;
  totalExpenses: number;
  submittedAt: string;
  checkedHudson?: boolean; // Added for Hudson's verification
  checkedAndre?: boolean; // Added for André's verification
  checked?: boolean; // Keep for backward compatibility if needed, but we'll use the specific ones
  editHistory?: EditHistoryEntry[]; // Audit Trail
}

export interface Vehicle {
  id: string;
  name: string;
  type: 'VTR' | 'CARRO' | 'MOTO';
}