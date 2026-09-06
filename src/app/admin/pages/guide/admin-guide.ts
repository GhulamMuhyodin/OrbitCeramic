import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-guide',
  imports: [CardModule, ButtonModule, RouterLink],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-6' },
  templateUrl: './admin-guide.html',
})
export class AdminGuidePage {}
