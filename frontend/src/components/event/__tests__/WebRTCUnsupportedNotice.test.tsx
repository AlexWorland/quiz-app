import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WebRTCUnsupportedNotice } from '../WebRTCUnsupportedNotice';

describe('WebRTCUnsupportedNotice', () => {
  it('should render notice with camera icon and title', () => {
    const handleManualEntry = vi.fn();
    render(
      <WebRTCUnsupportedNotice
        reason="no_media_devices"
        onUseManualEntry={handleManualEntry}
      />
    );

    expect(screen.getByText('Camera Not Available')).toBeInTheDocument();
    expect(screen.getByText(/device does not have camera support/i)).toBeInTheDocument();
  });

  it('should display no_media_devices message', () => {
    const handleManualEntry = vi.fn();
    render(
      <WebRTCUnsupportedNotice
        reason="no_media_devices"
        onUseManualEntry={handleManualEntry}
      />
    );

    expect(screen.getByText(/device does not have camera support/i)).toBeInTheDocument();
  });

  it('should display insecure_context message', () => {
    const handleManualEntry = vi.fn();
    render(
      <WebRTCUnsupportedNotice
        reason="insecure_context"
        onUseManualEntry={handleManualEntry}
      />
    );

    expect(screen.getByText(/secure connection/i)).toBeInTheDocument();
  });

  it('should call onUseManualEntry when button is clicked', async () => {
    const user = userEvent.setup();
    const handleManualEntry = vi.fn();
    render(
      <WebRTCUnsupportedNotice
        reason="no_getusermedia"
        onUseManualEntry={handleManualEntry}
      />
    );

    await user.click(screen.getByText('Enter Code Manually'));
    expect(handleManualEntry).toHaveBeenCalled();
  });

  it('should show browser suggestions for no_getusermedia', () => {
    const handleManualEntry = vi.fn();
    render(
      <WebRTCUnsupportedNotice
        reason="no_getusermedia"
        onUseManualEntry={handleManualEntry}
      />
    );

    expect(screen.getByText('Recommended browsers:')).toBeInTheDocument();
    expect(screen.getByText('Chrome 53+')).toBeInTheDocument();
    expect(screen.getByText('Firefox 55+')).toBeInTheDocument();
  });

  it('should not show browser suggestions for other reasons', () => {
    const handleManualEntry = vi.fn();
    render(
      <WebRTCUnsupportedNotice
        reason="no_media_devices"
        onUseManualEntry={handleManualEntry}
      />
    );

    expect(screen.queryByText('Recommended browsers:')).not.toBeInTheDocument();
  });
});
