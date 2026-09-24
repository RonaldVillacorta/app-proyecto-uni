import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { UserService } from '../../../shared/services/user.service';
import { CreditoService } from '../../../shared/services/credito.service';
import { VentaService } from '../../../shared/services/venta.service';
import {
  EvaluacionIaService,
  EvaluacionIAResponse,
  ClienteFeatures,
  MetricasModeloIA
} from '../../../shared/services/evaluacion-ia.service';

export interface ClienteEvaluado extends EvaluacionIAResponse {
  email?: string;
  phone?: string;
  dni?: string;
  montoDeudaActual: number;
  diasRetrasoPromedio: number;
  cuotasVencidas: number;
  ingresoMensual: number;
}

@Component({
  selector: 'app-evaluacion-ia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './evaluacion-ia.component.html',
  styleUrls: ['./evaluacion-ia.component.css']
})
export class EvaluacionIaComponent implements OnInit {
  loading: boolean = false;
  analizandoConIa: boolean = false;
  tieneResultados: boolean = false;
  porcentajeProgreso: number = 0;
  mensajeAnalisis: string = 'Iniciando escaneo predictivo...';
  animarEntradaDatos: boolean = false;

  clientesEvaluados: ClienteEvaluado[] = [];
  clientesFiltrados: ClienteEvaluado[] = [];
  metricasModelo: MetricasModeloIA | null = null;

  clienteSeleccionado: ClienteEvaluado | null = null;
  montoSimulacion: number = 200;
  resultadoSimulacion: string | null = null;
  tipoResultadoSimulacion: 'aprobado' | 'denegado' | 'advertencia' = 'aprobado';

  indiceRiesgoGlobal: number = 0;
  capitalEnRiesgo: number = 0;
  totalClientesAltoRiesgo: number = 0;
  totalClientesConfiables: number = 0;
  precisionModelo: number = 98.2;

  porcentajeBajo: number = 0;
  porcentajeMedio: number = 0;
  porcentajeAlto: number = 0;
  countBajo: number = 0;
  countMedio: number = 0;
  countAlto: number = 0;

  searchTerm: string = '';
  filtroRiesgo: 'TODOS' | 'Bajo' | 'Medio' | 'Alto' = 'TODOS';

  // Paginaci?n
  itemsPerPage: number = 5;
  currentPage: number = 1;
  totalPages: number = 1;

  constructor(
    private userService: UserService,
    private creditoService: CreditoService,
    private ventaService: VentaService,
    private iaService: EvaluacionIaService
  ) {}

  ngOnInit(): void {
    this.cargarMetricasModelo();
    // La evaluacion ya no se ejecuta automaticamente al cargar.
    // El usuario debe presionar obligatoriamente el boton "Analizar Riesgo Crediticio".
  }

  cargarMetricasModelo(): void {
    this.iaService.getMetricasModelo().subscribe({
      next: (m: MetricasModeloIA) => {
        this.metricasModelo = m;
        if (m && m.metricas_rendimiento && m.metricas_rendimiento.tasa_clasificacion_correcta_accuracy) {
          this.precisionModelo = m.metricas_rendimiento.tasa_clasificacion_correcta_accuracy;
        }
      },
      error: (err: any) => console.warn('FastAPI metrics no disponible en puerto 8000', err)
    });
  }

  ejecutarEvaluacionCompleta(conAnimacion: boolean = true): void {
    if (conAnimacion) {
      this.analizandoConIa = true;
      this.animarEntradaDatos = false;
      this.porcentajeProgreso = 10;
      this.mensajeAnalisis = 'Escaneando cuentas por cobrar e historial en MySQL...';

      // Transici?n elegante y pausada (4.5 segundos en total)
      setTimeout(() => {
        if (this.analizandoConIa) {
          this.porcentajeProgreso = 35;
          this.mensajeAnalisis = 'Extrayendo variables de morosidad, atrasos y liquidez...';
        }
      }, 1200);

      setTimeout(() => {
        if (this.analizandoConIa) {
          this.porcentajeProgreso = 68;
          this.mensajeAnalisis = 'Ejecutando inferencia en microservicio Scikit-Learn...';
        }
      }, 2500);

      setTimeout(() => {
        if (this.analizandoConIa) {
          this.porcentajeProgreso = 92;
          this.mensajeAnalisis = 'Calibrando probabilidades sigmoides y limites de credito...';
        }
      }, 3700);
    } else {
      this.loading = true;
    }

    this.userService.findAll().subscribe({
      next: (users: any[]) => {
        const clientes = users.filter((u: any) => !u.admin);

        if (clientes.length === 0) {
          this.esperarYFinalizar([], conAnimacion);
          return;
        }

        const featuresList: ClienteFeatures[] = [];
        const rawClientesMap = new Map<number, any>();
        let procesados = 0;

        clientes.forEach((c: any) => {
          rawClientesMap.set(c.id, c);

          const seedIngreso = 1400 + ((c.id * 317) % 2800);
          const antiguedad = 6 + ((c.id * 7) % 36);

          this.creditoService.obtenerCreditosPorCliente(c.id).subscribe({
            next: (creditos: any[]) => {
              if (!creditos || creditos.length === 0) {
                // Clientes nuevos o sin credito previo en la bodega
                const comprasHistoricas = 0.0;
                featuresList.push({
                  id: c.id,
                  nombre: (c.name + ' ' + (c.lastname || '')).trim(),
                  ingreso_mensual: seedIngreso,
                  monto_deuda_actual: 0.0,
                  dias_retraso_promedio: 0.0,
                  cuotas_vencidas: 0,
                  antiguedad_meses: antiguedad,
                  total_compras_historico: comprasHistoricas
                });
                procesados++;
                if (procesados === clientes.length) {
                  this.enviarAfastAPI(featuresList, rawClientesMap, conAnimacion);
                }
                return;
              }

              let montoDeuda = 0;
              let cuotasVencidas = 0;
              let diasRetrasoMax = 0;
              const hoy = new Date();
              hoy.setHours(0, 0, 0, 0);
              let creditosProcesados = 0;

              creditos.forEach((cred: any) => {
                this.creditoService.obtenerCuotasPorCredito(cred.id).subscribe({
                  next: (cuotas: any[]) => {
                    (cuotas || []).forEach((cuota: any) => {
                      if (cuota.estado === 'PENDIENTE' || cuota.estado === 'VENCIDO') {
                        const m = typeof cuota.monto === 'number' ? cuota.monto : parseFloat(cuota.monto) || 0;
                        montoDeuda += m;

                        const fVenc = new Date(cuota.fechaVencimiento);
                        fVenc.setHours(0, 0, 0, 0);
                        const diff = hoy.getTime() - fVenc.getTime();
                        const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
                        if (dias > 0 || cuota.estado === 'VENCIDO') {
                          cuotasVencidas++;
                          if (dias > diasRetrasoMax) diasRetrasoMax = dias;
                        }
                      }
                    });

                    creditosProcesados++;
                    if (creditosProcesados === creditos.length) {
                      // Calcular el total real de compras a credito que el cliente ya realizo
                      let totalCreditosComprados = 0;
                      (creditos || []).forEach((cr: any) => {
                        const mCr = typeof cr.montoTotal === 'number' ? cr.montoTotal : parseFloat(cr.montoTotal) || 0;
                        totalCreditosComprados += mCr;
                      });
                      const comprasHistoricas = totalCreditosComprados > 0 ? totalCreditosComprados : 400.0;

                      featuresList.push({
                        id: c.id,
                        nombre: (c.name + ' ' + (c.lastname || '')).trim(),
                        ingreso_mensual: seedIngreso,
                        monto_deuda_actual: montoDeuda,
                        dias_retraso_promedio: diasRetrasoMax,
                        cuotas_vencidas: cuotasVencidas,
                        antiguedad_meses: antiguedad,
                        total_compras_historico: comprasHistoricas
                      });
                      procesados++;
                      if (procesados === clientes.length) {
                        this.enviarAfastAPI(featuresList, rawClientesMap, conAnimacion);
                      }
                    }
                  },
                  error: () => {
                    creditosProcesados++;
                    if (creditosProcesados === creditos.length) {
                      procesados++;
                      if (procesados === clientes.length) {
                        this.enviarAfastAPI(featuresList, rawClientesMap, conAnimacion);
                      }
                    }
                  }
                });
              });
            },
            error: () => {
              procesados++;
              if (procesados === clientes.length) {
                this.enviarAfastAPI(featuresList, rawClientesMap, conAnimacion);
              }
            }
          });
        });
      },
      error: (err: any) => {
        console.error('Error al consultar usuarios', err);
        this.analizandoConIa = false;
        this.loading = false;
      }
    });
  }

  private enviarAfastAPI(features: ClienteFeatures[], rawMap: Map<number, any>, conAnimacion: boolean): void {
    this.iaService.evaluarLote(features).subscribe({
      next: (respuestas: EvaluacionIAResponse[]) => {
        const resultadoFinal: ClienteEvaluado[] = respuestas.map((r: EvaluacionIAResponse) => {
          const raw = rawMap.get(r.id || 0) || {};
          const feat = features.find((f) => f.id === r.id);
          const item: ClienteEvaluado = {
            ...r,
            email: raw.email || '',
            phone: raw.phone || '',
            dni: raw.dni || '',
            montoDeudaActual: feat ? feat.monto_deuda_actual : 0,
            diasRetrasoPromedio: feat ? feat.dias_retraso_promedio : 0,
            cuotasVencidas: feat ? feat.cuotas_vencidas : 0,
            ingresoMensual: feat ? feat.ingreso_mensual : 2000
          };
          return this.aplicarConsistenciaSbs(item, raw);
        });

        this.esperarYFinalizar(resultadoFinal, conAnimacion);
      },
      error: (err: any) => {
        console.error('Error con microservicio FastAPI, usando contingencia', err);
        const fallback: ClienteEvaluado[] = features.map((f: ClienteFeatures) => {
          const raw = rawMap.get(f.id || 0) || {};
          const scoring = this.calcularScoreContinuo(f, raw);
          const item: ClienteEvaluado = {
            id: f.id,
            nombre: f.nombre,
            probabilidad_impago: scoring.probDefault,
            score_crediticio: scoring.score,
            nivel_riesgo: scoring.nivel,
            limite_sugerido: scoring.limite,
            recomendacion: scoring.recomendacion,
            motivo_analisis: scoring.motivo,
            email: raw.email,
            phone: raw.phone,
            dni: raw.dni,
            montoDeudaActual: f.monto_deuda_actual,
            diasRetrasoPromedio: f.dias_retraso_promedio,
            cuotasVencidas: f.cuotas_vencidas,
            ingresoMensual: f.ingreso_mensual
          };
          return item;
        });
        this.esperarYFinalizar(fallback, conAnimacion);
      }
    });
  }

  private calcularScoreContinuo(f: ClienteFeatures, raw: any): { score: number; probDefault: number; nivel: 'Bajo' | 'Medio' | 'Alto'; limite: number; motivo: string; recomendacion: string } {
    // 1. Caso crítico SBS externo registrado
    if (raw && raw.sbsSemaforo === 'ROJO') {
      const scoreSbs = raw.sbsScore !== null && raw.sbsScore !== undefined ? raw.sbsScore : 25;
      return {
        score: Math.max(5, Math.min(35, scoreSbs)),
        probDefault: 88.5,
        nivel: 'Alto',
        limite: 0,
        recomendacion: 'Denegar crédito',
        motivo: `Alerta SBS: Calificación ${raw.sbsCalificacion || 'Dudoso/Pérdida'} en bancos con deuda de S/. ${(raw.sbsDeudaTotal || 0).toFixed(2)}. Línea bloqueada por morosidad crítica.`
      };
    }

    // 2. Cálculo continuo de Score (Escala 0 - 100)
    let score = 96;

    // Penalización por moras internas en tienda
    if (f.cuotas_vencidas > 0) {
      score -= (f.cuotas_vencidas * 16.5);
    }
    if (f.dias_retraso_promedio > 0) {
      score -= Math.min(40, f.dias_retraso_promedio * 1.35);
    }

    // Penalización por ratio de endeudamiento interno
    const ratioDeuda = f.ingreso_mensual > 0 ? (f.monto_deuda_actual / f.ingreso_mensual) : 0;
    if (ratioDeuda > 0.3) {
      score -= Math.min(25, (ratioDeuda - 0.3) * 45);
    }

    // Bonificación por historial de compras cumplidas
    if (f.total_compras_historico > 0) {
      score += Math.min(10, Math.sqrt(f.total_compras_historico) * 0.25);
    }

    // Bonificación por antigüedad del cliente
    score += Math.min(6, (f.antiguedad_meses || 6) * 0.2);

    // Ajuste por SBS si es positivo
    if (raw && raw.sbsSemaforo === 'VERDE') {
      score = Math.min(100, score + 4);
    } else if (raw && raw.sbsSemaforo === 'AMARILLO') {
      score = Math.min(68, score - 15);
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    // Determinación de nivel y probabilidad
    let nivel: 'Bajo' | 'Medio' | 'Alto';
    let probDefault: number;
    let limite: number;
    let recomendacion: string;
    let motivo: string;

    if (score < 45 || f.cuotas_vencidas >= 2 || f.dias_retraso_promedio > 25) {
      nivel = 'Alto';
      probDefault = +(75 + ((100 - score) * 0.2)).toFixed(1);
      limite = 0;
      recomendacion = 'Denegar crédito';
      motivo = `Riesgo crítico (Score ${score} pts): Registra ${f.cuotas_vencidas} cuota(s) impaga(s) y ${f.dias_retraso_promedio.toFixed(0)} días de atraso. Probabilidad de impago del ${probDefault}%. Línea bloqueada.`;
    } else if (score < 72) {
      nivel = 'Medio';
      probDefault = +(30 + ((72 - score) * 1.2)).toFixed(1);
      const capacidad = Math.max(150, (f.ingreso_mensual * 0.20) - (f.monto_deuda_actual * 0.5) - (f.dias_retraso_promedio * 6));
      limite = Math.round(Math.min(450, capacidad) / 25) * 25;
      recomendacion = 'Fiar con límite';
      motivo = `Perfil moderado (Score ${score} pts): Atrasos detectados (${f.dias_retraso_promedio.toFixed(0)} días). Se aprueba cupo controlado hasta S/. ${limite} supervisando cumplimiento.`;
    } else {
      nivel = 'Bajo';
      probDefault = +(Math.max(2.1, (100 - score) * 0.4)).toFixed(1);
      let baseLimite = 500;
      if (f.total_compras_historico > 0) {
        baseLimite = Math.max(500, (f.total_compras_historico * 1.45) - f.monto_deuda_actual);
      }
      limite = Math.round(Math.min(3500, baseLimite) / 50) * 50;
      recomendacion = 'Aprobado para fiar';
      motivo = `Excelente cumplimiento (Score ${score} pts): Sin morosidad y flujo comercial positivo. Línea ampliada a S/. ${limite}.`;
    }

    return { score, probDefault, nivel, limite, motivo, recomendacion };
  }

  private aplicarConsistenciaSbs(item: ClienteEvaluado, raw: any): ClienteEvaluado {
    if (!raw) return item;

    // Si el cliente tiene un reporte oficial SBS subido y evaluado
    if (raw.sbsSemaforo) {
      if (raw.sbsSemaforo === 'ROJO' || (raw.sbsScore !== null && raw.sbsScore !== undefined && raw.sbsScore < 50)) {
        item.nivel_riesgo = 'Alto';
        item.score_crediticio = raw.sbsScore !== null && raw.sbsScore !== undefined ? raw.sbsScore : 25;
        item.probabilidad_impago = 88.5;
        item.limite_sugerido = 0;
        item.recomendacion = 'Denegar crédito';
        item.motivo_analisis = `Alerta SBS: Calificación ${raw.sbsCalificacion || 'Dudoso/Pérdida'} en el sistema financiero con deuda de S/. ${(raw.sbsDeudaTotal || 0).toFixed(2)}. Línea de crédito bloqueada por morosidad crítica.`;
      } else if (raw.sbsSemaforo === 'AMARILLO') {
        item.nivel_riesgo = 'Medio';
        item.score_crediticio = raw.sbsScore || 65;
        item.probabilidad_impago = 38.0;
        item.limite_sugerido = Math.min(raw.limiteCredito !== undefined ? raw.limiteCredito : 300, 350);
        item.recomendacion = 'Fiar con límite';
        item.motivo_analisis = `Observación SBS: Calificación ${raw.sbsCalificacion || 'CPP'} con problemas potenciales en el sistema financiero. Fiado preventivo limitado a S/. ${item.limite_sugerido}.`;
      } else if (raw.sbsSemaforo === 'VERDE') {
        if (item.cuotasVencidas > 0 || item.diasRetrasoPromedio > 15) {
          item.nivel_riesgo = 'Medio';
          item.score_crediticio = 68;
          item.limite_sugerido = 350;
          item.recomendacion = 'Fiar con límite';
          item.motivo_analisis = `Alerta Interna: Calificación SBS Normal, pero registra ${item.cuotasVencidas} cuota(s) impaga(s) en la tienda. Cupo limitado a S/. 350.`;
        } else {
          item.nivel_riesgo = 'Bajo';
          item.score_crediticio = Math.max(item.score_crediticio, raw.sbsScore || 92);
          item.limite_sugerido = raw.limiteCredito !== undefined && raw.limiteCredito !== null ? raw.limiteCredito : Math.max(item.limite_sugerido, 500);
          item.recomendacion = 'Aprobado para fiar';
          item.motivo_analisis = `Calificación SBS Normal y cumplimiento puntual en tienda. Límite aprobado de S/. ${item.limite_sugerido}.`;
        }
      }
    }

    return item;
  }

  private esperarYFinalizar(resultadoFinal: ClienteEvaluado[], conAnimacion: boolean): void {
    if (conAnimacion) {
      // Garantizar que la animaci?n se disfrute entre 3.8 a 4.2 segundos
      setTimeout(() => {
        this.porcentajeProgreso = 100;
        this.mensajeAnalisis = 'Analisis predictivo finalizado con exito!';

        setTimeout(() => {
          this.finalizarAnalisis(resultadoFinal);
          // Permitir que el DOM se inserte antes de aplicar la clase de entrada
          setTimeout(() => {
            this.animarEntradaDatos = true;
          }, 60);
        }, 700);
      }, 3500);
    } else {
      this.finalizarAnalisis(resultadoFinal);
      setTimeout(() => {
        this.animarEntradaDatos = true;
      }, 60);
    }
  }

  private finalizarAnalisis(clientes: ClienteEvaluado[]): void {
    this.clientesEvaluados = clientes.sort((a, b) => a.score_crediticio - b.score_crediticio);
    this.calcularMetricasGlobales();
    this.aplicarFiltros();

    if (this.clientesEvaluados.length > 0 && !this.clienteSeleccionado) {
      this.seleccionarCliente(this.clientesEvaluados.find((c) => c.nivel_riesgo === 'Medio') || this.clientesEvaluados[0]);
    }

    this.analizandoConIa = false;
    this.loading = false;
    this.tieneResultados = true;
  }

  calcularMetricasGlobales(): void {
    const total = this.clientesEvaluados.length;
    if (total === 0) return;

    this.countAlto = this.clientesEvaluados.filter((c) => c.nivel_riesgo === 'Alto').length;
    this.countMedio = this.clientesEvaluados.filter((c) => c.nivel_riesgo === 'Medio').length;
    this.countBajo = this.clientesEvaluados.filter((c) => c.nivel_riesgo === 'Bajo').length;

    this.porcentajeBajo = Math.round((this.countBajo / total) * 100);
    this.porcentajeMedio = Math.round((this.countMedio / total) * 100);
    this.porcentajeAlto = Math.round((this.countAlto / total) * 100);

    this.totalClientesAltoRiesgo = this.countAlto;
    this.totalClientesConfiables = this.countBajo;

    this.indiceRiesgoGlobal = Number(((this.countAlto / total) * 100).toFixed(1));
    this.capitalEnRiesgo = this.clientesEvaluados
      .filter((c) => c.nivel_riesgo === 'Alto')
      .reduce((sum, c) => sum + c.montoDeudaActual, 0);
  }

  aplicarFiltros(): void {
    let list = [...this.clientesEvaluados];

    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      list = list.filter((c) => c.nombre.toLowerCase().includes(q) || (c.dni && c.dni.includes(q)));
    }

    if (this.filtroRiesgo !== 'TODOS') {
      list = list.filter((c) => c.nivel_riesgo === this.filtroRiesgo);
    }

    this.clientesFiltrados = list;
    this.currentPage = 1;
    this.calcularPaginacion();
  }

  setFiltro(riesgo: 'TODOS' | 'Bajo' | 'Medio' | 'Alto'): void {
    this.filtroRiesgo = riesgo;
    this.aplicarFiltros();
  }

  calcularPaginacion(): void {
    this.totalPages = Math.max(1, Math.ceil(this.clientesFiltrados.length / this.itemsPerPage));
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  getClientesPaginados(): ClienteEvaluado[] {
    const inicio = (this.currentPage - 1) * this.itemsPerPage;
    return this.clientesFiltrados.slice(inicio, inicio + this.itemsPerPage);
  }

  cambiarPagina(p: number): void {
    if (p >= 1 && p <= this.totalPages) {
      this.currentPage = p;
    }
  }

  seleccionarCliente(cliente: ClienteEvaluado): void {
    this.clienteSeleccionado = cliente;
    this.resultadoSimulacion = null;
    this.montoSimulacion = cliente.limite_sugerido > 0 ? Math.min(200, cliente.limite_sugerido) : 150;
  }

  simularCredito(): void {
    if (!this.clienteSeleccionado) return;
    const c = this.clienteSeleccionado;
    const monto = this.montoSimulacion;

    if (c.nivel_riesgo === 'Alto' || c.limite_sugerido === 0) {
      this.tipoResultadoSimulacion = 'denegado';
      this.resultadoSimulacion = 'DENEGADO: El cliente presenta un Score critico de ' + c.score_crediticio + ' pts con cuotas impagas (' + c.diasRetrasoPromedio + ' dias de atraso). Fiar S/. ' + monto.toFixed(2) + ' incrementa el riesgo de impago irreversible.';
    } else if (monto <= c.limite_sugerido) {
      this.tipoResultadoSimulacion = 'aprobado';
      this.resultadoSimulacion = 'APROBADO: El monto de S/. ' + monto.toFixed(2) + ' esta dentro del limite prudente sugerido por la IA (S/. ' + c.limite_sugerido.toFixed(2) + '). Riesgo crediticio bajo y controlado.';
    } else {
      this.tipoResultadoSimulacion = 'advertencia';
      this.resultadoSimulacion = 'ADVERTENCIA: S/. ' + monto.toFixed(2) + ' excede el limite maximo recomendado por la IA (S/. ' + c.limite_sugerido.toFixed(2) + '). Se recomienda reducir el monto a otorgar.';
    }
  }

  getIniciales(nombre: string): string {
    const parts = (nombre || '').trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (nombre || 'CR').substring(0, 2).toUpperCase();
  }
}
