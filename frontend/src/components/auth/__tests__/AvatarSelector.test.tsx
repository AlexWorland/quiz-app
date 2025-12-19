import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvatarSelector } from '../AvatarSelector';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Upload: () => <div data-testid="upload-icon">Upload</div>,
  Loader: () => <div data-testid="loader-icon">Loader</div>,
}));

describe('AvatarSelector', () => {
  const mockOnSelect = vi.fn();
  const originalFetch = global.fetch;
  const originalCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    URL.createObjectURL = vi.fn((blob) => `blob:${blob}`);
    vi.stubEnv('VITE_UNSPLASH_KEY', '');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    vi.unstubAllEnvs();
  });

  it('should render with emoji tab by default', () => {
    render(<AvatarSelector onSelect={mockOnSelect} />);
    expect(screen.getByText('😀 Emoji')).toBeInTheDocument();
    expect(screen.getByText('🖼️ Stock')).toBeInTheDocument();
    expect(screen.getByText('📁 Upload')).toBeInTheDocument();
  });

  it('should display emoji grid when emoji tab is active', () => {
    render(<AvatarSelector onSelect={mockOnSelect} />);
    // Check for some emojis
    expect(screen.getByText('😀')).toBeInTheDocument();
    expect(screen.getByText('😎')).toBeInTheDocument();
  });

  it('should call onSelect when emoji is clicked', async () => {
    render(<AvatarSelector onSelect={mockOnSelect} />);
    // Clear the initial call from mount (default emoji selection)
    mockOnSelect.mockClear();
    
    const emojiButton = screen.getByText('😎');
    await userEvent.click(emojiButton);

    expect(mockOnSelect).toHaveBeenCalledWith('😎', 'emoji', null);
  });

  it('should highlight selected emoji', async () => {
    render(<AvatarSelector onSelect={mockOnSelect} />);
    const firstEmoji = screen.getByText('😀');
    const secondEmoji = screen.getByText('😎');

    // First emoji should be selected by default
    expect(firstEmoji.closest('button')).toHaveClass('bg-accent-cyan');

    // Click second emoji
    await userEvent.click(secondEmoji);

    // Second emoji should now be selected
    expect(secondEmoji.closest('button')).toHaveClass('bg-accent-cyan');
  });

  it('should switch to stock tab when clicked', async () => {
    render(<AvatarSelector onSelect={mockOnSelect} />);
    const stockTab = screen.getByText('🖼️ Stock');
    await userEvent.click(stockTab);

    expect(stockTab.closest('button')).toHaveClass('bg-accent-cyan');
  });

  it('should load default stock images when Unsplash key is not available', async () => {
    render(<AvatarSelector onSelect={mockOnSelect} />);
    const stockTab = screen.getByText('🖼️ Stock');
    await userEvent.click(stockTab);

    await waitFor(() => {
      const images = screen.getAllByAltText('avatar');
      expect(images.length).toBeGreaterThan(0);
    });
  });

  it('should show loading state when loading stock images', async () => {
    vi.stubEnv('VITE_UNSPLASH_KEY', 'test-key');
    
    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    vi.mocked(global.fetch).mockReturnValue(fetchPromise);

    render(<AvatarSelector onSelect={mockOnSelect} />);
    const stockTab = screen.getByText('🖼️ Stock');
    await userEvent.click(stockTab);

    // Should show loading state immediately when Unsplash key is available
    await waitFor(() => {
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    // Resolve the fetch
    resolveFetch!({ json: async () => ({ results: [] }) } as Response);
  });

  it('should load stock images from Unsplash when key is available', async () => {
    vi.stubEnv('VITE_UNSPLASH_KEY', 'test-key');
    const mockResults = [
      { urls: { small: 'https://example.com/img1.jpg' } },
      { urls: { small: 'https://example.com/img2.jpg' } },
    ];

    vi.mocked(global.fetch).mockResolvedValue({
      json: async () => ({ results: mockResults }),
    } as Response);

    render(<AvatarSelector onSelect={mockOnSelect} />);
    const stockTab = screen.getByText('🖼️ Stock');
    await userEvent.click(stockTab);

    await waitFor(() => {
      const images = screen.getAllByAltText('avatar');
      expect(images.length).toBe(2);
    });
  });

  it('should fallback to default images if Unsplash API fails', async () => {
    vi.stubEnv('VITE_UNSPLASH_KEY', 'test-key');
    vi.mocked(global.fetch).mockRejectedValue(new Error('API Error'));

    render(<AvatarSelector onSelect={mockOnSelect} />);
    const stockTab = screen.getByText('🖼️ Stock');
    await userEvent.click(stockTab);

    await waitFor(() => {
      const images = screen.getAllByAltText('avatar');
      expect(images.length).toBeGreaterThan(0);
    });
  });

  it('should call onSelect when stock image is clicked', async () => {
    render(<AvatarSelector onSelect={mockOnSelect} />);
    const stockTab = screen.getByText('🖼️ Stock');
    await userEvent.click(stockTab);

    await waitFor(() => {
      const images = screen.getAllByAltText('avatar');
      expect(images.length).toBeGreaterThan(0);
    });

    const firstImage = screen.getAllByAltText('avatar')[0];
    await userEvent.click(firstImage);

    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.stringContaining('dicebear.com'),
      'preset'
    );
  });

  it('should have load more button in stock tab', async () => {
    render(<AvatarSelector onSelect={mockOnSelect} />);
    const stockTab = screen.getByText('🖼️ Stock');
    await userEvent.click(stockTab);

    await waitFor(() => {
      expect(screen.getByText('Load more')).toBeInTheDocument();
    });
  });

  it('should reload stock images when load more is clicked', async () => {
    vi.stubEnv('VITE_UNSPLASH_KEY', 'test-key');
    
    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    vi.mocked(global.fetch).mockReturnValue(fetchPromise);

    render(<AvatarSelector onSelect={mockOnSelect} />);
    const stockTab = screen.getByText('🖼️ Stock');
    await userEvent.click(stockTab);

    // Wait for initial load to complete
    await waitFor(() => {
      expect(screen.getByText('Load more')).toBeInTheDocument();
    });

    // Reset fetch mock for reload
    let resolveReload: (value: Response) => void;
    const reloadPromise = new Promise<Response>((resolve) => {
      resolveReload = resolve;
    });
    vi.mocked(global.fetch).mockReturnValue(reloadPromise);

    const loadMoreButton = screen.getByText('Load more');
    await userEvent.click(loadMoreButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    // Resolve the reload fetch
    resolveReload!({ json: async () => ({ results: [] }) } as Response);
  });

  it('should switch to upload tab when clicked', async () => {
    render(<AvatarSelector onSelect={mockOnSelect} />);
    const uploadTab = screen.getByText('📁 Upload');
    await userEvent.click(uploadTab);

    expect(uploadTab.closest('button')).toHaveClass('bg-accent-cyan');
    expect(screen.getByTestId('upload-icon')).toBeInTheDocument();
  });

  it('should display upload area in upload tab', async () => {
    render(<AvatarSelector onSelect={mockOnSelect} />);
    const uploadTab = screen.getByText('📁 Upload');
    await userEvent.click(uploadTab);

    expect(screen.getByText(/Click to upload or drag and drop/i)).toBeInTheDocument();
  });

  it('should call onSelect with file when file is uploaded', async () => {
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    vi.mocked(URL.createObjectURL).mockReturnValue('blob:test-url');

    render(<AvatarSelector onSelect={mockOnSelect} />);
    const uploadTab = screen.getByText('📁 Upload');
    await userEvent.click(uploadTab);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, file);

    expect(mockOnSelect).toHaveBeenCalledWith('blob:test-url', 'custom', file);
  });

  it('should not call onSelect if no file is selected', async () => {
    render(<AvatarSelector onSelect={mockOnSelect} />);
    // Clear the initial call from mount (default emoji selection)
    mockOnSelect.mockClear();
    
    const uploadTab = screen.getByText('📁 Upload');
    await userEvent.click(uploadTab);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    // Simulate change event with no files
    Object.defineProperty(fileInput, 'files', {
      value: null,
      writable: false,
    });

    await userEvent.click(fileInput);

    // Should not have been called with file (only the initial emoji call should exist)
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('should disable file input when loading prop is true', async () => {
    render(<AvatarSelector onSelect={mockOnSelect} loading={true} />);
    const uploadTab = screen.getByText('📁 Upload');
    await userEvent.click(uploadTab);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput).toBeDisabled();
  });

  it('should display label', () => {
    render(<AvatarSelector onSelect={mockOnSelect} />);
    expect(screen.getByText('Choose your avatar *')).toBeInTheDocument();
  });

  it('should handle tab switching correctly', async () => {
    render(<AvatarSelector onSelect={mockOnSelect} />);

    // Start with emoji tab
    expect(screen.getByText('😀')).toBeInTheDocument();

    // Switch to stock tab
    const stockTab = screen.getByText('🖼️ Stock');
    await userEvent.click(stockTab);
    await waitFor(() => {
      expect(screen.queryByText('😀')).not.toBeInTheDocument();
    });

    // Switch to upload tab
    const uploadTab = screen.getByText('📁 Upload');
    await userEvent.click(uploadTab);
    expect(screen.getByTestId('upload-icon')).toBeInTheDocument();

    // Switch back to emoji tab
    const emojiTab = screen.getByText('😀 Emoji');
    await userEvent.click(emojiTab);
    expect(screen.getByText('😀')).toBeInTheDocument();
  });

  it('should handle empty Unsplash response gracefully', async () => {
    vi.stubEnv('VITE_UNSPLASH_KEY', 'test-key');
    vi.mocked(global.fetch).mockResolvedValue({
      json: async () => ({ results: [] }),
    } as Response);

    render(<AvatarSelector onSelect={mockOnSelect} />);
    const stockTab = screen.getByText('🖼️ Stock');
    await userEvent.click(stockTab);

    await waitFor(() => {
      // Should fallback to default images
      const images = screen.getAllByAltText('avatar');
      expect(images.length).toBeGreaterThan(0);
    });
  });
});

