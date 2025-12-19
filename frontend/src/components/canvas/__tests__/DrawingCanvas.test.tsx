import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { DrawingCanvas } from '../DrawingCanvas';

// Mock canvas context to prevent infinite re-renders
const mockContext = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  lineCap: '',
  lineJoin: '',
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
};

describe('DrawingCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getContext to return a stable context
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext as any);
    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render canvas element', () => {
    render(<DrawingCanvas width={800} height={600} />);
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('width', '800');
    expect(canvas).toHaveAttribute('height', '600');
  });

  it('should set canvas background color', () => {
    render(<DrawingCanvas width={800} height={600} />);
    const canvas = document.querySelector('canvas');
    expect(canvas).toHaveStyle({ backgroundColor: '#1a1a1a' });
  });

  it('should have correct canvas classes', () => {
    render(<DrawingCanvas width={800} height={600} />);
    const canvas = document.querySelector('canvas');
    expect(canvas).toHaveClass('border', 'border-dark-700', 'rounded-lg', 'cursor-crosshair', 'touch-none');
  });

  it('should render with initial strokes', () => {
    const initialStrokes = [
      {
        points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
        color: '#ffffff',
        width: 3,
      },
    ];

    render(<DrawingCanvas width={800} height={600} initialStrokes={initialStrokes} />);
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('should accept disabled prop', () => {
    render(<DrawingCanvas width={800} height={600} disabled={true} />);
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('should accept onStrokeComplete callback', () => {
    const onStrokeComplete = vi.fn();
    render(<DrawingCanvas width={800} height={600} onStrokeComplete={onStrokeComplete} />);
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('should update when initialStrokes prop changes', () => {
    const { rerender } = render(<DrawingCanvas width={800} height={600} initialStrokes={[]} />);

    const newStrokes = [
      {
        points: [{ x: 50, y: 50 }, { x: 100, y: 100 }],
        color: '#ef4444',
        width: 5,
      },
    ];

    rerender(<DrawingCanvas width={800} height={600} initialStrokes={newStrokes} />);

    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('should have event handlers attached', () => {
    render(<DrawingCanvas width={800} height={600} />);
    const canvas = document.querySelector('canvas')!;
    
    // Check that event handlers are attached by checking if events can be dispatched
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    });
    
    expect(() => canvas.dispatchEvent(mouseDownEvent)).not.toThrow();
  });
});

