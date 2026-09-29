# Frontend Web - Sistema de Gestión de Cuentas por Cobrar con Inteligencia Artificial
**Tesis:** *Desarrollo de un sistema web basado en inteligencia artificial para mejorar la gestión de cuentas por cobrar en la microempresa Comercial Reyes, 2026*  
**Autor:** Ronald Villacorta  
**Entregable:** 1.2 · Repositorio en GitHub (Fase 1: Software)  
**Versión / Tag:** `v1.0.0-entregable1`  

---

## 1. Descripción General
Aplicación web cliente (Frontend SPA) construida con **Angular 19**. Ofrece una experiencia interactiva y moderna tanto para el Administrador de Comercial Reyes como para sus clientes compradores, conectándose a través de una API REST protegida por JWT y un microservicio de Inteligencia Artificial para el scoring crediticio.

---

## 2. Características Principales

* **Seguridad y Doble Factor (2FA TOTP):** Acceso con credenciales encriptadas y desafío temporal de 6 dígitos mediante Google Authenticator o Telegram Bot (RFC 6238).
* **Panel de Administración (Dashboard):**
  * Tarjetas de resumen en tiempo real: Cuentas por cobrar, mora vencida, recaudación mensual y eficiencia de cobranza.
* **Evaluación Crediticia con IA (Objetivo 3):**
  * Carga de reportes de riesgo crediticio de la SBS en PDF o imagen.
  * Visualización del Score Crediticio (0 a 100 puntos), semáforo de riesgo y límite de dinero sugerido.
* **Gestión de Ventas y Créditos:**
  * Registro ágil de ventas al contado, fiadas o a crédito.
  * Cálculo dinámico de subtotales, cuotas y fechas de vencimiento.
* **Auditoría de Pagos y Validación Yape:**
  * Bandeja de comprobantes digitales de Yape con vistas para: *Pendientes*, *Aprobados*, *Rechazados* y *Todos*.
  * Inspección visual directa de fotos alojadas en Cloudinary.
* **Directorio y Perfil Integral del Cliente:**
  * Ficha en 5 pestañas: *Resumen*, *Compras*, *Cuentas*, *Pagos* e *Historial SBS*.
* **Portal del Cliente (Autogestión):**
  * Consulta personal de cupo disponible, compras, desglose de artículos y pago de cuotas con código QR oficial de Yape.
* **Asistente Virtual Chatbot con IA:**
  * Widget de conversación interactiva con sugerencias rápidas («¿Quién no paga?») y respuestas dinámicas.

---

## 3. Tecnologías Utilizadas

* **Framework:** Angular 19 (Arquitectura Standalone y Módulos Reactivos)
* **Lenguaje:** TypeScript 5.x / HTML5 / CSS3
* **Estilos y Componentes:** Bootstrap 5 y AdminLTE 3
* **Librerías de Notificación:** SweetAlert2
* **Manejo de Estados y Asincronía:** RxJS

---

## 4. Estructura del Proyecto

```text
app-proyecto-uni/
├── src/
│   ├── app/
│   │   ├── auth/                 # Componente de inicio de sesión
│   │   ├── business/
│   │   │   ├── admin/            # Vistas administrativas
│   │   │   │   ├── admin-ventas/ # Catálogo y auditoría de pagos Yape
│   │   │   │   ├── cobranzas/    # Bandeja de mora y semáforo de retraso
│   │   │   │   ├── dashboard/    # Panel principal con KPIs
│   │   │   │   ├── evaluacion-ia/# Carga de SBS y resultados del score
│   │   │   │   ├── nueva-venta/  # Formulario interactivo de venta
│   │   │   │   ├── user/         # Directorio maestro de clientes
│   │   │   │   ├── user-detail/  # Perfil de 5 pestañas del cliente
│   │   │   │   └── user-form/    # Registro de nuevos clientes con sueldo
│   │   │   └── cliente/          # Portal del cliente (dashboard, compras, Yape)
│   │   ├── guards/               # Protección de rutas por roles (ADMIN / CLIENTE)
│   │   ├── interceptors/         # Inyección automática del Bearer JWT
│   │   ├── shared/
│   │   │   ├── components/       # Chatbot virtual y barras de navegación
│   │   │   └── services/         # Servicios HTTP (Auth, Venta, Cuota, Pago, IA)
│   │   └── verify-sms/           # Desafío de código de seguridad 2FA
│   ├── assets/                   # Recursos visuales y estilos globales
│   └── index.html                # Plantilla base SPA
├── angular.json                  # Configuración de compilación y empaquetado
├── package.json                  # Dependencias y scripts de ejecución
└── Dockerfile                    # Empaquetado de producción con Nginx Alpine
```

---

## 5. Instalación y Ejecución Local

### Prerrequisitos
* Node.js v18 o superior
* npm v9 o superior
* Angular CLI v19 (`npm install -g @angular/cli`)

### Pasos de Instalación
```bash
# 1. Clonar el repositorio
git clone https://github.com/AnonyMovsJs/app-proyecto-uni.git
cd app-proyecto-uni

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo
ng serve --open
```
La aplicación web se abrirá automáticamente en [http://localhost:4200](http://localhost:4200).

---

## 6. Licencia
Este proyecto se distribuye bajo la licencia **MIT License**. Consulta el archivo [LICENSE](LICENSE) para más información.
