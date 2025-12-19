import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('should render with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should render with default variant (primary)', () => {
    const { container } = render(<Button>Test</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-accent-cyan');
  });

  it('should render with primary variant', () => {
    const { container } = render(<Button variant="primary">Test</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-accent-cyan');
  });

  it('should render with secondary variant', () => {
    const { container } = render(<Button variant="secondary">Test</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-gray-200');
  });

  it('should render with danger variant', () => {
    const { container } = render(<Button variant="danger">Test</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-red-500');
  });

  it('should render with default size (md)', () => {
    const { container } = render(<Button>Test</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('px-4', 'py-2', 'text-base');
  });

  it('should render with sm size', () => {
    const { container } = render(<Button size="sm">Test</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm');
  });

  it('should render with md size', () => {
    const { container } = render(<Button size="md">Test</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('px-4', 'py-2', 'text-base');
  });

  it('should render with lg size', () => {
    const { container } = render(<Button size="lg">Test</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('px-6', 'py-3', 'text-lg');
  });

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByText('Click me');
    await userEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByText('Disabled');
    expect(button).toBeDisabled();
  });

  it('should be disabled when loading prop is true', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should show loading text when loading', () => {
    render(<Button loading>Click me</Button>);
    expect(screen.getByText('...')).toBeInTheDocument();
    expect(screen.queryByText('Click me')).not.toBeInTheDocument();
  });

  it('should show children when not loading', () => {
    render(<Button loading={false}>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });

  it('should accept custom className', () => {
    const { container } = render(<Button className="custom-class">Test</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Test</Button>);
    expect(ref).toHaveBeenCalled();
  });

  it('should pass through other button props', () => {
    render(<Button type="submit" aria-label="Submit button">Submit</Button>);
    const button = screen.getByLabelText('Submit button');
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('should not call onClick when disabled', async () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    
    const button = screen.getByText('Disabled');
    await userEvent.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should not call onClick when loading', async () => {
    const handleClick = vi.fn();
    render(<Button loading onClick={handleClick}>Loading</Button>);
    
    const button = screen.getByRole('button');
    await userEvent.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should have disabled styles when disabled', () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
  });
});

