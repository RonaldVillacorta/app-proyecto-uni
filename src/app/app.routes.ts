import { Routes } from '@angular/router';
import { AuthComponent } from './auth/auth.component';
import { ForbiddenComponent } from './shared/components/forbidden/forbidden.component';
import { authGuard } from './guards/auth.guard';
import { UserFormComponent } from './business/users/user-form/user-form.component';
import { authRutasGuard } from './guards/auth-rutas.guard';
import { VerifySmsComponent } from './verify-sms/verify-sms.component'; // AGREGAR IMPORT
import { Component } from '@angular/core';
import { NuevaVentaComponent } from './business/admin/nueva-venta/nueva-venta.component';
import { PagarCuotaComponent } from './business/cliente/mis-cuotas/pagar-cuota/pagar-cuota.component';
import { DetalleCompraComponent } from './business/cliente/mis-compras/detalle-compra/detalle-compra.component';
import { ClienteDashboardComponent } from './business/cliente/cliente-dashboard/cliente-dashboard.component';
import { ListaComprasComponent } from './business/cliente/mis-compras/lista-compras/lista-compras.component';
import { AdminDashboardComponent } from './business/admin/admin-dashboard/admin-dashboard.component';
import { AdminVentasComponent } from './business/admin/admin-ventas/admin-ventas.component';
import { AdminUsuarioDetalleComponent } from './business/admin/admin-usuario-detalle/admin-usuario-detalle.component';
import { ControlCobranzasComponent } from './business/admin/control-cobranzas/control-cobranzas.component';
import { EvaluacionIaComponent } from './business/admin/evaluacion-ia/evaluacion-ia.component';

import { AdminPagosComponent } from './business/admin/admin-pagos/admin-pagos.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'login',
    component: AuthComponent,
  },
  {
    path: 'verify-sms',
    component: VerifySmsComponent,
  },
  {
    path: 'forbidden',
    component: ForbiddenComponent,
  },
  {
    path: '',
    loadComponent: () => import('./shared/components/layout/layout.component'),
    children: [
      {
        path: 'user',
        component: AdminUsuarioDetalleComponent,
        canActivate: [authRutasGuard],
      },
      {
        path: 'profile',
        component: AdminUsuarioDetalleComponent,
        canActivate: [authRutasGuard],
      },
      {
        path: 'user/edit/:id',
        component: UserFormComponent,
        canActivate: [authGuard],
      },
      {
        path: 'user/create',
        component: UserFormComponent,
        canActivate: [authGuard],
      },
      {
        path: 'users',
        loadComponent: () => import('./business/users/users.component'),
        canActivate: [authGuard],
      },
      {
        path: 'admin/ventas',
        component: AdminVentasComponent,
        canActivate: [authGuard],
      },
      {
        path: 'admin/ventas/nueva',
        component: NuevaVentaComponent,
        canActivate: [authGuard],
      },
      {
        path: 'admin/dashboard',
        component: AdminDashboardComponent,
        canActivate: [authGuard],
      },
      {
        path: 'admin/compras',
        component: AdminVentasComponent,
        canActivate: [authGuard],
      },
      {
        path: 'admin/venta/:id',
        component: DetalleCompraComponent,
        canActivate: [authGuard],
      },
      {
        path: 'admin/cobranzas',
        component: ControlCobranzasComponent,
        canActivate: [authGuard],
      },
      {
        path: 'admin/pagos',
        component: AdminPagosComponent,
        canActivate: [authGuard],
      },
      {
        path: 'admin/evaluacion-ia',
        component: EvaluacionIaComponent,
        canActivate: [authGuard],
      },
      {
        path: 'admin/user/:id',
        component: AdminUsuarioDetalleComponent,
        canActivate: [authGuard],
      },
      {
        path: 'cliente/dashboard',
        component: ClienteDashboardComponent,
        canActivate: [authRutasGuard],
      },
      {
        path: 'cliente/mis-compras',
        component: ListaComprasComponent,
        canActivate: [authRutasGuard],
      },
      {
        path: 'cliente/detalle-compra/:id',
        component: DetalleCompraComponent,
        canActivate: [authRutasGuard],
      },
      {
        path: 'cliente/pagar-cuota/:id',
        component: PagarCuotaComponent,
        canActivate: [authRutasGuard],
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];

