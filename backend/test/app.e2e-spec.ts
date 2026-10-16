import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { AiBudget, AiService } from '../src/ai/ai.service.js';
import { AppModule, configureApp } from '../src/app.module.js';
import { SignupLimiter } from '../src/auth/rate-limit.js';
import { MaintenanceService } from '../src/maintenance/maintenance.module.js';
import { StorageService } from '../src/ocr/storage.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { currentPeriod } from '../src/subscription/subscription.module.js';

// Runs against the dev Postgres (docker/docker-compose.yml) with unique emails.
describe('UsahaKu API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestAgent; // business A
  let b: TestAgent; // business B
  const today = new Date().toISOString().slice(0, 10);

  // AI is mocked: tests cover our pipeline (upload -> S3 -> queue -> worker
  // -> confirm), not the model. Redis + S3 are the real dev containers.
  const ai = {
    modelId: 'test-model',
    extractReceipt: vi.fn(),
    suggestPrice: vi.fn(),
  };

  // Better Auth rejects cookie-bearing POSTs without a trusted Origin (CSRF).
  const ORIGIN = 'http://localhost:3000';
  const signUp = (
    server: ReturnType<INestApplication['getHttpServer']>,
    body: Record<string, unknown>,
    headers: Record<string, string> = {},
  ) =>
    request(server)
      .post('/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .set(headers)
      .send(body);

  const register = async () => {
    const agent = request.agent(app.getHttpServer()).set('Origin', ORIGIN);
    await agent
      .post('/auth/sign-up/email')
      .send({
        name: 'Tester',
        email: `t-${randomUUID()}@test.local`,
        password: 'rahasia123',
      })
      .expect(200);
    return agent;
  };

  beforeAll(async () => {
    if (existsSync('.env')) process.loadEnvFile();
    process.env.FRONTEND_ORIGIN = ORIGIN;
    // Throttling is covered by its own app below; disable it for the rest.
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
      .overrideProvider(AiService)
      .useValue(ai)
      .compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    a = await register();
    b = await register();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('auth', () => {
    it('sets an httpOnly session cookie on sign-up', async () => {
      const res = await signUp(app.getHttpServer(), {
        name: 'X',
        email: `x-${randomUUID()}@test.local`,
        password: 'rahasia123',
      }).expect(200);
      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toMatch(/usahaku\.session_token=.+HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/i);
    });

    it('rejects requests without / with a forged cookie', async () => {
      await request(app.getHttpServer()).get('/business/me').expect(401);
      await request(app.getHttpServer())
        .get('/business/me')
        .set('Cookie', 'usahaku.session_token=forged.token.value')
        .expect(401);
    });

    it('scopes the session cookie to COOKIE_DOMAIN for subdomain deployments', async () => {
      process.env.COOKIE_DOMAIN = '.usahaku.test';
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
        .useValue({
          take: async () => undefined,
          release: async () => undefined,
        })
        .compile();
      delete process.env.COOKIE_DOMAIN;
      const sub = mod.createNestApplication();
      configureApp(sub);
      await sub.init();
      try {
        const res = await signUp(sub.getHttpServer(), {
          name: 'D',
          email: `dom-${randomUUID()}@test.local`,
          password: 'rahasia123',
        }).expect(200);
        expect(String(res.headers['set-cookie'])).toMatch(
          /usahaku\.session_token=.+Domain=\.usahaku\.test/i,
        );
      } finally {
        await sub.close();
      }
    });

    it('exposes a public health check', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('sign-out revokes the session: a copied cookie stops working', async () => {
      const res = await signUp(app.getHttpServer(), {
        name: 'L',
        email: `l-${randomUUID()}@test.local`,
        password: 'rahasia123',
      }).expect(200);
      const cookie = String(res.headers['set-cookie']).split(';')[0];
      const me = await request(app.getHttpServer())
        .get('/business/me')
        .set('Cookie', cookie)
        .expect(200);
      expect(me.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
      });
      expect(me.headers['x-powered-by']).toBeUndefined();
      await request(app.getHttpServer())
        .post('/auth/sign-out')
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .send({})
        .expect(200);
      await request(app.getHttpServer())
        .get('/business/me')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('rejects cookie-bearing POST from an untrusted origin (CSRF)', async () => {
      const res = await signUp(app.getHttpServer(), {
        name: 'C',
        email: `c-${randomUUID()}@test.local`,
        password: 'rahasia123',
      }).expect(200);
      const cookie = String(res.headers['set-cookie']).split(';')[0];
      await request(app.getHttpServer())
        .post('/auth/sign-out')
        .set('Origin', 'https://evil.example')
        .set('Cookie', cookie)
        .send({})
        .expect(403);
    });

    it('rejects duplicate email and wrong password', async () => {
      const email = `d-${randomUUID()}@test.local`;
      const body = { name: 'D', email, password: 'rahasia123' };
      const server = app.getHttpServer();
      await signUp(server, body).expect(200);
      await signUp(server, body).expect(422);
      await request(server)
        .post('/auth/sign-in/email')
        .set('Origin', ORIGIN)
        .send({ email, password: 'salahsalah' })
        .expect(401);
      await request(server)
        .post('/auth/sign-in/email')
        .set('Origin', ORIGIN)
        .send({ email: email.toUpperCase(), password: 'rahasia123' })
        .expect(200);
    });

    it('still verifies password hashes of accounts created before Better Auth', async () => {
      const email = `legacy-${randomUUID()}@test.local`;
      const argon2 = await import('argon2');
      // Same shape as the migration: credential accountId = user id.
      const id = randomUUID();
      await prisma.user.create({
        data: {
          id,
          email,
          emailCanonical: email,
          name: 'Legacy',
          accounts: {
            create: {
              accountId: id,
              providerId: 'credential',
              password: await argon2.hash('rahasia123'),
            },
          },
          subscription: { create: {} },
          business: { create: { name: 'Usaha Lama' } },
        },
      });
      const agent = request.agent(app.getHttpServer()).set('Origin', ORIGIN);
      await agent
        .post('/auth/sign-in/email')
        .send({ email, password: 'rahasia123' })
        .expect(200);
      const me = await agent.get('/business/me').expect(200);
      expect(me.body.name).toBe('Usaha Lama');
    });

    it('validates input and strips unknown fields', async () => {
      await signUp(app.getHttpServer(), {
        name: 'A',
        email: 'bukan-email',
        password: '123',
      }).expect(400);
      await a.patch('/business/me').send({ userId: randomUUID() }).expect(400);
    });

    it('creates business with FREE tier and default categories', async () => {
      const me = await a.get('/business/me').expect(200);
      expect(me.body.name).toBe('Usaha Tester');
      const sub = await a.get('/subscription/me').expect(200);
      expect(sub.body.effectiveTier).toBe('FREE');
      const cats = await a.get('/categories').expect(200);
      expect(cats.body.map((c: { name: string }) => c.name)).toEqual(
        expect.arrayContaining([
          'Penjualan',
          'Belanja Bahan',
          'Gaji',
          'Sewa',
          'Listrik & Gas',
          'Lain-lain',
        ]),
      );
      const patched = await a
        .patch('/business/me')
        .send({ name: 'Kopi Senja', type: 'KEDAI_MINUMAN', city: 'Bandung' })
        .expect(200);
      expect(patched.body).toMatchObject({
        name: 'Kopi Senja',
        type: 'KEDAI_MINUMAN',
      });
    });
  });

  describe('costing: ingredient -> recipe HPP', () => {
    let sugarId: string;
    let milkId: string;
    let recipeId: string;

    it('computes pricePerUsageUnit and rejects incompatible units', async () => {
      const sugar = await a
        .post('/ingredients')
        .send({
          name: 'Gula',
          purchaseUnit: 'kg',
          purchaseQty: 1,
          usageUnit: 'gram',
          purchasePrice: 15000,
        })
        .expect(201);
      expect(sugar.body.pricePerUsageUnit).toBe('15');
      sugarId = sugar.body.id;

      const milk = await a
        .post('/ingredients')
        .send({
          name: 'Susu',
          purchaseUnit: 'liter',
          purchaseQty: 1,
          usageUnit: 'ml',
          purchasePrice: 20000,
        })
        .expect(201);
      milkId = milk.body.id;

      await a
        .post('/ingredients')
        .send({
          name: 'X',
          purchaseUnit: 'kg',
          purchaseQty: 1,
          usageUnit: 'ml',
          purchasePrice: 1,
        })
        .expect(400);
    });

    it('creates recipe with HPP, recommended price and first snapshot', async () => {
      const res = await a
        .post('/recipes')
        .send({
          name: 'Es Kopi Susu',
          yieldPortions: 10,
          targetMarginPct: 60,
          ingredients: [
            { ingredientId: sugarId, quantity: 200 }, // 3.000
            { ingredientId: milkId, quantity: 1000 }, // 20.000
          ],
          overheads: [{ name: 'Kemasan', costPerPortion: 1500 }],
        })
        .expect(201);
      recipeId = res.body.id;
      // 23.000 / 10 + 1.500 = 3.800 ; 3.800 / 0.4 = 9.500
      expect(res.body.currentHpp).toBe('3800');
      expect(res.body.recommendedPrice).toBe('9500');
      const hist = await a.get(`/recipes/${recipeId}/hpp-history`).expect(200);
      expect(hist.body).toHaveLength(1);
      expect(hist.body[0].trigger).toBe('RECIPE_EDIT');
    });

    it('price change recalculates recipe HPP + PRICE_CHANGE snapshot + price log', async () => {
      await a
        .patch(`/ingredients/${milkId}`)
        .send({ purchasePrice: 30000 })
        .expect(200);
      const r = await a.get(`/recipes/${recipeId}`).expect(200);
      // (3.000 + 30.000) / 10 + 1.500 = 4.800
      expect(r.body.currentHpp).toBe('4800');
      const hist = await a.get(`/recipes/${recipeId}/hpp-history`).expect(200);
      expect(hist.body.map((h: { trigger: string }) => h.trigger)).toEqual([
        'RECIPE_EDIT',
        'PRICE_CHANGE',
      ]);
      const milk = await a.get(`/ingredients/${milkId}`).expect(200);
      expect(milk.body.priceLogs).toHaveLength(2);
    });

    it('rejects null on required fields and numeric overflow with 400, not 500', async () => {
      await a
        .patch(`/recipes/${recipeId}`)
        .send({ yieldPortions: null })
        .expect(400);
      await a.patch(`/recipes/${recipeId}`).send({ name: null }).expect(400);
      await a
        .patch(`/ingredients/${milkId}`)
        .send({ purchasePrice: null })
        .expect(400);
      await a.patch('/business/me').send({ name: null }).expect(400);
      // 1e12 per 0.001 gram overflows Decimal(14,4) pricePerUsageUnit
      await a
        .post('/ingredients')
        .send({
          name: 'Mahal',
          purchaseUnit: 'pack',
          purchaseQty: 0.001,
          usageUnit: 'gram',
          purchasePrice: 999_999_999_999,
        })
        .expect(400);
    });

    it('refuses to delete an ingredient used by a recipe (409)', async () => {
      await a.delete(`/ingredients/${milkId}`).expect(409);
    });

    it('scopes by businessId: B cannot see/modify/use A data', async () => {
      await b.get(`/ingredients/${milkId}`).expect(404);
      await b
        .patch(`/ingredients/${milkId}`)
        .send({ purchasePrice: 1 })
        .expect(404);
      await b.delete(`/ingredients/${milkId}`).expect(404);
      await b.get(`/recipes/${recipeId}`).expect(404);
      await b.get(`/recipes/${recipeId}/hpp-history`).expect(404);
      await b.delete(`/recipes/${recipeId}`).expect(404);
      expect((await b.get('/ingredients').expect(200)).body).toHaveLength(0);
      // B cannot reference A's ingredient in its own recipe
      await b
        .post('/recipes')
        .send({
          name: 'Curang',
          yieldPortions: 1,
          targetMarginPct: 10,
          ingredients: [{ ingredientId: milkId, quantity: 1 }],
        })
        .expect(400);
    });

    it('enforces FREE recipe limit (402)', async () => {
      const agent = await register();
      const recipe = { yieldPortions: 1, targetMarginPct: 50, ingredients: [] };
      for (let i = 0; i < 10; i++) {
        await agent
          .post('/recipes')
          .send({ ...recipe, name: `R${i}` })
          .expect(201);
      }
      await agent
        .post('/recipes')
        .send({ ...recipe, name: 'R10' })
        .expect(402);
    });
  });

  describe('finance', () => {
    let incomeCat: string;
    let expenseCat: string;

    beforeAll(async () => {
      const cats = (await a.get('/categories').expect(200)).body as {
        id: string;
        name: string;
      }[];
      incomeCat = cats.find((c) => c.name === 'Penjualan')!.id;
      expenseCat = cats.find((c) => c.name === 'Belanja Bahan')!.id;
    });

    it('derives type from category, keeps decimal precision', async () => {
      const t = await a
        .post('/transactions')
        .send({
          categoryId: incomeCat,
          amount: 150000.1,
          transactionDate: today,
        })
        .expect(201);
      expect(t.body).toMatchObject({
        type: 'INCOME',
        amount: '150000.1',
        source: 'MANUAL',
      });
      await a
        .post('/transactions')
        .send({
          categoryId: expenseCat,
          amount: 50000.2,
          transactionDate: today,
          description: 'Belanja pasar',
        })
        .expect(201);
      await a
        .post('/transactions')
        .send({ categoryId: incomeCat, amount: 1.001, transactionDate: today })
        .expect(400);
    });

    it('lists with filter + pagination, scoped', async () => {
      const list = await a
        .get('/transactions')
        .query({ type: 'INCOME', limit: 1 })
        .expect(200);
      expect(list.body).toMatchObject({ total: 1, page: 1, limit: 1 });
      expect((await b.get('/transactions').expect(200)).body.total).toBe(0);
      await b
        .post('/transactions')
        .send({ categoryId: incomeCat, amount: 1, transactionDate: today })
        .expect(400);
    });

    it('summary and profit-loss sum correctly', async () => {
      const s = await a
        .get('/reports/summary')
        .query({ from: today, to: today })
        .expect(200);
      expect(s.body).toMatchObject({
        totalIncome: '150000.1',
        totalExpense: '50000.2',
        balance: '99999.9',
      });
      const pl = await a
        .get('/reports/profit-loss')
        .query({ from: today, to: today })
        .expect(200);
      expect(pl.body.netProfit).toBe('99999.9');
      const empty = await b
        .get('/reports/summary')
        .query({ from: today, to: today })
        .expect(200);
      expect(empty.body.totalIncome).toBe('0');
      await a
        .get('/reports/summary')
        .query({ from: today, to: '2000-01-01' })
        .expect(400);
    });

    it('exports PDF on FREE, blocks Excel (402)', async () => {
      const pdf = await a
        .get('/reports/export')
        .query({ from: today, to: today, format: 'pdf' })
        .buffer(true)
        .expect(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      await a
        .get('/reports/export')
        .query({ from: today, to: today, format: 'xlsx' })
        .expect(402);
    });

    it('exports Excel on PRO', async () => {
      const agent = await register();
      const me = (await agent.get('/business/me')).body as { id: string };
      await prisma.subscription.updateMany({
        where: { user: { business: { id: me.id } } },
        data: { tier: 'PRO' },
      });
      const xlsx = await agent
        .get('/reports/export')
        .query({ from: today, to: today, format: 'xlsx' })
        .buffer(true)
        .expect(200);
      expect(xlsx.headers['content-type']).toContain('spreadsheetml');
      expect((await agent.get('/subscription/me')).body.effectiveTier).toBe(
        'PRO',
      );
    });

    it('enforces FREE monthly transaction quota (402), atomically', async () => {
      const me = (await a.get('/business/me')).body as { id: string };
      await prisma.usageCounter.update({
        where: {
          businessId_period: { businessId: me.id, period: currentPeriod() },
        },
        data: { transactionCount: 100 },
      });
      await a
        .post('/transactions')
        .send({ categoryId: incomeCat, amount: 1, transactionDate: today })
        .expect(402);
      const counter = await prisma.usageCounter.findUniqueOrThrow({
        where: {
          businessId_period: { businessId: me.id, period: currentPeriod() },
        },
      });
      expect(counter.transactionCount).toBe(100); // rolled back
    });

    it('protects default categories and categories in use', async () => {
      await a.delete(`/categories/${incomeCat}`).expect(400);
      const c = await a
        .post('/categories')
        .send({ name: 'Catering', type: 'INCOME' })
        .expect(201);
      await a
        .post('/categories')
        .send({ name: 'Catering', type: 'INCOME' })
        .expect(409);
      await a.delete(`/categories/${c.body.id}`).expect(204);
    });
  });

  describe('settings, menu sales, notifications', () => {
    let s: TestAgent;
    let recipeId: string;
    let incomeCat: string;
    let expenseCat: string;
    const yesterday = new Date(Date.now() - 86_400_000)
      .toISOString()
      .slice(0, 10);

    beforeAll(async () => {
      s = await register();
      const cats = (await s.get('/categories').expect(200)).body as {
        id: string;
        name: string;
      }[];
      incomeCat = cats.find((c) => c.name === 'Penjualan')!.id;
      expenseCat = cats.find((c) => c.name === 'Belanja Bahan')!.id;
      const ing = await s
        .post('/ingredients')
        .send({
          name: 'Kopi',
          purchaseUnit: 'kg',
          purchaseQty: 1,
          usageUnit: 'gram',
          purchasePrice: 100000,
        })
        .expect(201);
      const r = await s
        .post('/recipes')
        .send({
          name: 'Kopi Hitam',
          category: ' Minuman ',
          yieldPortions: 10,
          targetMarginPct: 50,
          sellingPrice: 1000, // below HPP 2.000 -> loss notification
          ingredients: [{ ingredientId: ing.body.id, quantity: 200 }],
        })
        .expect(201);
      recipeId = r.body.id;
      expect(r.body.category).toBe('Minuman');
      await s
        .patch(`/ingredients/${ing.body.id}`)
        .send({ purchasePrice: 110000 })
        .expect(200);
    });

    it('stores daily profit target + branch label; "" / null clear them', async () => {
      const res = await s
        .patch('/business/me')
        .send({ dailyProfitTarget: 600000.5, branchLabel: 'Cabang Utama' })
        .expect(200);
      expect(res.body).toMatchObject({
        dailyProfitTarget: '600000.5',
        branchLabel: 'Cabang Utama',
      });
      await s
        .patch('/business/me')
        .send({ dailyProfitTarget: 1.001 })
        .expect(400);
      const cleared = await s
        .patch('/business/me')
        .send({ dailyProfitTarget: null, branchLabel: '' })
        .expect(200);
      expect(cleared.body).toMatchObject({
        dailyProfitTarget: null,
        branchLabel: null,
      });
    });

    it('links INCOME entries to a menu; validates portions, type and scope', async () => {
      const sale = { categoryId: incomeCat, amount: 30000, recipeId };
      const t = await s
        .post('/transactions')
        .send({ ...sale, portions: 3, transactionDate: today })
        .expect(201);
      expect(t.body).toMatchObject({
        portions: 3,
        recipe: { id: recipeId, name: 'Kopi Hitam' },
      });
      await s
        .post('/transactions')
        .send({ ...sale, portions: 5, transactionDate: yesterday })
        .expect(201);
      await s
        .post('/transactions')
        .send({ ...sale, transactionDate: today }) // portions missing
        .expect(400);
      await s
        .post('/transactions')
        .send({
          ...sale,
          categoryId: expenseCat,
          portions: 1,
          transactionDate: today,
        })
        .expect(400);
      // B cannot sell A's menu
      const bCats = (await b.get('/categories').expect(200)).body as {
        id: string;
        name: string;
      }[];
      await b
        .post('/transactions')
        .send({
          ...sale,
          categoryId: bCats.find((c) => c.name === 'Penjualan')!.id,
          portions: 1,
          transactionDate: today,
        })
        .expect(400);
      // Switching to an expense category drops the sale
      const moved = await s
        .patch(`/transactions/${t.body.id}`)
        .send({ categoryId: expenseCat })
        .expect(200);
      expect(moved.body).toMatchObject({ recipeId: null, portions: null });
      await s
        .patch(`/transactions/${t.body.id}`)
        .send({ categoryId: incomeCat, recipeId, portions: 4 })
        .expect(200);
      // recipeId alone keeps the current portions...
      const kept = await s
        .patch(`/transactions/${t.body.id}`)
        .send({ recipeId })
        .expect(200);
      expect(kept.body.portions).toBe(4);
      // ...but can't turn a plain entry into a sale without portions
      const plain = await s
        .post('/transactions')
        .send({ categoryId: incomeCat, amount: 1000, transactionDate: today })
        .expect(201);
      await s
        .patch(`/transactions/${plain.body.id}`)
        .send({ recipeId })
        .expect(400);
    });

    it('sums portions per menu with a trend vs the previous period, scoped', async () => {
      const res = await s
        .get('/reports/recipe-sales')
        .query({ from: today, to: today })
        .expect(200);
      expect(res.body).toEqual([
        { recipeId, portionsSold: 4, previousPortionsSold: 5, trend: 'down' },
      ]);
      const other = await b
        .get('/reports/recipe-sales')
        .query({ from: today, to: today })
        .expect(200);
      expect(other.body).toEqual([]);
    });

    it('derives notifications from price rises and loss-making menus, scoped', async () => {
      const res = await s.get('/notifications').expect(200);
      const titles = (res.body as { title: string }[]).map((n) => n.title);
      expect(titles).toContain('Harga Kopi naik 10% dari harga sebelumnya');
      expect(titles).toContain('Kopi Hitam rugi: harga jual di bawah HPP');
      expect((await b.get('/notifications').expect(200)).body).toEqual([]);
    });
  });

  describe('AI: receipt OCR + price suggestion', () => {
    let c: TestAgent;
    let businessId: string;
    let sugarId: string;
    let recipeId: string;
    // Minimal bytes with a real PNG signature (never decoded: AI is mocked)
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('fake-receipt-image'),
    ]);

    const waitForScan = async (agent: TestAgent, id: string) => {
      for (let i = 0; i < 50; i++) {
        const res = await agent.get(`/receipts/${id}`).expect(200);
        if (!['PENDING', 'PROCESSING'].includes(res.body.status)) {
          return res.body;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      throw new Error('scan never finished');
    };

    beforeAll(async () => {
      c = await register();
      businessId = (await c.get('/business/me')).body.id;
      sugarId = (
        await c
          .post('/ingredients')
          .send({
            name: 'Gula Pasir',
            purchaseUnit: 'kg',
            purchaseQty: 1,
            usageUnit: 'gram',
            purchasePrice: 15000,
          })
          .expect(201)
      ).body.id;
      recipeId = (
        await c
          .post('/recipes')
          .send({
            name: 'Teh Manis',
            yieldPortions: 10,
            targetMarginPct: 50,
            ingredients: [{ ingredientId: sugarId, quantity: 200 }],
          })
          .expect(201)
      ).body.id;
    });

    it('rejects non-image uploads', async () => {
      await c
        .post('/receipts')
        .attach('image', Buffer.from('not an image'), 'x.png')
        .expect(400);
      await c.post('/receipts').expect(400);
    });

    it('upload -> 202 -> worker extracts + matches ingredient -> DONE -> confirm', async () => {
      ai.extractReceipt.mockResolvedValueOnce({
        merchantName: 'Toko Makmur',
        date: today,
        total: 40000,
        items: [
          { name: 'GULA PASIR 1KG', qty: 2, unit: 'kg', price: 32000 },
          { name: 'Kantong plastik', qty: 1, unit: 'pcs', price: 8000 },
        ],
      });
      const up = await c
        .post('/receipts')
        .attach('image', png, 'struk.png')
        .expect(202);
      const scan = await waitForScan(c, up.body.id);
      expect(scan).toMatchObject({
        status: 'DONE',
        merchantName: 'Toko Makmur',
        detectedTotal: '40000',
      });
      expect(scan.items[0].matchedIngredient?.id).toBe(sugarId);
      expect(scan.items[1].matchedIngredient).toBeNull();

      const img = await c.get(scan.imageUrl).buffer(true).expect(200);
      expect(img.headers['content-type']).toBe('image/png');
      expect(Buffer.compare(img.body as Buffer, png)).toBe(0);

      // scoping: another business sees nothing
      await b.get(`/receipts/${scan.id}`).expect(404);
      await b.get(`/receipts/${scan.id}/image`).expect(404);
      await b
        .post(`/receipts/${scan.id}/confirm`)
        .send({ amount: 1, transactionDate: today, items: [] })
        .expect(404);

      // confirm: EXPENSE (source OCR) + ingredient price update + HPP recalc
      const trx = await c
        .post(`/receipts/${scan.id}/confirm`)
        .send({
          amount: 40000,
          transactionDate: today,
          description: 'Belanja Toko Makmur',
          items: [
            {
              name: 'Gula Pasir',
              qty: 2,
              unit: 'kg',
              price: 32000,
              ingredientId: sugarId,
              updateIngredientPrice: true,
            },
            { name: 'Kantong plastik', qty: 1, unit: 'pcs', price: 8000 },
          ],
        })
        .expect(201);
      expect(trx.body).toMatchObject({
        type: 'EXPENSE',
        source: 'OCR',
        amount: '40000',
        receiptScanId: scan.id,
      });

      const sugar = (await c.get(`/ingredients/${sugarId}`)).body;
      expect(sugar.purchasePrice).toBe('16000'); // 32.000 / 2 kg
      expect(sugar.priceLogs[0].source).toBe('OCR');
      const recipe = (await c.get(`/recipes/${recipeId}`)).body;
      expect(recipe.currentHpp).toBe('320'); // 200 g x 16 / 10 portions

      await c
        .post(`/receipts/${scan.id}/confirm`)
        .send({ amount: 40000, transactionDate: today, items: [] })
        .expect(409);
      expect((await c.get(`/receipts/${scan.id}`)).body.status).toBe(
        'CONFIRMED',
      );
    });

    it('rejects confirming with another business ingredient (rolls back)', async () => {
      ai.extractReceipt.mockResolvedValueOnce({
        merchantName: null,
        date: null,
        total: null,
        items: [],
      });
      const up = await c
        .post('/receipts')
        .attach('image', png, 'struk.png')
        .expect(202);
      await waitForScan(c, up.body.id);
      const foreign = (
        await b.post('/ingredients').send({
          name: 'Garam',
          purchaseUnit: 'kg',
          purchaseQty: 1,
          usageUnit: 'gram',
          purchasePrice: 5000,
        })
      ).body.id;
      await c
        .post(`/receipts/${up.body.id}/confirm`)
        .send({
          amount: 1000,
          transactionDate: today,
          items: [
            {
              name: 'x',
              qty: 1,
              unit: 'kg',
              price: 1000,
              ingredientId: foreign,
              updateIngredientPrice: true,
            },
          ],
        })
        .expect(400);
      expect((await c.get(`/receipts/${up.body.id}`)).body.status).toBe('DONE');
    });

    it('AI not configured -> FAILED with safe message, still confirmable manually', async () => {
      ai.extractReceipt.mockRejectedValueOnce(
        new ServiceUnavailableException('Fitur AI belum dikonfigurasi'),
      );
      const up = await c
        .post('/receipts')
        .attach('image', png, 'struk.png')
        .expect(202);
      const scan = await waitForScan(c, up.body.id);
      expect(scan).toMatchObject({
        status: 'FAILED',
        errorMessage: 'Fitur AI belum dikonfigurasi',
      });
      await c
        .post(`/receipts/${scan.id}/confirm`)
        .send({
          amount: 12000,
          transactionDate: today,
          items: [{ name: 'Telur', qty: 1, unit: 'kg', price: 12000 }],
        })
        .expect(201);
    });

    it('enforces monthly OCR quota (402)', async () => {
      const where = {
        businessId_period: { businessId, period: currentPeriod() },
      };
      await prisma.usageCounter.update({ where, data: { ocrCount: 10 } });
      await c.post('/receipts').attach('image', png, 'struk.png').expect(402);
      const counter = await prisma.usageCounter.findUniqueOrThrow({ where });
      expect(counter.ocrCount).toBe(10);
    });

    it('price suggestion: floor/recommended computed by server, stored, scoped, quota 402', async () => {
      // HPP 320 (after the receipt price update), margin 50% -> formula 640 -> 1.000; floor at 25% margin 426,67 -> 500.
      ai.suggestPrice.mockResolvedValueOnce({
        maxPrice: 1200, // rounded up to the Rp 500 step
        reasoning: 'Harga teh manis di pasaran.',
      });
      const s = await c
        .post(`/recipes/${recipeId}/price-suggestion`)
        .expect(201);
      expect(s.body).toMatchObject({
        minPrice: '500',
        recommendedPrice: '1000',
        maxPrice: '1500',
        model: 'test-model',
        hppAtRequest: '320',
      });
      expect(
        (await c.get(`/recipes/${recipeId}/price-suggestions`)).body,
      ).toHaveLength(1);
      await b.post(`/recipes/${recipeId}/price-suggestion`).expect(404);
      await b.get(`/recipes/${recipeId}/price-suggestions`).expect(404);

      await prisma.usageCounter.update({
        where: { businessId_period: { businessId, period: currentPeriod() } },
        data: { aiSuggestionCount: 5 },
      });
      const calls = ai.suggestPrice.mock.calls.length;
      await c.post(`/recipes/${recipeId}/price-suggestion`).expect(402);
      expect(ai.suggestPrice.mock.calls.length).toBe(calls); // no AI call over quota
    });

    it('price suggestion: rejects a ceiling at/below HPP, lifts a low ceiling to recommended', async () => {
      const agent = await register();
      const ing = await agent
        .post('/ingredients')
        .send({
          name: 'Daging',
          purchaseUnit: 'kg',
          purchaseQty: 1,
          usageUnit: 'gram',
          purchasePrice: 15000,
        })
        .expect(201);
      // HPP 6.000, margin 60% -> formula 15.000; floor at 30% margin 8.571,43 -> 9.000.
      const rid = (
        await agent
          .post('/recipes')
          .send({
            name: 'Steak',
            yieldPortions: 1,
            targetMarginPct: 60,
            ingredients: [{ ingredientId: ing.body.id, quantity: 400 }],
          })
          .expect(201)
      ).body.id;
      ai.suggestPrice.mockResolvedValueOnce({ maxPrice: 18, reasoning: 'x' }); // unit slip
      await agent.post(`/recipes/${rid}/price-suggestion`).expect(503);
      ai.suggestPrice.mockResolvedValueOnce({
        maxPrice: 12000,
        reasoning: 'x',
      });
      const s = await agent
        .post(`/recipes/${rid}/price-suggestion`)
        .expect(201);
      expect(s.body).toMatchObject({
        minPrice: '9000',
        recommendedPrice: '15000',
        maxPrice: '15000',
      });
    });

    it('AI failure does not burn suggestion quota', async () => {
      const agent = await register();
      const rid = (
        await agent.post('/recipes').send({
          name: 'R',
          yieldPortions: 1,
          targetMarginPct: 50,
          ingredients: [],
        })
      ).body.id;
      ai.suggestPrice.mockRejectedValueOnce(
        new ServiceUnavailableException('Layanan AI sedang tidak tersedia'),
      );
      await agent.post(`/recipes/${rid}/price-suggestion`).expect(503);
      expect(
        (await agent.get('/subscription/me')).body.usage.aiSuggestions,
      ).toBe(0);
    });
  });

  describe('anti multi-account', () => {
    const signup = (
      server: ReturnType<INestApplication['getHttpServer']>,
      email: string,
      ip?: string,
    ) =>
      signUp(
        server,
        { name: 'M', email, password: 'rahasia123' },
        ip ? { 'X-Forwarded-For': ip } : {},
      );

    it('treats gmail dots and +tags as the same mailbox', async () => {
      const base = `m${randomUUID().replaceAll('-', '').slice(0, 12)}`;
      const server = app.getHttpServer();
      await signup(server, `${base}@gmail.com`).expect(200);
      await signup(
        server,
        `${base.slice(0, 5)}.${base.slice(5)}@gmail.com`,
      ).expect(422);
      await signup(server, `${base}+promo@gmail.com`).expect(422);
      await signup(server, `${base}@googlemail.com`).expect(422);
    });

    it('rejects disposable email domains', async () => {
      await signup(
        app.getHttpServer(),
        `x-${randomUUID()}@mailinator.com`,
      ).expect(400);
    });

    it('requires a valid Turnstile token when a secret is configured', async () => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret';
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
        .useValue({
          take: async () => undefined,
          release: async () => undefined,
        })
        .compile();
      delete process.env.TURNSTILE_SECRET_KEY;
      const guarded = mod.createNestApplication();
      configureApp(guarded);
      await guarded.init();
      const verify = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async (_url, init) => {
          const sent = JSON.parse(init?.body as string) as {
            response?: string;
          };
          return Response.json({ success: sent.response === 'good' });
        });
      const server = guarded.getHttpServer();
      const post = (token?: string) =>
        signUp(
          server,
          {
            name: 'T',
            email: `ts-${randomUUID()}@test.local`,
            password: 'rahasia123',
          },
          token ? { 'x-captcha-response': token } : {},
        );
      try {
        await post().expect(400); // missing token, verifier never called
        expect(verify).not.toHaveBeenCalled();
        await post('bad').expect(403);
        await post('good').expect(200);
        verify.mockRejectedValueOnce(new Error('network down'));
        await post('good').expect(500); // fails closed
      } finally {
        verify.mockRestore();
        await guarded.close();
      }
    });

    it('caps new accounts per IP per day, and frees the slot on failure', async () => {
      process.env.MAX_SIGNUPS_PER_IP_PER_DAY = '2';
      const mod = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const capped = mod.createNestApplication();
      configureApp(capped);
      capped.getHttpAdapter().getInstance().set('trust proxy', 1);
      await capped.init();
      delete process.env.MAX_SIGNUPS_PER_IP_PER_DAY;
      const server = capped.getHttpServer();
      // Random per run: the counters live in Redis for a day.
      const randomIp = (net: string) =>
        `${net}.${Math.floor(Math.random() * 250) + 1}`;
      const ip = randomIp('203.0.113');
      const dup = `dup-${randomUUID()}@test.local`;
      await signup(server, dup, ip).expect(200);
      await signup(server, dup, ip).expect(422); // failed: must not use a slot
      await signup(server, `b-${randomUUID()}@test.local`, ip).expect(200);
      await signup(server, `c-${randomUUID()}@test.local`, ip).expect(429);
      // another IP is unaffected
      await signup(
        server,
        `d-${randomUUID()}@test.local`,
        randomIp('198.51.100'),
      ).expect(200);
      await capped.close();
    });
  });

  it('rate-limits login (429)', async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const throttled = mod.createNestApplication();
    configureApp(throttled);
    await throttled.init();
    const server = throttled.getHttpServer();
    const body = {
      email: `nope-${randomUUID()}@test.local`,
      password: 'salahsalah',
    };
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      codes.push(
        (
          await request(server)
            .post('/auth/sign-in/email')
            .set('Origin', ORIGIN)
            .send(body)
        ).status,
      );
    }
    await throttled.close();
    expect(codes).toContain(429);
  });

  describe('growth limits and cleanup', () => {
    it('caps ingredients and categories per plan (402), PRO gets more room', async () => {
      const agent = await register();
      const me = (await agent.get('/business/me')).body as { id: string };
      await prisma.ingredient.createMany({
        data: Array.from({ length: 200 }, (_, i) => ({
          businessId: me.id,
          name: `Bahan ${i}`,
          purchaseUnit: 'kg' as const,
          purchaseQty: 1,
          usageUnit: 'gram' as const,
          purchasePrice: 1000,
          pricePerUsageUnit: 1,
        })),
      });
      const ingredient = {
        name: 'Satu lagi',
        purchaseUnit: 'kg',
        purchaseQty: 1,
        usageUnit: 'gram',
        purchasePrice: 1000,
      };
      const res = await agent.post('/ingredients').send(ingredient).expect(402);
      expect(res.body.message).toMatch(/200 bahan baku paket FREE/);
      const summary = (await agent.get('/subscription/me')).body;
      expect(summary.usage.ingredients).toBe(200);
      expect(summary.limits.ingredients).toBe(200);

      await prisma.category.createMany({
        data: Array.from({ length: 24 }, (_, i) => ({
          businessId: me.id,
          name: `Kategori ${i}`,
          type: 'EXPENSE' as const,
        })),
      }); // 6 defaults + 24 = 30
      await agent
        .post('/categories')
        .send({ name: 'Ke-31', type: 'EXPENSE' })
        .expect(402);

      await prisma.subscription.updateMany({
        where: { user: { business: { id: me.id } } },
        data: { tier: 'PRO' },
      });
      await agent.post('/ingredients').send(ingredient).expect(201);
      await agent
        .post('/categories')
        .send({ name: 'Ke-31', type: 'EXPENSE' })
        .expect(201);
    });

    it('keeps at most 10 sessions per user', async () => {
      const email = `sess-${randomUUID()}@test.local`;
      const server = app.getHttpServer();
      await signUp(server, { name: 'S', email, password: 'rahasia123' }).expect(
        200,
      );
      for (let i = 0; i < 12; i++) {
        await request(server)
          .post('/auth/sign-in/email')
          .set('Origin', ORIGIN)
          .send({ email, password: 'rahasia123' })
          .expect(200);
      }
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(
        10,
      );
    });

    it('purges expired sessions, stale scans and old photos', async () => {
      const storage = app.get(StorageService, { strict: false });
      const del = vi.spyOn(storage, 'delete').mockResolvedValue(undefined);
      const agent = await register();
      const me = (await agent.get('/business/me')).body as { id: string };
      const user = await prisma.user.findFirstOrThrow({
        where: { business: { id: me.id } },
      });
      const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
      const scan = (status: 'FAILED' | 'DONE' | 'CONFIRMED', age: number) =>
        prisma.receiptScan.create({
          data: {
            businessId: me.id,
            imageKey: `${me.id}/${randomUUID()}`,
            mimeType: 'image/png',
            status,
            rawResult: { x: 1 },
            updatedAt: daysAgo(age),
          },
        });
      const oldFailed = await scan('FAILED', 8);
      const freshFailed = await scan('FAILED', 1);
      const oldDraft = await scan('DONE', 31);
      const oldConfirmed = await scan('CONFIRMED', 31);
      const freshConfirmed = await scan('CONFIRMED', 2);
      const expiredSession = await prisma.session.create({
        data: {
          userId: user.id,
          token: randomUUID(),
          expiresAt: daysAgo(1),
        },
      });
      await prisma.verification.create({
        data: { identifier: 'x', value: 'y', expiresAt: daysAgo(1) },
      });

      try {
        const result = await app.get(MaintenanceService).purge();
        expect(result.sessions).toBeGreaterThanOrEqual(1);
        expect(result.verifications).toBeGreaterThanOrEqual(1);
        const left = async (id: string) =>
          prisma.receiptScan.findUnique({ where: { id } });
        expect(await left(oldFailed.id)).toBeNull();
        expect(await left(freshFailed.id)).not.toBeNull();
        expect(await left(oldDraft.id)).toBeNull();
        // saved data stays, only the photo goes
        const purged = await left(oldConfirmed.id);
        expect(purged).toMatchObject({ imageKey: null, rawResult: null });
        expect((await left(freshConfirmed.id))?.imageKey).not.toBeNull();
        expect(
          await prisma.session.findUnique({ where: { id: expiredSession.id } }),
        ).toBeNull();
        // the active session still works
        await agent.get('/business/me').expect(200);
        expect(del).toHaveBeenCalledWith(oldFailed.imageKey);
        expect(del).not.toHaveBeenCalledWith(freshFailed.imageKey);

        // a photo that cannot be deleted keeps its row for the next run
        const stuck = await scan('FAILED', 9);
        del.mockRejectedValueOnce(new Error('s3 down'));
        await app.get(MaintenanceService).purge();
        expect(await left(stuck.id)).not.toBeNull();
        await app.get(MaintenanceService).purge();
        expect(await left(stuck.id)).toBeNull();
      } finally {
        del.mockRestore();
      }
    });

    it('serves no photo once purged, scan data stays readable', async () => {
      const agent = await register();
      const me = (await agent.get('/business/me')).body as { id: string };
      const gone = await prisma.receiptScan.create({
        data: {
          businessId: me.id,
          imageKey: null,
          mimeType: 'image/png',
          status: 'CONFIRMED',
          merchantName: 'Toko X',
        },
      });
      const res = await agent.get(`/receipts/${gone.id}`).expect(200);
      expect(res.body).toMatchObject({
        merchantName: 'Toko X',
        imageUrl: null,
      });
      await agent.get(`/receipts/${gone.id}/image`).expect(404);
    });
  });

  it('caps AI provider calls per day app-wide (503), 0 = unlimited', async () => {
    const budget = new AiBudget(2, `test-ai-${randomUUID()}`);
    const unlimited = new AiBudget(0, `test-ai-${randomUUID()}`);
    try {
      await budget.take();
      await budget.take();
      await expect(budget.take()).rejects.toMatchObject({ status: 503 });
      for (let i = 0; i < 5; i++) await unlimited.take();
    } finally {
      budget.disconnect();
      unlimited.disconnect();
    }
  });
});
