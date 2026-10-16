import { canonicalEmail, isDisposableEmail } from './email.js';

describe('canonicalEmail', () => {
  it('collapses gmail dots, +tags and googlemail', () => {
    expect(canonicalEmail('Foo.Bar+x@Gmail.com')).toBe('foobar@gmail.com');
    expect(canonicalEmail('foobar@googlemail.com')).toBe('foobar@gmail.com');
  });

  it('keeps dots on other domains but drops +tags', () => {
    expect(canonicalEmail('a.b+c@kantor.co.id')).toBe('a.b@kantor.co.id');
  });
});

describe('isDisposableEmail', () => {
  it('flags throwaway domains only', () => {
    expect(isDisposableEmail('x@Mailinator.com')).toBe(true);
    expect(isDisposableEmail('x@gmail.com')).toBe(false);
  });
});
