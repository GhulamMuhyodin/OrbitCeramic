import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

import { routes } from './app.routes';
import { adminApiInterceptor } from './admin/admin-api.interceptor';

const OrbitAura = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f7f7f7',
      100: '#eeeeee',
      200: '#dcdcdc',
      300: '#c2c2c2',
      400: '#999999',
      500: '#666666',
      600: '#333333',
      700: '#222222',
      800: '#151515',
      900: '#0b0b0b',
      950: '#000000',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: OrbitAura,
        options: {
          darkModeSelector: false,
        },
      },
      ripple: true,
    }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
      }),
    ),
    provideHttpClient(withFetch(), withInterceptors([adminApiInterceptor])),
    provideClientHydration(withEventReplay()),
  ],
};
