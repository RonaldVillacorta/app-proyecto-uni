import { Component, OnInit } from '@angular/core';
import { UserService } from '../../shared/services/user.service';
import { AuthService } from '../../shared/services/auth.service';
import { VentaService } from '../../shared/services/venta.service';
import { CreditoService } from '../../shared/services/credito.service';
import { PagoService } from '../../shared/services/pago.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export default class ProfileComponent implements OnInit {
  userProfile: any;
  ventas: any[] = [];
  creditos: any[] = [];
  cuotas: any[] = [];
  pagos: any[] = [];
  recentActivity: any[] = [];

  loading = true;
  error = '';
  activeTab = 'profile'; // Pestaña activa: 'profile', 'activity', 'edit', 'sbs'
  editProfileForm: FormGroup;
  editMode = false;
  saveSuccess = false;

  // Variables SBS Document AI
  selectedSbsFile: File | null = null;
  sbsFilePreview: string | null = null;
  sbsFileIsPdf = false;
  sbsAnalyzing = false;
  sbsAnalysisResult: any = null;
  sbsUploadError = '';

  // Estadísticas calculadas
  totalCompras = 0;
  totalGastado = 0;
  totalDeuda = 0;
  totalPagado = 0;
  cuotasPendientes = 0;
  cuotasVencidas = 0;
  cuotasPagadas = 0;

  constructor(
    private userService: UserService,
    public authService: AuthService,
    private ventaService: VentaService,
    private creditoService: CreditoService,
    private pagoService: PagoService,
    private fb: FormBuilder
  ) {
    // Inicializar formulario
    this.editProfileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      lastname: ['', [Validators.required, Validators.minLength(2)]],
      dni: ['', [Validators.required, Validators.pattern('^[0-9]{8}$')]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{9}$')]],
      address: ['', [Validators.required]],
      email: [
        { value: '', disabled: true },
        [Validators.required, Validators.email],
      ],
    });
  }

  ngOnInit(): void {
    this.loadProfileData();
  }

  loadProfileData() {
    this.loading = true;
    this.error = '';

    // Limpiar datos previos
    this.ventas = [];
    this.creditos = [];
    this.cuotas = [];
    this.pagos = [];
    this.recentActivity = [];

    this.userService.userProfile().subscribe({
      next: (profile) => {
        this.userProfile = profile;

        // Actualizar formulario con datos de perfil
        this.editProfileForm.patchValue({
          name: this.userProfile.name || '',
          lastname: this.userProfile.lastname || '',
          dni: this.userProfile.dni || '',
          phone: this.userProfile.phone || '',
          address: this.userProfile.address || '',
          email: this.userProfile.email || '',
        });

        // Cargar datos relacionados
        this.loadUserTransactions(profile.id);

        // Inicializar datos SBS si ya existen previamente
        if (this.userProfile.sbsCalificacion) {
          this.sbsAnalysisResult = {
            calificacion: this.userProfile.sbsCalificacion,
            deudaTotal: this.userProfile.sbsDeudaTotal || 0,
            entidades: this.userProfile.sbsEntidades
              ? this.userProfile.sbsEntidades.split(',').map((e: string) => e.trim()).filter((e: string) => e.length > 0)
              : [],
            scoreCrediticio: this.userProfile.sbsScore || 90,
            limiteSugerido: this.userProfile.limiteCredito || 500,
            semaforo: this.userProfile.sbsSemaforo || 'VERDE',
            nivelRiesgo: (this.userProfile.sbsScore >= 75) ? 'Bajo' : ((this.userProfile.sbsScore >= 50) ? 'Medio' : 'Alto'),
            documentoUrl: this.userProfile.sbsDocumentoUrl,
            fechaEvaluacion: this.userProfile.sbsFechaEvaluacion
              ? new Date(this.userProfile.sbsFechaEvaluacion).toLocaleString()
              : '',
            recomendacion: (this.userProfile.sbsScore >= 75) ? 'Aprobado para fiar' : ((this.userProfile.sbsScore >= 50) ? 'Fiar con límite' : 'Denegar crédito')
          };
        }
      },
      error: (error) => {
        console.error('Error al cargar perfil:', error);
        this.error = 'No se pudieron cargar los datos del perfil';
        this.loading = false;
      },
    });
  }

  loadUserTransactions(userId: number) {
    let operacionesCompletadas = 0;
    const totalOperaciones = 3; // ventas, creditos, pagos

    const finalizarCarga = () => {
      operacionesCompletadas++;
      if (operacionesCompletadas === totalOperaciones) {
        this.calcularEstadisticas();
        this.prepararActividadReciente();
        this.loading = false;
      }
    };

    // Cargar ventas
    this.ventaService.obtenerVentasPorCliente(userId).subscribe({
      next: (ventas) => {
        this.ventas = ventas.sort(
          (a, b) =>
            new Date(b.fechaVenta).getTime() - new Date(a.fechaVenta).getTime()
        );
        finalizarCarga();
      },
      error: (error) => {
        console.error('Error al cargar ventas:', error);
        finalizarCarga();
      },
    });

    // Cargar créditos y cuotas
    this.creditoService.obtenerCreditosPorCliente(userId).subscribe({
      next: (creditos) => {
        this.creditos = creditos;

        if (creditos.length > 0) {
          let creditosProcesados = 0;

          creditos.forEach((credito) => {
            this.creditoService.obtenerCuotasPorCredito(credito.id).subscribe({
              next: (cuotas) => {
                cuotas.forEach((cuota) => {
                  cuota.credito_id = credito.id;
                  this.cuotas.push(cuota);
                });

                creditosProcesados++;
                if (creditosProcesados === creditos.length) {
                  finalizarCarga();
                }
              },
              error: (error) => {
                console.error('Error al cargar cuotas:', error);
                creditosProcesados++;
                if (creditosProcesados === creditos.length) {
                  finalizarCarga();
                }
              },
            });
          });
        } else {
          finalizarCarga();
        }
      },
      error: (error) => {
        console.error('Error al cargar créditos:', error);
        finalizarCarga();
      },
    });

    // Cargar pagos
    this.pagoService.obtenerPagosPorCliente(userId).subscribe({
      next: (pagos) => {
        this.pagos = pagos.sort(
          (a, b) =>
            new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime()
        );
        finalizarCarga();
      },
      error: (error) => {
        console.error('Error al cargar pagos:', error);
        finalizarCarga();
      },
    });
  }

  calcularEstadisticas() {
    // Estadísticas de ventas
    this.totalCompras = this.ventas.length;
    this.totalGastado = this.ventas.reduce(
      (total, venta) => total + parseFloat(venta.montoTotal.toString()),
      0
    );

    // Estadísticas de cuotas
    this.cuotasPendientes = this.cuotas.filter(
      (c) => c.estado === 'PENDIENTE'
    ).length;
    this.cuotasVencidas = this.cuotas.filter(
      (c) => c.estado === 'VENCIDO'
    ).length;
    this.cuotasPagadas = this.cuotas.filter(
      (c) => c.estado === 'PAGADO'
    ).length;

    // Calcular deuda total
    this.totalDeuda = this.cuotas
      .filter((c) => c.estado === 'PENDIENTE' || c.estado === 'VENCIDO')
      .reduce((total, cuota) => total + parseFloat(cuota.monto.toString()), 0);

    // Calcular total pagado
    this.totalPagado = this.pagos.reduce(
      (total, pago) => total + parseFloat(pago.monto.toString()),
      0
    );
  }

  prepararActividadReciente() {
    let actividades: any[] = [];

    // Agregar ventas como actividades
    this.ventas.slice(0, 5).forEach((venta) => {
      actividades.push({
        type: 'purchase',
        date: new Date(venta.fechaVenta),
        title: 'Compra realizada',
        description: venta.descripcion,
        amount: parseFloat(venta.montoTotal.toString()),
        status: venta.estado || 'COMPLETADO',
        id: venta.id,
      });
    });

    // Agregar pagos como actividades
    this.pagos.slice(0, 3).forEach((pago) => {
      actividades.push({
        type: 'payment',
        date: new Date(pago.fechaPago),
        title: 'Pago de cuota',
        description: `Pago de cuota #${pago.cuota?.numeroCuota || 'N/A'}`,
        amount: parseFloat(pago.monto.toString()),
        status: 'PROCESADO',
        id: pago.id,
      });
    });

    // Agregar créditos aprobados como actividades
    this.creditos.slice(0, 2).forEach((credito) => {
      actividades.push({
        type: 'credit',
        date: new Date(credito.fechaInicio),
        title: 'Crédito aprobado',
        description: `Crédito para ${credito.numeroCuotas} cuotas`,
        amount: parseFloat(credito.montoTotal.toString()),
        status: credito.estado || 'APROBADO',
        id: credito.id,
      });
    });

    // Ordenar por fecha (más reciente primero) y tomar los primeros 6
    this.recentActivity = actividades
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 6);
  }

  // Cambiar pestaña activa
  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.saveSuccess = false;
  }

  // Entrar en modo edición
  enableEditMode() {
    this.editMode = true;
    this.setActiveTab('edit');
  }

  // Cancelar edición
  cancelEdit() {
    this.editMode = false;
    this.setActiveTab('profile');

    // Restaurar valores originales
    this.editProfileForm.patchValue({
      name: this.userProfile.name || '',
      lastname: this.userProfile.lastname || '',
      dni: this.userProfile.dni || '',
      phone: this.userProfile.phone || '',
      address: this.userProfile.address || '',
      email: this.userProfile.email || '',
    });
  }

  // Guardar cambios en el perfil
  saveProfile() {
    if (this.editProfileForm.valid) {
      this.loading = true;

      const updatedUser = {
        ...this.userProfile,
        ...this.editProfileForm.value,
        email: this.userProfile.email, // Mantener email original
      };

      this.userService.updateUser(updatedUser).subscribe({
        next: (response) => {
          this.userProfile = response;
          this.saveSuccess = true;
          this.editMode = false;
          this.loading = false;

          Swal.fire({
            title: '¡Actualizado!',
            text: 'Tu perfil ha sido actualizado correctamente',
            icon: 'success',
            background: '#2c3e50',
            color: 'white',
            iconColor: '#2ecc71',
          });

          setTimeout(() => {
            this.setActiveTab('profile');
          }, 1500);
        },
        error: (error) => {
          this.loading = false;
          console.error('Error al actualizar perfil:', error);

          Swal.fire({
            title: 'Error',
            text: 'No se pudo actualizar tu perfil. Intenta nuevamente.',
            icon: 'error',
            background: '#2c3e50',
            color: 'white',
            iconColor: '#e74c3c',
          });
        },
      });
    }
  }

  // Obtener la fecha formateada para un elemento de actividad
  getFormattedDate(date: Date): string {
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return 'Hoy';
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return `Hace ${diffDays} días`;
    } else {
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  }

  // Obtener clase de ícono para actividad
  getActivityIcon(type: string): string {
    switch (type) {
      case 'purchase':
        return 'fas fa-shopping-bag';
      case 'payment':
        return 'fas fa-money-bill-wave';
      case 'credit':
        return 'fas fa-credit-card';
      default:
        return 'fas fa-star';
    }
  }

  // Obtener color de badge para actividad
  getActivityBadgeColor(type: string): string {
    switch (type) {
      case 'purchase':
        return '#4fc3f7';
      case 'payment':
        return '#2ecc71';
      case 'credit':
        return '#f39c12';
      default:
        return '#3498db';
    }
  }

  // Formatear moneda
  formatCurrency(value: number): string {
    return `S/. ${value.toFixed(2)}`;
  }

  // Formatear fecha
  formatDate(date: string | Date): string {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('es-ES');
    } catch (error) {
      return 'N/A';
    }
  }

  // Obtener clase de estado
  getStatusClass(status: string): string {
    switch (status) {
      case 'COMPLETADO':
      case 'PROCESADO':
      case 'PAGADO':
        return 'badge-success';
      case 'PENDIENTE':
        return 'badge-warning';
      case 'VENCIDO':
        return 'badge-danger';
      case 'APROBADO':
        return 'badge-info';
      default:
        return 'badge-secondary';
    }
  }

  // Refrescar datos
  refreshData() {
    this.loadProfileData();
  }

  // Ver detalle de compra con lista de productos
  verDetalleCompra(item: any): void {
    const ventaId = item.id;
    if (!ventaId) return;

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
          filasHtml = '<tr><td colspan="4" class="text-center text-muted py-3">No hay productos registrados en esta compra</td></tr>';
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
          title: `Detalle de tu Compra #${ventaId}`,
          html: `
            <div style="text-align: left; color: #2C1810; font-family: 'Plus Jakarta Sans', sans-serif;">
              <p class="mb-2 small" style="color: #8C7B72;">
                ${item.description || ''}
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
                <span style="font-size: 0.95rem; font-weight: 600; color: #66564E;">Total:</span>
                <span style="font-size: 1.25rem; font-weight: 800; color: #166534; margin-left: 8px;">
                  ${this.formatCurrency(item.amount || item.montoTotal || 0)}
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

  isClient(): boolean {
    return !this.authService.isAdmin();
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
        if (this.userProfile) {
          this.userProfile.sbsCalificacion = resultado.calificacion;
          this.userProfile.sbsDeudaTotal = resultado.deudaTotal;
          this.userProfile.sbsScore = resultado.scoreCrediticio;
          this.userProfile.sbsSemaforo = resultado.semaforo;
          this.userProfile.limiteCredito = resultado.limiteSugerido;
          this.userProfile.sbsFechaEvaluacion = resultado.fechaEvaluacion;
          this.userProfile.sbsDocumentoUrl = resultado.documentoUrl;
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
