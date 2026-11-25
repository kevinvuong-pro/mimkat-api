import { Request } from 'express';

import { DeviceUtil } from './device.util';

describe('DeviceUtil', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('extracts device information without making a geolocation request', () => {
    const request = {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0',
      },
      socket: { remoteAddress: '203.0.113.1' },
    } as Request;
    const fetch = jest.spyOn(global, 'fetch');

    expect(DeviceUtil.extractDeviceInfo(request)).toMatchObject({
      ipAddress: '203.0.113.1',
      userAgent: request.headers['user-agent'],
      deviceName: expect.any(String),
      deviceType: expect.any(String),
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
