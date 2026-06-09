import { buildSaveButtonLabel, DETECTION_FORMAT_REGISTRY } from '../detectionFormatRegistry';

describe('detection format registry', () => {
  it('derives save button labels from registry display names', () => {
    expect(buildSaveButtonLabel(DETECTION_FORMAT_REGISTRY[0])).toBe('SAVE KQL');
  });

  it('supports new formats without modal code changes', () => {
    const dummy = { displayName: 'DummyX' };
    expect(buildSaveButtonLabel(dummy)).toBe('SAVE DUMMYX');
  });
});

