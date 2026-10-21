import { environment } from '../../../environments/environment';
import {
  cacheBustProfilePhotoUrl,
  resolveProfilePhotoUrl,
} from './profile-photo';

const apiOrigin = new URL(environment.apiBaseUrl).origin;

describe('profile photo helpers', () => {
  describe('resolveProfilePhotoUrl', () => {
    it('renders absolute and backend-relative upload URLs', () => {
      expect(
        resolveProfilePhotoUrl('https://res.cloudinary.com/demo/image/upload/v1/me.png')
      ).toBe('https://res.cloudinary.com/demo/image/upload/v1/me.png');
      expect(resolveProfilePhotoUrl('/uploads/me.png')).toBe(
        `${apiOrigin}/uploads/me.png`
      );
    });

    it('returns null for missing values so callers show the fallback', () => {
      expect(resolveProfilePhotoUrl(null)).toBeNull();
      expect(resolveProfilePhotoUrl(undefined)).toBeNull();
      expect(resolveProfilePhotoUrl('   ')).toBeNull();
    });
  });

  describe('cacheBustProfilePhotoUrl', () => {
    it('adds a version query parameter without changing the stored URL', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/v1/me.png';
      expect(cacheBustProfilePhotoUrl(url, '123')).toBe(`${url}?v=123`);
    });

    it('uses an ampersand when the URL already has a query string', () => {
      expect(
        cacheBustProfilePhotoUrl('https://example.com/me.png?width=100', 'abc')
      ).toBe('https://example.com/me.png?width=100&v=abc');
    });

    it('does not alter data or blob URLs', () => {
      expect(cacheBustProfilePhotoUrl('data:image/png;base64,AAAA', '1')).toBe(
        'data:image/png;base64,AAAA'
      );
      expect(cacheBustProfilePhotoUrl('blob:http://localhost/abc', '1')).toBe(
        'blob:http://localhost/abc'
      );
    });
  });
});
