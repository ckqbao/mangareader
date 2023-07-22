import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef, EventEmitter,
  inject,
  Input,
  OnInit, Output,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {fromEvent, of} from "rxjs";
import {catchError, filter, tap} from "rxjs/operators";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import getBoundingClientRect from "@popperjs/core/lib/dom-utils/getBoundingClientRect";
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {ReaderService} from "../../../_services/reader.service";

enum BookLineOverlayMode {
  None = 0,
  Bookmark = 1
}

@Component({
  selector: 'app-book-line-overlay',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './book-line-overlay.component.html',
  styleUrls: ['./book-line-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookLineOverlayComponent implements OnInit {
  @Input({required: true}) libraryId!: number;
  @Input({required: true}) seriesId!: number;
  @Input({required: true}) volumeId!: number;
  @Input({required: true}) chapterId!: number;
  @Input({required: true}) pageNumber: number = 0;
  @Input({required: true}) parent: ElementRef | undefined;
  @Output() refreshToC: EventEmitter<void> = new EventEmitter();

  xPath: string = '';
  selectedText: string = '';
  overlayPosition: { top: number; left: number } = { top: 0, left: 0 };
  mode: BookLineOverlayMode = BookLineOverlayMode.None;
  bookmarkForm: FormGroup = new FormGroup({
    name: new FormControl('', [Validators.required]),
  });

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdRef = inject(ChangeDetectorRef);
  private readonly readerService = inject(ReaderService);

  get BookLineOverlayMode() { return BookLineOverlayMode; }
  constructor(private elementRef: ElementRef) {}


  ngOnInit() {
    if (this.parent) {
      fromEvent<MouseEvent>(this.parent.nativeElement, 'mouseup')
        .pipe(takeUntilDestroyed(this.destroyRef),
          tap((event: MouseEvent) => {
            const selection = window.getSelection();
            if (!event.target) return;

            if (this.mode !== BookLineOverlayMode.None && (!selection || selection.toString().trim() === '')) {
              this.reset();
              return;
            }

            this.selectedText = selection ? selection.toString().trim() : '';

            if (this.selectedText.length > 0 && this.mode === BookLineOverlayMode.None) {
              // Get x,y coord so we can position overlay
              if (event.target) {
                const range = selection!.getRangeAt(0)
                const rect = range.getBoundingClientRect();
                const box = getBoundingClientRect(event.target as Element);
                this.xPath = this.readerService.getXPathTo(event.target);
                if (this.xPath !== '') {
                  this.xPath = '//' + this.xPath;
                }

                this.overlayPosition = {
                  top: rect.top + window.scrollY - 64 - rect.height, // 64px is the top menu area
                  left: rect.left + window.scrollX + 30 // Adjust 10 to center the overlay box horizontally
                };
              }
            }
            this.cdRef.markForCheck();
          }))
        .subscribe();
    }
  }

  switchMode(mode: BookLineOverlayMode) {
    this.mode = mode;
    this.cdRef.markForCheck();
    if (this.mode === BookLineOverlayMode.Bookmark) {
      this.bookmarkForm.get('name')?.setValue(this.selectedText);
      this.focusOnBookmarkInput();
    }
  }

  createPTOC() {
    this.readerService.createPersonalToC(this.libraryId, this.seriesId, this.volumeId, this.chapterId, this.pageNumber,
      this.bookmarkForm.get('name')?.value, this.xPath).pipe(catchError(err => {
        this.focusOnBookmarkInput();
        return of();
    })).subscribe(() => {
      this.reset();
      this.refreshToC.emit();
      this.cdRef.markForCheck();
    });
  }

  focusOnBookmarkInput() {
    if (this.mode !== BookLineOverlayMode.Bookmark) return;
    setTimeout(() => this.elementRef.nativeElement.querySelector('#bookmark-name')?.focus(), 10);
  }

  reset() {
    this.bookmarkForm.reset();
    this.mode = BookLineOverlayMode.None;
    this.xPath = '';
    this.selectedText = '';
    this.cdRef.markForCheck();
  }

}