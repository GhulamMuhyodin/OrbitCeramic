import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, input } from '@angular/core';
import { BatchContent } from '../../data/site-content.model';

@Component({
  selector: 'app-batch-celebration',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './batch-celebration.html',
})
export class BatchCelebration {
  readonly content = input.required<BatchContent>();
  @Output() readonly dismiss = new EventEmitter<void>();

  protected readonly confettiPieces = Array.from({ length: 36 }, (_, i) => i + 1);

  protected dismissCelebration(): void {
    this.dismiss.emit();
  }
}
