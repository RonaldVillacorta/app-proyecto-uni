import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { UserService } from '../../../shared/services/user.service';
import { VentaService } from '../../../shared/services/venta.service';
import { CreditoService } from '../../../shared/services/credito.service';
import { PagoService } from '../../../shared/services/pago.service';
import { AuthService } from '../../../shared/services/auth.service';
import { Chart, registerables } from 'chart.js';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-usuario-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-usuario-detalle.component.html',
  styleUrls: ['./admin-usuario-detalle.component.css'],
})
export class AdminUsuarioDetalleComponent implements OnInit {
  userId!: number;
  user: any = {};
  ventas: any[] = [];
  creditos: any[] = [];
  pagos: any[] = [];
  cuotas: any[] = [];

  // Para transacciones recientes combinadas
  transaccionesRecientes: any[] = [];

  // Contadores para cuotas
  cuotasPendientesCount = 0;
  cuotasVencidasCount = 0;
  cuotasPagadasCount = 0;

  // Estadísticas del usuario
  totalCompras = 0;
  totalGastado = 0;
  totalDeuda = 0;
  totalPagado = 0;

  // Estado de la página
  loading = true;
  error = '';
  activeTab = 'perfil'; // 'perfil', 'compras', 'creditos', 'pagos', 'sbs'

  // Variables SBS Document AI
  selectedSbsFile: File | null = null;
  sbsFilePreview: string | null = null;
  sbsFileIsPdf = false;
  sbsAnalyzing = false;
  sbsAnalysisResult: any = null;
  sbsUploadError = '';

  // Control de acordeón para cuentas desplegables (empiezan colapsadas)
  cuentasDesplegadas: { [id: number]: boolean } = {};

  toggleCuenta(creditoId: number): void {
    this.cuentasDesplegadas[creditoId] = !this.cuentasDesplegadas[creditoId];
  }

  isCuentaDesplegada(creditoId: number): boolean {
    return !!this.cuentasDesplegadas[creditoId];
  }

  // Control de acordeón para pagos agrupados por cuenta
  pagosCuentaDesplegados: { [id: string]: boolean } = {};

  togglePagosCuenta(key: string | number): void {
    this.pagosCuentaDesplegados[key] = !this.pagosCuentaDesplegados[key];
  }

  isPagosCuentaDesplegado(key: string | number): boolean {
    return !!this.pagosCuentaDesplegados[key];
  }

  /**
   * Obtiene el índice secuencial (1, 2, 3...) de la cuenta (crédito) del cliente
   */
  obtenerNumeroCuenta(creditoId?: number): number | null {
    if (!creditoId || !this.creditos) return null;
    const index = this.creditos.findIndex((c) => c.id === creditoId);
    return index !== -1 ? index + 1 : null;
  }

  /**
   * Obtiene los pagos asociados a un crédito específico (por su lista de cuotas o crédito directo)
   */
  obtenerPagosPorCredito(creditoId: number): any[] {
    if (!this.pagos) return [];
    return this.pagos.filter((pago) => {
      if (pago.creditoId === creditoId) return true;
      if (pago.cuota && (pago.cuota.credito_id === creditoId || pago.cuota.creditoId === creditoId)) return true;
      const cMatch = this.cuotas.find((c) => c.id === pago.cuotaId || (pago.cuota && c.id === pago.cuota.id));
      if (cMatch && cMatch.credito_id === creditoId) return true;
      return false;
    });
  }

  /**
   * Obtiene pagos no asignados directamente a una cuenta específica (abonos libres o fiados sin crédito específico)
   */
  obtenerPagosOtros(): any[] {
    if (!this.pagos) return [];
    return this.pagos.filter((pago) => {
      const tieneCred = this.creditos.some((cred) => {
        if (pago.creditoId === cred.id) return true;
        if (pago.cuota && (pago.cuota.credito_id === cred.id || pago.cuota.creditoId === cred.id)) return true;
        const cMatch = this.cuotas.find((c) => c.id === pago.cuotaId || (pago.cuota && c.id === pago.cuota.id));
        return cMatch && cMatch.credito_id === cred.id;
      });
      return !tieneCred;
    });
  }

  contarCuotasPagadas(creditoId: number): number {
    if (!this.cuotas) return 0;
    return this.cuotas.filter((c: any) => c.credito_id === creditoId && c.estado === 'PAGADO').length;
  }

  modalComprobanteVisible = false;
  comprobanteSeleccionadoUrl = '';
  pagoSeleccionado: any = null;

  verFotoComprobante(pago: any): void {
    if (typeof pago === 'string') {
      this.comprobanteSeleccionadoUrl = pago;
      this.pagoSeleccionado = null;
    } else {
      this.comprobanteSeleccionadoUrl = pago.comprobanteUrl;
      this.pagoSeleccionado = pago;
    }
    this.modalComprobanteVisible = true;
  }

  cerrarModalComprobante(): void {
    this.modalComprobanteVisible = false;
    this.comprobanteSeleccionadoUrl = '';
    this.pagoSeleccionado = null;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private ventaService: VentaService,
    private creditoService: CreditoService,
    private pagoService: PagoService,
    public authService: AuthService
  ) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const newId = +params['id'];
      if (newId && !isNaN(newId)) {
        this.userId = newId;
        this.cargarDatosUsuario();
      } else {
        // Si no viene id en la ruta (es /user o Mi Perfil), cargamos el perfil del usuario autenticado
        this.cargarPerfilAutenticado();
      }
    });

    this.route.queryParams.subscribe((queryParams) => {
      if (queryParams['tab']) {
        this.setActiveTab(queryParams['tab']);
      }
    });
  }

  cargarPerfilAutenticado(): void {
    this.loading = true;
    this.error = '';
    this.userService.userProfile().subscribe({
      next: (user) => {
        this.user = user;
        this.userId = user.id;
        this.inicializarDatosSbs();
        this.cargarVentas();
      },
      error: (err) => {
        console.error('Error al cargar perfil autenticado:', err);
        this.error = 'No se pudo cargar la información de tu perfil.';
        this.loading = false;
      }
    });
  }

  cargarDatosUsuario(): void {
    if (!this.userId || isNaN(this.userId)) {
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = '';
    this.cuotas = [];
    this.pagos = [];
    this.creditos = [];
    this.ventas = [];

    this.userService.findById(this.userId).subscribe({
      next: (user) => {
        this.user = user;
        this.inicializarDatosSbs();
        this.cargarVentas();
      },
      error: (err) => {
        console.error('Error al cargar usuario:', err);
        this.error =
          'No se pudo cargar la información del usuario. Por favor, intente nuevamente.';
        this.loading = false;
      },
    });
  }

  cargarVentas(): void {
    this.ventaService.obtenerVentasPorCliente(this.userId).subscribe({
      next: (ventas) => {
        this.ventas = ventas || [];
        this.totalCompras = this.ventas.length;
        this.totalGastado = this.ventas.reduce(
          (total, venta) => total + (venta?.montoTotal ? parseFloat(venta.montoTotal.toString()) : 0),
          0
        );
        this.cargarCreditos();
      },
      error: (err) => {
        console.error('Error al cargar ventas:', err);
        this.cargarCreditos();
      },
    });
  }

  cargarCreditos(): void {
    this.creditoService.obtenerCreditosPorCliente(this.userId).subscribe({
      next: (creditos) => {
        this.creditos = creditos || [];

        if (this.creditos.length > 0) {
          const cuotaObservables = this.creditos.map((credito) =>
            this.creditoService.obtenerCuotasPorCredito(credito.id).pipe(
              catchError((err) => {
                console.error(`Error al cargar cuotas para crédito ${credito.id}:`, err);
                return of([]);
              })
            )
          );

          forkJoin(cuotaObservables).subscribe({
            next: (cuotasList) => {
              this.cuotas = [];
              cuotasList.forEach((cuotas, index) => {
                const cred = this.creditos[index];
                const creditoId = cred?.id;
                const targetVentaId = cred?.ventaId || cred?.venta;
                (cuotas || []).forEach((cuota: any) => {
                  cuota.credito_id = creditoId;
                  cuota.ventaId = cuota.ventaId || targetVentaId;
                  this.cuotas.push(cuota);
                });
              });

              this.actualizarContadoresCuotas();
              this.calcularDeudaTotal();
              this.cargarPagos();
            },
            error: (err) => {
              console.error('Error en forkJoin de cuotas:', err);
              this.actualizarContadoresCuotas();
              this.calcularDeudaTotal();
              this.cargarPagos();
            },
          });
        } else {
          this.actualizarContadoresCuotas();
          this.calcularDeudaTotal();
          this.cargarPagos();
        }
      },
      error: (err) => {
        console.error('Error al cargar créditos:', err);
        this.cargarPagos();
      },
    });
  }

  cargarPagos(): void {
    this.pagoService.obtenerPagosPorCliente(this.userId).subscribe({
      next: (pagos) => {
        this.pagos = pagos || [];
        this.totalPagado = this.pagos.reduce((total, pago) => {
          const monto = pago?.monto != null ? parseFloat(pago.monto.toString()) : 0;
          return total + (isNaN(monto) ? 0 : monto);
        }, 0);

        try {
          this.prepararTransaccionesRecientes();
        } catch (transErr) {
          console.error('Error al preparar transacciones:', transErr);
        }

        this.loading = false;

        setTimeout(() => {
          try {
            if (this.activeTab === 'perfil') {
              this.createComprasChart();
              this.createPagosChart();
            }
          } catch (chartErr) {
            console.warn('Error inicializando gráficos:', chartErr);
          }
        }, 300);
      },
      error: (err) => {
        console.error('Error al cargar pagos:', err);
        this.loading = false;
      },
    });
  }

  // Método para actualizar contadores de cuotas
  actualizarContadoresCuotas(): void {
    this.cuotasPendientesCount = 0;
    this.cuotasVencidasCount = 0;
    this.cuotasPagadasCount = 0;

    (this.cuotas || []).forEach((cuota) => {
      if (!cuota) return;
      if (cuota.estado === 'PENDIENTE') {
        this.cuotasPendientesCount++;
      } else if (cuota.estado === 'VENCIDO') {
        this.cuotasVencidasCount++;
      } else if (cuota.estado === 'PAGADO') {
        this.cuotasPagadasCount++;
      }
    });
  }

  // Método para calcular la deuda total
  calcularDeudaTotal(): void {
    this.totalDeuda = 0;

    (this.cuotas || []).forEach((cuota) => {
      if (cuota && (cuota.estado === 'PENDIENTE' || cuota.estado === 'VENCIDO')) {
        const monto = cuota.monto != null ? parseFloat(cuota.monto.toString()) : 0;
        this.totalDeuda += isNaN(monto) ? 0 : monto;
      }
    });
  }

  // Método para preparar transacciones recientes
  prepararTransaccionesRecientes(): void {
    const transacciones: any[] = [];

    (this.ventas || []).forEach((v) => {
      if (v) {
        const fechaVal = v.fechaVenta || new Date();
        transacciones.push({
          tipo: 'venta',
          fecha: new Date(fechaVal),
          datos: v,
        });
      }
    });

    (this.pagos || []).forEach((p) => {
      if (p) {
        const fechaVal = p.fechaPago || p.fecha_pago || new Date();
        transacciones.push({
          tipo: 'pago',
          fecha: new Date(fechaVal),
          datos: p,
        });
      }
    });

    transacciones.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    this.transaccionesRecientes = transacciones.slice(0, 5);
  }

  // Método para obtener cuotas por crédito
  getCuotasPorCredito(creditoId: number): any[] {
    return this.cuotas.filter((cuota) => cuota.credito_id === creditoId);
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;

    // Recrear gráficos solo cuando se cambia a la pestaña perfil
    if (tab === 'perfil') {
      setTimeout(() => {
        this.createComprasChart();
        this.createPagosChart();
      }, 300);
    }
  }

  // Crear gráfico de compras por mes
  createComprasChart(): void {
    const canvas = document.getElementById('comprasChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpiar gráfico anterior si existe
    const existingChart = Chart.getChart('comprasChart');
    if (existingChart) {
      existingChart.destroy();
    }

    // Inicializar arrays para los datos mensuales
    const months = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    const contadoData = Array(12).fill(0);
    const creditoData = Array(12).fill(0);

    // Agrupar ventas por mes y tipo
    this.ventas.forEach((venta) => {
      const fechaVenta = new Date(venta.fechaVenta);
      const month = fechaVenta.getMonth();

      if (venta.tipoVenta === 'CONTADO') {
        contadoData[month] += parseFloat(venta.montoTotal.toString());
      } else {
        creditoData[month] += parseFloat(venta.montoTotal.toString());
      }
    });

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Contado',
            data: contadoData,
            backgroundColor: 'rgba(46, 204, 113, 0.7)',
            borderColor: '#2ecc71',
            borderWidth: 2,
            borderRadius: 4,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
          },
          {
            label: 'Crédito',
            data: creditoData,
            backgroundColor: 'rgba(52, 152, 219, 0.7)',
            borderColor: '#3498db',
            borderWidth: 2,
            borderRadius: 4,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: '#2C1810',
              font: {
                family: "'Plus Jakarta Sans', sans-serif",
                weight: 'bold',
              },
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: '#E5DDD3',
            },
            ticks: {
              color: '#66564E',
              font: {
                family: "'Plus Jakarta Sans', sans-serif",
              },
            },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#2C1810',
              padding: 15,
              font: {
                family: "'Plus Jakarta Sans', sans-serif",
                size: 13,
                weight: 'bold',
              },
            },
          },
          tooltip: {
            backgroundColor: 'rgba(44, 24, 16, 0.9)',
            titleFont: {
              size: 14,
            },
            bodyFont: {
              size: 13,
            },
          },
        },
      },
    });
  }

  // Crear gráfico de estado de pagos
  createPagosChart(): void {
    const canvas = document.getElementById('pagosChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpiar gráfico anterior si existe
    const existingChart = Chart.getChart('pagosChart');
    if (existingChart) {
      existingChart.destroy();
    }

    // Calcular montos por estado
    let pagadosAmount = 0;
    let pendientesAmount = 0;
    let vencidosAmount = 0;

    for (let i = 0; i < this.cuotas.length; i++) {
      const monto = parseFloat(this.cuotas[i].monto.toString());
      if (this.cuotas[i].estado === 'PAGADO') {
        pagadosAmount += monto;
      } else if (this.cuotas[i].estado === 'PENDIENTE') {
        pendientesAmount += monto;
      } else if (this.cuotas[i].estado === 'VENCIDO') {
        vencidosAmount += monto;
      }
    }

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Pagados', 'Pendientes', 'Vencidos'],
        datasets: [
          {
            data: [pagadosAmount, pendientesAmount, vencidosAmount],
            backgroundColor: [
              '#16A34A',
              '#D97706',
              '#DC2626',
            ],
            borderColor: ['#FFFFFF', '#FFFFFF', '#FFFFFF'],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#2C1810',
              padding: 15,
              font: {
                family: "'Plus Jakarta Sans', sans-serif",
                size: 13,
                weight: 'bold',
              },
            },
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            titleFont: {
              size: 14,
            },
            bodyFont: {
              size: 13,
            },
            callbacks: {
              label: function (context) {
                const value = context.raw as number;
                return `S/. ${value.toFixed(2)}`;
              },
            },
          },
        },
      },
    });
  }

  // Helpers para obtener clases y estilos
  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'PAGADO':
        return 'bg-success';
      case 'PENDIENTE':
        return 'bg-warning';
      case 'VENCIDO':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  getTipoVentaClass(tipo: string): string {
    return tipo === 'CONTADO' ? 'bg-success' : 'bg-primary';
  }

  getStatusClass(estado: boolean): string {
    return estado ? 'bg-success' : 'bg-danger';
  }

  getStatusText(estado: boolean): string {
    return estado ? 'Activo' : 'Inactivo';
  }

  // Formatear fechas y valores
  formatDate(date: string): string {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('es-ES');
    } catch (error) {
      return 'N/A';
    }
  }

  formatCurrency(value: number): string {
    if (value === undefined || value === null) return 'S/. 0.00';
    try {
      return `S/. ${parseFloat(value.toString()).toFixed(2)}`;
    } catch (error) {
      return 'S/. 0.00';
    }
  }

  // Método para cambiar el estado del usuario
  cambiarEstadoUsuario(): void {
    this.userService.deleteUser(this.userId).subscribe({
      next: () => {
        // Actualizar el estado del usuario en el objeto local
        this.user.estado = !this.user.estado;
      },
      error: (err) => {
        console.error('Error al cambiar estado de usuario:', err);
      },
    });
  }

  // Ver detalles de productos de una compra
  verDetalleCompra(venta: any): void {
    const ventaId = venta.id;
    (Swal as any).fire({
      title: 'Cargando detalle...',
      allowOutsideClick: false,
      didOpen: () => {
        (Swal as any).showLoading();
      }
    });

    this.ventaService.obtenerDetallesVenta(ventaId).subscribe({
      next: (detalles) => {
        let filasHtml = '';
        if (!detalles || detalles.length === 0) {
          filasHtml = '<tr><td colspan="4" class="text-center text-muted py-3">No hay productos registrados en esta venta</td></tr>';
        } else {
          detalles.forEach((d: any) => {
            filasHtml += `
              <tr style="border-bottom: 1px solid #E5DDD3;">
                <td style="padding: 8px 12px; text-align: left; font-weight: 600; color: #2C1810;">${d.nombreProducto}</td>
                <td style="padding: 8px 12px; text-align: center; color: #66564E;">${d.cantidad}</td>
                <td style="padding: 8px 12px; text-align: right; color: #66564E;">S/. ${parseFloat(d.precioUnitario).toFixed(2)}</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: #166534;">S/. ${parseFloat(d.subtotal).toFixed(2)}</td>
              </tr>
            `;
          });
        }

        (Swal as any).fire({
          title: `Detalle de Compra #${venta.id}`,
          html: `
            <div style="text-align: left; color: #2C1810; font-family: 'Plus Jakarta Sans', sans-serif;">
              <p class="mb-2 small" style="color: #8C7B72;">
                Fecha: <strong>${this.formatDate(venta.fechaVenta)}</strong> | Tipo: <strong>${venta.tipoVenta}</strong>
              </p>
              <div class="table-responsive rounded mt-3" style="max-height: 280px; overflow-y: auto; border: 1px solid #E5DDD3;">
                <table style="width: 100%; font-size: 0.88rem; border-collapse: collapse;">
                  <thead>
                    <tr style="background: #FAF7F2; border-bottom: 2px solid #E5DDD3;">
                      <th style="padding: 8px 12px; text-align: left; color: #66564E;">Producto</th>
                      <th style="padding: 8px 12px; text-align: center; color: #66564E;">Cant.</th>
                      <th style="padding: 8px 12px; text-align: right; color: #66564E;">P. Unit</th>
                      <th style="padding: 8px 12px; text-align: right; color: #66564E;">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filasHtml}
                  </tbody>
                </table>
              </div>
              <div style="margin-top: 16px; padding: 10px; background: #F5F1EB; border-radius: 8px; text-align: right;">
                <span style="font-size: 0.95rem; font-weight: 600; color: #66564E;">Monto Total de la Compra:</span>
                <span style="font-size: 1.25rem; font-weight: 800; color: #166534; margin-left: 8px;">
                  ${this.formatCurrency(venta.montoTotal)}
                </span>
              </div>
            </div>
          `,
          confirmButtonText: 'Cerrar',
          confirmButtonColor: '#2C1810',
          width: '580px'
        });
      },
      error: (err) => {
        console.error('Error al cargar detalles:', err);
        (Swal as any).fire('Error', 'No se pudieron obtener los productos de la compra', 'error');
      }
    });
  }

  // Redirigir al detalle completo de la venta
  irADetalleVenta(cuota: any, credito: any): void {
    const targetVentaId = cuota?.ventaId || credito?.ventaId || credito?.venta;
    if (targetVentaId) {
      if (this.authService.isAdmin()) {
        this.router.navigate(['/admin/venta', targetVentaId]);
      } else {
        this.router.navigate(['/cliente/detalle-compra', targetVentaId]);
      }
    } else {
      (Swal as any).fire('Aviso', 'No se encontró la venta asociada a este crédito', 'info');
    }
  }

  // Editar / Aplazar fecha de vencimiento de una cuota
  editarFechaVencimiento(cuota: any): void {
    const fechaActual = cuota.fechaVencimiento || new Date().toISOString().split('T')[0];

    (Swal as any).fire({
      title: `Aplazar / Modificar Vencimiento`,
      html: `
        <div style="text-align: left; color: #2C1810;">
          <p class="mb-2" style="font-size: 0.9rem;">
            Cuota N° <strong>${cuota.numeroCuota}</strong> | Monto pendiente: <strong style="color: #9A5B13;">S/. ${parseFloat(cuota.monto).toFixed(2)}</strong>
          </p>
          <label style="font-weight: 600; font-size: 0.88rem; color: #66564E;">Nueva Fecha de Vencimiento:</label>
          <input id="swal-nueva-fecha" type="date" value="${fechaActual}" class="swal2-input" style="width: 100%; margin: 8px 0; border: 1px solid #C59B6D;">
          <small class="text-muted d-block mt-1">
            Si el cliente solicitó prórroga o aplazar los días de pago, selecciona la nueva fecha pactada.
          </small>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-calendar-check mr-1"></i> Guardar Nueva Fecha',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2C1810',
      preConfirm: () => {
        const fechaVal = (document.getElementById('swal-nueva-fecha') as HTMLInputElement)?.value;
        if (!fechaVal) {
          (Swal as any).showValidationMessage('Debe seleccionar una fecha');
          return false;
        }
        return fechaVal;
      }
    }).then((result: any) => {
      if (result.isConfirmed && result.value) {
        (Swal as any).fire({
          title: 'Actualizando fecha...',
          allowOutsideClick: false,
          didOpen: () => (Swal as any).showLoading()
        });

        this.creditoService.actualizarFechaVencimientoCuota(cuota.id, result.value).subscribe({
          next: () => {
            (Swal as any).fire('¡Fecha Actualizada!', 'Se ha modificado la fecha de vencimiento exitosamente', 'success').then(() => {
              this.cargarCreditos();
            });
          },
          error: (err: any) => {
            console.error('Error al actualizar fecha:', err);
            (Swal as any).fire('Error', err?.error?.error || 'No se pudo actualizar la fecha', 'error');
          }
        });
      }
    });
  }

  // Registrar cobro presencial en tienda (Efectivo o Yape)
  registrarCobroPresencial(cuota: any): void {
    const deudaCuota = parseFloat(cuota.monto) || 0;

    (Swal as any).fire({
      title: 'Registrar Cobro Presencial',
      html: `
        <div style="text-align: left; color: #2C1810; font-family: 'Plus Jakarta Sans', sans-serif;">
          <p class="mb-2" style="font-size: 0.92rem;">
            Cobro para Cuota N° <strong>${cuota.numeroCuota}</strong> | Deuda actual: <strong style="color: #9A5B13;">S/. ${deudaCuota.toFixed(2)}</strong>
          </p>

          <div class="form-group mb-3">
            <label style="font-weight: 700; font-size: 0.88rem; color: #2C1810;">Método de Pago recibido:</label>
            <select id="swal-cobro-metodo" class="swal2-input" style="width: 100%; margin: 4px 0; height: 42px; border: 1px solid #C59B6D;">
              <option value="EFECTIVO" selected>Efectivo (en caja / mano)</option>
              <option value="YAPE">Yape (en mostrador)</option>
              <option value="TRANSFERENCIA">Transferencia bancaria</option>
            </select>
          </div>

          <div class="form-group mb-3">
            <label style="font-weight: 700; font-size: 0.88rem; color: #2C1810;">Monto Cobrado (S/.):</label>
            <input id="swal-cobro-monto" type="number" step="0.50" min="0.50" max="${deudaCuota}" value="${deudaCuota}"
                   class="swal2-input" style="width: 100%; margin: 4px 0; border: 1px solid #C59B6D; font-weight: 700; color: #166534;"
                   onkeydown="if(event.key==='-'||event.key==='+'||event.key==='e') event.preventDefault();">
            <small class="text-muted d-block mt-1">Máximo permitido: S/. ${deudaCuota.toFixed(2)} (no se permiten números negativos ni superar la deuda).</small>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-check-circle mr-1"></i> Registrar Pago Aprobado',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#166534',
      preConfirm: () => {
        const metodo = (document.getElementById('swal-cobro-metodo') as HTMLSelectElement)?.value || 'EFECTIVO';
        const montoInput = (document.getElementById('swal-cobro-monto') as HTMLInputElement)?.value;
        const montoNum = parseFloat(montoInput);

        if (!montoInput || isNaN(montoNum) || montoNum <= 0) {
          (Swal as any).showValidationMessage('Ingresa un monto numérico positivo mayor a 0');
          return false;
        }

        if (montoNum > deudaCuota) {
          (Swal as any).showValidationMessage(`El monto no puede superar la deuda total pendiente (S/. ${deudaCuota.toFixed(2)})`);
          return false;
        }

        return {
          cuotaId: cuota.id,
          monto: montoNum,
          metodoPago: metodo
        };
      }
    }).then((result: any) => {
      if (result.isConfirmed && result.value) {
        (Swal as any).fire({
          title: 'Registrando cobro...',
          allowOutsideClick: false,
          didOpen: () => (Swal as any).showLoading()
        });

        this.pagoService.registrarPago(result.value).subscribe({
          next: () => {
            (Swal as any).fire({
              title: '¡Cobro Registrado!',
              text: 'El pago presencial fue registrado y aprobado con éxito',
              icon: 'success',
              confirmButtonColor: '#166534'
            }).then(() => {
              this.cargarDatosUsuario();
            });
          },
          error: (err: any) => {
            console.error('Error al registrar cobro:', err);
            (Swal as any).fire('Error', err?.error?.error || err?.error || 'No se pudo registrar el cobro', 'error');
          }
        });
      }
    });
  }

  // Pago de cuota realizado por el propio cliente mediante Yape con comprobante
  pagarCuotaCliente(cuota: any): void {
    const deudaCuota = parseFloat(cuota.monto) || 0;

    (Swal as any).fire({
      title: 'Pagar Cuota con Yape',
      html: `
        <div style="text-align: left; color: #2C1810; font-family: 'Plus Jakarta Sans', sans-serif;">
          <div style="background: #FAF7F2; border-radius: 8px; padding: 12px; border: 1px solid #E5DDD3; margin-bottom: 12px;">
            <p class="mb-1" style="font-size: 0.95rem; font-weight: 700; color: #2C1810;">
              Cuota N° ${cuota.numeroCuota} <span style="font-size: 0.85rem; font-weight: normal; color: #66564E;">(Vence: ${this.formatDate(cuota.fechaVencimiento)})</span>
            </p>
            <p class="mb-0" style="font-size: 0.92rem; color: #66564E;">
              Monto pendiente: <strong style="color: #166534; font-size: 1.05rem;">S/. ${deudaCuota.toFixed(2)}</strong>
            </p>
          </div>

          <div style="text-align: center; margin: 12px 0; padding: 12px; background: #FAF5FF; border-radius: 8px; border: 1px dashed #A855F7;">
            <p class="mb-1" style="font-size: 0.85rem; font-weight: 600; color: #6B21A8;">
              <i class="fas fa-qrcode mr-1"></i> Escanea con Yape para pagar:
            </p>
            <img src="https://res.cloudinary.com/dwy44hftd/image/upload/v1746738914/yape_qr_placeholder.png"
                 alt="QR Yape" style="max-width: 130px; border-radius: 8px; border: 2px solid #7E22CE; margin: 4px 0;"
                 onerror="this.style.display='none'">
            <div style="font-weight: 800; color: #6B21A8; font-size: 1.1rem; letter-spacing: 0.5px;">
              Yape a: 987 654 321
            </div>
            <small style="color: #7E22CE; font-size: 0.78rem;">Titular: Ronald - D3 Royale</small>
          </div>

          <div class="form-group mb-3">
            <label style="font-weight: 700; font-size: 0.88rem; color: #2C1810;">Monto a Pagar (S/.):</label>
            <input id="swal-cliente-monto" type="number" step="0.50" min="0.50" max="${deudaCuota}" value="${deudaCuota}"
                   class="swal2-input" style="width: 100%; margin: 4px 0; border: 1px solid #C59B6D; font-weight: 700; color: #166534;"
                   onkeydown="if(event.key==='-'||event.key==='+'||event.key==='e') event.preventDefault();">
            <small class="text-muted d-block mt-1">Máximo a pagar: S/. ${deudaCuota.toFixed(2)} (no se permiten números negativos ni superar el monto).</small>
          </div>

          <div class="form-group mb-2">
            <label style="font-weight: 700; font-size: 0.88rem; color: #2C1810;">Comprobante de Pago (Captura Yape):</label>
            <input id="swal-cliente-file" type="file" accept="image/*"
                   class="form-control-file" style="font-size: 0.85rem; border: 1px solid #E5DDD3; padding: 6px; border-radius: 6px; width: 100%; background: #FAF7F2;">
            <small class="text-muted d-block mt-1">Adjunta la captura legible de la transferencia en Yape.</small>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-paper-plane mr-1"></i> Enviar Comprobante',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#166534',
      cancelButtonColor: '#66564E',
      width: '500px',
      preConfirm: () => {
        const montoInput = (document.getElementById('swal-cliente-monto') as HTMLInputElement)?.value;
        const fileInput = (document.getElementById('swal-cliente-file') as HTMLInputElement)?.files;
        const montoNum = parseFloat(montoInput);

        if (!montoInput || isNaN(montoNum) || montoNum <= 0) {
          (Swal as any).showValidationMessage('Ingresa un monto válido mayor a 0');
          return false;
        }

        if (montoNum > deudaCuota) {
          (Swal as any).showValidationMessage(`El monto no puede superar la cuota (S/. ${deudaCuota.toFixed(2)})`);
          return false;
        }

        if (!fileInput || fileInput.length === 0) {
          (Swal as any).showValidationMessage('Debes adjuntar la captura del comprobante de Yape');
          return false;
        }

        return {
          cuotaId: cuota.id,
          monto: montoNum,
          file: fileInput[0]
        };
      }
    }).then((result: any) => {
      if (result.isConfirmed && result.value) {
        (Swal as any).fire({
          title: 'Subiendo comprobante...',
          text: 'Por favor espere mientras enviamos su comprobante de pago',
          allowOutsideClick: false,
          didOpen: () => (Swal as any).showLoading()
        });

        this.pagoService.registrarPagoYape(result.value.cuotaId, result.value.file).subscribe({
          next: () => {
            (Swal as any).fire({
              title: '¡Comprobante Enviado!',
              text: 'Tu comprobante de Yape fue recibido y está en revisión. El administrador lo validará a la brevedad.',
              icon: 'success',
              confirmButtonColor: '#166534'
            }).then(() => {
              this.cargarDatosUsuario();
            });
          },
          error: (err: any) => {
            console.error('Error al subir comprobante Yape:', err);
            (Swal as any).fire('Error', err?.error?.error || err?.error || 'No se pudo registrar el pago con comprobante', 'error');
          }
        });
      }
    });
  }

  isClient(): boolean {
    return !this.authService.isAdmin();
  }

  inicializarDatosSbs(): void {
    if (this.user && this.user.sbsCalificacion) {
      this.sbsAnalysisResult = {
        calificacion: this.user.sbsCalificacion,
        deudaTotal: this.user.sbsDeudaTotal || 0,
        entidades: this.user.sbsEntidades
          ? this.user.sbsEntidades.split(',').map((e: string) => e.trim()).filter((e: string) => e.length > 0)
          : [],
        scoreCrediticio: this.user.sbsScore || 90,
        limiteSugerido: this.user.limiteCredito || 500,
        semaforo: this.user.sbsSemaforo || 'VERDE',
        nivelRiesgo: (this.user.sbsScore >= 75) ? 'Bajo' : ((this.user.sbsScore >= 50) ? 'Medio' : 'Alto'),
        documentoUrl: this.user.sbsDocumentoUrl,
        fechaEvaluacion: this.user.sbsFechaEvaluacion
          ? new Date(this.user.sbsFechaEvaluacion).toLocaleString()
          : '',
        recomendacion: (this.user.sbsScore >= 75) ? 'Aprobado para fiar' : ((this.user.sbsScore >= 50) ? 'Fiar con límite' : 'Denegar crédito')
      };
    } else {
      this.sbsAnalysisResult = null;
    }
  }

  onSbsFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.processSelectedSbsFile(file);
    }
  }

  onSbsFileDropped(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.processSelectedSbsFile(file);
    }
  }

  onSbsDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  processSelectedSbsFile(file: File): void {
    this.sbsUploadError = '';
    const validExtensions = ['pdf', 'png', 'jpg', 'jpeg'];
    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    if (!validExtensions.includes(extension)) {
      this.sbsUploadError = 'Formato no admitido. Por favor selecciona un archivo PDF o una imagen (PNG, JPG, JPEG).';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      this.sbsUploadError = 'El archivo supera el tamaño máximo permitido de 15MB.';
      return;
    }

    this.selectedSbsFile = file;
    this.sbsFileIsPdf = extension === 'pdf';

    if (!this.sbsFileIsPdf) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.sbsFilePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      this.sbsFilePreview = null;
    }
  }

  clearSbsFile(): void {
    this.selectedSbsFile = null;
    this.sbsFilePreview = null;
    this.sbsFileIsPdf = false;
    this.sbsUploadError = '';
  }

  uploadAndAnalyzeSbsReport(): void {
    if (!this.selectedSbsFile) {
      return;
    }

    this.sbsAnalyzing = true;
    this.sbsUploadError = '';

    this.userService.subirReporteSbs(this.selectedSbsFile).subscribe({
      next: (resultado) => {
        this.sbsAnalyzing = false;
        this.sbsAnalysisResult = resultado;
        if (this.user) {
          this.user.sbsCalificacion = resultado.calificacion;
          this.user.sbsDeudaTotal = resultado.deudaTotal;
          this.user.sbsScore = resultado.scoreCrediticio;
          this.user.sbsSemaforo = resultado.semaforo;
          this.user.limiteCredito = resultado.limiteSugerido;
          this.user.sbsFechaEvaluacion = resultado.fechaEvaluacion;
          this.user.sbsDocumentoUrl = resultado.documentoUrl;
        }

        Swal.fire({
          title: '¡Reporte SBS Analizado con IA!',
          text: `Calificación detectada: ${resultado.calificacion}. Nuevo límite de fiado asignado: S/. ${parseFloat(resultado.limiteSugerido).toFixed(2)}`,
          icon: 'success',
          background: '#24130C',
          color: '#FAF7F2',
          iconColor: '#C59B6D',
          confirmButtonColor: '#C59B6D'
        });
      },
      error: (err) => {
        this.sbsAnalyzing = false;
        console.error('Error al analizar reporte SBS:', err);
        const errMsg = err?.error?.error || 'No se pudo procesar el reporte SBS. Verifica que el archivo sea legible.';
        this.sbsUploadError = errMsg;
        Swal.fire({
          title: 'Error de Análisis',
          text: errMsg,
          icon: 'error',
          background: '#24130C',
          color: '#FAF7F2',
          iconColor: '#E74C3C',
          confirmButtonColor: '#C59B6D'
        });
      }
    });
  }
}
