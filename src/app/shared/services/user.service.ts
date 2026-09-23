import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { User } from '../model/user';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  url: string = 'http://localhost:8080/api/users'

  constructor(private http : HttpClient){}

  findAll(): Observable<User[]> {
    return this.http.get<User[]>(this.url);
  }

  findById(id: number): Observable<User> {
    return this.http.get<User>(`${this.url}/${id}`);
  }

  userProfile(): Observable<any> {
    return this.http.get<any>(`${this.url}/profile`);
  }

  saveUser(user: User): Observable<User> {
    return this.http.post<User>(this.url, user);
  }

  updateUser(user: User): Observable<User> {
    return this.http.put<User>(`${this.url}/${user.id}`, user);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /**
   * Consulta el DNI a través del Backend seguro de Spring Boot (BFF).
   * El token y las credenciales quedan protegidos en el servidor.
   */
  consultarDniApi(dni: string): Observable<any> {
    const cached = localStorage.getItem(`dni_cache_${dni}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Solo reutilizar la caché si contiene la información oficial completa de SUNAT
        if (parsed && parsed.success && parsed.sunat) {
          return of(parsed);
        }
      } catch (_) {
        localStorage.removeItem(`dni_cache_${dni}`);
      }
    }

    return this.http.get<any>(`${this.url}/consulta-dni/${dni}`).pipe(
      tap((res) => {
        if (res && res.success && res.data) {
          localStorage.setItem(`dni_cache_${dni}`, JSON.stringify(res));
        }
      })
    );
  }

  /**
   * Consulta RUC a través del Backend seguro de Spring Boot.
   */
  consultarRucApi(ruc: string): Observable<any> {
    const cached = localStorage.getItem(`ruc_cache_${ruc}`);
    if (cached) {
      try {
        return of(JSON.parse(cached));
      } catch (_) {}
    }

    return this.http.get<any>(`${this.url}/consulta-ruc/${ruc}`).pipe(
      tap((res) => {
        if (res && res.success && res.data) {
          localStorage.setItem(`ruc_cache_${ruc}`, JSON.stringify(res));
        }
      })
    );
  }

  /**
   * Sube y procesa el reporte de deudas SBS con IA multimodal (PDF o Imagen).
   */
  subirReporteSbs(archivo: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', archivo);
    return this.http.post<any>(`${this.url}/profile/reporte-sbs`, formData);
  }
}
