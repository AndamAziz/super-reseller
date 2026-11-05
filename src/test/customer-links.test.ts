import { describe, expect, it } from 'vitest';
import { customerLinks } from '../lib/customer-links';

const line = { username: 'customer', password: 'p& ss', custom_host: null };
describe('customer delivery links', () => {
  it('defaults to the published provider, not the preview host', () => {
    expect(customerLinks(line).provider).toBe('https://re.andam.uk/api/public');
    expect(customerLinks(line).m3u).toBe('https://re.andam.uk/api/public/playlist?username=customer&password=p%26+ss');
  });
  it('does not duplicate the public prefix on a supplied provider host', () => {
    expect(customerLinks({ ...line, custom_host: 'https://super-reseller.lovable.app/api/public/' }).provider).toBe('https://re.andam.uk/api/public');
  });
  it('provides a distinct authenticated combined GitHub catalogue', () => {
    expect(customerLinks(line).content).toBe('https://re.andam.uk/api/public/content?username=customer&password=p%26+ss&provider_key=github');
  });
});