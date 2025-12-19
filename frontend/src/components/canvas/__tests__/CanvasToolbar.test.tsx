import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanvasToolbar } from '../CanvasToolbar';

// Mock lucide-react icon
vi.mock('lucide-react', () => ({
  Trash2: () => <div data-testid="trash-icon">Trash</div>,
}));

describe('CanvasToolbar', () => {
  const defaultProps = {
    color: '#ffffff',
    brushSize: 3,
    onColorChange: vi.fn(),
    onBrushSizeChange: vi.fn(),
    onClear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render color palette', () => {
    render(<CanvasToolbar {...defaultProps} />);
    expect(screen.getByLabelText('Select color #ffffff')).toBeInTheDocument();
  });

  it('should render brush size selector', () => {
    render(<CanvasToolbar {...defaultProps} />);
    expect(screen.getByLabelText('Brush size 3')).toBeInTheDocument();
  });

  it('should render clear button when canClear is true', () => {
    render(<CanvasToolbar {...defaultProps} canClear={true} />);
    expect(screen.getByText('Clear Canvas')).toBeInTheDocument();
    expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
  });

  it('should not render clear button when canClear is false', () => {
    render(<CanvasToolbar {...defaultProps} canClear={false} />);
    expect(screen.queryByText('Clear Canvas')).not.toBeInTheDocument();
  });

  it('should call onClear when clear button is clicked', async () => {
    render(<CanvasToolbar {...defaultProps} />);
    const clearButton = screen.getByText('Clear Canvas');
    await userEvent.click(clearButton);

    expect(defaultProps.onClear).toHaveBeenCalledTimes(1);
  });

  it('should pass color to ColorPalette', () => {
    render(<CanvasToolbar {...defaultProps} color="#ef4444" />);
    const selectedColorButton = screen.getByLabelText('Select color #ef4444');
    expect(selectedColorButton).toHaveClass('border-white');
  });

  it('should pass brushSize to BrushSizeSelector', () => {
    render(<CanvasToolbar {...defaultProps} brushSize={5} />);
    const selectedSizeButton = screen.getByLabelText('Brush size 5');
    expect(selectedSizeButton).toHaveClass('border-accent-cyan');
  });

  it('should call onColorChange when color is selected', async () => {
    render(<CanvasToolbar {...defaultProps} />);
    const colorButton = screen.getByLabelText('Select color #ef4444');
    await userEvent.click(colorButton);

    expect(defaultProps.onColorChange).toHaveBeenCalledWith('#ef4444');
  });

  it('should call onBrushSizeChange when brush size is selected', async () => {
    render(<CanvasToolbar {...defaultProps} />);
    const sizeButton = screen.getByLabelText('Brush size 5');
    await userEvent.click(sizeButton);

    expect(defaultProps.onBrushSizeChange).toHaveBeenCalledWith(5);
  });

  it('should default canClear to true', () => {
    render(<CanvasToolbar color="#ffffff" brushSize={3} onColorChange={vi.fn()} onBrushSizeChange={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText('Clear Canvas')).toBeInTheDocument();
  });
});

