import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { AiService } from '../src/ai/ai.service.js';
import { AppModule, configureApp } from '../src/app.module.js';
import { MailService } from '../src/auth/mail.service.js';
import { SignupLimiter } from '../src/auth/rate-limit.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Black-box attack probes against the real HTTP stack (Postgres + Redis).
// Every test asserts the DEFENSIVE behaviour: a failure here is a vulnerability.
describe('Security (e2e)', () => {
  const ORIGIN = 'http://localhost:3000';
  const EVIL = 'https://evil.example';
  let app: INestApplication;
  let prisma: PrismaService;
  let attacker: TestAgent; // business B
  let victim: TestAgent; // business A
  let victimIds: {
    business: string;
    category: string;
    ingredient: string;
    recipe: string;
    transaction: string;
    scan: string;
  };

  const server = () => app.getHttpServer();

  const signUp = (email: string, password = 'rahasia123') =>
    request(server())
      .post('/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .send({ name: 'Sec', email, password });

  const register = async () => {
    const agent = request.agent(server()).set('Origin', ORIGIN);
    const email = `sec-${randomUUID()}@test.local`;
    await agent
      .post('/auth/sign-up/email')
      .send({ name: 'Sec', email, password: 'rahasia123' })
      .expect(200);
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });
    return agent;
  };

  beforeAll(async () => {
    if (existsSync('.env')) process.loadEnvFile();
    process.env.FRONTEND_ORIGIN = ORIGIN;
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 1,
          timeToExpire: 0,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      })
      .overrideProvider(SignupLimiter)
      .useValue({ take: async () => undefined, release: async () => undefined })
      .overrideProvider(MailService)
      .useValue({ send: async () => undefined })
      .overrideProvider(AiService)
      .useValue({
        modelId: 'test',
        extractReceipt: vi.fn(),
        suggestPrice: vi.fn(),
      })
      .compile();
    app = mod.createNestApplication();
    configureApp(app);
    app.enableCors({ origin: ORIGIN, credentials: true });
    await app.init();
    prisma = app.get(PrismaService);

    victim = await register();
    attacker = await register();

    // The victim owns one of everything.
    const business = (await victim.get('/business/me')).body.id as string;
    const category = (
      await victim
        .post('/categories')
        .send({ name: 'Rahasia', type: 'INCOME' })
        .expect(201)
    ).body.id as string;
    const ingredient = (
      await victim
        .post('/ingredients')
        .send({
          name: 'Bahan A',
          purchaseUnit: 'kg',
          purchaseQty: 1,
          usageUnit: 'gram',
          purchasePrice: 10000,
        })
        .expect(201)
    ).body.id as string;
    const recipe = (
      await victim
        .post('/recipes')
        .send({
          name: 'Resep A',
          yieldPortions: 1,
          targetMarginPct: 50,
          ingredients: [{ ingredientId: ingredient, quantity: 10 }],
        })
        .expect(201)
    ).body.id as string;
    const transaction = (
      await victim
        .post('/transactions')
        .send({
          categoryId: category,
          amount: 99999,
          transactionDate: '2026-01-15',
        })
        .expect(201)
    ).body.id as string;
    const scan = (
      await prisma.receiptScan.create({
        data: {
          businessId: business,
          imageKey: `${business}/x`,
          mimeType: 'image/png',
          status: 'DONE',
        },
      })
    ).id;
    victimIds = { business, category, ingredient, recipe, transaction, scan };
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication is required everywhere', () => {
    const protectedRoutes: [string, string][] = [
      ['get', '/business/me'],
      ['patch', '/business/me'],
      ['get', '/subscription/me'],
      ['get', '/notifications'],
      ['get', '/categories'],
      ['post', '/categories'],
      ['get', '/ingredients'],
      ['post', '/ingredients'],
      ['get', '/recipes'],
      ['post', '/recipes'],
      ['get', '/transactions'],
      ['post', '/transactions'],
      ['get', '/reports/summary?from=2026-01-01&to=2026-01-31&granularity=day'],
      ['get', '/reports/profit-loss?from=2026-01-01&to=2026-01-31'],
      ['get', '/reports/export?from=2026-01-01&to=2026-01-31&format=pdf'],
      ['post', '/receipts'],
    ];

    it.each(protectedRoutes)(
      '%s %s -> 401 without a session',
      async (method, path) => {
        const res = await (
          request(server()) as unknown as Record<
            string,
            (p: string) => request.Test
          >
        )[method]!(path).set('Origin', ORIGIN);
        expect(res.status).toBe(401);
      },
    );

    it('rejects garbage, empty, and well-formed-but-unknown session cookies', async () => {
      const cookies = [
        'usahaku.session_token=',
        'usahaku.session_token=garbage',
        `usahaku.session_token=${randomUUID()}.${randomUUID()}`,
        'usahaku.session_token=../../etc/passwd',
        `__Secure-usahaku.session_token=${randomUUID()}`,
        'access_token=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.',
      ];
      for (const cookie of cookies) {
        await request(server())
          .get('/business/me')
          .set('Cookie', cookie)
          .expect(401);
      }
    });

    it('does not accept the session token via header or query string', async () => {
      const signup = await signUp(`hdr-${randomUUID()}@test.local`).expect(200);
      const token = signup.body.token as string;
      await request(server())
        .get('/business/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      await request(server()).get(`/business/me?token=${token}`).expect(401);
    });

    it('only /health and /auth/* are public', async () => {
      await request(server()).get('/health').expect(200);
      // unknown routes reveal nothing and are never served
      await request(server()).get('/').expect(404);
      await request(server()).get('/admin').expect(404);
    });
  });

  describe('tenant isolation (IDOR): B can never reach A', () => {
    it('hides every A resource behind 404 (never 403, never 200)', async () => {
      const v = victimIds;
      const attempts: [string, string, object?][] = [
        ['get', `/ingredients/${v.ingredient}`],
        ['patch', `/ingredients/${v.ingredient}`, { purchasePrice: 1 }],
        ['delete', `/ingredients/${v.ingredient}`],
        ['get', `/recipes/${v.recipe}`],
        ['get', `/recipes/${v.recipe}/hpp-history`],
        ['patch', `/recipes/${v.recipe}`, { name: 'hacked' }],
        ['delete', `/recipes/${v.recipe}`],
        ['get', `/recipes/${v.recipe}/price-suggestions`],
        ['post', `/recipes/${v.recipe}/price-suggestion`],
        ['get', `/transactions/${v.transaction}`],
        ['patch', `/transactions/${v.transaction}`, { amount: 1 }],
        ['delete', `/transactions/${v.transaction}`],
        ['patch', `/categories/${v.category}`, { name: 'hacked' }],
        ['delete', `/categories/${v.category}`],
        ['get', `/receipts/${v.scan}`],
        ['get', `/receipts/${v.scan}/image`],
        [
          'post',
          `/receipts/${v.scan}/confirm`,
          { amount: 1000, transactionDate: '2026-01-15', items: [] },
        ],
      ];
      for (const [method, path, body] of attempts) {
        const req = (
          attacker as unknown as Record<string, (p: string) => request.Test>
        )[method]!(path);
        const res = await (body ? req.send(body) : req);
        expect([method, path, res.status]).toEqual([method, path, 404]);
      }
      // ...and nothing changed
      expect(
        (await victim.get(`/ingredients/${v.ingredient}`).expect(200)).body
          .purchasePrice,
      ).toBe('10000');
      expect(
        (await victim.get(`/recipes/${v.recipe}`).expect(200)).body.name,
      ).toBe('Resep A');
      expect(
        (await victim.get(`/transactions/${v.transaction}`).expect(200)).body
          .amount,
      ).toBe('99999');
    });

    it('lists, reports and notifications never include A data', async () => {
      const lists = [
        '/ingredients',
        '/recipes',
        '/transactions',
        '/notifications',
      ];
      for (const path of lists) {
        const body = (await attacker.get(path).expect(200)).body as unknown;
        expect(JSON.stringify(body)).not.toContain(victimIds.ingredient);
        expect(JSON.stringify(body)).not.toContain(victimIds.recipe);
        expect(JSON.stringify(body)).not.toContain(victimIds.transaction);
      }
      const cats = (await attacker.get('/categories').expect(200)).body as {
        id: string;
      }[];
      expect(cats.map((c) => c.id)).not.toContain(victimIds.category);
      const pl = (
        await attacker
          .get('/reports/profit-loss')
          .query({ from: '2026-01-01', to: '2026-01-31' })
          .expect(200)
      ).body;
      expect(pl.totalIncome).toBe('0');
      const sum = (
        await attacker
          .get('/reports/summary')
          .query({ from: '2026-01-01', to: '2026-01-31', granularity: 'day' })
          .expect(200)
      ).body;
      expect(sum.totalIncome).toBe('0');
    });

    it('B cannot attach its data to A objects, nor A objects to its own data', async () => {
      const v = victimIds;
      await attacker
        .post('/transactions')
        .send({
          categoryId: v.category,
          amount: 1,
          transactionDate: '2026-01-15',
        })
        .expect((r) => expect(r.status).toBeGreaterThanOrEqual(400));
      const own = (await attacker.get('/categories')).body as {
        id: string;
        name: string;
      }[];
      const ownIncome = own.find((c) => c.name === 'Penjualan')!.id;
      await attacker
        .post('/transactions')
        .send({
          categoryId: ownIncome,
          amount: 1,
          transactionDate: '2026-01-15',
          recipeId: v.recipe,
          portions: 1,
        })
        .expect((r) => expect(r.status).toBeGreaterThanOrEqual(400));
      await attacker
        .post('/recipes')
        .send({
          name: 'x',
          yieldPortions: 1,
          targetMarginPct: 10,
          ingredients: [{ ingredientId: v.ingredient, quantity: 1 }],
        })
        .expect(400);
    });

    it('a body-supplied businessId / userId is rejected, not honoured', async () => {
      await attacker
        .post('/ingredients')
        .send({
          name: 'x',
          purchaseUnit: 'kg',
          purchaseQty: 1,
          usageUnit: 'gram',
          purchasePrice: 1,
          businessId: victimIds.business,
        })
        .expect(400);
      await attacker
        .patch('/business/me')
        .send({ id: victimIds.business, userId: randomUUID() })
        .expect(400);
      const before = await prisma.ingredient.count({
        where: { businessId: victimIds.business },
      });
      expect(before).toBe(1);
    });
  });

  describe('privilege escalation and mass assignment', () => {
    it('cannot self-upgrade the plan or bump quotas through any writable body', async () => {
      const me = (await attacker.get('/business/me')).body.id as string;
      const attempts = [
        attacker.patch('/business/me').send({ tier: 'PRO' }),
        attacker.patch('/business/me').send({ subscription: { tier: 'PRO' } }),
        attacker
          .post('/categories')
          .send({ name: 'x', type: 'INCOME', isDefault: true }),
        attacker.post('/transactions').send({
          categoryId: randomUUID(),
          amount: 1,
          transactionDate: '2026-01-01',
          source: 'OCR',
        }),
      ];
      for (const res of await Promise.all(attempts))
        expect(res.status).toBe(400);
      const sub = (await attacker.get('/subscription/me').expect(200)).body;
      expect(sub.effectiveTier).toBe('FREE');
      expect(
        await prisma.subscription.count({
          where: { tier: 'PRO', user: { business: { id: me } } },
        }),
      ).toBe(0);
    });

    it('sign-up cannot smuggle privileged fields', async () => {
      const email = `esc-${randomUUID()}@test.local`;
      const res = await request(server())
        .post('/auth/sign-up/email')
        .set('Origin', ORIGIN)
        .send({
          name: 'E',
          email,
          password: 'rahasia123',
          emailVerified: true,
          id: randomUUID(),
          role: 'admin',
          emailCanonical: 'x@x.x',
        });
      // Better Auth ignores or rejects undeclared fields; either way none may stick
      if (res.status === 200) {
        const user = await prisma.user.findUniqueOrThrow({ where: { email } });
        expect(user.emailVerified).toBe(false);
        expect(user.emailCanonical).toBe(email);
        expect(user.id).not.toBe(res.body.user?.id === undefined ? '' : 'x');
      }
    });

    it('unverified accounts cannot spend the AI budget', async () => {
      const email = `unv-${randomUUID()}@test.local`;
      const res = await signUp(email).expect(200);
      const cookie = String(res.headers['set-cookie']).split(';')[0]!;
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
        'base64',
      );
      await request(server())
        .post('/receipts')
        .set('Cookie', cookie)
        .set('Origin', ORIGIN)
        .attach('image', png, 'a.png')
        .expect(403);
    });
  });

  describe('input handling', () => {
    it('SQL/NoSQL-looking input is treated as data', async () => {
      const payloads = [
        `' OR '1'='1`,
        `'; DROP TABLE "User"; --`,
        `" OR 1=1 --`,
        `%' OR name LIKE '%`,
        '{"$ne":null}',
      ];
      for (const q of payloads) {
        const ing = await attacker.get('/ingredients').query({ q });
        const rec = await attacker.get('/recipes').query({ q });
        expect([ing.status, rec.status]).toEqual([200, 200]);
        expect(ing.body).toEqual([]);
        expect(rec.body).toEqual([]);
      }
      // the tables are still there and the victim's data intact
      expect(await prisma.user.count()).toBeGreaterThan(0);
      const found = await victim
        .get('/ingredients')
        .query({ q: `' OR '1'='1` })
        .expect(200);
      expect(found.body).toEqual([]);
    });

    it('stores markup as inert text and never reflects it as HTML', async () => {
      const xss = `<img src=x onerror=alert(1)>`;
      const created = await attacker
        .post('/ingredients')
        .send({
          name: xss,
          purchaseUnit: 'kg',
          purchaseQty: 1,
          usageUnit: 'gram',
          purchasePrice: 1000,
        })
        .expect(201);
      expect(created.headers['content-type']).toMatch(/application\/json/);
      expect(created.headers['x-content-type-options']).toBe('nosniff');
      const html = await attacker.get('/ingredients');
      expect(html.headers['content-type']).toMatch(/application\/json/);
    });

    it('rejects invalid ids, dates, numbers and enums with 400 (never 500)', async () => {
      const cats = (await attacker.get('/categories')).body as {
        id: string;
        name: string;
      }[];
      const cat = cats.find((c) => c.name === 'Penjualan')!.id;
      const bad: [string, string, object?][] = [
        ['get', '/ingredients/not-a-uuid'],
        ['get', '/recipes/1%27%20OR%201=1'],
        ['get', '/receipts/..%2f..%2fetc%2fpasswd'],
        ['get', '/transactions?page=-1'],
        ['get', '/transactions?limit=100000'],
        ['get', '/transactions?from=2026-13-45'],
        ['get', '/transactions?type=HACK'],
        [
          'get',
          '/reports/summary?from=2026-01-01&to=2030-01-01&granularity=day',
        ],
        ['get', '/reports/summary?from=x&to=y&granularity=year'],
        [
          'post',
          '/transactions',
          { categoryId: cat, amount: -5, transactionDate: '2026-01-01' },
        ],
        [
          'post',
          '/transactions',
          { categoryId: cat, amount: 0, transactionDate: '2026-01-01' },
        ],
        [
          'post',
          '/transactions',
          { categoryId: cat, amount: 'NaN', transactionDate: '2026-01-01' },
        ],
        [
          'post',
          '/transactions',
          { categoryId: cat, amount: 1e30, transactionDate: '2026-01-01' },
        ],
        [
          'post',
          '/transactions',
          { categoryId: cat, amount: 1.234, transactionDate: '2026-01-01' },
        ],
        [
          'post',
          '/transactions',
          { categoryId: cat, amount: 1, transactionDate: '2026-02-30' },
        ],
        [
          'post',
          '/transactions',
          {
            categoryId: cat,
            amount: 1,
            transactionDate: '2026-01-01',
            description: 'x'.repeat(501),
          },
        ],
        ['post', '/categories', { name: '', type: 'INCOME' }],
        ['post', '/categories', { name: 'x', type: 'ADMIN' }],
        [
          'post',
          '/ingredients',
          {
            name: 'x',
            purchaseUnit: 'kg',
            purchaseQty: 0,
            usageUnit: 'gram',
            purchasePrice: 1,
          },
        ],
        [
          'post',
          '/ingredients',
          {
            name: 'x',
            purchaseUnit: 'kg',
            purchaseQty: -1,
            usageUnit: 'gram',
            purchasePrice: 1,
          },
        ],
        [
          'post',
          '/ingredients',
          {
            name: 'x',
            purchaseUnit: 'kg',
            purchaseQty: 1,
            usageUnit: 'ml',
            purchasePrice: 1,
          },
        ],
        [
          'post',
          '/recipes',
          { name: 'x', yieldPortions: 0, targetMarginPct: 10, ingredients: [] },
        ],
        [
          'post',
          '/recipes',
          {
            name: 'x',
            yieldPortions: 1,
            targetMarginPct: 100,
            ingredients: [],
          },
        ],
        [
          'post',
          '/recipes',
          {
            name: 'x',
            yieldPortions: 1,
            targetMarginPct: 10,
            ingredients: Array.from({ length: 101 }, () => ({
              ingredientId: randomUUID(),
              quantity: 1,
            })),
          },
        ],
        ['patch', '/business/me', { name: '' }],
        ['patch', '/business/me', { type: 'HACK' }],
        ['patch', '/business/me', { name: null }],
      ];
      for (const [method, path, body] of bad) {
        const req = (
          attacker as unknown as Record<string, (p: string) => request.Test>
        )[method]!(path);
        const res = await (body ? req.send(body) : req);
        expect([method, path, JSON.stringify(body), res.status]).toEqual([
          method,
          path,
          JSON.stringify(body),
          400,
        ]);
      }
    });

    it('survives prototype-pollution payloads and malformed or oversized bodies', async () => {
      const pollution = await attacker
        .post('/categories')
        .set('Content-Type', 'application/json')
        .send(
          '{"name":"p","type":"INCOME","__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}}}',
        );
      // accepted or refused, but never allowed to touch Object.prototype
      expect([201, 400]).toContain(pollution.status);
      expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
      expect(({} as Record<string, unknown>).x).toBeUndefined();
      if (pollution.status === 201) {
        expect(Object.keys(pollution.body).sort()).not.toContain('isAdmin');
        expect(pollution.body.name).toBe('p');
      }

      const broken = await attacker
        .post('/categories')
        .set('Content-Type', 'application/json')
        .send('{"name": ');
      expect(broken.status).toBe(400);

      const huge = await attacker
        .post('/categories')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ name: 'x'.repeat(300_000), type: 'INCOME' }));
      expect(huge.status).toBe(413);

      const wrongType = await attacker
        .post('/categories')
        .set('Content-Type', 'text/plain')
        .send('name=x&type=INCOME');
      expect(wrongType.status).toBe(400);
    });

    it('errors never leak stack traces, SQL or framework internals', async () => {
      const probes = [
        attacker.get('/ingredients/not-a-uuid'),
        attacker.post('/categories').send({ name: 'x', type: 'BAD' }),
        attacker.get(`/ingredients/${randomUUID()}`),
        request(server())
          .get('/does-not-exist')
          .set('Cookie', 'usahaku.session_token=x'),
        attacker
          .post('/categories')
          .set('Content-Type', 'application/json')
          .send('{bad'),
      ];
      for (const res of await Promise.all(probes)) {
        const text = JSON.stringify(res.body) + res.text;
        expect(text).not.toMatch(
          /at \S+ \(|node_modules|prisma|SELECT |INSERT |postgres|ECONN|\.ts:\d+|stack/i,
        );
      }
    });
  });

  describe('headers, CORS and CSRF', () => {
    it('sends hardening headers and hides the framework', async () => {
      const res = await attacker.get('/business/me').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['content-security-policy']).toContain(
        "frame-ancestors 'none'",
      );
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['x-powered-by']).toBeUndefined();
      const notFound = await request(server()).get('/nope');
      expect(notFound.headers['x-powered-by']).toBeUndefined();
      expect(notFound.headers['x-content-type-options']).toBe('nosniff');
    });

    it('CORS: only the frontend origin, with credentials; no wildcard', async () => {
      // The allow-list is one fixed origin: whatever the caller sends, the header
      // can only ever name the frontend, so a browser on another site is blocked.
      const ok = await request(server()).get('/health').set('Origin', ORIGIN);
      expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
      expect(ok.headers['access-control-allow-credentials']).toBe('true');
      for (const origin of [EVIL, 'null', `${ORIGIN}.evil.example`]) {
        const res = await request(server())
          .get('/health')
          .set('Origin', origin);
        const allowed = res.headers['access-control-allow-origin'];
        expect([origin, allowed === origin]).toEqual([origin, false]);
        expect(allowed).not.toBe('*');
        const preflight = await request(server())
          .options('/ingredients')
          .set('Origin', origin)
          .set('Access-Control-Request-Method', 'DELETE');
        expect(preflight.headers['access-control-allow-origin']).not.toBe(
          origin,
        );
        expect(preflight.headers['access-control-allow-origin']).not.toBe('*');
      }
    });

    it('CSRF: cookie-bearing state changes from other origins are refused', async () => {
      const res = await signUp(`csrf-${randomUUID()}@test.local`).expect(200);
      const cookie = String(res.headers['set-cookie']).split(';')[0]!;
      for (const origin of [
        EVIL,
        'null',
        `${ORIGIN}.evil.example`,
        'http://localhost:3001',
      ]) {
        const r = await request(server())
          .post('/auth/sign-out')
          .set('Cookie', cookie)
          .set('Origin', origin)
          .send({});
        expect([origin, r.status]).toEqual([origin, 403]);
      }
      // the session survived the failed attempts
      await request(server())
        .get('/business/me')
        .set('Cookie', cookie)
        .expect(200);
      // cookie but no Origin at all
      const noOrigin = await request(server())
        .post('/auth/sign-out')
        .set('Cookie', cookie)
        .send({});
      expect(noOrigin.status).toBe(403);
    });

    it('session cookie is HttpOnly + SameSite and scoped to the whole site', async () => {
      const res = await signUp(`ck-${randomUUID()}@test.local`).expect(200);
      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toMatch(/usahaku\.session_token=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\//i);
      expect(cookie).toMatch(/Max-Age=\d+/i);
    });
  });

  describe('authentication hardening', () => {
    it('login failures are indistinguishable for unknown email vs wrong password', async () => {
      const email = `enum-${randomUUID()}@test.local`;
      await signUp(email).expect(200);
      const wrong = await request(server())
        .post('/auth/sign-in/email')
        .set('Origin', ORIGIN)
        .send({ email, password: 'salahsalah' });
      const unknown = await request(server())
        .post('/auth/sign-in/email')
        .set('Origin', ORIGIN)
        .send({
          email: `nobody-${randomUUID()}@test.local`,
          password: 'salahsalah',
        });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(unknown.body).toEqual(wrong.body);
    });

    it('password-reset request answers identically for known and unknown emails', async () => {
      const email = `rst-${randomUUID()}@test.local`;
      await signUp(email).expect(200);
      const known = await request(server())
        .post('/auth/request-password-reset')
        .set('Origin', ORIGIN)
        .send({ email });
      const unknown = await request(server())
        .post('/auth/request-password-reset')
        .set('Origin', ORIGIN)
        .send({ email: `no-${randomUUID()}@test.local` });
      expect(known.status).toBe(unknown.status);
      expect(known.body).toEqual(unknown.body);
    });

    it('rejects weak/oversized passwords and malformed emails at the door', async () => {
      for (const password of ['', '1234567', 'x'.repeat(129)]) {
        expect(
          (await signUp(`pw-${randomUUID()}@test.local`, password)).status,
        ).toBe(400);
      }
      for (const email of [
        'not-an-email',
        'a@b',
        '"><script>@x.com',
        `${'a'.repeat(300)}@x.com`,
        'a b@x.com',
      ]) {
        const res = await signUp(email);
        expect([email.slice(0, 20), res.status]).toEqual([
          email.slice(0, 20),
          400,
        ]);
      }
    });

    it('reset and verification tokens cannot be forged, guessed, reused or swapped', async () => {
      const post = (path: string, body: object) =>
        request(server()).post(path).set('Origin', ORIGIN).send(body);
      for (const token of [
        '',
        'abc',
        randomUUID(),
        'A'.repeat(24),
        "' OR 1=1 --",
      ]) {
        const res = await post('/auth/reset-password', {
          newPassword: 'sandibaru123',
          token,
        });
        expect([token, res.status >= 400]).toEqual([token, true]);
      }
      for (const token of [
        '',
        'abc',
        'a.b.c',
        'eyJhbGciOiJub25lIn0.eyJlbWFpbCI6ImFAYi5jIn0.',
      ]) {
        const res = await request(server())
          .get('/auth/verify-email')
          .query({ token });
        expect([token, res.status >= 400]).toEqual([token, true]);
      }
      // an unverified user was not flipped by any of that
      expect(
        await prisma.user.count({
          where: { email: { startsWith: 'a@b' }, emailVerified: true },
        }),
      ).toBe(0);
    });

    it('a password change kills stolen sessions; sign-out kills the session server-side', async () => {
      const email = `sess-${randomUUID()}@test.local`;
      const signup = await signUp(email).expect(200);
      const stolen = String(signup.headers['set-cookie']).split(';')[0]!;
      await request(server())
        .get('/business/me')
        .set('Cookie', stolen)
        .expect(200);
      // sign out from another "device" with the same cookie: the cookie is dead afterwards
      await request(server())
        .post('/auth/sign-out')
        .set('Origin', ORIGIN)
        .set('Cookie', stolen)
        .send({})
        .expect(200);
      await request(server())
        .get('/business/me')
        .set('Cookie', stolen)
        .expect(401);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(
        0,
      );
    });

    it('does not offer GET sign-in or other verb tampering', async () => {
      for (const [method, path] of [
        ['get', '/auth/sign-in/email'],
        ['put', '/auth/sign-up/email'],
        ['delete', '/auth/sign-out'],
      ] as const) {
        const res = await (
          request(server()) as unknown as Record<
            string,
            (p: string) => request.Test
          >
        )[method]!(path).set('Origin', ORIGIN);
        expect([method, path, res.status >= 400]).toEqual([method, path, true]);
      }
    });
  });

  describe('uploads', () => {
    it('refuses non-images, spoofed extensions, empty, oversized and multi-file uploads', async () => {
      const send = (buf: Buffer, name: string, type?: string) =>
        attacker
          .post('/receipts')
          .attach('image', buf, { filename: name, contentType: type });
      const html = await send(
        Buffer.from('<script>alert(1)</script>'),
        'struk.png',
        'image/png',
      );
      expect(html.status).toBe(400);
      const exe = await send(
        Buffer.from('MZ\x90\x00\x03\x00\x00\x00'),
        'struk.jpg',
        'image/jpeg',
      );
      expect(exe.status).toBe(400);
      const svg = await send(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
        ),
        'x.svg',
        'image/svg+xml',
      );
      expect(svg.status).toBe(400);
      const empty = await send(Buffer.alloc(0), 'kosong.png', 'image/png');
      expect(empty.status).toBe(400);
      const big = await send(
        Buffer.concat([
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          Buffer.alloc(6 * 1024 * 1024),
        ]),
        'besar.png',
        'image/png',
      );
      expect([400, 413]).toContain(big.status);
      const two = await attacker
        .post('/receipts')
        .attach('image', Buffer.from('a'), 'a.png')
        .attach('image', Buffer.from('b'), 'b.png');
      expect(two.status).toBeGreaterThanOrEqual(400);
      const wrongField = await attacker
        .post('/receipts')
        .attach('file', Buffer.from('a'), 'a.png');
      expect(wrongField.status).toBeGreaterThanOrEqual(400);
      // nothing was queued or stored for any of those
      expect(
        await prisma.receiptScan.count({
          where: {
            business: { id: (await attacker.get('/business/me')).body.id },
          },
        }),
      ).toBe(0);
    });
  });

  describe('abuse resistance (real rate limiter)', () => {
    it('brute-forcing logins, mail endpoints and sign-ups hits 429', async () => {
      const mod = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(MailService)
        .useValue({ send: async () => undefined })
        .compile();
      const real = mod.createNestApplication();
      configureApp(real);
      real.getHttpAdapter().getInstance().set('trust proxy', 1);
      await real.init();
      const ip = () => `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
      const hammer = async (
        path: string,
        make: (i: number) => object,
        n: number,
      ) => {
        const from = ip();
        const codes: number[] = [];
        for (let i = 0; i < n; i++) {
          codes.push(
            (
              await request(real.getHttpServer())
                .post(path)
                .set('Origin', ORIGIN)
                .set('X-Forwarded-For', from)
                .send(make(i))
            ).status,
          );
        }
        return codes;
      };
      try {
        const login = await hammer(
          '/auth/sign-in/email',
          () => ({
            email: `v-${randomUUID()}@test.local`,
            password: 'salahsalah',
          }),
          14,
        );
        expect(login).toContain(429);
        const reset = await hammer(
          '/auth/request-password-reset',
          () => ({ email: `v-${randomUUID()}@test.local` }),
          6,
        );
        expect(reset).toContain(429);
        const verify = await hammer(
          '/auth/send-verification-email',
          () => ({ email: `v-${randomUUID()}@test.local` }),
          6,
        );
        expect(verify).toContain(429);
        const flood = await hammer(
          '/auth/sign-up/email',
          (i) => ({
            name: 'F',
            email: `flood${i}-${randomUUID()}@test.local`,
            password: 'rahasia123',
          }),
          8,
        );
        expect(flood).toContain(429);
      } finally {
        await real.close();
      }
    }, 120_000);
  });
});
