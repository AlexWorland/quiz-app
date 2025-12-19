import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrushSizeSelector } from '../BrushSizeSelector';

describe('BrushSizeSelector', () => {
  it('should render all brush sizes', () => {
    const onSizeChange = vi.fn();
    render(<BrushSizeSelector size={3} onSizeChange={onSizeChange} />);

    expect(screen.getByLabelText('Brush size 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Brush size 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Brush size 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Brush size 8')).toBeInTheDocument();
    expect(screen.getByLabelText('Brush size 12')).toBeInTheDocument();
  });

  it('should highlight selected size', () => {
    const onSizeChange = vi.fn();
    const { container } = render(<BrushSizeSelector size={5} onSizeChange={onSizeChange} />);

    const selectedButton = screen.getByLabelText('Brush size 5');
    expect(selectedButton).toHaveClass('border-accent-cyan', 'bg-accent-cyan/20');
  });

  it('should not highlight unselected sizes', () => {
    const onSizeChange = vi.fn();
    render(<BrushSizeSelector size={5} onSizeChange={onSizeChange} />);

    const unselectedButton = screen.getByLabelText('Brush size 3');
    expect(unselectedButton).toHaveClass('border-dark-600');
    expect(unselectedButton).not.toHaveClass('border-accent-cyan');
  });

  it('should call onSizeChange when size is clicked', async () => {
    const onSizeChange = vi.fn();
    render(<BrushSizeSelector size={3} onSizeChange={onSizeChange} />);

    const sizeButton = screen.getByLabelText('Brush size 5');
    await userEvent.click(sizeButton);

    expect(onSizeChange).toHaveBeenCalledWith(5);
  });

  it('should display brush size indicator dots', () => {
    const onSizeChange = vi.fn();
    render(<BrushSizeSelector size={3} onSizeChange={onSizeChange} />);

    const sizeButton = screen.getByLabelText('Brush size 5');
    const dot = sizeButton.querySelector('div');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveStyle({ width: '5px', height: '5px' });
  });

  it('should update selected size when prop changes', () => {
    const onSizeChange = vi.fn();
    const { rerender } = render(<BrushSizeSelector size={3} onSizeChange={onSizeChange} />);

    let selectedButton = screen.getByLabelText('Brush size 3');
    expect(selectedButton).toHaveClass('border-accent-cyan');

    rerender(<BrushSizeSelector size={8} onSizeChange={onSizeChange} />);

    selectedButton = screen.getByLabelText('Brush size 8');
    expect(selectedButton).toHaveClass('border-accent-cyan');
  });
});

