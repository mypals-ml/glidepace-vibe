import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from './clipboard';

const originalClipboard = navigator.clipboard;
const originalIsSecureContext = window.isSecureContext;
const originalExecCommand = document.execCommand;

function setClipboard(clipboard: Clipboard | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  });
}

function setIsSecureContext(isSecureContext: boolean) {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: isSecureContext,
  });
}

describe('copyTextToClipboard', () => {
  afterEach(() => {
    setClipboard(originalClipboard);
    setIsSecureContext(originalIsSecureContext);
    document.execCommand = originalExecCommand;
    vi.restoreAllMocks();
  });

  it('uses navigator.clipboard in secure contexts', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    setIsSecureContext(true);
    setClipboard({ writeText } as unknown as Clipboard);
    document.execCommand = vi.fn();

    await expect(copyTextToClipboard('Issue title')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('Issue title');
    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it('falls back when navigator.clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'));
    const execCommand = vi.fn().mockReturnValue(true);

    setIsSecureContext(true);
    setClipboard({ writeText } as unknown as Clipboard);
    document.execCommand = execCommand;

    await expect(copyTextToClipboard('Issue body')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('Issue body');
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('uses the textarea fallback in non-secure contexts', async () => {
    const execCommand = vi.fn().mockReturnValue(true);

    setIsSecureContext(false);
    setClipboard(undefined);
    document.execCommand = execCommand;

    await expect(copyTextToClipboard('Issue comment')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});
