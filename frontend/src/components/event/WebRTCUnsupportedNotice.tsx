import { WebRTCUnsupportedReason, getWebRTCErrorMessage } from '../../utils/webrtcDetection';
import { Button } from '../common/Button';

interface WebRTCUnsupportedNoticeProps {
  reason?: WebRTCUnsupportedReason;
  onUseManualEntry: () => void;
}

export function WebRTCUnsupportedNotice({
  reason,
  onUseManualEntry,
}: WebRTCUnsupportedNoticeProps) {
  const errorMessage = getWebRTCErrorMessage(reason);

  const getBrowserSuggestions = () => {
    if (reason === 'no_getusermedia') {
      return (
        <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
          <p className="text-sm text-slate-300 font-medium mb-2">Recommended browsers:</p>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>Chrome 53+</li>
            <li>Firefox 55+</li>
            <li>Safari 14.1+</li>
            <li>Edge 79+</li>
          </ul>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-red-900/20 border border-red-600 rounded-lg p-6 mb-6">
      <div className="flex gap-3">
        <div className="text-2xl mt-1">📷</div>
        <div className="flex-1">
          <h3 className="text-red-400 font-semibold mb-2">Camera Not Available</h3>
          <p className="text-red-300 text-sm mb-4">{errorMessage}</p>

          <Button
            onClick={onUseManualEntry}
            variant="outline"
            className="text-sm"
          >
            Enter Code Manually
          </Button>

          {getBrowserSuggestions()}
        </div>
      </div>
    </div>
  );
}
