import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPalette } from '../ColorPalette';

describe('ColorPalette', () => {
  it('should render all colors', () => {
    const onColorChange = vi.fn();
    render(<ColorPalette selectedColor="#ffffff" onColorChange={onColorChange} />);

    expect(screen.getByLabelText('Select color #ffffff')).toBeInTheDocument();
    expect(screen.getByLabelText('Select color #000000')).toBeInTheDocument();
    expect(screen.getByLabelText('Select color #ef4444')).toBeInTheDocument();
    expect(screen.getByLabelText('Select color #f59e0b')).toBeInTheDocument();
    expect(screen.getByLabelText('Select color #eab308')).toBeInTheDocument();
    expect(screen.getByLabelText('Select color #22c55e')).toBeInTheDocument();
    expect(screen.getByLabelText('Select color #3b82f6')).toBeInTheDocument();
    expect(screen.getByLabelText('Select color #8b5cf6')).toBeInTheDocument();
    expect(screen.getByLabelText('Select color #ec4899')).toBeInTheDocument();
  });

  it('should highlight selected color', () => {
    const onColorChange = vi.fn();
    const { container } = render(<ColorPalette selectedColor="#ef4444" onColorChange={onColorChange} />);

    const selectedButton = screen.getByLabelText('Select color #ef4444');
    expect(selectedButton).toHaveClass('border-white', 'scale-110');
  });

  it('should not highlight unselected colors', () => {
    const onColorChange = vi.fn();
    render(<ColorPalette selectedColor="#ffffff" onColorChange={onColorChange} />);

    const unselectedButton = screen.getByLabelText('Select color #ef4444');
    expect(unselectedButton).toHaveClass('border-dark-600');
    expect(unselectedButton).not.toHaveClass('border-white');
  });

  it('should call onColorChange when color is clicked', async () => {
    const onColorChange = vi.fn();
    render(<ColorPalette selectedColor="#ffffff" onColorChange={onColorChange} />);

    const colorButton = screen.getByLabelText('Select color #ef4444');
    await userEvent.click(colorButton);

    expect(onColorChange).toHaveBeenCalledWith('#ef4444');
  });

  it('should apply background color to buttons', () => {
    const onColorChange = vi.fn();
    render(<ColorPalette selectedColor="#ffffff" onColorChange={onColorChange} />);

    const redButton = screen.getByLabelText('Select color #ef4444');
    expect(redButton).toHaveStyle({ backgroundColor: '#ef4444' });
  });

  it('should update selected color when prop changes', () => {
    const onColorChange = vi.fn();
    const { rerender } = render(<ColorPalette selectedColor="#ffffff" onColorChange={onColorChange} />);

    let selectedButton = screen.getByLabelText('Select color #ffffff');
    expect(selectedButton).toHaveClass('border-white');

    rerender(<ColorPalette selectedColor="#ef4444" onColorChange={onColorChange} />);

    selectedButton = screen.getByLabelText('Select color #ef4444');
    expect(selectedButton).toHaveClass('border-white');
  });
});

