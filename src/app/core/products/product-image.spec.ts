import { environment } from '../../../environments/environment';
import { resolveProductImageUrl } from './product-image';

const apiOrigin = new URL(environment.apiBaseUrl).origin;
const uploadUrl = 'http://localhost:3001/uploads/1791563575213-d13be78d.jpg';

describe('resolveProductImageUrl', () => {
  it('keeps an absolute http(s) URL exactly as the backend returned it', () => {
    expect(resolveProductImageUrl(uploadUrl)).toBe(uploadUrl);
    expect(resolveProductImageUrl('https://example.com/latte.png')).toBe(
      'https://example.com/latte.png'
    );
  });

  it('never prefixes an absolute URL with the API base URL', () => {
    expect(resolveProductImageUrl('https://example.com/latte.png')).not.toContain(
      environment.apiBaseUrl
    );
    expect(resolveProductImageUrl(uploadUrl)).not.toContain(`${environment.apiBaseUrl}/`);
  });

  it('resolves a backend-relative upload path against the backend origin', () => {
    expect(resolveProductImageUrl('/uploads/a.jpg')).toBe(`${apiOrigin}/uploads/a.jpg`);
    expect(resolveProductImageUrl('uploads/a.jpg')).toBe(`${apiOrigin}/uploads/a.jpg`);
    expect(resolveProductImageUrl('/uploads/a.jpg')).not.toContain('/api/uploads');
  });

  it('keeps legacy bundled asset paths but makes them root-relative', () => {
    expect(resolveProductImageUrl('assets/products/hot/Americano.png')).toBe(
      '/assets/products/hot/Americano.png'
    );
    expect(resolveProductImageUrl('/assets/products/hot/Americano.png')).toBe(
      '/assets/products/hot/Americano.png'
    );
  });

  it('returns an empty string for missing, blank or non-string values', () => {
    expect(resolveProductImageUrl('')).toBe('');
    expect(resolveProductImageUrl('   ')).toBe('');
    expect(resolveProductImageUrl(null)).toBe('');
    expect(resolveProductImageUrl(undefined)).toBe('');
  });

  it('leaves unrelated values untouched', () => {
    expect(resolveProductImageUrl('images/x.png')).toBe('images/x.png');
    expect(resolveProductImageUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(resolveProductImageUrl('//cdn.example.com/x.png')).toBe('//cdn.example.com/x.png');
  });
});
