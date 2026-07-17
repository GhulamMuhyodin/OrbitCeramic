import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home';

export const routes: Routes = [
  {
    path: '',
    component: HomePage,
    title: 'Orbit Ceramic — Handmade Pottery',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
