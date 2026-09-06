import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { getBatchScheduleStatus } from './data/site-content.model';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should classify batch state as scheduled, live, or complete', () => {
    const now = new Date('2026-08-01T12:00:00Z').getTime();

    expect(getBatchScheduleStatus('2026-08-02T12:00:00Z', now)).toBe('scheduled');
    expect(getBatchScheduleStatus('2026-08-01T11:00:00Z', now)).toBe('live');
    expect(getBatchScheduleStatus('2026-07-31T12:00:00Z', now)).toBe('complete');
  });
});
