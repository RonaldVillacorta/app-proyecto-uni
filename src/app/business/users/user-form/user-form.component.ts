import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UserService } from '../../../shared/services/user.service';
import { User } from '../../../shared/model/user';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css'],
})
export class UserFormComponent implements OnInit {
  userForm!: FormGroup;
  isEditMode = false;
  id!: number;
  loading = false;
  errorValidationBackend: any;
  user: User = new User();

  constructor(
    private route: ActivatedRoute,
    private userService: UserService,
    private router: Router,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.id = +this.route.snapshot.paramMap.get('id')!;
    this.isEditMode = !!this.id;
    this.initForm();

    if (this.isEditMode) {
      this.loadUser();
    }
  }

  initForm() {
    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      lastname: ['', [Validators.required, Validators.minLength(2)]],
      dni: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
      phone: ['', [Validators.pattern(/^\d{9}$/)]],
      address: [''],
      ingresoMensual: [null, [Validators.min(0)]],
      // Solo incluimos email en modo edicion, pero deshabilitado
      ...(this.isEditMode ? { email: [{ value: '', disabled: true }] } : {}),
      // La contrasena es opcional en modo edicion
      ...(this.isEditMode ? { password: [''] } : {}),
    });
  }

  loadUser() {
    this.loading = true;
    if (this.id) {
      this.userService.findById(this.id).subscribe({
        next: (data) => {
          this.user = data;
          this.userForm.patchValue({
            name: this.user.name,
            lastname: this.user.lastname,
            dni: this.user.dni,
            phone: this.user.phone,
            address: this.user.address,
            email: this.user.email,
            ingresoMensual: this.user.ingresoMensual || null,
          });
          this.loading = false;
        },
        error: (error) => {
          this.errorValidationBackend = error.error;
          this.loading = false;

          Swal.fire({
            title: 'Error',
            text: 'No se pudo cargar la informacion del usuario',
            icon: 'error',
            background: '#2c3e50',
            color: 'white',
            iconColor: '#e74c3c',
          });
        },
      });
    }
  }

  onSubmit() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    const userData = {
      ...this.user,
      ...this.userForm.value,
    };

    if (this.isEditMode) {
      userData.email = this.user.email;
      if (!userData.password) {
        delete userData.password;
      }
    }

    if (this.isEditMode) {
      this.userService.updateUser(userData).subscribe({
        next: () => {
          this.loading = false;
          Swal.fire({
            title: 'Actualizado!',
            text: 'Cliente actualizado exitosamente',
            icon: 'success',
            background: '#24130C',
            color: '#FAF7F2',
            confirmButtonColor: '#C59B6D',
          }).then(() => {
            this.router.navigate(['/users']);
          });
        },
        error: (error) => {
          this.errorValidationBackend = error.error;
          this.loading = false;
          Swal.fire({
            title: 'Error',
            text: 'No se pudo actualizar el cliente',
            icon: 'error',
            background: '#24130C',
            color: '#FAF7F2',
            confirmButtonColor: '#E74C3C',
          });
        },
      });
    } else {
      this.userService.saveUser(userData).subscribe({
        next: () => {
          this.loading = false;
          Swal.fire({
            title: 'Registrado!',
            text: 'Cliente registrado exitosamente',
            icon: 'success',
            background: '#24130C',
            color: '#FAF7F2',
            confirmButtonColor: '#C59B6D',
          }).then(() => {
            this.router.navigate(['/users']);
          });
        },
        error: (error) => {
          this.errorValidationBackend = error.error;
          this.loading = false;
          Swal.fire({
            title: 'Error',
            text: 'No se pudo registrar el cliente',
            icon: 'error',
            background: '#24130C',
            color: '#FAF7F2',
            confirmButtonColor: '#E74C3C',
          });
        },
      });
    }
  }

  getFieldErrorMessage(fieldName: string): string {
    const field = this.userForm.get(fieldName);

    if (!field || !field.errors || !field.touched) {
      return '';
    }

    if (field.errors['required']) {
      return 'Este campo es obligatorio';
    }

    if (field.errors['minlength']) {
      return 'Debe tener al menos ' + field.errors['minlength'].requiredLength + ' caracteres';
    }

    if (field.errors['pattern']) {
      switch (fieldName) {
        case 'dni':
          return 'El DNI debe tener 8 digitos numericos';
        case 'phone':
          return 'El telefono debe tener 9 digitos numericos';
        default:
          return 'Formato invalido';
      }
    }

    if (field.errors['email']) {
      return 'Email invalido';
    }

    if (field.errors['min']) {
      return 'El monto no puede ser negativo';
    }

    return 'Campo invalido';
  }

  hasError(fieldName: string): boolean {
    const field = this.userForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }
}

