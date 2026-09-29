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
   * Sube y procesa el reporte de deudas SBS con IA multimodal (PDF o Imagen).
   * Si se especifica userId, evalúa al cliente seleccionado; de lo contrario, al perfil en sesión.
   */
  subirReporteSbs(archivo: File, userId?: number): Observable<any> {
    const formData = new FormData();
    formData.append('file', archivo);
    if (userId) {
      return this.http.post<any>(`${this.url}/${userId}/reporte-sbs`, formData);
    }
    return this.http.post<any>(`${this.url}/profile/reporte-sbs`, formData);
  }
}
