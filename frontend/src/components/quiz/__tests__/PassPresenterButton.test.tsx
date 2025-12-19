import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PassPresenterButton } from '../PassPresenterButton';

describe('PassPresenterButton', () => {
  const mockParticipants = [
    { id: '1', username: 'User1', avatar_url: 'avatar1.jpg' },
    { id: '2', username: 'User2' },
    { id: '3', username: 'User3', avatar_url: 'avatar3.jpg' },
  ];

  it('should render button', () => {
    render(<PassPresenterButton participants={mockParticipants} currentUserId="1" onPass={vi.fn()} />);
    expect(screen.getByText('Pass Presenter Role')).toBeInTheDocument();
  });

  it('should open dropdown when button is clicked', () => {
    render(<PassPresenterButton participants={mockParticipants} currentUserId="1" onPass={vi.fn()} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Pass Presenter Role'));
    });
    
    expect(screen.getByText('Select next presenter:')).toBeInTheDocument();
  });

  it('should filter out current user from eligible participants', () => {
    render(<PassPresenterButton participants={mockParticipants} currentUserId="1" onPass={vi.fn()} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Pass Presenter Role'));
    });
    
    expect(screen.getByText('User2')).toBeInTheDocument();
    expect(screen.getByText('User3')).toBeInTheDocument();
    expect(screen.queryByText('User1')).not.toBeInTheDocument();
  });

  it('should call onPass when participant is selected', () => {
    const onPass = vi.fn();
    render(<PassPresenterButton participants={mockParticipants} currentUserId="1" onPass={onPass} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Pass Presenter Role'));
    });
    
    act(() => {
      fireEvent.click(screen.getByText('User2'));
    });
    
    expect(onPass).toHaveBeenCalledWith('2');
  });

  it('should close dropdown after selecting participant', () => {
    render(<PassPresenterButton participants={mockParticipants} currentUserId="1" onPass={vi.fn()} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Pass Presenter Role'));
    });
    
    expect(screen.getByText('Select next presenter:')).toBeInTheDocument();
    
    act(() => {
      fireEvent.click(screen.getByText('User2'));
    });
    
    expect(screen.queryByText('Select next presenter:')).not.toBeInTheDocument();
  });

  it('should toggle dropdown when button is clicked twice', () => {
    render(<PassPresenterButton participants={mockParticipants} currentUserId="1" onPass={vi.fn()} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Pass Presenter Role'));
    });
    
    expect(screen.getByText('Select next presenter:')).toBeInTheDocument();
    
    act(() => {
      fireEvent.click(screen.getByText('Pass Presenter Role'));
    });
    
    expect(screen.queryByText('Select next presenter:')).not.toBeInTheDocument();
  });

  it('should show message when no eligible participants', () => {
    render(<PassPresenterButton participants={[{ id: '1', username: 'User1' }]} currentUserId="1" onPass={vi.fn()} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Pass Presenter Role'));
    });
    
    expect(screen.getByText('No other participants available')).toBeInTheDocument();
  });

  it('should handle empty participants list', () => {
    render(<PassPresenterButton participants={[]} currentUserId="1" onPass={vi.fn()} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Pass Presenter Role'));
    });
    
    expect(screen.getByText('No other participants available')).toBeInTheDocument();
  });
});

