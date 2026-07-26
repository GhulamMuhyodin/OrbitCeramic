import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home';
import { CollectionsPage } from './pages/collections/collections-page';
import { JourneyPage } from './pages/journey/journey-page';
import { AboutPage } from './pages/about/about-page';
import { BatchPage } from './pages/batch/batch-page';

export const routes: Routes = [
  {
    path: '',
    component: HomePage,
    title: 'Orbit Ceramic — Handmade Pottery',
  },
  {
    path: 'collections',
    component: CollectionsPage,
    title: 'Collections — Orbit Ceramic',
  },
  {
    path: 'journey',
    component: JourneyPage,
    title: 'Journey — Orbit Ceramic',
  },
  {
    path: 'studio',
    redirectTo: 'journey',
    pathMatch: 'full',
  },
  {
    path: 'about',
    component: AboutPage,
    title: 'About — Orbit Ceramic',
  },
  {
    path: 'batch',
    component: BatchPage,
    title: 'Batch — Orbit Ceramic',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
