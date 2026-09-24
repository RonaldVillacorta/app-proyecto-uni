export class User  {
  id !: number;
  name: string = '';
  lastname: string = '';
  dni: string = '';
  phone: string = '';
  address: string = '';
  email: string = '';
  password: string = '';
  estado: boolean = true;
  admin?: boolean;
  limiteCredito?: number;
  sbsCalificacion?: string;
  sbsDeudaTotal?: number;
  sbsEntidades?: string;
  sbsScore?: number;
  sbsSemaforo?: string;
  sbsFechaEvaluacion?: string;
  sbsDocumentoUrl?: string;
  ingresoMensual?: number;
}

export interface SbsAnalysisResult {
  calificacion: string;
  porcentajeNormal: number;
  porcentajeCpp: number;
  porcentajeDeficiente: number;
  porcentajeDudoso: number;
  porcentajePerdida: number;
  deudaTotal: number;
  entidades: string[];
  numeroEntidades: number;
  semaforo: 'VERDE' | 'AMARILLO' | 'ROJO' | string;
  scoreCrediticio: number;
  limiteSugerido: number;
  nivelRiesgo: string;
  recomendacion: string;
  resumenIa: string;
  documentoUrl: string;
  fechaEvaluacion: string;
}

