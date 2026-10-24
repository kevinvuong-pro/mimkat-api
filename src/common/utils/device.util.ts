import { Request } from 'express';
import { Logger } from '@nestjs/common';
import { UAParser } from 'ua-parser-js';

export interface DeviceInfo {
  ipAddress: string;
  location?: string;
  userAgent: string;
  deviceName: string;
  deviceType: string;
}

interface DeviceRequestHeaders {
  'x-device-model'?: string;
  'x-device-mobile'?: string;
  'x-device-platform'?: string;
}

export class DeviceUtil {
  private static readonly logger = new Logger(DeviceUtil.name);

  static async extractDeviceInfo(req: Request): Promise<DeviceInfo> {
    const ipAddress = this.getIpAddress(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const deviceType = this.getDeviceType(userAgent);
    const clientHints = req.headers as DeviceRequestHeaders;
    const deviceName = clientHints['x-device-model']?.trim() || this.getDeviceName(userAgent);
    const location = await this.getLocation(ipAddress);

    return {
      location,
      ipAddress,
      userAgent,
      deviceName,
      deviceType,
    };
  }

  private static getIpAddress(req: Request): string {
    // Check for IP in various headers (for proxied requests)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (forwarded as string).split(',');

      return ips[0].trim();
    }

    return (req.headers['x-real-ip'] as string) || req.socket.remoteAddress || 'Unknown';
  }

  private static async getLocation(ipAddress: string): Promise<string | undefined> {
    if (
      !ipAddress ||
      ipAddress === '::1' ||
      ipAddress === 'Unknown' ||
      ipAddress === '127.0.0.1' ||
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('172.16.') ||
      ipAddress.startsWith('192.168.')
    ) {
      return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      const response = await fetch(
        `https://free.freeipapi.com/api/v1/json/${encodeURIComponent(ipAddress)}`,
        {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        },
      );

      if (!response.ok) {
        throw new Error(`Geolocation request failed with status ${response.status}`);
      }

      const data = (await response.json()) as {
        regionName?: string;
        countryName?: string;
      };

      const location = [data.regionName, data.countryName].filter(Boolean).join(', ');

      return location || undefined;
    } catch (error) {
      this.logger.warn(
        `Unable to resolve location for IP ${ipAddress}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  }

  private static getDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase();

    // Mobile detection
    const mobileKeywords = [
      'ipad',
      'ipod',
      'webos',
      'iphone',
      'mobile',
      'android',
      'blackberry',
      'windows phone',
    ];
    if (mobileKeywords.some((keyword) => ua.includes(keyword))) return 'mobile';

    // Desktop apps detection (Electron, etc.)
    if (ua.includes('electron') || ua.includes('desktop')) return 'desktop';

    // Default to web
    return 'web';
  }

  private static getDeviceName(userAgent: string): string {
    const parsed = UAParser(userAgent);

    if (parsed.device.model) return parsed.device.model;
    if (parsed.device.vendor) return `${parsed.device.vendor} Device`;

    const ua = userAgent.toLowerCase();

    // iOS devices
    if (ua.includes('ipad')) return 'iPad';
    if (ua.includes('ipod')) return 'iPod';
    if (ua.includes('iphone')) return 'iPhone';

    // Android
    if (ua.includes('android')) {
      // Try to extract device model
      const androidMatch = userAgent.match(/Android.*?;\s*([^)]+)/);

      if (androidMatch && androidMatch[1]) return androidMatch[1].trim();

      return 'Android Device';
    }

    // Desktop OS
    if (ua.includes('linux')) return 'Linux PC';
    if (ua.includes('windows')) return 'Windows PC';
    if (ua.includes('macintosh') || ua.includes('mac os x')) return 'Mac';

    // Browsers
    if (ua.includes('edge')) return 'Edge Browser';
    if (ua.includes('firefox')) return 'Firefox Browser';
    if (ua.includes('chrome') && !ua.includes('edge')) return 'Chrome Browser';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari Browser';

    // Fallback to generic name based on device type when specific device/browser cannot be detected
    return userAgent;
  }
}
