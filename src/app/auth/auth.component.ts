import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { User } from '../shared/model/user';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css',
})
export class AuthComponent {
  user: User;
  errorMensagge: boolean = false;
  showPassword: boolean = false;
  isLoading: boolean = false;

  constructor(private authService: AuthService, private router: Router) {
    this.user = new User();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (!this.user.email || !this.user.password) {
      this.errorMensagge = true;
      return;
    }
    this.errorMensagge = false;
    this.isLoading = true;

    this.authService
      .loginUser({ email: this.user.email, password: this.user.password })
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          console.log('Respuesta del login:', response);

          if (response.requiresSms) {
            this.authService.tempToken = response.tempToken;
            this.authService.pendingAuth = {
              email: response.email,
              isAdmin: response.isAdmin,
              tempToken: response.tempToken,
              totpSecret: response.totpSecret,
              totpUri: response.totpUri,
              qrCodeUrl: response.qrCodeUrl,
            };

            Swal.fire({
              title: 'Autenticación en 2 Pasos',
              text: 'Ingresa el código de 6 dígitos de tu app Google Authenticator',
              icon: 'info',
              confirmButtonText: 'Continuar',
              confirmButtonColor: '#361E14',
            }).then(() => {
              this.router.navigate(['/verify-sms']);
            });
          } else {
            const token = response.token;
            const payload = this.authService.getPayload(token);
            const user = { email: payload.sub };
            const login = {
              user,
              isAuth: true,
              isAdmin: payload.isAdmin,
            };

            this.authService.token = token;
            this.authService.user = login;

            if (this.admin) {
              this.router.navigate(['/admin/dashboard']);
            } else {
              this.router.navigate(['/cliente/dashboard']);
            }
          }
        },

        error: (error) => {
          this.isLoading = false;
          if (error.status === 401) {
            Swal.fire({
              title: 'Error de Autenticación',
              text: 'Email o contraseña incorrectos',
              icon: 'error',
              confirmButtonColor: '#361E14',
            });
          } else if (error.error && error.error.error === 'SMS_ERROR') {
            Swal.fire({
              title: 'Error en Envío 2FA',
              text: 'No se pudo enviar el código SMS. Intenta nuevamente.',
              icon: 'error',
              confirmButtonColor: '#361E14',
            });
          } else {
            Swal.fire({
              title: 'Error de Conexión',
              text: 'No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.',
              icon: 'error',
              confirmButtonColor: '#361E14',
            });
          }
        },
      });
  }

  get admin(): boolean {
    return this.authService.isAdmin();
  }
}
