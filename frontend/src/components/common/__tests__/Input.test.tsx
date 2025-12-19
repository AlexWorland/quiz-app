import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../Input';

describe('Input', () => {
  it('should render input element', () => {
    render(<Input />);
    const input = document.querySelector('input');
    expect(input).toBeInTheDocument();
  });

  it('should render with label', () => {
    render(<Input label="Username" />);
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  it('should render without label when not provided', () => {
    render(<Input />);
    expect(screen.queryByText('Username')).not.toBeInTheDocument();
  });

  it('should display error message when error prop is provided', () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('should not display error message when error prop is not provided', () => {
    render(<Input />);
    expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
  });

  it('should apply error styles when error is present', () => {
    const { container } = render(<Input error="Error message" />);
    const input = container.querySelector('input');
    expect(input).toHaveClass('border-red-500', 'focus:ring-red-500');
  });

  it('should not apply error styles when error is not present', () => {
    const { container } = render(<Input />);
    const input = container.querySelector('input');
    expect(input).not.toHaveClass('border-red-500');
  });

  it('should accept and display value', () => {
    render(<Input value="test value" onChange={() => {}} />);
    const input = document.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('test value');
  });

  it('should call onChange when value changes', async () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    
    const input = document.querySelector('input')!;
    await userEvent.type(input, 'test');
    
    expect(handleChange).toHaveBeenCalled();
  });

  it('should accept placeholder', () => {
    render(<Input placeholder="Enter your name" />);
    const input = screen.getByPlaceholderText('Enter your name');
    expect(input).toBeInTheDocument();
  });

  it('should accept type prop', () => {
    render(<Input type="password" />);
    const input = document.querySelector('input[type="password"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'password');
  });

  it('should accept disabled prop', () => {
    render(<Input disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('should accept required prop', () => {
    render(<Input required />);
    const input = screen.getByRole('textbox');
    expect(input).toBeRequired();
  });

  it('should accept name prop', () => {
    render(<Input name="username" />);
    const input = document.querySelector('input');
    expect(input).toHaveAttribute('name', 'username');
  });

  it('should accept id prop', () => {
    render(<Input id="user-input" />);
    const input = document.querySelector('input');
    expect(input).toHaveAttribute('id', 'user-input');
  });

  it('should associate label with input using htmlFor', () => {
    render(<Input label="Username" id="username" />);
    const label = screen.getByText('Username');
    const input = screen.getByLabelText('Username');
    expect(label).toBeInTheDocument();
    expect(input).toHaveAttribute('id', 'username');
  });

  it('should accept custom className', () => {
    const { container } = render(<Input className="custom-input" />);
    const input = container.querySelector('input');
    expect(input).toHaveClass('custom-input');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<Input ref={ref} />);
    expect(ref).toHaveBeenCalled();
  });

  it('should have focus ring styles', () => {
    const { container } = render(<Input />);
    const input = container.querySelector('input');
    expect(input).toHaveClass('focus:ring-2', 'focus:ring-accent-cyan');
  });

  it('should have dark mode styles', () => {
    const { container } = render(<Input />);
    const input = container.querySelector('input');
    expect(input).toHaveClass('dark:bg-dark-800', 'dark:text-gray-100');
  });

  it('should render error message with correct styling', () => {
    render(<Input error="Error message" />);
    const errorMessage = screen.getByText('Error message');
    expect(errorMessage).toHaveClass('text-red-500', 'text-sm', 'mt-1');
  });

  it('should handle controlled input', async () => {
    const handleChange = vi.fn();
    render(<Input value="" onChange={handleChange} />);
    
    const input = document.querySelector('input') as HTMLInputElement;
    await userEvent.type(input, 'a');
    
    expect(handleChange).toHaveBeenCalled();
  });

  it('should handle uncontrolled input', async () => {
    render(<Input defaultValue="initial" />);
    
    const input = document.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('initial');
    
    await userEvent.type(input, ' new');
    expect(input.value).toBe('initial new');
  });
});

